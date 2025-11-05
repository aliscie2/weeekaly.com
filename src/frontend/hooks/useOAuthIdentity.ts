import { useState, useEffect } from 'react';
import { Identity } from '@dfinity/agent';
import { DelegationIdentity } from '@dfinity/identity';
import { loginWithOAuth, getProviders, OAuthProvider } from '../utils/oauthDelegation';
import { backendActor } from '../utils/actor';
import { storeIdentity, restoreIdentity, clearIdentity } from '../utils/identityStorage';
import { AUTH_CONSTANTS, AUTH_ERRORS } from '../utils/authConstants';

/**
 * React hook for managing OAuth-based IC identity authentication
 * 
 * Provides authentication state, login/logout functions, and provider management.
 * Automatically attempts to restore identity from localStorage on mount.
 * 
 * @returns Object containing identity state and authentication functions
 * 
 * @example
 * ```typescript
 * const { identity, isAuthenticated, login, logout } = useOAuthIdentity();
 * 
 * // Login with Google
 * await login('google');
 * 
 * // Check if authenticated
 * if (isAuthenticated) {
 *   console.log('User is logged in');
 * }
 * ```
 */
export function useOAuthIdentity() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start as loading
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);

  // Restore identity and load providers on mount
  useEffect(() => {
    const init = async () => {
      // Try to restore identity from localStorage
      const restoredIdentity = restoreIdentity();
      
      if (restoredIdentity) {
        setIdentity(restoredIdentity);
      }
      
      // Load providers
      await loadProviders();
      
      setIsLoading(false);
    };
    
    init();
  }, []);

  const loadProviders = async () => {
    try {
      const providerList = await getProviders(backendActor);
      setProviders(providerList);
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  };

  const login = async (providerName: string = AUTH_CONSTANTS.DEFAULT_PROVIDER): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Load providers if not loaded
      if (providers.length === 0) {
        await loadProviders();
      }

      const provider = providers.find(
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
        
        // TODO: Fix delegation chain storage - currently has issues with targets field
        // Store identity for persistence
        // if (newIdentity instanceof DelegationIdentity) {
        //   storeIdentity(newIdentity);
        // }
        
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
    loadProviders,
  };
}
