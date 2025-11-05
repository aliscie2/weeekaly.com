import { Identity } from '@dfinity/agent';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { AUTH_CONSTANTS, AUTH_ERRORS } from './authConstants';

export interface OAuthProvider {
  name: string;
  client_id: string;
  authorization_url: string;
  token_url: string;
  scope: string;
  response_type: string;
}

/**
 * Get available OAuth providers from backend canister
 * @param backendActor - The backend canister actor instance
 * @returns Promise resolving to array of available OAuth providers
 */
export async function getProviders(backendActor: any): Promise<OAuthProvider[]> {
  return await backendActor.get_providers();
}

/**
 * Generate PKCE (Proof Key for Code Exchange) challenge
 * Used for authorization code flow security
 * @returns Object containing code verifier and challenge
 * @private
 */
async function generatePKCE() {
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const challenge = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return { verifier, challenge };
}

/**
 * Authenticate user with OAuth provider and create IC delegation identity
 * 
 * This function:
 * 1. Opens OAuth popup window
 * 2. Waits for user authentication
 * 3. Receives ID token from callback
 * 4. Creates delegation with backend canister
 * 5. Returns authenticated Identity
 * 
 * @param provider - OAuth provider configuration (e.g., Google)
 * @param backendActor - Backend canister actor for delegation creation
 * @param onSuccess - Optional callback on successful authentication
 * @param onError - Optional callback on authentication error
 * @returns Promise resolving to Identity on success, null on failure
 * 
 * @example
 * ```typescript
 * const identity = await loginWithOAuth(
 *   googleProvider,
 *   backendActor,
 *   () => console.log('Success!'),
 *   (err) => console.error(err)
 * );
 * ```
 */
export async function loginWithOAuth(
  provider: OAuthProvider,
  backendActor: any,
  onSuccess?: () => void,
  onError?: (error: Error) => void
): Promise<Identity | null> {
  try {
    // 1. Generate session key pair
    const sessionKey = Ed25519KeyIdentity.generate();
    const sessionPublicKey = sessionKey.getPublicKey().toDer();
    
    // 2. Generate state and nonce
    const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const nonce = Array.from(new Uint8Array(sessionPublicKey))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // 3. Build authorization URL
    const authUrl = new URL(provider.authorization_url);
    const params: Record<string, string> = {
      client_id: provider.client_id,
      redirect_uri: `${window.location.origin}${AUTH_CONSTANTS.OAUTH_CALLBACK_PATH}`,
      response_type: provider.response_type,
      scope: provider.scope,
      state: state,
      nonce: nonce,
    };
    
    // Only add PKCE for code flow (not for id_token implicit flow)
    if (provider.response_type.includes('code')) {
      const { challenge } = await generatePKCE();
      params.code_challenge = challenge;
      params.code_challenge_method = 'S256';
    }
    
    authUrl.search = new URLSearchParams(params).toString();
    
    // 5. Open popup
    const width = AUTH_CONSTANTS.POPUP_WIDTH;
    const height = AUTH_CONSTANTS.POPUP_HEIGHT;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      authUrl.href,
      'OAuth Login',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    if (!popup) {
      throw new Error(AUTH_ERRORS.POPUP_BLOCKED);
    }
    
    // 6. Wait for callback
    const token = await new Promise<string>((resolve, reject) => {
      const messageListener = (event: MessageEvent) => {
        if (event.source === popup && event.origin === window.location.origin) {
          window.removeEventListener('message', messageListener);
          popup?.close();
          
          if (event.data.type === AUTH_CONSTANTS.MESSAGE_TYPE_SUCCESS) {
            if (event.data.state !== state) {
              reject(new Error(AUTH_ERRORS.INVALID_STATE));
            } else {
              resolve(event.data.id_token);
            }
          } else if (event.data.type === AUTH_CONSTANTS.MESSAGE_TYPE_ERROR) {
            reject(new Error(event.data.error || AUTH_ERRORS.AUTH_FAILED));
          }
        }
      };
      window.addEventListener('message', messageListener);
      
      // Timeout after configured duration
      setTimeout(() => {
        window.removeEventListener('message', messageListener);
        if (popup && !popup.closed) {
          popup.close();
        }
        reject(new Error(AUTH_ERRORS.AUTH_TIMEOUT));
      }, AUTH_CONSTANTS.OAUTH_TIMEOUT_MS);
    });
    
    // 7. Extract email and user info from JWT token
    const jwtParts = token.split('.');
    if (jwtParts.length === 3) {
      try {
        const payload = JSON.parse(atob(jwtParts[1].replace(/-/g, '+').replace(/_/g, '/')));
        
        // Store email and user info in localStorage for later retrieval
        localStorage.setItem(AUTH_CONSTANTS.STORAGE_KEY_USER_EMAIL, payload.email || '');
        localStorage.setItem(AUTH_CONSTANTS.STORAGE_KEY_USER_NAME, payload.name || '');
        localStorage.setItem(AUTH_CONSTANTS.STORAGE_KEY_USER_ID, payload.sub || '');
        localStorage.setItem(AUTH_CONSTANTS.STORAGE_KEY_USER_PICTURE, payload.picture || '');
      } catch (e) {
        console.error('❌ [OAuth] Failed to parse JWT payload:', e);
      }
    }
    
    // 8. Prepare delegation
    const prepareResult = await backendActor.prepare_delegation({
      provider: AUTH_CONSTANTS.DEFAULT_PROVIDER,
      id_token: token,
      origin: window.location.origin,
      session_public_key: Array.from(new Uint8Array(sessionPublicKey)),
      max_time_to_live: AUTH_CONSTANTS.MAX_TIME_TO_LIVE_NS,
      targets: [],
    });
    
    if ('Err' in prepareResult) {
      throw new Error(prepareResult.Err);
    }
    
    const { expire_at } = prepareResult.Ok;
    
    // 9. Get delegation
    const delegationResult = await backendActor.get_delegation({
      provider: AUTH_CONSTANTS.DEFAULT_PROVIDER,
      origin: window.location.origin,
      session_public_key: Array.from(new Uint8Array(sessionPublicKey)),
      expire_at: expire_at,
      targets: [],
    });
    
    if ('Err' in delegationResult) {
      throw new Error(delegationResult.Err);
    }
    
    // 10. Use session key directly as identity
    // TODO: Implement proper delegation chain with threshold ECDSA signing
    const identity = sessionKey;
    
    onSuccess?.();
    return identity;
    
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    return null;
  }
}
