import { AUTH_CONSTANTS } from "./authConstants";
import { backendActor } from "./actor";

/**
 * Check if the access token is expired or about to expire
 * @returns true if token is expired or will expire in the next 5 minutes
 */
function isTokenExpired(): boolean {
  const expiryStr = localStorage.getItem(
    AUTH_CONSTANTS.STORAGE_KEY_TOKEN_EXPIRY,
  );
  if (!expiryStr) return true;

  const expiry = parseInt(expiryStr, 10);
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  return now >= expiry - fiveMinutes;
}

/**
 * Refresh the access token using the refresh token
 * @returns Promise resolving to the new access token, or null if refresh failed
 */
async function refreshAccessToken(): Promise<string | null> {
  try {
    const refreshToken = localStorage.getItem(
      AUTH_CONSTANTS.STORAGE_KEY_REFRESH_TOKEN,
    );

    if (!refreshToken) {
      return null;
    }

    // Call backend to refresh the token
    const result = await backendActor.refresh_google_token({
      refresh_token: refreshToken,
    });

    if ("Ok" in result) {
      // Store the new access token
      localStorage.setItem(
        AUTH_CONSTANTS.STORAGE_KEY_ACCESS_TOKEN,
        result.Ok.access_token,
      );

      // Update expiry time
      const expiryTime = Date.now() + Number(result.Ok.expires_in) * 1000;
      localStorage.setItem(
        AUTH_CONSTANTS.STORAGE_KEY_TOKEN_EXPIRY,
        expiryTime.toString(),
      );

      // Update refresh token if a new one was provided
      const newRefreshToken = result.Ok.refresh_token;
      if (
        Array.isArray(newRefreshToken) &&
        newRefreshToken.length > 0 &&
        newRefreshToken[0]
      ) {
        localStorage.setItem(
          AUTH_CONSTANTS.STORAGE_KEY_REFRESH_TOKEN,
          newRefreshToken[0],
        );
      }

      return result.Ok.access_token;
    } else {
      console.error("[tokenRefresh] ❌ Failed to refresh token:", result.Err);
      // Clear invalid tokens
      clearTokens();
      return null;
    }
  } catch (error) {
    console.error("[tokenRefresh] ❌ Error refreshing token:", error);
    clearTokens();
    return null;
  }
}

/**
 * Get a valid access token, refreshing if necessary
 * @returns Promise resolving to a valid access token, or null if unavailable
 */
export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = localStorage.getItem(
    AUTH_CONSTANTS.STORAGE_KEY_ACCESS_TOKEN,
  );

  if (!accessToken) {
    return null;
  }

  // Check if token is expired
  if (isTokenExpired()) {
    return await refreshAccessToken();
  }

  return accessToken;
}

/**
 * Clear all stored tokens
 */
export function clearTokens(): void {
  localStorage.removeItem(AUTH_CONSTANTS.STORAGE_KEY_ACCESS_TOKEN);
  localStorage.removeItem(AUTH_CONSTANTS.STORAGE_KEY_REFRESH_TOKEN);
  localStorage.removeItem(AUTH_CONSTANTS.STORAGE_KEY_TOKEN_EXPIRY);
}
