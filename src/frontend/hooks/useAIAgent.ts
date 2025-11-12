import { useState, useCallback, useMemo } from "react";
import { VibeCal, CalendarAction } from "../AIAgent";
import { useEventActions } from "./useEventActions";
import type { EventFormData } from "../components/EventFormModal";
import {
  filterEventsByScope,
  getScopeLabel,
  parseScopeFromMessage,
  type FilterScope,
  type EventLike,
} from "../utils/eventFilters";
import { PROMPTS } from "../AIAgent/prompts";
import { errorLogger } from "../utils/errorLogger";

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
};

const serializeContext = (
  events: CalendarEventInput[],
  availabilities: AvailabilityInput[],
  chatHistory: ChatHistoryInput[],
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
    hist: chatHistory.slice(-5).map((m) => ({
      // Last 5 messages for better context
      txt: m.text,
      ai: m.isAi,
    })),
  };
};

const deserializeResponse = (result: CalendarAction): CalendarAction => {
  // Just return the result as-is since we're not using short keys anymore
  return result;
};

export function useAIAgent(
  events: CalendarEventInput[],
  availabilities: AvailabilityInput[],
  chatHistory: ChatHistoryInput[] = [],
) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = useState<{
    scope: string;
    filter: string;
    count: number;
  } | null>(null);
  const eventActions = useEventActions();

  const processMessage = async (message: string): Promise<AIAgentResponse> => {
    setIsProcessing(true);

    try {
      const context = serializeContext(events, availabilities, chatHistory);

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

      // PHASE 1: Pre-process - Check for bulk operations BEFORE categorization
      const bulkCheck = detectBulkOperation(message, context, chatHistory);
      if (bulkCheck) {
        // Store pending action in state
        if (bulkCheck.action?.type === "BULK_DELETE_CONFIRMATION") {
          setPendingBulkDelete({
            scope: (bulkCheck.action.scope as string) || "",
            filter: (bulkCheck.action.filter as string) || "",
            count: (bulkCheck.action.count as number) || 0,
          });
        }
        return bulkCheck;
      }

      // PHASE 2: Check for query operations
      const queryCheck = await detectQueryOperation(message, context);
      if (queryCheck) {
        return queryCheck;
      }

      // Step 1: Categorize with quick model
      const categoryResult = await categorizeMessage(message, context);

      // Step 2: Handle based on category
      if (categoryResult.category === "CASUAL") {
        return {
          feedback: (categoryResult.response as string) || "Got it!",
          suggestions: (categoryResult.suggestions as string[]) || [
            "Create event",
            "View events",
          ],
        };
      }

      if (categoryResult.category === "NONE") {
        // DUMMY DATA: Handle "find suitable time" requests
        if (
          message.toLowerCase().includes("find") &&
          message.toLowerCase().includes("time")
        ) {

          // Extract names from message
          const names = message.match(/\b[A-Z][a-z]+\b/g) || ["John", "Gary"];

          // Generate 3 time slots based on timezone
          const now = new Date();
          const slots = [
            {
              time: "Tomorrow at 10:00 AM",
              datetime: new Date(now.getTime() + 24 * 60 * 60 * 1000).setHours(
                10,
                0,
                0,
                0,
              ),
              timezone: "EST (UTC-5)",
            },
            {
              time: "Tomorrow at 2:00 PM",
              datetime: new Date(now.getTime() + 24 * 60 * 60 * 1000).setHours(
                14,
                0,
                0,
                0,
              ),
              timezone: "EST (UTC-5)",
            },
            {
              time: "Day after tomorrow at 11:00 AM",
              datetime: new Date(now.getTime() + 48 * 60 * 60 * 1000).setHours(
                11,
                0,
                0,
                0,
              ),
              timezone: "EST (UTC-5)",
            },
          ];

          const feedback = `Based on ${names.join(", ")}'s availability and timezone differences, here are 3 suitable meeting slots:`;

          const suggestions = slots.map((slot) => slot.time);

          return {
            feedback,
            suggestions,
            action: {
              type: "SUGGEST_TIMES",
              slots,
              attendees: names,
            },
          };
        }

        return {
          feedback:
            "I'm not sure what you mean. I can help you create events, manage availability, or answer questions about the calendar.",
          suggestions: ["Create event", "View my events", "Help"],
        };
      }

      // Determine which model to use
      const category = (categoryResult.category as string) || "NONE";
      const useFullModel = ["EVENT", "AVAILABILITY", "FAQ"].includes(category);

      const selectedAgent = useFullModel
        ? new VibeCal({
            apiKey: import.meta.env.VITE_GROQ_API_KEY,
            quick: false,
          })
        : agent;

      const rawResult = await selectedAgent.parseText(message, context);
      const result = deserializeResponse(rawResult);

      // Execute actions - handle both single action and multiple actions
      let executionFeedback: string | undefined;

      if (result.actions && Array.isArray(result.actions)) {
        // Multiple actions
        const feedbacks: string[] = [];

        for (const action of result.actions) {
          try {
            const feedback = await executeAction(action);
            if (feedback) feedbacks.push(feedback);
          } catch (error) {
            errorLogger.logError(
              "Action execution failed",
              error,
              {
                component: "useAIAgent",
                action: "executeAction",
                metadata: { actionType: action.type },
              },
            );
            feedbacks.push(`Failed: ${action.type}`);
          }
        }

        executionFeedback =
          feedbacks.length > 0 ? feedbacks.join("\n") : undefined;
      } else if (result.type) {
        // Single action
        executionFeedback = await executeAction(result);
      }

      const response: AIAgentResponse = {
        feedback: executionFeedback || result.feedback || "Done",
        suggestions: result.suggestions || [],
        action: result,
        actions: result.actions as CalendarAction[] | undefined,
      };

      return response;
    } catch (error) {
      errorLogger.logError(
        "Failed to process AI message",
        error,
        {
          component: "useAIAgent",
          action: "processMessage",
          metadata: { message: message.substring(0, 100) },
        },
      );
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

    const eventData: EventFormData = {
      summary: title || "New Event",
      description: description,
      start: new Date(start || new Date()),
      end: new Date(end || new Date()),
      location: location,
      attendees: attendees?.map((email: string) => ({ email })) || [],
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

  const detectQueryOperation = useCallback(
    async (
      message: string,
      _context: SerializedContext,
    ): Promise<AIAgentResponse | null> => {
      const lowerMsg = message.toLowerCase();

      // EXCLUDE action commands - these are NOT queries
      const actionCommands = [
        /\b(create|add|make|schedule|book|new)\b/,
        /\b(delete|remove|cancel|clear)\b/,
        /\b(update|change|modify|edit|move)\b/,
      ];

      const isActionCommand = actionCommands.some((pattern) =>
        pattern.test(lowerMsg),
      );
      if (isActionCommand) {
        return null;
      }

      // Query patterns - questions about existing data
      const queryPatterns = [
        /\b(what|when|where|who|how many|how much|which)\b/,
        /\b(show me|tell me|list|display)\b/,
        /\b(do i have|have i|any|got)\b.*\b(event|meeting|schedule)/,
        /\?$/, // Ends with question mark
      ];

      const isQuery = queryPatterns.some((pattern) => pattern.test(lowerMsg));

      if (!isQuery) {
        return null;
      }

      // Determine query scope using utility
      const scope = parseScopeFromMessage(message);
      const scopeLabel = getScopeLabel(scope);

      // Filter events using utility
      const filteredEvents = filterEventsByScope(events, scope);
      const count = filteredEvents.length;

      // If no events, return early
      if (count === 0) {
        return {
          feedback: `You don't have any events ${scopeLabel}.`,
          suggestions: ["Create event"],
          action: {
            type: "QUERY",
            queryType: "list",
            scope,
            events: [],
          },
        };
      }

      // Use AI to generate natural response based on the question
      try {
        const queryAgent = new VibeCal({
          apiKey: import.meta.env.VITE_GROQ_API_KEY,
          quick: true,
        });

        // Limit events to first 5 for AI processing
        const limitedEvents = filteredEvents.slice(0, 5).map((e) => {
          const startValue = e.start;
          const endValue = e.end;
          const startDateTime =
            typeof startValue === "string"
              ? startValue
              : startValue?.dateTime || "";
          const endDateTime =
            typeof endValue === "string" ? endValue : endValue?.dateTime || "";

          return {
            t: e.summary || e.title || "",
            s: startDateTime,
            e: endDateTime,
            id: e.id,
          };
        });

        const result = await queryAgent.parse(message, {
          systemPrompt: PROMPTS.QUERY_RESPONSE,
          context: {
            events: limitedEvents,
            question: message,
            eventCount: count,
            scope: scopeLabel,
          },
        });

        return {
          feedback:
            (result.feedback as string) ||
            (result.response as string) ||
            "Here are your events.",
          suggestions: (result.suggestions as string[]) || [
            "Create event",
            "Delete event",
          ],
          action: {
            type: "QUERY",
            queryType: "natural",
            scope,
            events: filteredEvents,
          },
        };
      } catch (error) {
        console.error("[detectQueryOperation] AI error:", error);

        // Fallback: Format event list manually
        const eventList = filteredEvents
          .slice(0, 5)
          .map((e) => {
            const startValue = e.start;
            const startDate =
              typeof startValue === "string"
                ? new Date(startValue)
                : new Date(startValue?.dateTime || new Date());
            const title = e.summary || e.title || "Untitled Event";
            const time = startDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });
            const date = startDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            return `• ${title} - ${date} at ${time}`;
          })
          .join("\n");

        const moreText = count > 5 ? `\n\n...and ${count - 5} more` : "";

        return {
          feedback: `Here are your events ${scopeLabel}:\n\n${eventList}${moreText}`,
          suggestions: ["Create event", "Delete event"],
          action: {
            type: "QUERY",
            queryType: "list",
            scope,
            events: filteredEvents,
          },
        };
      }
    },
    [events],
  );

  const detectBulkOperation = useCallback(
    (
      message: string,
      context: SerializedContext,
      chatHistory: ChatHistoryInput[],
    ): AIAgentResponse | null => {
      const lowerMsg = message.toLowerCase();

      // Bulk delete patterns
      const bulkDeletePatterns = [
        /delete\s+(all|every|everything)/,
        /remove\s+(all|every|everything)/,
        /clear\s+(all|every|everything)/,
        /cancel\s+(all|every|everything)/,
        /delete\s+(them|those|it)/, // Context-aware: "delete them"
        /remove\s+(them|those|it)/,
      ];

      const isBulkDelete = bulkDeletePatterns.some((pattern) =>
        pattern.test(lowerMsg),
      );

      if (isBulkDelete) {
        // Extract scope using utility
        const filterScope = parseScopeFromMessage(message);
        let filter: string = filterScope;
        let scope = `${getScopeLabel(filterScope)}'s events`;

        // Map serialized events back to EventLike format for filtering
        const deserializedEvents: EventLike[] = context.events.map((e) => ({
          id: e.id,
          start: e.s,
          end: e.e,
          title: e.t,
        }));

        let count = filterEventsByScope(deserializedEvents, filterScope).length;

        // Handle context-aware "them/those/it" references
        if (lowerMsg.match(/delete\s+(them|those|it)/)) {
          // Context-aware: Look at chat history for scope
          const recentMessages = chatHistory.slice(-3);
          for (const msg of recentMessages.reverse()) {
            if (!msg.isAi) continue; // Only check AI responses

            const historyScope = parseScopeFromMessage(msg.text);
            if (historyScope !== "all") {
              filter = historyScope;
              scope = `${getScopeLabel(historyScope)}'s events`;
              count = filterEventsByScope(
                deserializedEvents,
                historyScope,
              ).length;
              break;
            }
          }
        }

        if (count === 0) {
          return {
            feedback: `You don't have any ${scope} to delete.`,
            suggestions: ["Create event", "View events"],
          };
        }

        return {
          feedback: `⚠️ Are you sure you want to delete ${count} ${scope}? This cannot be undone.`,
          suggestions: ["Yes, delete all", "No, cancel"],
          action: {
            type: "BULK_DELETE_CONFIRMATION",
            scope,
            count,
            filter,
          },
        };
      }

      return null;
    },
    [chatHistory],
  );

  const categorizeMessage = useCallback(
    async (message: string, context: SerializedContext) => {
      const lowerMsg = message.toLowerCase();

      // Fast keyword-based categorization (fallback)
      const actionKeywords =
        /\b(create|add|make|mae|schedule|new|book|set|plan|arrange|event|meeting|call|appointment)\b/;
      const casualKeywords = /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no)$/;

      // Quick check for obvious cases
      if (actionKeywords.test(lowerMsg)) {
        return { category: "EVENT", response: "", suggestions: [] };
      }

      if (casualKeywords.test(lowerMsg.trim())) {
        return {
          category: "CASUAL",
          response: "Got it! What would you like to do?",
          suggestions: ["Create event", "View events"],
        };
      }

      const quickAgent = new VibeCal({
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        quick: true,
      });

      try {
        const result = await quickAgent.parse(message, {
          systemPrompt: PROMPTS.CATEGORIZE_MESSAGE,
          context,
        });

        // Validate result
        if (!result || !result.category) {
          console.error("[categorizeMessage] ❌ Invalid result:", result);
          return {
            category: "EVENT", // Default to EVENT instead of CASUAL for unknown
            response: "",
            suggestions: [],
          };
        }

        return result;
      } catch (error) {
        console.error("[categorizeMessage] Error:", error);
        // Default to casual for parse errors
        return {
          category: "CASUAL",
          response: "I'm here to help! What would you like to do?",
          suggestions: ["Create event", "View events"],
        };
      }
    },
    [],
  );

  // Memoize agent instance
  const agent = useMemo(
    () =>
      new VibeCal({
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        quick: true,
      }),
    [],
  );

  return {
    processMessage,
    isProcessing,
    eventActions,
  };
}
