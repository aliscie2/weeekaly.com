import { AUTH_CONSTANTS } from './authConstants';
import { backendActor } from './actor';

// ============================================================================
// CONSTANTS
// ============================================================================

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1094222481488-rrlvvr8q7mjaq9vmave57fkfrjcd9g3a.apps.googleusercontent.com';

// ⚠️ CLIENT SECRET REMOVED - Now handled securely on backend
// This eliminates the critical security vulnerability

export const CALENDAR_CONSTANTS = {
  POLL_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes (reduced from 30 seconds)
  STALE_TIME_MS: 2 * 60 * 1000, // 2 minutes
  MAX_EVENTS: 50,
  TIME_RANGE_PAST_MONTHS: 1,
  TIME_RANGE_FUTURE_MONTHS: 2,
  RETRY_ATTEMPTS: 3,
  EXPIRY_BUFFER_MS: 5 * 60 * 1000, // 5 minute buffer for token expiry
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  hangoutLink?: string;
  location?: string;
  creator?: {
    email: string;
    displayName?: string;
  };
}

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in: number | bigint;
  token_type: string;
}

// ============================================================================
// LOGGING UTILITY
// ============================================================================

const logger = {
  debug: (msg: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(msg, data);
    }
  },
  info: (msg: string, data?: any) => {
    console.log(msg, data);
  },
  error: (msg: string, error?: any) => {
    console.error(msg, error);
  }
};

// ============================================================================
// TOKEN MANAGEMENT (Secure - Uses Backend)
// ============================================================================

/**
 * Exchange authorization code for access token via SECURE backend
 * This eliminates client secret exposure in frontend
 */
export async function exchangeCodeForToken(code: string): Promise<TokenData> {
  logger.debug('🔄 [Calendar] Exchanging authorization code via backend...');
  
  const codeVerifier = sessionStorage.getItem('pkce_verifier') || '';
  const redirectUri = `${window.location.origin}${AUTH_CONSTANTS.OAUTH_CALLBACK_PATH}`;
  
  try {
    // Call SECURE backend endpoint instead of Google directly
    const result = await backendActor.exchange_oauth_code({
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    });

    if ('Err' in result) {
      throw new Error(result.Err);
    }

    const tokens = result.Ok;
    logger.info('✅ [Calendar] Token exchange successful via backend!');
    
    // Store tokens locally
    localStorage.setItem(AUTH_CONSTANTS.STORAGE_KEY_ACCESS_TOKEN, tokens.access_token);
    
    // Handle optional refresh_token (Candid optional is [] | [value])
    const refreshToken = Array.isArray(tokens.refresh_token) && tokens.refresh_token.length > 0 
      ? tokens.refresh_token[0] 
      : undefined;
    if (refreshToken) {
      localStorage.setItem(AUTH_CONSTANTS.STORAGE_KEY_REFRESH_TOKEN, refreshToken);
    }
    
    const expiryTime = Date.now() + Number(tokens.expires_in) * 1000;
    localStorage.setItem(AUTH_CONSTANTS.STORAGE_KEY_TOKEN_EXPIRY, expiryTime.toString());

    // Clear code verifier
    sessionStorage.removeItem('pkce_verifier');

    return {
      access_token: tokens.access_token,
      refresh_token: refreshToken,
      expires_in: Number(tokens.expires_in),
      token_type: tokens.token_type,
    };
  } catch (error) {
    logger.error('❌ [Calendar] Token exchange failed:', error);
    throw error;
  }
}

/**
 * Refresh access token using refresh token via SECURE backend
 */
async function refreshAccessToken(refreshToken: string, retries = CALENDAR_CONSTANTS.RETRY_ATTEMPTS): Promise<string | null> {
  logger.debug('🔄 [Calendar] Refreshing access token via backend...');
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Call SECURE backend endpoint
      const result = await backendActor.refresh_google_token({
        refresh_token: refreshToken,
      });

      if ('Err' in result) {
        throw new Error(result.Err);
      }

      const tokens = result.Ok;
      
      // Store new tokens
      localStorage.setItem(AUTH_CONSTANTS.STORAGE_KEY_ACCESS_TOKEN, tokens.access_token);
      const expiryTime = Date.now() + Number(tokens.expires_in) * 1000;
      localStorage.setItem(AUTH_CONSTANTS.STORAGE_KEY_TOKEN_EXPIRY, expiryTime.toString());

      logger.info('✅ [Calendar] Token refresh successful!');
      return tokens.access_token;
    } catch (error) {
      logger.error(`❌ [Calendar] Token refresh attempt ${attempt + 1} failed:`, error);
      
      if (attempt < retries - 1) {
        // Exponential backoff
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  logger.error('❌ [Calendar] All token refresh attempts failed');
  return null;
}

/**
 * Get valid access token (refresh if expired)
 * Includes 5-minute buffer to account for clock skew
 */
export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = localStorage.getItem(AUTH_CONSTANTS.STORAGE_KEY_ACCESS_TOKEN);
  const expiryTime = localStorage.getItem(AUTH_CONSTANTS.STORAGE_KEY_TOKEN_EXPIRY);
  const refreshToken = localStorage.getItem(AUTH_CONSTANTS.STORAGE_KEY_REFRESH_TOKEN);

  // If no access token, try to exchange code
  if (!accessToken) {
    const code = localStorage.getItem('ic-oauth-code');
    logger.debug('🔍 [Calendar] No access token found. Checking for authorization code...');
    
    if (code) {
      try {
        const tokens = await exchangeCodeForToken(code);
        // Clear the code after successful exchange
        localStorage.removeItem('ic-oauth-code');
        return tokens.access_token;
      } catch (error) {
        logger.error('❌ [Calendar] Failed to exchange code for token:', error);
        return null;
      }
    } else {
      logger.debug('⚠️ [Calendar] No authorization code found. User needs to log in.');
    }
    return null;
  }

  // Check if token expires soon (within buffer time)
  if (expiryTime && Date.now() >= (parseInt(expiryTime) - CALENDAR_CONSTANTS.EXPIRY_BUFFER_MS)) {
    logger.debug('🔄 [Calendar] Token expired or expiring soon, attempting refresh...');
    
    if (refreshToken) {
      const newToken = await refreshAccessToken(refreshToken);
      if (newToken) {
        return newToken;
      }
      // If refresh failed, clear invalid tokens
      localStorage.removeItem(AUTH_CONSTANTS.STORAGE_KEY_ACCESS_TOKEN);
      localStorage.removeItem(AUTH_CONSTANTS.STORAGE_KEY_REFRESH_TOKEN);
      localStorage.removeItem(AUTH_CONSTANTS.STORAGE_KEY_TOKEN_EXPIRY);
      return null;
    }
    
    logger.debug('⚠️ [Calendar] No refresh token available');
    return null;
  }

  return accessToken;
}

// ============================================================================
// CALENDAR API FUNCTIONS
// ============================================================================

/**
 * Fetch calendar events from Google Calendar API
 * Now with proper error handling and retry logic
 */
export async function fetchGoogleCalendarEvents(): Promise<GoogleCalendarEvent[]> {
  const startTime = performance.now();
  
  logger.debug('🔍 [Calendar] Fetching calendar events...');
  
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    logger.debug('⚠️ [Calendar] No valid access token available');
    return [];
  }

  try {
    // Calculate time range
    const now = new Date();
    const timeMin = new Date(
      now.getFullYear(), 
      now.getMonth() - CALENDAR_CONSTANTS.TIME_RANGE_PAST_MONTHS, 
      1
    ).toISOString();
    
    const timeMax = new Date(
      now.getFullYear(), 
      now.getMonth() + CALENDAR_CONSTANTS.TIME_RANGE_FUTURE_MONTHS, 
      0
    ).toISOString();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        new URLSearchParams({
          timeMin,
          timeMax,
          maxResults: CALENDAR_CONSTANTS.MAX_EVENTS.toString(),
          singleEvents: 'true',
          orderBy: 'startTime',
        }),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Calendar API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const events = data.items || [];
    
    const duration = performance.now() - startTime;
    logger.info('✅ [Calendar] Successfully fetched events', {
      count: events.length,
      duration: `${duration.toFixed(2)}ms`
    });
    
    return events;
  } catch (error) {
    const duration = performance.now() - startTime;
    logger.error('❌ [Calendar] Failed to fetch events', {
      error,
      duration: `${duration.toFixed(2)}ms`
    });
    return [];
  }
}

/**
 * List all calendars for the user
 */
export async function fetchGoogleCalendars(): Promise<any[]> {
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    logger.debug('⚠️ [Calendar] No valid access token available');
    return [];
  }

  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch calendars');
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    logger.error('❌ [Calendar] Failed to fetch calendars:', error);
    return [];
  }
}

// ============================================================================
// TIMEZONE UTILITIES
// ============================================================================

/**
 * Get user's timezone
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Convert Date object to Google Calendar dateTime format
 * @param date - JavaScript Date object
 * @param timezone - IANA timezone (e.g., 'America/New_York')
 * @returns Object with dateTime and timeZone
 */
export function convertToGoogleDateTime(date: Date, timezone?: string): { dateTime: string; timeZone: string } {
  const tz = timezone || getUserTimezone();
  
  // Format: 2025-10-04T12:00:00+03:00
  const isoString = date.toISOString();
  
  return {
    dateTime: isoString,
    timeZone: tz,
  };
}

/**
 * Convert Google Calendar dateTime to JavaScript Date
 * @param googleDateTime - Google Calendar dateTime string
 * @returns JavaScript Date object
 */
export function convertFromGoogleDateTime(googleDateTime: string): Date {
  return new Date(googleDateTime);
}

// ============================================================================
// EVENT CRUD OPERATIONS
// ============================================================================

export interface CreateEventInput {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendees?: Array<{ email: string; displayName?: string }>;
  location?: string;
  conferenceData?: boolean; // If true, creates Google Meet link
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

export interface UpdateEventInput {
  summary?: string;
  description?: string;
  start?: Date;
  end?: Date;
  attendees?: Array<{ email: string; displayName?: string }>;
  location?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  conferenceData?: boolean; // If true, adds Google Meet link
}

/**
 * Create a new event in Google Calendar
 */
export async function createGoogleCalendarEvent(input: CreateEventInput): Promise<GoogleCalendarEvent> {
  logger.info('📝 [Calendar] Creating event:', {
    summary: input.summary,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
    timezone: getUserTimezone(),
  });

  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    throw new Error('No valid access token available');
  }

  const timezone = getUserTimezone();
  
  // Build event object
  const eventData: any = {
    summary: input.summary,
    description: input.description,
    start: convertToGoogleDateTime(input.start, timezone),
    end: convertToGoogleDateTime(input.end, timezone),
    location: input.location,
    reminders: input.reminders || {
      useDefault: true,
    },
  };

  // Add attendees if provided
  if (input.attendees && input.attendees.length > 0) {
    eventData.attendees = input.attendees.map(a => ({
      email: a.email,
      displayName: a.displayName,
    }));
  }

  // Add conference data (Google Meet) if requested
  if (input.conferenceData) {
    eventData.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  try {
    const url = input.conferenceData
      ? 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1'
      : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create event: ${error.error?.message || 'Unknown error'}`);
    }

    const createdEvent = await response.json();
    logger.info('✅ [Calendar] Event created successfully:', {
      id: createdEvent.id,
      summary: createdEvent.summary,
      htmlLink: createdEvent.htmlLink,
    });

    return createdEvent;
  } catch (error) {
    logger.error('❌ [Calendar] Failed to create event:', error);
    throw error;
  }
}

/**
 * Update an existing event in Google Calendar
 */
export async function updateGoogleCalendarEvent(
  eventId: string,
  updates: UpdateEventInput
): Promise<GoogleCalendarEvent> {
  logger.info('📝 [Calendar] Updating event:', {
    eventId,
    updates,
  });

  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    throw new Error('No valid access token available');
  }

  const timezone = getUserTimezone();
  
  // Build update object
  const updateData: any = {};

  if (updates.summary !== undefined) updateData.summary = updates.summary;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.location !== undefined) updateData.location = updates.location;
  if (updates.status !== undefined) updateData.status = updates.status;
  
  if (updates.start) {
    updateData.start = convertToGoogleDateTime(updates.start, timezone);
  }
  
  if (updates.end) {
    updateData.end = convertToGoogleDateTime(updates.end, timezone);
  }

  if (updates.attendees) {
    updateData.attendees = updates.attendees.map(a => ({
      email: a.email,
      displayName: a.displayName,
    }));
  }

  // Add conference data (Google Meet) if requested
  if (updates.conferenceData) {
    updateData.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
    
    logger.info('📹 [Calendar] Adding Google Meet to update:', {
      eventId,
      conferenceData: updateData.conferenceData,
    });
  }

  try {
    // Use conferenceDataVersion=1 if adding Google Meet
    const url = updates.conferenceData
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?conferenceDataVersion=1`
      : `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;

    logger.info('🌐 [Calendar] Sending update request:', {
      url,
      method: 'PATCH',
      body: updateData,
    });

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update event: ${error.error?.message || 'Unknown error'}`);
    }

    const updatedEvent = await response.json();
    logger.info('✅ [Calendar] Event updated successfully:', {
      id: updatedEvent.id,
      summary: updatedEvent.summary,
      hasHangoutLink: !!updatedEvent.hangoutLink,
      hangoutLink: updatedEvent.hangoutLink,
      conferenceData: updatedEvent.conferenceData,
    });

    if (updates.conferenceData && !updatedEvent.hangoutLink) {
      logger.error('⚠️ [Calendar] Google Meet was requested but no hangoutLink in response!', {
        response: updatedEvent,
      });
    }

    return updatedEvent;
  } catch (error) {
    logger.error('❌ [Calendar] Failed to update event:', error);
    throw error;
  }
}

/**
 * Delete an event from Google Calendar
 */
export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  logger.info('🗑️ [Calendar] Deleting event:', { eventId });

  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    throw new Error('No valid access token available');
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.json();
      throw new Error(`Failed to delete event: ${error.error?.message || 'Unknown error'}`);
    }

    logger.info('✅ [Calendar] Event deleted successfully:', { eventId });
  } catch (error) {
    logger.error('❌ [Calendar] Failed to delete event:', error);
    throw error;
  }
}
