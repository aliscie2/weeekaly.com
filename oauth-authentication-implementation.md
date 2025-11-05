# OAuth Authentication Implementation

This document shows how OAuth authentication was implemented in this project, following the IC OAuth guide.

## What We Built

A Google OAuth authentication system that:
- Allows users to sign in with their Google account
- Creates IC delegation identities for authenticated users
- Stores user info (email, name, picture) for the application
- Manages sessions on the backend canister

---

## Architecture Overview

```
User clicks "Sign in with Google"
    ↓
Frontend opens Google OAuth popup
    ↓
User authenticates with Google
    ↓
Google redirects to /oauth-callback.html with id_token
    ↓
Callback sends token to parent window
    ↓
Frontend calls backend.prepare_delegation(id_token)
    ↓
Backend verifies JWT and stores session
    ↓
Frontend calls backend.get_delegation()
    ↓
Backend returns signed delegation
    ↓
Frontend creates DelegationIdentity
    ↓
User is authenticated!
```

---

## Implementation Details

### 1. Backend Canister (Rust)

**File:** `src/backend/src/lib.rs`

**Key Components:**

#### Provider Configuration
```rust
// Google OAuth provider config stored in canister
#[init]
fn init() {
    PROVIDERS.with(|p| {
        let mut providers = p.borrow_mut();
        providers.insert("google".to_string(), OAuthProvider {
            name: "Google".to_string(),
            client_id: GOOGLE_CLIENT_ID.to_string(),
            authorization_url: "https://accounts.google.com/o/oauth2/v2/auth".to_string(),
            token_url: "https://oauth2.googleapis.com/token".to_string(),
            scope: "openid email profile".to_string(),
            response_type: "id_token".to_string(),
        });
    });
}
```

#### Session Storage
```rust
// Store sessions by session public key
thread_local! {
    static SESSIONS: RefCell<HashMap<Vec<u8>, SessionData>> = RefCell::new(HashMap::new());
}

struct SessionData {
    user_id: String,        // Google user ID (sub claim)
    email: Option<String>,  // User email
    name: Option<String>,   // User name
    origin: String,         // App origin
    expires_at: u64,        // Expiration timestamp
    targets: Option<Vec<Principal>>,
}
```

#### Main Functions

**1. Get Providers**
```rust
#[query]
fn get_providers() -> Vec<OAuthProvider>
```
Returns list of configured OAuth providers (just Google in our case).

**2. Prepare Delegation**
```rust
#[update]
async fn prepare_delegation(req: PrepareDelegationRequest) -> Result<PrepareDelegationResponse, String>
```
- Verifies JWT token (⚠️ currently without signature verification - dev only!)
- Extracts user info (email, name, user_id)
- Stores session data
- Returns expiration time

**3. Get Delegation**
```rust
#[query]
fn get_delegation(req: GetDelegationRequest) -> Result<GetDelegationResponse, String>
```
- Retrieves stored session
- Creates delegation
- Signs delegation (⚠️ currently dummy signature - dev only!)
- Returns signed delegation

**4. Session Management**
```rust
#[update]
fn cleanup_expired_sessions() -> u64  // Remove expired sessions

#[query]
fn get_session_count() -> u64  // Get active session count

#[update]
fn logout(session_public_key: Vec<u8>) -> Result<(), String>  // Remove session
```

**5. User Info**
```rust
#[query]
fn get_user_info() -> UserInfo  // Get authenticated user's info
```

---

### 2. Frontend Implementation

#### Constants (`src/frontend/utils/authConstants.ts`)

All magic numbers extracted to constants:
```typescript
export const AUTH_CONSTANTS = {
  MAX_TIME_TO_LIVE_NS: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000), // 7 days
  OAUTH_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  POPUP_WIDTH: 500,
  POPUP_HEIGHT: 600,
  OAUTH_CALLBACK_PATH: '/oauth-callback.html',
  DEFAULT_PROVIDER: 'google',
  // Storage keys
  STORAGE_KEY_USER_EMAIL: 'ic-user-email',
  STORAGE_KEY_USER_NAME: 'ic-user-name',
  STORAGE_KEY_USER_ID: 'ic-user-id',
  STORAGE_KEY_USER_PICTURE: 'ic-user-picture',
  // ... more constants
};
```

#### OAuth Flow (`src/frontend/utils/oauthDelegation.ts`)

**Main Function:**
```typescript
export async function loginWithOAuth(
  provider: OAuthProvider,
  backendActor: any,
  onSuccess?: () => void,
  onError?: (error: Error) => void
): Promise<Identity | null>
```

**Flow Steps:**

1. **Generate Session Key**
```typescript
const sessionKey = Ed25519KeyIdentity.generate();
const sessionPublicKey = sessionKey.getPublicKey().toDer();
```

2. **Generate State & Nonce**
```typescript
const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');

const nonce = Array.from(new Uint8Array(sessionPublicKey))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');
```

3. **Build Authorization URL**
```typescript
const authUrl = new URL(provider.authorization_url);
const params = {
  client_id: provider.client_id,
  redirect_uri: `${window.location.origin}${AUTH_CONSTANTS.OAUTH_CALLBACK_PATH}`,
  response_type: provider.response_type,
  scope: provider.scope,
  state: state,
  nonce: nonce,
};
```

4. **Open Popup**
```typescript
const popup = window.open(
  authUrl.href,
  'OAuth Login',
  `width=${width},height=${height},left=${left},top=${top}`
);
```

5. **Wait for Callback**
```typescript
const token = await new Promise<string>((resolve, reject) => {
  const messageListener = (event: MessageEvent) => {
    if (event.source === popup && event.origin === window.location.origin) {
      if (event.data.type === AUTH_CONSTANTS.MESSAGE_TYPE_SUCCESS) {
        if (event.data.state !== state) {
          reject(new Error(AUTH_ERRORS.INVALID_STATE));
        } else {
          resolve(event.data.id_token);
        }
      }
    }
  };
  window.addEventListener('message', messageListener);
  setTimeout(() => reject(new Error(AUTH_ERRORS.AUTH_TIMEOUT)), 
    AUTH_CONSTANTS.OAUTH_TIMEOUT_MS);
});
```

6. **Extract User Info from JWT**
```typescript
const jwtParts = token.split('.');
const payload = JSON.parse(atob(jwtParts[1].replace(/-/g, '+').replace(/_/g, '/')));

// Store in localStorage
localStorage.setItem(AUTH_CONSTANTS.STORAGE_KEY_USER_EMAIL, payload.email || '');
localStorage.setItem(AUTH_CONSTANTS.STORAGE_KEY_USER_NAME, payload.name || '');
localStorage.setItem(AUTH_CONSTANTS.STORAGE_KEY_USER_ID, payload.sub || '');
localStorage.setItem(AUTH_CONSTANTS.STORAGE_KEY_USER_PICTURE, payload.picture || '');
```

7. **Prepare Delegation**
```typescript
const prepareResult = await backendActor.prepare_delegation({
  provider: AUTH_CONSTANTS.DEFAULT_PROVIDER,
  id_token: token,
  origin: window.location.origin,
  session_public_key: Array.from(new Uint8Array(sessionPublicKey)),
  max_time_to_live: AUTH_CONSTANTS.MAX_TIME_TO_LIVE_NS,
  targets: [],
});
```

8. **Get Delegation**
```typescript
const delegationResult = await backendActor.get_delegation({
  provider: AUTH_CONSTANTS.DEFAULT_PROVIDER,
  origin: window.location.origin,
  session_public_key: Array.from(new Uint8Array(sessionPublicKey)),
  expire_at: prepareResult.Ok.expire_at,
  targets: [],
});
```

9. **Return Identity**
```typescript
// Currently returns session key directly
// TODO: Implement proper delegation chain
const identity = sessionKey;
return identity;
```

#### OAuth Callback (`public/oauth-callback.html`)

Simple HTML page that receives OAuth redirect:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OAuth Callback</title>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p>Processing authentication...</p>
  </div>
  
  <script>
    window.onload = () => {
      // Parse URL for tokens
      const paramsHash = new URLSearchParams(window.location.hash.slice(1));
      const id_token = paramsHash.get('id_token');
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      
      // Send to parent window
      if (id_token) {
        window.opener.postMessage({
          type: 'oauth_success',
          id_token: id_token,
          state: paramsHash.get('state'),
        }, window.location.origin);
      } else if (code) {
        window.opener.postMessage({
          type: 'oauth_success',
          code: code,
          state: params.get('state'),
        }, window.location.origin);
      }
      
      setTimeout(() => window.close(), 100);
    };
  </script>
</body>
</html>
```

#### React Hook (`src/frontend/hooks/useOAuthIdentity.ts`)

Provides authentication state management:

```typescript
export function useOAuthIdentity() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);

  // Restore identity on mount
  useEffect(() => {
    const restoredIdentity = restoreIdentity();
    if (restoredIdentity) {
      setIdentity(restoredIdentity);
    }
    loadProviders();
    setIsLoading(false);
  }, []);

  const login = async (providerName: string = 'google'): Promise<boolean> => {
    const provider = providers.find(p => p.name.toLowerCase() === providerName);
    const newIdentity = await loginWithOAuth(provider, backendActor);
    if (newIdentity) {
      setIdentity(newIdentity);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIdentity(null);
    clearIdentity();
  };

  return {
    identity,
    isAuthenticated: identity !== null,
    isLoading,
    error,
    login,
    logout,
    providers,
  };
}
```

#### App Integration (`src/frontend/App.tsx`)

```typescript
export default function App() {
  const { login: loginWithOAuth, identity, isAuthenticated } = useOAuthIdentity();

  // Update backend actor when identity changes
  useEffect(() => {
    if (isAuthenticated && identity) {
      setAuthenticatedActor(identity);
      
      // Get user info
      backendActor.get_user_info().then((userInfo) => {
        console.log('User authenticated:', userInfo);
      });
    }
  }, [isAuthenticated, identity]);

  // Login button handler
  const handleLogin = async () => {
    const success = await loginWithOAuth('google');
    if (success) {
      toast.success('Successfully authenticated!');
    } else {
      toast.error('Login failed. Please try again.');
    }
  };

  return (
    <Button onClick={handleLogin}>
      Sign in with Google
    </Button>
  );
}
```

---

## Google OAuth Configuration

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project or select existing
3. Navigate to "APIs & Services" > "Credentials"
4. Create OAuth 2.0 Client ID:
   - **Application type:** Web application
   - **Authorized JavaScript origins:** 
     - `http://localhost:5173` (development)
     - `https://your-canister-id.ic0.app` (production)
   - **Authorized redirect URIs:**
     - `http://localhost:5173/oauth-callback.html` (development)
     - `https://your-canister-id.ic0.app/oauth-callback.html` (production)

5. Copy Client ID and update in backend:
```rust
const GOOGLE_CLIENT_ID: &str = "YOUR-CLIENT-ID.apps.googleusercontent.com";
```

### 2. OAuth Consent Screen

Configure the consent screen:
- **App name:** Your app name
- **User support email:** Your email
- **Scopes:** `openid`, `email`, `profile`
- **Authorized domains:** Your domain

---

## Security Notes

### ⚠️ Current Limitations (Development Only)

1. **JWT Signature NOT Verified**
   - Backend accepts any JWT without verifying signature
   - Must implement JWKS verification before production
   - See: `verify_jwt_token()` in `lib.rs`

2. **Delegation NOT Properly Signed**
   - Uses dummy hash instead of threshold ECDSA
   - Must implement proper signing before production
   - See: `sign_delegation()` in `lib.rs`

3. **Delegation Chain Storage Disabled**
   - Users must re-login on page refresh
   - Serialization issue with targets field
   - See: `useOAuthIdentity.ts` line 73

### ✅ Security Features Implemented

- ✅ State parameter for CSRF protection
- ✅ Nonce tied to session key
- ✅ Origin validation
- ✅ Session expiration (7 days)
- ✅ Secure message passing (origin check)

---

## File Structure

```
src/
├── backend/
│   ├── Cargo.toml                    # Added sha2, base64 dependencies
│   └── src/
│       └── lib.rs                    # OAuth backend implementation
├── frontend/
│   ├── App.tsx                       # Login integration
│   ├── hooks/
│   │   └── useOAuthIdentity.ts      # Authentication hook
│   └── utils/
│       ├── authConstants.ts          # Constants (NEW)
│       ├── oauthDelegation.ts        # OAuth flow logic
│       ├── identityStorage.ts        # Identity persistence
│       └── actor.ts                  # Backend actor management
└── public/
    └── oauth-callback.html           # OAuth redirect handler
```

---

## Testing

### Local Development

1. **Start dfx:**
```bash
dfx start --clean
```

2. **Deploy backend:**
```bash
dfx deploy backend
```

3. **Start frontend:**
```bash
npm run dev
```

4. **Test login:**
- Click "Sign in with Google"
- Complete Google OAuth flow
- Check console for user info
- Verify session in backend

### Check Session Count
```bash
dfx canister call backend get_session_count
```

### Cleanup Expired Sessions
```bash
dfx canister call backend cleanup_expired_sessions
```

---

## Next Steps

### Before Production

1. **Implement JWT Signature Verification**
   - Fetch Google's JWKS
   - Verify JWT signature
   - Validate all claims

2. **Implement Threshold ECDSA Signing**
   - Use IC's `sign_with_ecdsa` API
   - Properly sign delegations

3. **Fix Delegation Chain Storage**
   - Resolve serialization issue
   - Enable session persistence

4. **Add Tests**
   - Unit tests for JWT parsing
   - Integration tests for OAuth flow
   - Security tests

### Nice to Have

- Token refresh functionality
- Multiple OAuth providers (GitHub, Microsoft)
- Session management UI
- Analytics and monitoring

---

## Resources

- **Original Guide:** `oauth-authentication-guide.md` (from friend)
- **Optimization Plan:** `optimizationPlan.md`
- **Changes Summary:** `OPTIMIZATION_SUMMARY.md`
- **Google OAuth Docs:** https://developers.google.com/identity/protocols/oauth2
- **IC Documentation:** https://internetcomputer.org/docs

---

## Questions?

If you have questions about this implementation:

1. Check the original guide (`oauth-authentication-guide.md`)
2. Review the optimization plan (`optimizationPlan.md`)
3. Look at the code comments (JSDoc)
4. Check security warnings in backend code

---

**Implementation Status:** ✅ Working (Development Only)  
**Production Ready:** ❌ No (Security fixes needed)  
**Last Updated:** November 2025
