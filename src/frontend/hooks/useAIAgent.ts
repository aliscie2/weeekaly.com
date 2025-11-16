import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { VibeCal, CalendarAction } from "../AIAgent";
import { useEventActions } from "./useEventActions";
import type { EventFormData } from "../components/EventFormModal";
import { filterEventsByScope, type FilterScope } from "../utils/eventFilters";
import { PROMPTS } from "../AIAgent/prompts";
import { errorLogger } from "../utils/errorLogger";
import {
  getAvailabilitySummary,
  type Availability as AvailabilityType,
  type AvailabilityEvent as AvailabilityEventType,
} from "../utils/availabilityHelpers";

interface AIAgentResponse {
  feedback: string;
  suggestions: string[];
  action?: CalendarAction;
  actions?: CalendarAction[];
}

type CalendarEventInput = {
  id: string;
  summary?: string;
  title?: string;
  start?: { dateTime?: string } | string;
  end?: { dateTime?: string } | string;
  startTime?: string;
  endTime?: string;
};

type AvailabilityInput = {
  id: string;
  name: string;
};

type ChatHistoryInput = {
  text: string;
  isAi: boolean;
};

type SerializedContext = {
  now: {
    iso: string;
    date: string;
    time: string;
    timezone: string;
    offset: number;
  };
  events: Array<{ id: string; t: string; s: string; e: string }>;
  avail: Array<{ id: string; n: string }>;
  hist: Array<{ txt: string; ai: boolean }>;
  selectedAvail?: string | null;
};

const serializeContext = (
  events: CalendarEventInput[],
  availabilities: AvailabilityInput[],
  chatHistory: ChatHistoryInput[],
  selectedAvailabilityId: string | null = null,
): SerializedContext => {
  const now = new Date();

  return {
    // Current time context
    now: {
      iso: now.toISOString(),
      date: now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: -now.getTimezoneOffset() / 60, // Hours from UTC
    },
    events: events.map((e) => {
      const startValue = e.start;
      const endValue = e.end;
      const startDateTime =
        typeof startValue === "string"
          ? startValue
          : startValue?.dateTime || e.startTime || "";
      const endDateTime =
        typeof endValue === "string"
          ? endValue
          : endValue?.dateTime || e.endTime || "";

      return {
        id: e.id,
        t: e.summary || e.title || "", // title
        s: startDateTime, // start
        e: endDateTime, // end
      };
    }),
    avail: availabilities.map((a) => ({
      id: a.id,
      n: a.name, // name
    })),
    hist: chatHistory.slice(-10).map((m) => ({
      // Last 10 messages for better context
      txt: m.text,
      ai: m.isAi,
    })),
    selectedAvail: selectedAvailabilityId, // Selected availability ID
  };
};

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
      // Removed to reduce noise - see detailed logs below

      // Check if user is confirming a pending bulk delete
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

      // PHASE 1: Quick model categorizes and extracts metadata (no context needed)
      const quickAgent = new VibeCal({
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        quick: true,
      });

      // Quick model processing...
      const category = await quickAgent.parse(message, {
        systemPrompt: PROMPTS.CATEGORIZE_MESSAGE,
      });

      console.log("═══════════════════════════════════════════════════");
      console.log("🔍 QUICK MODEL RESPONSE (Raw):");
      console.log(JSON.stringify(category, null, 2));
      console.log("═══════════════════════════════════════════════════");

      // Category and metadata shown in raw response above

      // Handle casual responses immediately (no need for full model)
      if (category.type === "CASUAL") {
        return {
          feedback: category.feedback || "Got it!",
          suggestions: category.suggestions || ["Create event", "View events"],
        };
      }

      // PHASE 1.5: Extract emails, duration, and fetch availabilities
      let extractedEmails: string[] = [];
      let emailAvailabilities: any[] = [];
      let duration: { start: Date; end: Date } | null = null;

      const metadata = category.metadata as any;

      // Extract duration for event filtering
      if (metadata?.duration) {
        try {
          duration = {
            start: new Date(metadata.duration.start),
            end: new Date(metadata.duration.end),
          };
          // Duration extracted (shown in quick model response)
        } catch (error) {
          console.warn("[useAIAgent] ⚠️ Failed to parse duration:", error);
        }
      }

      if (metadata?.emails && Array.isArray(metadata.emails)) {
        extractedEmails = metadata.emails as string[];
        // Emails extracted (shown in quick model response)

        // Fetch availabilities for extracted emails
        if (extractedEmails.length > 0) {
          try {
            const { backendActor } = await import("../utils/actor");
            const availabilitiesResult =
              await backendActor.search_by_emails(extractedEmails);

            // Flatten the results (search_by_emails returns Vec<Vec<Availability>>)
            const flatResults = availabilitiesResult.flat();

            // BigInt values are already converted to numbers by backendCaster
            emailAvailabilities = flatResults;

            // Availabilities fetched
          } catch (error) {
            console.error(
              "[useAIAgent] ❌ Failed to fetch availabilities:",
              error,
            );
          }
        }
      }

      // Add current user's email if not already included
      const currentUserEmail = localStorage.getItem("ic-user-email");
      if (
        currentUserEmail &&
        extractedEmails.length > 0 &&
        !extractedEmails.includes(currentUserEmail)
      ) {
        extractedEmails.push(currentUserEmail);
        // Current user email added
      }

      // Final emails list prepared

      // Filter events by duration BEFORE passing to AI (CRITICAL OPTIMIZATION)
      let filteredEvents = events;
      if (duration) {
        filteredEvents = events.filter((e: any) => {
          const eventStart = new Date(
            e.start?.dateTime || e.start?.date || e.startTime || new Date(),
          );
          return eventStart >= duration.start && eventStart <= duration.end;
        });
        // Events filtered by duration
      }

      // CRITICAL: Fetch other users' events during the requested duration
      let otherUsersEvents: any[] = [];
      if (extractedEmails.length > 0 && duration) {
        try {
          console.log("═══════════════════════════════════════════════════");
          console.log("📅 FETCHING OTHER USERS' EVENTS:");
          console.log("Emails:", extractedEmails);
          console.log("Duration:", {
            start: duration.start.toISOString(),
            end: duration.end.toISOString(),
          });

          // For each email, fetch their events from Google Calendar
          for (const email of extractedEmails) {
            if (email === currentUserEmail) continue; // Skip current user

            try {
              // Get the availability to find their calendar ID
              const avail = emailAvailabilities.find(
                (a: any) => a.owner_email && a.owner_email[0] === email,
              );

              if (!avail) {
                console.log(`⚠️ No availability found for ${email}`);
                continue;
              }

              // Use their busy_times if available (already stored in backend)
              if (avail.busy_times && Array.isArray(avail.busy_times)) {
                console.log(
                  `✅ Using busy_times for ${email}:`,
                  avail.busy_times.length,
                  "events",
                );
                avail.busy_times.forEach((busyTime: any) => {
                  const startTime = new Date(
                    Number(busyTime.start_time) * 1000,
                  );
                  const endTime = new Date(Number(busyTime.end_time) * 1000);

                  // Only include if within requested duration
                  if (
                    startTime >= duration.start &&
                    startTime <= duration.end
                  ) {
                    otherUsersEvents.push({
                      start: { dateTime: startTime.toISOString() },
                      end: { dateTime: endTime.toISOString() },
                      summary: `Busy (${email})`,
                      email: email,
                    });
                  }
                });
              }
            } catch (error) {
              console.error(`❌ Failed to fetch events for ${email}:`, error);
            }
          }

          console.log("Total other users' events:", otherUsersEvents.length);
          console.log("═══════════════════════════════════════════════════");
        } catch (error) {
          console.error(
            "[useAIAgent] ❌ Failed to fetch other users' events:",
            error,
          );
        }
      }

      // Calculate mutual availability if we have multiple people's availabilities
      let mutualAvailability: any[] = [];
      if (emailAvailabilities.length > 0) {
        try {
          // Get current user's availability
          const currentUserAvailability = availabilities.find(() => {
            // Match by checking if this is the user's availability
            return true; // For now, use the first/selected availability
          });

          if (currentUserAvailability && emailAvailabilities.length > 0) {
            // Prepare availabilities for summary calculation
            const allAvailabilities: AvailabilityType[] = [
              // Current user's availability
              {
                id: currentUserAvailability.id,
                owner: "current-user",
                title: currentUserAvailability.name,
                description: "",
                slots: (currentUserAvailability as any).slots || [],
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                created_at: BigInt(0),
                updated_at: BigInt(0),
              },
              // Other users' availabilities (BigInt already converted to numbers by backendCaster)
              ...emailAvailabilities.map((avail: any) => ({
                id: avail.id,
                owner: avail.owner,
                title: avail.title,
                description: avail.description || "",
                slots: avail.slots || [],
                timezone:
                  avail.timezone ||
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                // Convert numbers back to BigInt for internal calculation
                created_at: BigInt(avail.created_at || 0),
                updated_at: BigInt(avail.updated_at || 0),
              })),
            ];

            // Convert events to AvailabilityEventType
            // Include BOTH current user's events AND other users' events
            const allBusyEvents = [...filteredEvents, ...otherUsersEvents];

            const availabilityEvents: AvailabilityEventType[] =
              allBusyEvents.map((e: any) => ({
                startTime: new Date(
                  e.start?.dateTime ||
                    e.start?.date ||
                    e.startTime ||
                    new Date(),
                ),
                endTime: new Date(
                  e.end?.dateTime || e.end?.date || e.endTime || new Date(),
                ),
              }));

            // Calculate for next 7 days
            const startTime = new Date();
            startTime.setHours(0, 0, 0, 0);
            const endTime = new Date(startTime);
            endTime.setDate(endTime.getDate() + 7);

            console.log("═══════════════════════════════════════════════════");
            console.log("🔍 CALCULATING MUTUAL AVAILABILITY:");
            console.log(
              "All availabilities:",
              allAvailabilities.map((a) => ({
                id: a.id,
                title: a.title,
                slots: a.slots,
              })),
            );
            console.log(
              "Events (busy times):",
              availabilityEvents.map((e) => ({
                start: e.startTime.toISOString(),
                end: e.endTime.toISOString(),
              })),
            );
            console.log("Time range:", {
              start: startTime.toISOString(),
              end: endTime.toISOString(),
            });

            // Get mutual availability summary
            mutualAvailability = getAvailabilitySummary(
              allAvailabilities,
              availabilityEvents,
              startTime,
              endTime,
            );

            console.log(
              "Result - Free time slots:",
              mutualAvailability.map((block) => ({
                start: new Date(block.start).toISOString(),
                end: new Date(block.end).toISOString(),
                durationMinutes: Math.round(
                  (block.end - block.start) / (1000 * 60),
                ),
              })),
            );
            console.log("═══════════════════════════════════════════════════");
          }
        } catch (error) {
          console.error(
            "[useAIAgent] ❌ Failed to calculate mutual availability:",
            error,
          );
        }
      }

      // PHASE 2: Full model handles the action with full context + metadata
      // Use filtered events instead of all events (CRITICAL OPTIMIZATION)
      const context = serializeContext(
        filteredEvents,
        availabilities,
        chatHistory,
        selectedAvailabilityId,
      );

      // Convert mutual availability to readable format for AI
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

      // Add extracted metadata to context
      const enrichedContext = {
        ...context,
        extracted: {
          ...(category.metadata || {}),
          emails: extractedEmails, // Updated emails list with current user
          emailAvailabilities: emailAvailabilities, // Fetched availabilities
          mutualAvailability: readableMutualAvailability, // Calculated mutual free time (readable format)
        },
      };

      // Context prepared for full model

      const fullAgent = new VibeCal({
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        quick: false,
      });

      // Full model processing...
      const result = await fullAgent.parse(message, {
        systemPrompt: PROMPTS.GENERIC_CALENDAR_ASSISTANT,
        context: enrichedContext,
      });

      console.log("═══════════════════════════════════════════════════");
      console.log("🤖 FULL MODEL RESPONSE (Raw):");
      console.log(JSON.stringify(result, null, 2));
      console.log("═══════════════════════════════════════════════════");

      // AI result shown in raw response above

      // Handle CHECK_AVAILABILITY - format mutual availability into readable feedback
      if (
        (result.type as string) === "CHECK_AVAILABILITY" &&
        mutualAvailability.length > 0
      ) {
        const formatTimeSlot = (block: any) => {
          const start = new Date(block.start); // Use block.start, not block.startTime
          const end = new Date(block.end); // Use block.end, not block.endTime
          const duration = Math.round(
            (end.getTime() - start.getTime()) / (1000 * 60),
          ); // minutes

          const timeStr = start.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          const endTimeStr = end.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });

          const hours = Math.floor(duration / 60);
          const mins = duration % 60;
          const durationStr =
            hours > 0
              ? `${hours}h ${mins > 0 ? mins + "min" : ""}`.trim()
              : `${mins}min`;

          return `• ${timeStr} - ${endTimeStr} (${durationStr})`;
        };

        const emailsList = extractedEmails
          .filter((e) => e !== currentUserEmail)
          .join(", ");
        const slotsText = mutualAvailability
          .slice(0, 10)
          .map(formatTimeSlot)
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

      // Handle clarification requests (no action to execute)
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
        // Multiple actions
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
        // Single action
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
      return {
        feedback: errorMessage,
        suggestions: ["Try again", "Cancel"],
      };
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateEvent = async (action: CalendarAction) => {
    const title = action.title as string | undefined;
    const description = action.description as string | undefined;
    const start = action.start as string | undefined;
    const end = action.end as string | undefined;
    const location = action.location as string | undefined;
    const attendees = action.attendees as string[] | undefined;
    const meetingLink = action.meeting_link as boolean | undefined;

    // Get current user's email and name
    const currentUserEmail = localStorage.getItem("ic-user-email");
    const currentUserName = localStorage.getItem("ic-user-name");

    // Build attendees list - always include current user first
    const attendeesList: Array<{ email: string; displayName?: string }> = [];

    // Add current user if available
    if (currentUserEmail) {
      attendeesList.push({
        email: currentUserEmail,
        displayName: currentUserName || undefined,
      });
    }

    // Add other attendees (avoid duplicates)
    if (attendees && attendees.length > 0) {
      attendees.forEach((email: string) => {
        if (email !== currentUserEmail) {
          attendeesList.push({ email });
        }
      });
    }

    console.log("[useAIAgent] 📧 Final attendees list:", attendeesList);

    const eventData: EventFormData = {
      summary: title || "New Event",
      description: description,
      start: new Date(start || new Date()),
      end: new Date(end || new Date()),
      location: location,
      attendees: attendeesList,
      conferenceData: meetingLink !== undefined,
    };

    eventActions.handleFormSubmit(eventData);

    // Return formatted feedback
    const startDate = eventData.start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const startTime = eventData.start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `Created "${eventData.summary}" on ${startDate} at ${startTime}`;
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

    if (!event) {
      console.error("[useAIAgent] ❌ Event not found");
      throw new Error("Event not found");
    }

    const startValue = event.start;
    const endValue = event.end;
    const startDateTime =
      typeof startValue === "string"
        ? startValue
        : startValue?.dateTime || new Date().toISOString();
    const endDateTime =
      typeof endValue === "string"
        ? endValue
        : endValue?.dateTime || new Date().toISOString();

    const updates: Partial<EventFormData> = {
      summary: event.summary || event.title || "Untitled Event",
      start: new Date(startDateTime),
      end: new Date(endDateTime),
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
        const time = updates.start.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        changesList.push(`start time to ${time}`);
      }
      if (changes.end) {
        updates.end = new Date(changes.end);
        const time = updates.end.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        changesList.push(`end time to ${time}`);
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

    // Return formatted feedback
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

    if (!event) {
      console.error("[useAIAgent] ❌ Not found:", eventTitle);
      throw new Error(`Event not found: "${eventTitle}"`);
    }

    const foundEventTitle = event.summary || event.title || "Untitled Event";
    eventActions.handleDeleteEvent(event.id, foundEventTitle);

    // Return formatted feedback
    return `Deleted "${foundEventTitle}"`;
  };

  const handleAddAvailability = async (action: CalendarAction) => {
    console.log("[useAIAgent] 📥 Raw action received:", action);

    // Check if data is nested in 'availability' object
    const availData = (action.availability as any) || action;

    const title =
      (availData.title as string) ||
      (action.title as string) ||
      "My Availability";
    const description =
      (availData.description as string) || (action.description as string) || "";

    // Check if AI returned slots in the correct format
    let slots = (availData.slots || action.slots) as
      | Array<{
          day_of_week: number;
          start_time: number;
          end_time: number;
        }>
      | undefined;

    // If not, try to convert from AI's format (days, startTime, endTime)
    if (!slots || slots.length === 0) {
      const days = (availData.days || action.days) as string[] | undefined;
      const startTime = (availData.startTime || action.startTime) as
        | string
        | undefined;
      const endTime = (availData.endTime || action.endTime) as
        | string
        | undefined;

      console.log("[useAIAgent] 🔄 Converting AI format:", {
        days,
        startTime,
        endTime,
      });

      if (days && startTime && endTime) {
        // Convert day names to day_of_week numbers
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

        // Convert time strings to minutes from midnight
        const parseTime = (timeStr: string): number => {
          const [hours, minutes] = timeStr.split(":").map(Number);
          return hours * 60 + minutes;
        };

        const start_time = parseTime(startTime);
        const end_time = parseTime(endTime);

        // Create slots for each day
        slots = days.map((dayName) => {
          const day_of_week = dayMap[dayName.toLowerCase()];
          return { day_of_week, start_time, end_time };
        });

        console.log("[useAIAgent] ✅ Converted to slots:", slots);
      }
    }

    console.log("═══════════════════════════════════════════════════");
    console.log("📊 AVAILABILITY SLOTS TO CREATE:");
    console.log("Title:", title);
    console.log("Slots:", JSON.stringify(slots, null, 2));
    console.log("═══════════════════════════════════════════════════");

    if (!slots || slots.length === 0) {
      console.error("[useAIAgent] ❌ No slots found in action:", action);
      console.error(
        "[useAIAgent] 🔍 Full action object:",
        JSON.stringify(action, null, 2),
      );
      throw new Error(
        "No time slots provided. Please specify days and times (e.g., 'every day from 9am to 6pm')",
      );
    }

    // Import dynamically to avoid circular dependency
    const { backendActor } = await import("../utils/actor");
    const { getValidAccessToken } = await import("../utils/tokenRefresh");

    // Get email and name from localStorage
    const email = localStorage.getItem("ic-user-email");
    const name = localStorage.getItem("ic-user-name");

    // Fetch busy times from Google Calendar
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
      console.warn("[useAIAgent] ⚠️ Failed to fetch busy times:", error);
      // Continue without busy times
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

    if ("Err" in result) {
      console.error("[useAIAgent] ❌ Backend error:", result.Err);
      throw new Error(result.Err);
    }

    console.log("[useAIAgent] ✅ Availability created:", result.Ok);

    // Invalidate React Query cache to refetch availabilities
    // queryClient is already available from the hook scope
    queryClient.invalidateQueries({ queryKey: ["availabilities"] });

    // Return formatted feedback
    const daysText = slots.length === 7 ? "every day" : `${slots.length} days`;
    return `Created availability "${title}" for ${daysText}`;
  };

  const handleUpdateAvailability = async (action: CalendarAction) => {
    console.log("[useAIAgent] 📥 Update availability action:", action);

    // Get the availability ID - priority: action > selected > first
    const availabilityId =
      (action.availability_id as string) ||
      (action.id as string) ||
      selectedAvailabilityId ||
      availabilities[0]?.id; // Default to first if only one exists

    if (!availabilityId) {
      throw new Error("No availability ID found");
    }

    console.log("[useAIAgent] 🔄 Updating availability:", availabilityId);

    // Check if data is nested
    const availData = (action.availability as any) || action.changes || action;

    const title = availData.title as string | undefined;
    const description = availData.description as string | undefined;

    // Convert slots if provided
    let slots:
      | Array<{
          day_of_week: number;
          start_time: number;
          end_time: number;
        }>
      | undefined;

    if (availData.slots) {
      slots = availData.slots;
    } else if (availData.days && availData.startTime && availData.endTime) {
      // Convert from AI format
      const dayMap: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };

      const parseTime = (timeStr: string): number => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        return hours * 60 + minutes;
      };

      const start_time = parseTime(availData.startTime);
      const end_time = parseTime(availData.endTime);

      slots = (availData.days as string[]).map((dayName) => ({
        day_of_week: dayMap[dayName.toLowerCase()],
        start_time,
        end_time,
      }));
    }

    console.log("[useAIAgent] 📊 Update data:", { title, description, slots });

    // Import backend actor
    const { backendActor } = await import("../utils/actor");

    // Build update request (Candid optional format)
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

    console.log("[useAIAgent] 📤 Sending update request:", request);

    const result = await backendActor.update_availability(request);

    if ("Err" in result) {
      console.error("[useAIAgent] ❌ Backend error:", result.Err);
      throw new Error(result.Err);
    }

    console.log("[useAIAgent] ✅ Availability updated:", result.Ok);

    // Invalidate cache
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
      ADD_EVENT: async () => {
        return await handleCreateEvent(result);
      },
      UPDATE_EVENT: async () => {
        return await handleUpdateEvent(result);
      },
      DELETE_EVENT: async () => {
        return await handleDeleteEvent(result);
      },
      ADD_AVAILABILITY: async () => {
        return await handleAddAvailability(result);
      },
      UPDATE_AVAILABILITY: async () => {
        return await handleUpdateAvailability(result);
      },
      NEEDS_CLARIFICATION: async () => {
        return undefined;
      },
    };

    const action = actions[actionType];
    if (action) {
      return await action();
    } else {
      return undefined;
    }
  };

  const handleBulkDelete = useCallback(
    async (filter: string): Promise<AIAgentResponse> => {
      // Filter events using utility
      const eventsToDelete = filterEventsByScope(events, filter as FilterScope);

      // Delete all filtered events
      for (const event of eventsToDelete) {
        try {
          const eventId = event.id || "";
          const eventTitle = event.summary || event.title || "Untitled Event";
          await eventActions.handleDeleteEvent(eventId, eventTitle);
        } catch (error) {
          console.error(`[useAIAgent] ❌ Failed to delete ${event.id}:`, error);
        }
      }

      return {
        feedback: `✅ Successfully deleted ${eventsToDelete.length} event${eventsToDelete.length === 1 ? "" : "s"}.`,
        suggestions: ["Create event", "View events"],
      };
    },
    [events, eventActions],
  );

  return {
    processMessage,
    isProcessing,
    eventActions,
  };
}
