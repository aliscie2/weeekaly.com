/**
 * Authentication and OAuth related constants
 */

// Session and token lifetimes
export const AUTH_CONSTANTS = {
  // Delegation lifetime: 7 days in nanoseconds
  MAX_TIME_TO_LIVE_NS: BigInt(7 * 24 * 60 * 60 * 1000 * 1000 * 1000),

  // OAuth popup timeout: 5 minutes in milliseconds
  OAUTH_TIMEOUT_MS: 5 * 60 * 1000,

  // Popup window dimensions
  POPUP_WIDTH: 500,
  POPUP_HEIGHT: 600,

  // Storage keys
  STORAGE_KEY_SESSION_KEY: "ic_session_key",
  STORAGE_KEY_USER_EMAIL: "ic-user-email",
  STORAGE_KEY_USER_NAME: "ic-user-name",
  STORAGE_KEY_USER_ID: "ic-user-id",
  STORAGE_KEY_USER_PICTURE: "ic-user-picture",
  STORAGE_KEY_ACCESS_TOKEN: "ic-access-token",
  STORAGE_KEY_REFRESH_TOKEN: "ic-refresh-token",
  STORAGE_KEY_TOKEN_EXPIRY: "ic-token-expiry",

  // OAuth callback
  OAUTH_CALLBACK_PATH: "/oauth-callback.html",

  // Message types
  MESSAGE_TYPE_SUCCESS: "oauth_success",
  MESSAGE_TYPE_ERROR: "oauth_error",

  // Default provider
  DEFAULT_PROVIDER: "google",
} as const;

// Error messages
export const AUTH_ERRORS = {
  POPUP_BLOCKED: "Popup blocked. Please allow popups for this site.",
  AUTH_TIMEOUT: "Authentication timeout",
  AUTH_CANCELLED: "Authentication cancelled by user",
  INVALID_STATE: "Invalid state - possible CSRF attack",
  AUTH_FAILED: "Authentication failed",
  PROVIDER_NOT_FOUND: "Provider not found",
  SESSION_NOT_FOUND: "Session not found",
  NO_TOKEN: "No authorization token received",
} as const;
