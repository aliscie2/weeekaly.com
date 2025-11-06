/**
 * Calendar-related constants
 * Centralized configuration for Google Calendar integration
 */

export const CALENDAR_CONSTANTS = {
  // Polling and caching
  POLL_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes (reduced from 30 seconds)
  STALE_TIME_MS: 2 * 60 * 1000, // 2 minutes
  
  // API limits
  MAX_EVENTS: 50,
  TIME_RANGE_PAST_MONTHS: 1,
  TIME_RANGE_FUTURE_MONTHS: 2,
  
  // Retry configuration
  RETRY_ATTEMPTS: 3,
  MAX_RETRY_DELAY_MS: 30000, // 30 seconds max
  
  // Token management
  EXPIRY_BUFFER_MS: 5 * 60 * 1000, // 5 minute buffer for token expiry
  
  // Performance tracking
  SLOW_REQUEST_THRESHOLD_MS: 3000, // Log warning if request takes > 3s
} as const;

export const CALENDAR_ERRORS = {
  NO_TOKEN: 'No valid access token available',
  TOKEN_EXCHANGE_FAILED: 'Failed to exchange authorization code',
  TOKEN_REFRESH_FAILED: 'Failed to refresh access token',
  API_ERROR: 'Calendar API request failed',
  NETWORK_ERROR: 'Network error while fetching calendar data',
} as const;
