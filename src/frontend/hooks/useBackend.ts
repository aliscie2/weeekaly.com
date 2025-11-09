import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { backendActor } from "../utils/actor";

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
  [key: string]: any; // Allow additional properties from Google Calendar API
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
 * Hook to fetch calendar events with optimized auto-refresh
 * Polls every 5 minutes (reduced from 30 seconds for better performance)
 *
 * @param enabled - Whether to enable polling (default: true)
 */
export function useCalendarEvents(enabled: boolean = true) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: async (): Promise<GoogleCalendarEvent[]> => {
      // Dynamically import to avoid circular dependencies
      const { fetchGoogleCalendarEvents } = await import(
        "../utils/googleCalendar"
      );

      const events = await fetchGoogleCalendarEvents();

      // Check if user account changed (detect account switch)
      if (events.length > 0) {
        const firstEvent = events[0];
        const currentUserEmail =
          firstEvent.creator?.email || (firstEvent as any).organizer?.email;
        const storedUserEmail = localStorage.getItem("calendar_user_email");

        if (
          storedUserEmail &&
          currentUserEmail &&
          storedUserEmail !== currentUserEmail
        ) {
          // Clear all React Query cache
          queryClient.clear();
          queryClient.removeQueries();

          // Update stored email
          localStorage.setItem("calendar_user_email", currentUserEmail);

          // Return empty array to force refetch with new account
          return [];
        } else if (currentUserEmail && !storedUserEmail) {
          // First time - store the email
          localStorage.setItem("calendar_user_email", currentUserEmail);
        }
      }

      return events;
    },
    enabled, // Only run if enabled
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes (96% reduction in API calls)
    refetchIntervalInBackground: false, // Stop polling when tab is inactive (saves battery)
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes - data is "fresh" for 2 min
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes before garbage collection
    retry: 3, // Retry failed requests
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
}

/**
 * Hook to create a new calendar event
 * Automatically invalidates calendar events query on success
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
      // Use frontend direct API call for all events (including Google Meet)
      const { createGoogleCalendarEvent } = await import(
        "../utils/googleCalendar"
      );
      const result = await createGoogleCalendarEvent(input);
      return { id: result.id };
    },
    onSuccess: () => {
      // Invalidate and refetch calendar events
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

/**
 * Hook to update an existing calendar event
 * Automatically invalidates calendar events query on success
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      updates,
    }: {
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
      };
    }) => {
      // Use frontend direct API call (works without backend token)
      const { updateGoogleCalendarEvent } = await import(
        "../utils/googleCalendar"
      );
      const result = await updateGoogleCalendarEvent(eventId, updates);
      // Return the full event data from Google Calendar API
      return result;
    },
    onMutate: async ({ eventId, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["calendar-events"] });

      // Snapshot previous value
      const previousEvents = queryClient.getQueryData(["calendar-events"]);

      // Optimistically update
      queryClient.setQueryData(
        ["calendar-events"],
        (old: GoogleCalendarEvent[] | undefined) => {
          if (!old) return old;
          return old.map((event) =>
            event.id === eventId ? { ...event, ...updates } : event,
          );
        },
      );

      return { previousEvents };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousEvents) {
        queryClient.setQueryData(["calendar-events"], context.previousEvents);
      }
    },
    onSuccess: (updatedEvent, variables) => {
      // Immediately update the cache with the actual data from Google Calendar API
      // This ensures the Meet link appears right away if Google returned it
      queryClient.setQueryData(
        ["calendar-events"],
        (old: GoogleCalendarEvent[] | undefined) => {
          if (!old) return old;
          return old.map((event) => {
            if (event.id === variables.eventId) {
              // Use the actual event data returned from Google Calendar
              return updatedEvent;
            }
            return event;
          });
        },
      );
    },
    onSettled: () => {
      // Refetch to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

/**
 * Hook to delete a calendar event
 * Automatically invalidates calendar events query on success
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      // Use frontend direct API call (works without backend token)
      const { deleteGoogleCalendarEvent } = await import(
        "../utils/googleCalendar"
      );
      await deleteGoogleCalendarEvent(eventId);
      return eventId;
    },
    onMutate: async (eventId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["calendar-events"] });

      // Snapshot previous value
      const previousEvents = queryClient.getQueryData(["calendar-events"]);

      // Optimistically remove event
      queryClient.setQueryData(
        ["calendar-events"],
        (old: GoogleCalendarEvent[] | undefined) => {
          if (!old) return old;
          return old.filter((event) => event.id !== eventId);
        },
      );

      return { previousEvents };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousEvents) {
        queryClient.setQueryData(["calendar-events"], context.previousEvents);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}
