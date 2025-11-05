# OAuth Implementation Watchouts & Known Issues

This document tracks issues encountered during OAuth implementation and their solutions.

## 🚨 QUICK FIX

**Error:** `Login error: Error: Provider not found: google`

**Solution:** Redeploy the backend!
```bash
dfx deploy backend --mode reinstall --yes
```

The `get_providers()` function exists in the code but the old version is still running.

---

## 🔴 CRITICAL ISSUE #1: Missing `get_providers()` Function

### Error
```
Login error: Error: Provider not found: google
at login (useOAuthIdentity.ts:79:15)
```

### Root Cause
The backend canister HAS the `get_providers()` function, but it wasn't redeployed after recent changes.

**Frontend calls:**
```typescript
// src/frontend/utils/oauthDelegation.ts
export async function getProviders(backendActor: any): Promise<OAuthProvider[]> {
  return await backendActor.get_providers();  // Function exists but old version deployed
}
```

**Backend has:**
- ✅ `init()` - Initializes providers in HashMap (line ~100)
- ✅ `get_providers()` - Returns provider list (line ~180)
- ❌ **But old version is deployed!**

### Impact
- Frontend cannot load provider list
- `providers` array stays empty
- Login fails with "Provider not found: google"

### Solution
**The function already exists!** You just need to redeploy the backend:

```bash
dfx deploy backend --mode reinstall --yes
```

### Why This Happened
After adding the `get_providers()` function during optimization, the backend wasn't redeployed. The running canister still has the old code without this function.

### Verification
After redeploying, verify the function exists:
```bash
dfx canister call backend get_providers
```

You should see:
```
(
  vec {
    record {
      name = "Google";
      client_id = "1094222481488-...";
      ...
    };
  },
)
```

---

## 🟡 ISSUE #2: Provider Name Case Sensitivity

### Problem
Frontend searches for provider by lowercase name:
```typescript
const provider = providers.find(
  p => p.name.toLowerCase() === providerName.toLowerCase()
);
```

But backend stores with capital "G":
```rust
name: "Google".to_string(),
```

### Status
✅ **Not an issue** - Frontend correctly handles case-insensitive matching

### Why It's Documented
Good defensive programming, but worth noting for future providers.

---

## 🟡 ISSUE #3: Async Provider Loading Race Condition

### Problem
```typescript
const login = async (providerName: string = 'google'): Promise<boolean> => {
  // Load providers if not loaded
  if (providers.length === 0) {
    await loadProviders();  // ⚠️ Race condition possible
  }
  
  const provider = providers.find(...);  // May still be empty!
```

### Root Cause
`loadProviders()` updates state asynchronously, but we immediately try to find the provider.

### Current Workaround
The `loadProviders()` function is called in `useEffect` on mount, so providers should be loaded before user clicks login.

### Better Solution
```typescript
const login = async (providerName: string = 'google'): Promise<boolean> => {
  setIsLoading(true);
  setError(null);

  try {
    // Always reload providers to ensure fresh data
    await loadProviders();
    
    // Wait for state update by re-fetching directly
    const providerList = await getProviders(backendActor);
    const provider = providerList.find(
      p => p.name.toLowerCase() === providerName.toLowerCase()
    );
    
    if (!provider) {
      throw new Error(`${AUTH_ERRORS.PROVIDER_NOT_FOUND}: ${providerName}`);
    }
    
    // Continue with login...
```

### Status
🟡 **Workaround exists** but should be improved

---

## 🟢 ISSUE #4: Backend Not Redeployed After Changes

### Problem
After adding new functions or making changes to backend, frontend still calls old version.

### Solution
Always redeploy backend after changes:
```bash
dfx deploy backend --mode reinstall --yes
```

### Why `--mode reinstall`?
- Clears all state (sessions, providers)
- Ensures `init()` runs again
- Fresh start for testing

### When to Use
- After adding new functions
- After changing provider configuration
- After modifying types/structs
- When debugging weird behavior

---

## 🔵 ISSUE #5: Providers Not Persisting Across Upgrades

### Problem
Providers are stored in `thread_local!` which is volatile memory.

```rust
thread_local! {
    static PROVIDERS: RefCell<HashMap<String, OAuthProvider>> = RefCell::new(HashMap::new());
}
```

### Impact
- Providers lost on canister upgrade
- Must use `--mode reinstall` to reinitialize
- Not suitable for production

### Solution (Future)
Use stable storage:
```rust
use ic_stable_structures::{StableBTreeMap, memory_manager::MemoryId};

// In stable memory
static PROVIDERS: StableBTreeMap<String, OAuthProvider> = ...;
```

### Status
🔵 **Known limitation** - Document for production deployment

---

## 🟣 ISSUE #6: Error Messages Not User-Friendly

### Problem
Technical errors shown to users:
```
Error: Provider not found: google
```

### Better Approach
```typescript
if (!provider) {
  throw new Error('Unable to connect to Google. Please try again or contact support.');
}
```

### Status
🟣 **Enhancement** - Low priority

---

## 📋 Checklist: Before Testing OAuth

Before clicking "Sign in with Google", verify:

- [ ] Backend deployed: `dfx deploy backend --mode reinstall --yes`
- [ ] Frontend running: `npm run dev`
- [ ] Console shows no errors
- [ ] Check backend has providers:
  ```bash
  dfx canister call backend get_providers
  ```
- [ ] Google OAuth credentials configured
- [ ] Redirect URI matches in Google Console

---

## 🔍 Debugging Steps

### 1. Check if backend has `get_providers()`
```bash
dfx canister call backend get_providers
```

**Expected output:**
```
(
  vec {
    record {
      name = "Google";
      client_id = "1094222481488-...";
      authorization_url = "https://accounts.google.com/o/oauth2/v2/auth";
      token_url = "https://oauth2.googleapis.com/token";
      scope = "openid email profile";
      response_type = "id_token";
    };
  },
)
```

**If error:** Function doesn't exist - add it to backend

### 2. Check frontend can call backend
Open browser console:
```javascript
// Get backend actor
const actor = window.ic.plug.agent._actor;

// Try calling get_providers
actor.get_providers().then(console.log).catch(console.error);
```

### 3. Check provider loading in hook
Add console.log to `useOAuthIdentity.ts`:
```typescript
const loadProviders = async () => {
  try {
    console.log('🔄 Loading providers...');
    const providerList = await getProviders(backendActor);
    console.log('✅ Providers loaded:', providerList);
    setProviders(providerList);
  } catch (err) {
    console.error('❌ Failed to load providers:', err);
  }
};
```

### 4. Check providers state before login
```typescript
const login = async (providerName: string = 'google'): Promise<boolean> => {
  console.log('🔐 Login called with:', providerName);
  console.log('📋 Current providers:', providers);
  console.log('📊 Providers count:', providers.length);
  
  // ... rest of function
```

---

## 🛠️ Quick Fixes

### Fix #1: Redeploy Backend

**The function already exists in the code!**

**Just redeploy:**
```bash
dfx deploy backend --mode reinstall --yes
```

**Verify it worked:**
```bash
dfx canister call backend get_providers
```

**Expected output:**
```
(
  vec {
    record {
      name = "Google";
      client_id = "1094222481488-rrlvvr8q7mjaq9vmave57fkfrjcd9g3a.apps.googleusercontent.com";
      authorization_url = "https://accounts.google.com/o/oauth2/v2/auth";
      token_url = "https://oauth2.googleapis.com/token";
      scope = "openid email profile";
      response_type = "id_token";
    };
  },
)
```

### Fix #2: Improve Provider Loading

**File:** `src/frontend/hooks/useOAuthIdentity.ts`

**Replace login function:**
```typescript
const login = async (providerName: string = AUTH_CONSTANTS.DEFAULT_PROVIDER): Promise<boolean> => {
  setIsLoading(true);
  setError(null);

  try {
    // Fetch providers directly to avoid state race condition
    const providerList = await getProviders(backendActor);
    
    if (providerList.length === 0) {
      throw new Error('No authentication providers available');
    }

    const provider = providerList.find(
      p => p.name.toLowerCase() === providerName.toLowerCase()
    );
    
    if (!provider) {
      throw new Error(`${AUTH_ERRORS.PROVIDER_NOT_FOUND}: ${providerName}`);
    }

    const newIdentity = await loginWithOAuth(
      provider,
      backendActor,
      () => {},
      (err) => {
        console.error('❌ Login failed:', err);
        setError(err.message);
      }
    );

    if (newIdentity) {
      setIdentity(newIdentity);
      return true;
    }
    return false;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    setError(message);
    console.error('Login error:', err);
    return false;
  } finally {
    setIsLoading(false);
  }
};
```

---

## 📚 Related Documentation

- **Implementation Guide:** `oauth-authentication-implementation.md`
- **Optimization Plan:** `optimizationPlan.md`
- **Changes Summary:** `OPTIMIZATION_SUMMARY.md`

---

## 🎯 Prevention Checklist

To avoid similar issues in the future:

- [ ] Always check backend has required functions before frontend calls them
- [ ] Test backend functions with `dfx canister call` before integrating
- [ ] Add console.log statements during development
- [ ] Redeploy backend after any changes
- [ ] Use `--mode reinstall` when testing initialization
- [ ] Document all backend functions in implementation guide
- [ ] Add error handling for missing functions
- [ ] Test with empty state (no providers loaded)

---

## 🔄 Issue Status Legend

- 🔴 **CRITICAL** - Blocks functionality, must fix immediately
- 🟡 **WARNING** - Works but has issues, should fix soon
- 🟢 **INFO** - Good to know, not blocking
- 🔵 **FUTURE** - Known limitation, fix before production
- 🟣 **ENHANCEMENT** - Nice to have, low priority

---

**Last Updated:** November 2025  
**Status:** Issue #1 identified, solution provided  
**Next Action:** Add `get_providers()` function to backend
