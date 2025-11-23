import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { backendActor } from "../utils/actor";
import { getValidAccessToken, clearTokens } from "../utils/tokenRefresh";

// Define proper types for Google Calendar events
interface GoogleCalendarEventTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

interface GoogleCalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
  self?: boolean;
}

interface GoogleCalendarPerson {
  email: string;
  displayName?: string;
  self?: boolean;
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: GoogleCalendarEventTime;
  end?: GoogleCalendarEventTime;
  location?: string;
  attendees?: GoogleCalendarAttendee[];
  creator?: GoogleCalendarPerson;
  organizer?: GoogleCalendarPerson;
  hangoutLink?: string;
  status?: string;
  htmlLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
    }>;
  };
}

/**
 * Hook to fetch hello world message from backend
 * Automatically caches and prevents duplicate calls
 */
export function useHelloWorld() {
  return useQuery({
    queryKey: ["hello-world"],
    queryFn: async () => {
      const result = await backendActor.hello_world();
      return result;
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
}

/**
 * Hook to fetch calendar events directly from Google Calendar API
 * Optimized for React 19 with better caching and reduced polling
 *
 * @param enabled - Whether to enable polling (default: true)
 */
export function useCalendarEvents(enabled: boolean = true) {
  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: async (): Promise<GoogleCalendarEvent[]> => {
      try {
        // Check if user is authenticated
        const isAuth = await backendActor.is_authenticated();

        if (!isAuth) {
          return [];
        }

        // Get a valid access token (will refresh if expired)
        const accessToken = await getValidAccessToken();

        if (!accessToken) {
          return [];
        }

        // Fetch events from Google Calendar API
        // Get events from the past 30 days to 90 days in the future
        const timeMin = new Date();
        timeMin.setDate(timeMin.getDate() - 30);
        const timeMax = new Date();
        timeMax.setDate(timeMax.getDate() + 90);

        const url = new URL(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        );
        url.searchParams.append("timeMin", timeMin.toISOString());
        url.searchParams.append("timeMax", timeMax.toISOString());
        url.searchParams.append("singleEvents", "true");
        url.searchParams.append("orderBy", "startTime");
        url.searchParams.append("maxResults", "250");

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          // If token is invalid, clear all tokens
          if (response.status === 401) {
            clearTokens();
          }

          throw new Error(`Google Calendar API error: ${response.status}`);
        }

        const data = await response.json();
        const events = data.items || [];

        return events;
      } catch (error) {
        console.error(
          "[useCalendarEvents] ❌ Error:",
          error instanceof Error ? error.message : String(error),
        );
        // Return empty array on error instead of throwing
        return [];
      }
    },
    enabled: enabled,
    refetchInterval: false, // Disable auto-polling - use manual refresh instead
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
    retry: 1,
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnMount: false, // Prevent refetch on component mount if data exists
  });
}

/**
 * Hook to create a new calendar event
 * Optimized with optimistic updates for instant UI feedback
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      summary: string;
      description?: string;
      start: Date;
      end: Date;
      attendees?: Array<{ email: string; displayName?: string }>;
      location?: string;
      conferenceData?: boolean;
    }) => {
      // Check if user is authenticated
      const isAuth = await backendActor.is_authenticated();
      if (!isAuth) {
        throw new Error("User not authenticated");
      }

      // Get a valid access token (will refresh if expired)
      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        throw new Error("No access token found. Please log in again.");
      }

      // Get user's timezone
      const timeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      // Build event object
      type GoogleCalendarEventCreate = {
        summary: string;
        description: string;
        start: { dateTime: string; timeZone: string };
        end: { dateTime: string; timeZone: string };
        location: string;
        attendees: Array<{ email: string; displayName?: string }>;
        conferenceData?: {
          createRequest: {
            requestId: string;
            conferenceSolutionKey: { type: string };
          };
        };
      };

      const event: GoogleCalendarEventCreate = {
        summary: input.summary,
        description: input.description || "",
        start: {
          dateTime: input.start.toISOString(),
          timeZone: timeZone,
        },
        end: {
          dateTime: input.end.toISOString(),
          timeZone: timeZone,
        },
        location: input.location || "",
        attendees: input.attendees || [],
      };

      // Add Google Meet conference if requested
      if (input.conferenceData) {
        event.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        };
      }

      // Create event via Google Calendar API
      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        },
      );

      if (!response.ok) {
        // If token is invalid, clear all tokens
        if (response.status === 401) {
          clearTokens();
          throw new Error("Session expired. Please log in again.");
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to create event: ${response.status} ${errorText}`,
        );
      }

      const createdEvent = await response.json();
      return createdEvent;
    },
    onMutate: async (newEvent) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["calendar-events"] });

      // Snapshot previous value
      const previousEvents = queryClient.getQueryData<GoogleCalendarEvent[]>([
        "calendar-events",
      ]);

      // Add temp event to cache immediately
      const tempId = `temp-${Date.now()}`;
      queryClient.setQueryData<GoogleCalendarEvent[]>(
        ["calendar-events"],
        (old = []) => {
          const tempEvent: GoogleCalendarEvent = {
            id: tempId,
            summary: newEvent.summary,
            description: newEvent.description,
            start: {
              dateTime: newEvent.start.toISOString(),
            },
            end: {
              dateTime: newEvent.end.toISOString(),
            },
            location: newEvent.location,
            attendees: newEvent.attendees,
          };
          return [...old, tempEvent];
        },
      );

      return { previousEvents, tempId };
    },
    onError: (_err, _newEvent, context) => {
      // Rollback on error
      if (context?.previousEvents) {
        queryClient.setQueryData(["calendar-events"], context.previousEvents);
      }
    },
    onSuccess: (createdEvent, _newEvent, context) => {
      // Replace temp event with real event from server
      queryClient.setQueryData<GoogleCalendarEvent[]>(
        ["calendar-events"],
        (old = []) => {
          return old.map((event) =>
            event.id === context?.tempId ? createdEvent : event,
          );
        },
      );
    },
    onSettled: () => {
      // Mutation complete
    },
  });
}

/**
 * Hook to update an existing calendar event
 * Optimized with optimistic updates for instant UI feedback
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      eventId: string;
      updates: {
        summary?: string;
        description?: string;
        start?: Date;
        end?: Date;
        attendees?: Array<{ email: string; displayName?: string }>;
        location?: string;
        status?: "confirmed" | "tentative" | "cancelled";
        conferenceData?: boolean;
        attendeeResponse?: "accepted" | "declined" | "tentative";
      };
    }) => {
      // Check if user is authenticated
      const isAuth = await backendActor.is_authenticated();
      if (!isAuth) {
        throw new Error("User not authenticated");
      }

      // Get a valid access token (will refresh if expired)
      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        throw new Error("No access token found. Please log in again.");
      }

      // Get user's timezone
      const timeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      // Build update object (only include fields that are being updated)
      type GoogleCalendarEventUpdate = {
        summary?: string;
        description?: string;
        start?: { dateTime: string; timeZone: string };
        end?: { dateTime: string; timeZone: string };
        location?: string;
        attendees?: Array<{ email: string; displayName?: string }>;
        status?: string;
      };

      const updates: GoogleCalendarEventUpdate = {};

      if (params.updates.summary !== undefined) {
        updates.summary = params.updates.summary;
      }
      if (params.updates.description !== undefined) {
        updates.description = params.updates.description;
      }
      if (params.updates.start !== undefined) {
        updates.start = {
          dateTime: params.updates.start.toISOString(),
          timeZone: timeZone,
        };
      }
      if (params.updates.end !== undefined) {
        updates.end = {
          dateTime: params.updates.end.toISOString(),
          timeZone: timeZone,
        };
      }
      if (params.updates.location !== undefined) {
        updates.location = params.updates.location;
      }
      if (params.updates.attendees !== undefined) {
        updates.attendees = params.updates.attendees;
      }
      if (params.updates.status !== undefined) {
        updates.status = params.updates.status;
      }

      // Handle attendee response (accept/decline invitation)
      if (params.updates.attendeeResponse !== undefined) {
        // First, get the current event to find the current user's attendee entry
        const getResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${params.eventId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        if (!getResponse.ok) {
          throw new Error("Failed to fetch event for response update");
        }

        const currentEvent = await getResponse.json();
        const currentAttendees = currentEvent.attendees || [];

        // Update the current user's response status
        updates.attendees = currentAttendees.map(
          (attendee: GoogleCalendarAttendee) => {
            if (attendee.self) {
              return {
                ...attendee,
                responseStatus: params.updates.attendeeResponse,
              };
            }
            return attendee;
          },
        );
      }

      // Update event via Google Calendar API
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${params.eventId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        },
      );

      if (!response.ok) {
        // If token is invalid, clear all tokens
        if (response.status === 401) {
          clearTokens();
          throw new Error("Session expired. Please log in again.");
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to update event: ${response.status} ${errorText}`,
        );
      }

      const updatedEvent = await response.json();
      return updatedEvent;
    },
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["calendar-events"] });

      // Snapshot previous value
      const previousEvents = queryClient.getQueryData<GoogleCalendarEvent[]>([
        "calendar-events",
      ]);

      // Update cache directly with the changes
      queryClient.setQueryData<GoogleCalendarEvent[]>(
        ["calendar-events"],
        (old = []) => {
          return old.map((event) => {
            if (event.id === params.eventId) {
              return {
                ...event,
                ...(params.updates.summary !== undefined && {
                  summary: params.updates.summary,
                }),
                ...(params.updates.description !== undefined && {
                  description: params.updates.description,
                }),
                ...(params.updates.start !== undefined && {
                  start: { dateTime: params.updates.start.toISOString() },
                }),
                ...(params.updates.end !== undefined && {
                  end: { dateTime: params.updates.end.toISOString() },
                }),
                ...(params.updates.location !== undefined && {
                  location: params.updates.location,
                }),
                ...(params.updates.attendees !== undefined && {
                  attendees: params.updates.attendees,
                }),
                ...(params.updates.status !== undefined && {
                  status: params.updates.status,
                }),
              };
            }
            return event;
          });
        },
      );

      return { previousEvents };
    },
    onError: (_err, _params, context) => {
      // Rollback on error
      if (context?.previousEvents) {
        queryClient.setQueryData(["calendar-events"], context.previousEvents);
      }
    },
    onSuccess: () => {
      // Don't invalidate - we already updated the cache in onMutate
    },
    onSettled: () => {
      // Mutation complete
    },
  });
}

/**
 * Hook to fetch calendar events from a shared calendar
 * This allows viewing events from another person's calendar if they've shared it
 *
 * @param calendarId - The calendar ID (usually an email address) or 'primary' for own calendar
 * @param enabled - Whether to enable the query
 */
export function useSharedCalendarEvents(
  calendarId: string | undefined,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ["shared-calendar-events", calendarId],
    queryFn: async (): Promise<GoogleCalendarEvent[]> => {
      try {
        if (!calendarId) {
          console.log("[useSharedCalendarEvents] ⚠️ No calendar ID provided");
          return [];
        }

        // Get a valid access token (will refresh if expired)
        const accessToken = await getValidAccessToken();
        if (!accessToken) {
          console.log("[useSharedCalendarEvents] ⚠️ No access token available");
          return [];
        }

        // Fetch events from the past 30 days to 90 days in the future
        const timeMin = new Date();
        timeMin.setDate(timeMin.getDate() - 30);
        const timeMax = new Date();
        timeMax.setDate(timeMax.getDate() + 90);

        const url = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        );
        url.searchParams.append("timeMin", timeMin.toISOString());
        url.searchParams.append("timeMax", timeMax.toISOString());
        url.searchParams.append("singleEvents", "true");
        url.searchParams.append("orderBy", "startTime");
        url.searchParams.append("maxResults", "250");

        console.log(
          `[useSharedCalendarEvents] 🔍 Fetching events from calendar: ${calendarId}`,
        );

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          console.error(
            `[useSharedCalendarEvents] ❌ API error: ${response.status}`,
          );

          // If token is invalid, clear all tokens
          if (response.status === 401) {
            clearTokens();
          }

          // Log the error details
          const errorText = await response.text();
          console.error(
            `[useSharedCalendarEvents] ❌ Error details:`,
            errorText,
          );

          throw new Error(`Google Calendar API error: ${response.status}`);
        }

        const data = await response.json();
        const allEvents = data.items || [];

        // Filter out events that start before now
        const now = new Date();
        const events = allEvents.filter((event: any) => {
          const startTime = event.start?.dateTime || event.start?.date;
          if (!startTime) return false;

          const eventStart = new Date(startTime);
          return eventStart >= now;
        });

        console.log(
          `[useSharedCalendarEvents] ✅ Fetched ${events.length} future events from ${calendarId} (filtered from ${allEvents.length} total)`,
        );
        console.log(`[useSharedCalendarEvents] 📅 Events:`, events);

        return events;
      } catch (error) {
        console.error(
          "[useSharedCalendarEvents] ❌ Error:",
          error instanceof Error ? error.message : String(error),
        );
        // Return empty array on error instead of throwing
        return [];
      }
    },
    enabled: enabled && !!calendarId,
    refetchInterval: false,
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to set an availability as favorite
 */
export function useSetFavoriteAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (availabilityId: string) => {
      const result =
        await backendActor.set_favorite_availability(availabilityId);
      if ("Err" in result) {
        throw new Error(result.Err);
      }
      return result.Ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availabilities"] });
    },
  });
}

/**
 * Hook to delete a calendar event
 * Optimized with optimistic updates for instant UI feedback
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      // Check if user is authenticated
      const isAuth = await backendActor.is_authenticated();
      if (!isAuth) {
        throw new Error("User not authenticated");
      }

      // Get a valid access token (will refresh if expired)
      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        throw new Error("No access token found. Please log in again.");
      }

      // Delete event via Google Calendar API
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        // If token is invalid, clear all tokens
        if (response.status === 401) {
          clearTokens();
          throw new Error("Session expired. Please log in again.");
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to delete event: ${response.status} ${errorText}`,
        );
      }

      return { success: true };
    },
    // Removed optimistic updates - they cause double renders
    onError: () => {
      // Error handled by caller
    },
    onSuccess: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

/**
 * Hook to fetch user availabilities from backend
 * Uses React Query for caching and automatic refetching
 * Now uses email-based lookup for consistency across sessions
 */
export function useAvailabilities(enabled: boolean = true) {
  return useQuery({
    queryKey: ["availabilities"],
    queryFn: async () => {
      console.log("🔍 [useAvailabilities] Fetching availabilities");

      // Use principal-based endpoint (standard approach)
      const availsList = await backendActor.list_user_availabilities();
      console.log(
        "✅ [useAvailabilities] Found",
        availsList.length,
        "availabilities",
      );
      return availsList;
    },
    enabled: enabled,
    staleTime: 2 * 60 * 1000, // Consider fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

/**
 * Hook to fetch a specific availability by ID (public access)
 * This allows viewing someone else's availability
 */
export function useAvailabilityById(
  id: string | undefined,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ["availability", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Availability ID is required");
      }

      const result = await backendActor.get_availability(id);

      if ("Err" in result) {
        throw new Error(result.Err);
      }

      // Log raw result from backend BEFORE any processing
      console.log("[useAvailabilityById] 🔍 RAW backend response:", result.Ok);

      return result.Ok;
    },
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1, // Only retry once for 404s
  });
}
