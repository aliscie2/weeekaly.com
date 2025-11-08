import { Ed25519KeyIdentity } from '@dfinity/identity';
import { AUTH_CONSTANTS } from './authConstants';

const STORAGE_KEY_SESSION_KEY = AUTH_CONSTANTS.STORAGE_KEY_SESSION_KEY;

/**
 * Store session key in localStorage for session persistence
 * 
 * Currently using session key directly as identity (not delegation chain).
 * This allows users to remain authenticated across page reloads.
 * 
 * @param sessionKey - The Ed25519KeyIdentity session key to store
 * @throws Will log error if storage fails but won't throw
 */
export function storeSessionKey(sessionKey: Ed25519KeyIdentity): void {
  try {
    localStorage.setItem(STORAGE_KEY_SESSION_KEY, JSON.stringify(sessionKey.toJSON()));
    console.log('✅ [identityStorage] Session key stored successfully');
  } catch (error) {
    console.error('❌ [identityStorage] Failed to store session key:', error);
  }
}

/**
 * Restore session key from localStorage
 * 
 * Attempts to restore a previously stored session key.
 * 
 * @returns Ed25519KeyIdentity if valid stored key exists, null otherwise
 * @throws Will log error and return null if restoration fails
 */
export function restoreSessionKey(): Ed25519KeyIdentity | null {
  try {
    const sessionKeyJson = localStorage.getItem(STORAGE_KEY_SESSION_KEY);

    if (!sessionKeyJson) {
      return null;
    }

    const sessionKey = Ed25519KeyIdentity.fromJSON(sessionKeyJson);
    console.log('✅ [identityStorage] Session key restored successfully');
    return sessionKey;
  } catch (error) {
    console.error('❌ [identityStorage] Failed to restore session key:', error);
    clearSessionKey();
    return null;
  }
}

/**
 * Clear stored session key from localStorage
 * 
 * Removes the session key from storage, effectively logging out the user.
 * Safe to call even if no key is stored.
 */
export function clearSessionKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_SESSION_KEY);
    console.log('✅ [identityStorage] Session key cleared from storage');
  } catch (error) {
    console.error('❌ [identityStorage] Failed to clear session key:', error);
  }
}

/**
 * Clear all user-related data from localStorage
 * 
 * Removes session key and user profile information.
 * Use this for complete logout.
 */
export function clearAllUserData(): void {
  clearSessionKey();
  
  // Clear user profile data
  const userDataKeys = [
    AUTH_CONSTANTS.STORAGE_KEY_USER_EMAIL,
    AUTH_CONSTANTS.STORAGE_KEY_USER_NAME,
    AUTH_CONSTANTS.STORAGE_KEY_USER_ID,
    AUTH_CONSTANTS.STORAGE_KEY_USER_PICTURE,
    'ic-oauth-code'
  ];
  
  userDataKeys.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`❌ [identityStorage] Failed to clear ${key}:`, error);
    }
  });
  
  console.log('✅ [identityStorage] All user data cleared from storage');
}
