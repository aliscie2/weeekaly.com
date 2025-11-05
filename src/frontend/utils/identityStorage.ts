import { DelegationChain, DelegationIdentity, Ed25519KeyIdentity } from '@dfinity/identity';
import { AUTH_CONSTANTS, TIME_UNITS } from './authConstants';

const STORAGE_KEY = AUTH_CONSTANTS.STORAGE_KEY_DELEGATION;

/**
 * Store delegation identity in localStorage for session persistence
 * 
 * Serializes the delegation chain to JSON and stores it in localStorage.
 * This allows users to remain authenticated across page reloads.
 * 
 * @param identity - The DelegationIdentity to store
 * @throws Will log error if storage fails but won't throw
 */
export function storeIdentity(identity: DelegationIdentity): void {
  try {
    const delegationChain = identity.getDelegation();
    const delegationJson = delegationChain.toJSON();

    // Store delegation chain
    localStorage.setItem(STORAGE_KEY, JSON.stringify(delegationJson));
  } catch (error) {
    console.error('❌ [identityStorage] Failed to store identity:', error);
  }
}

/**
 * Restore delegation identity from localStorage
 * 
 * Attempts to restore a previously stored delegation identity.
 * Validates that the delegation hasn't expired before returning.
 * 
 * @returns DelegationIdentity if valid stored identity exists, null otherwise
 * @throws Will log error and return null if restoration fails
 */
export function restoreIdentity(): DelegationIdentity | null {
  try {
    const delegationJson = localStorage.getItem(STORAGE_KEY);

    if (!delegationJson) {
      return null;
    }

    // Restore delegation chain
    const delegationChain = DelegationChain.fromJSON(JSON.parse(delegationJson));

    // Check if delegation is still valid
    const now = Date.now() * TIME_UNITS.NANOSECONDS_PER_MILLISECOND;
    const delegations = delegationChain.delegations;
    
    if (delegations.length > 0) {
      const lastDelegation = delegations[delegations.length - 1];
      
      if (lastDelegation.delegation.expiration < BigInt(now)) {
        clearIdentity();
        return null;
      }
    }

    // Create a temporary session key for the restored identity
    const sessionKey = Ed25519KeyIdentity.generate();

    // Create delegation identity
    const identity = DelegationIdentity.fromDelegation(sessionKey, delegationChain);

    return identity;
  } catch (error) {
    console.error('❌ [identityStorage] Failed to restore identity:', error);
    clearIdentity();
    return null;
  }
}

/**
 * Clear stored identity from localStorage
 * 
 * Removes the delegation chain from storage, effectively logging out the user.
 * Safe to call even if no identity is stored.
 */
export function clearIdentity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear identity:', error);
  }
}
