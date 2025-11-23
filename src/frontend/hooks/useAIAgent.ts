import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { VibeCal, CalendarAction } from "../AIAgent";
import { useEventActions } from "./useEventActions";
import type { EventFormData } from "../components/EventFormModal";
import { filterEventsByScope, type FilterScope } from "../utils/eventFilters";
import { PROMPTS } from "../AIAgent/prompts";
import { errorLogger } from "../utils/errorLogger";
import { calculateMutualAvailability } from "../utils/availabilityHelpers";
import {
  classifyIntent,
  extractMetadata,
  generateCasualResponse,
} from "../utils/intentClassifier";
import {
  getEventTimes,
  checkEventConflict,
  filterFutureEvents,
  getEventTitle,
  toMinimalEventTime,
} from "../utils/eventHelpers";
import type { CalendarEventInput } from "../utils/eventHelpers";
import {
  formatTime,
  formatDate,
  formatDayName,
  formatShortDay,
  formatDuration,
  calculateDuration,
  getCurrentTimezone,
  getTimezoneOffset,
} from "../utils/dateFormatters";
import { getUserEmail, getUserInfo } from "../utils/storageHelpers";

// ============================================================================
// TYPES
// ============================================================================

interface AIAgentResponse {
  feedback: string;
  suggestions: string[];
  action?: CalendarAction;
  actions?: CalendarAction[];
}

// CalendarEventInput is now imported from eventHelpers.ts

type AvailabilityInput = {
  id: string;
  name: string;
};

type ChatHistoryInput = {
  text: string;
  isAi: boolean;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const serializeContext = (
  events: CalendarEventInput[],
  availabilities: AvailabilityInput[],
  chatHistory: ChatHistoryInput[],
  selectedAvailabilityId: string | null = null,
) => {
  const now = new Date();
  return {
    now: {
      iso: now.toISOString(),
      date: formatDayName(now),
      time: formatTime(now),
      timezone: getCurrentTimezone(),
      offset: getTimezoneOffset(),
    },
    events: events.map((e) => ({
      id: e.id,
      t: getEventTitle(e),
      ...toMinimalEventTime(e),
    })),
    avail: availabilities.map((a) => ({ id: a.id, n: a.name })),
    hist: chatHistory.slice(-10).map((m) => ({ txt: m.text, ai: m.isAi })),
    selectedAvail: selectedAvailabilityId,
  };
};

// Removed - now using utility from eventHelpers.ts

const fetchAvailabilities = async (emails: string[]) => {
  if (emails.length === 0) return [];
  try {
    const { backendActor } = await import("../utils/actor");
    const result = await backendActor.search_by_emails(emails);
    return result.flat();
  } catch (error) {
    console.error("❌ Failed to fetch availabilities:", error);
    return [];
  }
};

const fetchOtherUsersEvents = async (
  emailAvailabilities: any[],
  extractedEmails: string[],
  currentUserEmail: string | null,
  duration: { start: Date; end: Date } | null,
) => {
  const otherUsersEvents: any[] = [];
  if (!duration) return otherUsersEvents;

  console.log("🔍 Fetching other users' events from Google Calendar...");

  // Import token refresh utility
  const { getValidAccessToken } = await import("../utils/tokenRefresh");
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    console.log("❌ No access token available");
    return otherUsersEvents;
  }

  for (const email of extractedEmails) {
    if (email === currentUserEmail) continue;

    const avail = emailAvailabilities.find(
      (a: any) => a.owner_email?.[0] === email,
    );
    if (!avail) continue;

    try {
      // Fetch fresh events from Google Calendar
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(email)}/events`,
      );
      url.searchParams.append("timeMin", duration.start.toISOString());
      url.searchParams.append("timeMax", duration.end.toISOString());
      url.searchParams.append("singleEvents", "true");
      url.searchParams.append("orderBy", "startTime");
      url.searchParams.append("maxResults", "250");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const events = data.items || [];
        const now = new Date();

        // Filter out past events
        const futureEvents = events.filter((e: any) => {
          if (!e.start?.dateTime) return false;
          const eventStart = new Date(e.start.dateTime);
          return eventStart >= now;
        });

        futureEvents.forEach((e: any) => {
          if (e.start?.dateTime && e.end?.dateTime) {
            otherUsersEvents.push({
              start: { dateTime: e.start.dateTime },
              end: { dateTime: e.end.dateTime },
              summary: e.summary || `Busy (${email})`,
              email,
            });
          }
        });
      } else {
        // Fallback to stored busy_times
        if (
          avail.busy_times &&
          Array.isArray(avail.busy_times) &&
          avail.busy_times.length > 0
        ) {
          const now = new Date();
          avail.busy_times.forEach((busyTime: any) => {
            const startTime = new Date(Number(busyTime.start_time) * 1000);
            const eventStartMs = startTime.getTime();
            // Filter: must be in future and within duration
            if (
              eventStartMs >= now.getTime() &&
              eventStartMs >= duration.start.getTime() &&
              eventStartMs <= duration.end.getTime()
            ) {
              otherUsersEvents.push({
                start: { dateTime: startTime.toISOString() },
                end: {
                  dateTime: new Date(
                    Number(busyTime.end_time) * 1000,
                  ).toISOString(),
                },
                summary: `Busy (${email})`,
                email,
              });
            }
          });
        }
      }
    } catch (error) {
      errorLogger.logError(`Failed to fetch events for ${email}`, error, {
        component: "useAIAgent",
        action: "fetchOtherUsersEvents",
      });
    }
  }

  return otherUsersEvents;
};

const parseTimeSlots = (availData: any, action: any) => {
  let slots = (availData.slots || action.slots) as
    | Array<{ day_of_week: number; start_time: number; end_time: number }>
    | undefined;

  if (!slots || slots.length === 0) {
    const days = (availData.days || action.days) as string[] | undefined;
    const startTime = (availData.startTime || action.startTime) as
      | string
      | undefined;
    const endTime = (availData.endTime || action.endTime) as string | undefined;

    if (days && startTime && endTime) {
      const dayMap: Record<string, number> = {
        sunday: 0,
        sun: 0,
        monday: 1,
        mon: 1,
        tuesday: 2,
        tue: 2,
        wednesday: 3,
        wed: 3,
        thursday: 4,
        thu: 4,
        friday: 5,
        fri: 5,
        saturday: 6,
        sat: 6,
      };
      const parseTime = (timeStr: string): number => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        return hours * 60 + minutes;
      };
      const start_time = parseTime(startTime);
      const end_time = parseTime(endTime);
      slots = days.map((dayName) => ({
        day_of_week: dayMap[dayName.toLowerCase()],
        start_time,
        end_time,
      }));
    }
  }
  return slots;
};

// Removed - now using utility from eventHelpers.ts

// Removed unused function - logging happens at root level

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useAIAgent(
  events: CalendarEventInput[],
  availabilities: AvailabilityInput[],
  chatHistory: ChatHistoryInput[] = [],
  selectedAvailabilityId: string | null = null,
) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = useState<{
    scope: string;
    filter: string;
    count: number;
  } | null>(null);
  const eventActions = useEventActions();
  const queryClient = useQueryClient();

  const processMessage = async (message: string): Promise<AIAgentResponse> => {
    setIsProcessing(true);

    try {
      // Handle pending bulk delete confirmation
      if (pendingBulkDelete) {
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes("yes") || lowerMsg.includes("delete all")) {
          const result = await handleBulkDelete(pendingBulkDelete.filter);
          setPendingBulkDelete(null);
          return result;
        } else if (lowerMsg.includes("no") || lowerMsg.includes("cancel")) {
          setPendingBulkDelete(null);
          return {
            feedback: "Bulk delete cancelled. Your events are safe.",
            suggestions: ["Create event", "View events"],
          };
        }
      }

      // PHASE 1: Classify intent (short model)
      const intent = classifyIntent(message);
      const extractedData = extractMetadata(message);

      if (intent.type === "CASUAL") {
        const response = generateCasualResponse(message);
        return {
          feedback: response.feedback,
          suggestions: response.suggestions,
        };
      }

      // Extract metadata
      const metadata = {
        names: extractedData.names,
        emails: extractedData.emails,
        keywords: extractedData.keywords,
        duration: extractedData.duration,
      };
      let extractedEmails: string[] = metadata.emails || [];

      // Always default to next 7 days for filtering
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const duration = { start, end };

      // Override if user specified a duration
      if (metadata.duration) {
        try {
          duration.start = new Date(metadata.duration.start);
          duration.end = new Date(metadata.duration.end);
        } catch (error) {
          console.warn(
            "⚠️ Failed to parse duration, using default 7 days:",
            error,
          );
        }
      }

      // Get current user's email first
      const currentUserEmail = getUserEmail();

      // Filter out current user's email from extracted emails (we already have their data)
      const othersEmails = extractedEmails.filter(
        (email) => email !== currentUserEmail,
      );

      // Fetch availabilities only for other users (not current user)
      const emailAvailabilities = await fetchAvailabilities(othersEmails);

      // Add current user's email back for mutual availability calculation
      if (
        currentUserEmail &&
        extractedEmails.length > 0 &&
        !extractedEmails.includes(currentUserEmail)
      ) {
        extractedEmails.push(currentUserEmail);
      }

      // Filter events: only future events within duration
      const filteredEvents = filterFutureEvents(
        events,
        duration.start,
        duration.end,
      );

      // Fetch other users' events from Google Calendar (excluding current user)
      const otherUsersEvents = await fetchOtherUsersEvents(
        emailAvailabilities,
        othersEmails,
        currentUserEmail,
        duration,
      );

      // Calculate mutual availability using utility function
      const currentUserAvailability = availabilities.find(() => true);
      const mutualAvailability = calculateMutualAvailability(
        currentUserAvailability,
        emailAvailabilities,
        filteredEvents, // Already filtered to future events in duration
        otherUsersEvents, // Already filtered to future events in duration
        duration.start,
        duration.end,
      );

      // PHASE 2: Full model with enriched context
      const context = serializeContext(
        filteredEvents,
        availabilities,
        chatHistory,
        selectedAvailabilityId,
      );
      const readableMutualAvailability = mutualAvailability.map(
        (block: any) => {
          const start = new Date(block.start);
          const end = new Date(block.end);
          return {
            date: start.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
            startTime: start.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }),
            endTime: end.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }),
            startISO: start.toISOString(),
            endISO: end.toISOString(),
            durationMinutes: Math.round(
              (end.getTime() - start.getTime()) / (1000 * 60),
            ),
          };
        },
      );

      // Reduce context size: only send essential data
      const eventTimes = filteredEvents.map(toMinimalEventTime);

      const minimalContext = {
        now: context.now,
        events: eventTimes, // Only start/end times, not full event data
        hist: context.hist.slice(-5), // Only last 5 messages instead of 10
        avail: context.avail, // Include availabilities list
        selectedAvail: context.selectedAvail, // Include selected availability ID
        extracted: {
          emails: extractedEmails,
          // Only send mutual availability slots - this is the clean, intersected free time
          mutualAvailability: readableMutualAvailability.slice(0, 10), // Only top 10 slots
        },
      };

      const fullAgent = new VibeCal({
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        quick: false,
      });
      const result = await fullAgent.parse(message, {
        systemPrompt: PROMPTS.GENERIC_CALENDAR_ASSISTANT,
        context: minimalContext,
      });

      // Handle ADD_EVENT with availability validation
      if ((result.type as string) === "ADD_EVENT") {
        const hasAttendees = extractedEmails.length > 0;

        // FIX: If attendees present but no mutual availability, we need more info
        if (hasAttendees && mutualAvailability.length === 0) {
          const emailsList = extractedEmails
            .filter((e) => e !== currentUserEmail)
            .join(", ");
          return {
            feedback: `I couldn't find any available time slots with ${emailsList}. This could mean:\n\n1. They don't have an availability set up\n2. There are no mutual free times\n3. I need a specific time range\n\nPlease specify when you'd like to meet (e.g., "tomorrow at 2pm", "next Monday morning", "this week").`,
            suggestions: [
              "Tomorrow at 2pm",
              "Next Monday",
              "This week",
              "Cancel",
            ],
          };
        }

        if (hasAttendees && mutualAvailability.length > 0) {
          if (result.start) {
            const suggestedStart = new Date(result.start as string);
            const suggestedEnd = new Date(result.end as string);

            const isTimeAvailable = mutualAvailability.some((slot: any) => {
              const slotStart = new Date(slot.start);
              const slotEnd = new Date(slot.end);
              return suggestedStart >= slotStart && suggestedEnd <= slotEnd;
            });

            if (!isTimeAvailable) {
              const emailsList = extractedEmails
                .filter((e) => e !== currentUserEmail)
                .join(", ");
              return {
                feedback: `⚠️ That time is not available for ${emailsList}. Let me show you the available times instead.`,
                suggestions: ["Show available times", "Cancel"],
                action: result,
              };
            }
          } else {
            // Show available slots
            const defaultDuration = 15;
            let meetingDuration = defaultDuration;
            const durationMatch = message.match(
              /(\d+)\s*(min|minute|minutes|hour|hours|h)/i,
            );
            if (durationMatch) {
              const value = parseInt(durationMatch[1]);
              const unit = durationMatch[2].toLowerCase();
              meetingDuration = unit.startsWith("h") ? value * 60 : value;
            }

            const topSlots = mutualAvailability
              .filter((block: any) => {
                const blockDuration = Math.round(
                  (new Date(block.end).getTime() -
                    new Date(block.start).getTime()) /
                    (1000 * 60),
                );
                return blockDuration >= meetingDuration;
              })
              .slice(0, 3);

            if (topSlots.length === 0) {
              const emailsList = extractedEmails
                .filter((e) => e !== currentUserEmail)
                .join(", ");
              return {
                feedback: `No time slots found that can fit a ${meetingDuration}-minute meeting with ${emailsList}. Try a shorter duration or different time range.`,
                suggestions: ["Check availability again", "Cancel"],
                action: result,
              };
            }

            const emailsList = extractedEmails
              .filter((e) => e !== currentUserEmail)
              .join(", ");
            const slotsText = topSlots
              .map((block: any, index: number) => {
                const start = new Date(block.start);
                return `${index + 1}. ${formatDayName(start)} at ${formatTime(start)}`;
              })
              .join("\n");

            const suggestions = topSlots.map((block: any) => {
              const start = new Date(block.start);
              return `Book ${formatShortDay(start)} at ${formatTime(start)}`;
            });
            suggestions.push("Cancel");

            return {
              feedback: `I found ${topSlots.length} available time slots for a ${meetingDuration}-minute meeting with ${emailsList}:\n\n${slotsText}\n\nWhich time works best for you?`,
              suggestions,
              action: { ...result, meetingDuration },
            };
          }
        }
      }

      // Handle CHECK_AVAILABILITY
      if (
        (result.type as string) === "CHECK_AVAILABILITY" &&
        mutualAvailability.length > 0
      ) {
        const emailsList = extractedEmails
          .filter((e) => e !== currentUserEmail)
          .join(", ");
        const slotsText = mutualAvailability
          .slice(0, 10)
          .map((block: any) => {
            const start = new Date(block.start);
            const end = new Date(block.end);
            const duration = calculateDuration(start, end);
            return `• ${formatDayName(start)}: ${formatTime(start)} - ${formatTime(end)} (${formatDuration(duration)})`;
          })
          .join("\n");

        return {
          feedback:
            mutualAvailability.length > 0
              ? `Here are the available time slots with ${emailsList}:\n\n${slotsText}${mutualAvailability.length > 10 ? "\n\n...and more" : ""}\n\nWould you like to schedule a meeting?`
              : `No mutual free time found with ${emailsList} in the requested timeframe.`,
          suggestions:
            mutualAvailability.length > 0
              ? ["Schedule a meeting", "Show more times", "Cancel"]
              : ["Try different time", "Cancel"],
          action: result,
        };
      }

      // Handle bulk delete confirmation
      if (result.type === "BULK_DELETE_CONFIRMATION") {
        setPendingBulkDelete({
          scope: (result.scope as string) || "",
          filter: (result.filter as string) || "",
          count: (result.count as number) || 0,
        });
        return {
          feedback: result.feedback || "Confirm deletion?",
          suggestions: result.suggestions || ["Yes", "No"],
          action: result,
        };
      }

      // Handle clarification requests
      if (result.type === "NEEDS_CLARIFICATION" || result.type === "QUERY") {
        return {
          feedback: result.feedback || "Could you clarify?",
          suggestions: result.suggestions || [],
          action: result,
        };
      }

      // Execute actions
      let executionFeedback: string | undefined;
      if (result.actions && Array.isArray(result.actions)) {
        const feedbacks: string[] = [];
        for (const action of result.actions) {
          try {
            const feedback = await executeAction(action);
            if (feedback) feedbacks.push(feedback);
          } catch (error) {
            errorLogger.logError("Action execution failed", error, {
              component: "useAIAgent",
              action: "executeAction",
              metadata: { actionType: action.type },
            });
            feedbacks.push(`Failed: ${action.type}`);
          }
        }
        executionFeedback =
          feedbacks.length > 0 ? feedbacks.join("\n") : undefined;
      } else if (result.type) {
        try {
          executionFeedback = await executeAction(result);
        } catch (error) {
          errorLogger.logError("Action execution failed", error, {
            component: "useAIAgent",
            action: "executeAction",
            metadata: { actionType: result.type },
          });
          throw error;
        }
      }

      return {
        feedback: executionFeedback || result.feedback || "Done",
        suggestions: result.suggestions || [],
        action: result,
        actions: result.actions as CalendarAction[] | undefined,
      };
    } catch (error) {
      errorLogger.logError("Failed to process AI message", error, {
        component: "useAIAgent",
        action: "processMessage",
        metadata: { message: message.substring(0, 100) },
      });
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Sorry, I couldn't process that.";
      return { feedback: errorMessage, suggestions: ["Try again", "Cancel"] };
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  const handleCreateEvent = async (action: CalendarAction) => {
    const { email: currentUserEmail, name: currentUserName } = getUserInfo();

    const attendeesList: Array<{ email: string; displayName?: string }> = [];
    if (currentUserEmail) {
      attendeesList.push({
        email: currentUserEmail,
        displayName: currentUserName || undefined,
      });
    }
    if (action.attendees && Array.isArray(action.attendees)) {
      (action.attendees as string[]).forEach((email: string) => {
        if (email !== currentUserEmail) attendeesList.push({ email });
      });
    }

    const eventData: EventFormData = {
      summary: (action.title as string) || "New Event",
      description: action.description as string | undefined,
      start: new Date((action.start as string) || new Date()),
      end: new Date((action.end as string) || new Date()),
      location: action.location as string | undefined,
      attendees: attendeesList,
      conferenceData: (action.meeting_link as boolean) !== undefined,
    };

    if (checkEventConflict(events, eventData.start, eventData.end)) {
      throw new Error(
        `⚠️ Time conflict! You already have an event at ${formatTime(eventData.start)} on ${formatDate(eventData.start)}. Please choose a different time.`,
      );
    }

    eventActions.handleFormSubmit(eventData);
    return `Created "${eventData.summary}" on ${formatDate(eventData.start)} at ${formatTime(eventData.start)}`;
  };

  const handleUpdateEvent = async (action: CalendarAction) => {
    const eventId = action.event_id as string | undefined;
    const eventTitle = action.event_title as string | undefined;
    const event = eventId
      ? events.find((e) => e.id === eventId)
      : events.find((e) =>
          (e.summary || e.title)
            ?.toLowerCase()
            .includes(eventTitle?.toLowerCase() || ""),
        );

    if (!event) throw new Error("Event not found");

    const { startDateTime, endDateTime } = getEventTimes(event);
    const updates: Partial<EventFormData> = {
      summary: event.summary || event.title || "Untitled Event",
      start: new Date(startDateTime || new Date()),
      end: new Date(endDateTime || new Date()),
    };

    const changesList: string[] = [];
    const changes = action.changes as
      | {
          title?: string;
          description?: string;
          start?: string;
          end?: string;
          location?: string;
          attendees?: string[];
        }
      | undefined;

    if (changes) {
      if (changes.title) {
        updates.summary = changes.title;
        changesList.push(`title to "${changes.title}"`);
      }
      if (changes.description) {
        updates.description = changes.description;
        changesList.push("description");
      }
      if (changes.start) {
        updates.start = new Date(changes.start);
        changesList.push(
          `start time to ${updates.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
        );
      }
      if (changes.end) {
        updates.end = new Date(changes.end);
        changesList.push(
          `end time to ${updates.end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
        );
      }
      if (changes.location) {
        updates.location = changes.location;
        changesList.push(`location to "${changes.location}"`);
      }
      if (changes.attendees) {
        updates.attendees = changes.attendees.map((email: string) => ({
          email,
        }));
        changesList.push("attendees");
      }
    }

    eventActions.openEditForm(event.id, updates);
    const changesText =
      changesList.length > 0 ? changesList.join(", ") : "event details";
    return `Updated "${event.summary || event.title}" - changed ${changesText}`;
  };

  const handleDeleteEvent = async (action: CalendarAction) => {
    const eventId = action.event_id as string | undefined;
    const eventTitle = action.event_title as string | undefined;

    if (eventTitle?.toLowerCase().includes("all")) {
      throw new Error("Bulk delete not supported. Please specify which event.");
    }

    const event = eventId
      ? events.find((e) => e.id === eventId)
      : events.find((e) =>
          (e.summary || e.title)
            ?.toLowerCase()
            .includes(eventTitle?.toLowerCase() || ""),
        );
    if (!event) throw new Error(`Event not found: "${eventTitle}"`);

    const foundEventTitle = event.summary || event.title || "Untitled Event";
    eventActions.handleDeleteEvent(event.id, foundEventTitle);
    return `Deleted "${foundEventTitle}"`;
  };

  const handleAddAvailability = async (action: CalendarAction) => {
    const availData = (action.availability as any) || action;
    const title =
      (availData.title as string) ||
      (action.title as string) ||
      "My Availability";
    const description =
      (availData.description as string) || (action.description as string) || "";
    const slots = parseTimeSlots(availData, action);

    if (!slots || slots.length === 0) {
      throw new Error(
        "No time slots provided. Please specify days and times (e.g., 'every day from 9am to 6pm')",
      );
    }

    const { backendActor } = await import("../utils/actor");
    const { getValidAccessToken } = await import("../utils/tokenRefresh");
    const { email, name } = getUserInfo();

    let busyTimes: Array<{ start_time: bigint; end_time: bigint }> = [];
    try {
      const accessToken = await getValidAccessToken();
      if (accessToken) {
        const timeMin = new Date();
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
        if (response.ok) {
          const data = await response.json();
          const events = data.items || [];
          busyTimes = events
            .filter((e: any) => e.start?.dateTime && e.end?.dateTime)
            .map((e: any) => ({
              start_time: BigInt(
                Math.floor(new Date(e.start.dateTime).getTime() / 1000),
              ),
              end_time: BigInt(
                Math.floor(new Date(e.end.dateTime).getTime() / 1000),
              ),
            }));
        }
      }
    } catch (error) {
      console.warn("⚠️ Failed to fetch busy times:", error);
    }

    const request = {
      title,
      description,
      slots,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      owner_email: (email ? [email] : []) as [] | [string],
      owner_name: (name ? [name] : []) as [] | [string],
      busy_times: (busyTimes.length > 0 ? [busyTimes] : []) as
        | []
        | [Array<{ start_time: bigint; end_time: bigint }>],
    };

    const result = await backendActor.create_availability(request);
    if ("Err" in result) throw new Error(result.Err);

    queryClient.invalidateQueries({ queryKey: ["availabilities"] });
    const daysText = slots.length === 7 ? "every day" : `${slots.length} days`;
    return `Created availability "${title}" for ${daysText}`;
  };

  const handleUpdateAvailability = async (action: CalendarAction) => {
    const availabilityId =
      (action.availability_id as string) ||
      (action.id as string) ||
      selectedAvailabilityId ||
      availabilities[0]?.id;
    if (!availabilityId) throw new Error("No availability ID found");

    const availData = (action.availability as any) || action.changes || action;
    const title = availData.title as string | undefined;
    const description = availData.description as string | undefined;
    const slots = parseTimeSlots(availData, action);

    const { backendActor } = await import("../utils/actor");
    const request: {
      id: string;
      title: [] | [string];
      description: [] | [string];
      slots:
        | []
        | [
            Array<{
              day_of_week: number;
              start_time: number;
              end_time: number;
            }>,
          ];
      timezone: [] | [string];
    } = {
      id: availabilityId,
      title: title ? [title] : [],
      description: description ? [description] : [],
      slots: slots ? [slots] : [],
      timezone: [],
    };

    const result = await backendActor.update_availability(request);
    if ("Err" in result) throw new Error(result.Err);

    queryClient.invalidateQueries({ queryKey: ["availabilities"] });
    const daysText = slots
      ? slots.length === 7
        ? "every day"
        : `${slots.length} days`
      : "availability";
    return `Updated "${title || "availability"}" for ${daysText}`;
  };

  const executeAction = async (
    result: CalendarAction,
  ): Promise<string | undefined> => {
    const actionType = result.type?.toUpperCase();
    const actions: Record<string, () => Promise<string | undefined>> = {
      ADD_EVENT: async () => await handleCreateEvent(result),
      UPDATE_EVENT: async () => await handleUpdateEvent(result),
      DELETE_EVENT: async () => await handleDeleteEvent(result),
      ADD_AVAILABILITY: async () => await handleAddAvailability(result),
      UPDATE_AVAILABILITY: async () => await handleUpdateAvailability(result),
      NEEDS_CLARIFICATION: async () => undefined,
    };
    const action = actions[actionType];
    return action ? await action() : undefined;
  };

  const handleBulkDelete = useCallback(
    async (filter: string): Promise<AIAgentResponse> => {
      const eventsToDelete = filterEventsByScope(events, filter as FilterScope);
      for (const event of eventsToDelete) {
        try {
          const eventId = event.id || "";
          const eventTitle = event.summary || event.title || "Untitled Event";
          await eventActions.handleDeleteEvent(eventId, eventTitle);
        } catch (error) {
          console.error(`❌ Failed to delete ${event.id}:`, error);
        }
      }
      return {
        feedback: `✅ Successfully deleted ${eventsToDelete.length} event${eventsToDelete.length === 1 ? "" : "s"}.`,
        suggestions: ["Create event", "View events"],
      };
    },
    [events, eventActions],
  );

  return { processMessage, isProcessing, eventActions };
}
