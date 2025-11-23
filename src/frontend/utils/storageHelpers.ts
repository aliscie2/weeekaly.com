/**
 * Centralized localStorage access with type safety
 */

// Storage key constants
const STORAGE_KEYS = {
  USER_EMAIL: "ic-user-email",
  USER_NAME: "ic-user-name",
  ACCESS_TOKEN: "ic-access-token",
  REFRESH_TOKEN: "ic-refresh-token",
  TOKEN_EXPIRY: "ic-token-expiry",
  EVENT_SEEN_PREFIX: "event_seen_",
} as const;

/**
 * Get user email from storage
 */
export function getUserEmail(): string | null {
  return localStorage.getItem(STORAGE_KEYS.USER_EMAIL);
}

/**
 * Get user name from storage
 */
function getUserName(): string | null {
  return localStorage.getItem(STORAGE_KEYS.USER_NAME);
}

/**
 * Check if event has been seen
 */
export function isEventSeen(eventId: string): boolean {
  return (
    localStorage.getItem(`${STORAGE_KEYS.EVENT_SEEN_PREFIX}${eventId}`) ===
    "true"
  );
}

/**
 * Get user info (email and name)
 */
export function getUserInfo(): { email: string | null; name: string | null } {
  return {
    email: getUserEmail(),
    name: getUserName(),
  };
}
