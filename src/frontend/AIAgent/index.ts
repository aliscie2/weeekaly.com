import { askAI } from "./askAI";
import { PROMPTS } from "./prompts";

// Generic calendar action types
type CalendarActionType =
  | "ADD_EVENT"
  | "UPDATE_EVENT"
  | "DELETE_EVENT"
  | "SET_AVAILABILITY"
  | "UPDATE_AVAILABILITY"
  | "DELETE_AVAILABILITY"
  | "BLOCK_SLOT"
  | "UNBLOCK_SLOT"
  | "NEEDS_CLARIFICATION"
  | "SUGGEST_ALTERNATIVES"
  | "SUGGEST_TIMES"
  | "QUERY"
  | "BULK_DELETE_CONFIRMATION";

export interface CalendarAction {
  type: CalendarActionType;
  mainContext?: "AVAILABILITY" | "EVENT" | "SLOT" | "UNKNOWN";
  requiredContext?: string;
  feedback?: string;
  options?: string[];
  suggestions?: string[];
  [key: string]: unknown;
}

type VibeCalConfig = {
  apiKey: string;
  quick?: boolean;
};

type ParseOptions = {
  systemPrompt?: string;
  context?: Record<string, unknown> | undefined;
};

export class VibeCal {
  private config: VibeCalConfig;

  constructor(config: VibeCalConfig) {
    this.config = config;
  }

  /**
   * Generic parse method - accepts custom system prompt and context
   */
  async parse(text: string, options?: ParseOptions): Promise<CalendarAction> {
    const systemPrompt = options?.systemPrompt || this.getDefaultSystemPrompt();
    const contextStr = options?.context
      ? `\n\nContext: ${JSON.stringify(options.context)}`
      : "";

    try {
      const result = await askAI(
        text + contextStr,
        systemPrompt,
        this.config.apiKey,
        this.config.quick ?? true,
      );

      // Extract JSON from response (handle markdown code blocks and malformed JSON)
      let jsonStr = result.response.trim();

      // Remove markdown code blocks if present
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        // If no code block, try to find JSON object boundaries
        const startIdx = jsonStr.indexOf("{");
        const endIdx = jsonStr.lastIndexOf("}");
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonStr = jsonStr.substring(startIdx, endIdx + 1);
        }
      }

      try {
        const parsed = JSON.parse(jsonStr);

        // Detect if AI returned wrong format (query data instead of action)
        if (parsed.eventCount || parsed.events || parsed.scope) {
          return {
            type: "NEEDS_CLARIFICATION",
            feedback:
              "I'm having trouble understanding that. Could you rephrase?",
            suggestions: ["Create event", "View events", "Help"],
          };
        }

        // If multiple feedback fields, keep only the first
        if (
          typeof parsed.feedback === "object" &&
          Array.isArray(parsed.feedback)
        ) {
          parsed.feedback = parsed.feedback[0];
        }

        return parsed;
      } catch (parseError) {
        // Try to detect if AI returned multiple separate JSON objects
        // This happens when AI doesn't follow the "actions" array format
        const multipleJsonMatch = jsonStr.match(/\{[^}]+\}/g);
        if (multipleJsonMatch && multipleJsonMatch.length > 1) {
          try {
            const actions = multipleJsonMatch
              .map((json) => {
                try {
                  return JSON.parse(json);
                } catch {
                  return null;
                }
              })
              .filter((obj) => obj !== null);

            if (actions.length > 0) {
              return {
                type: "ADD_EVENT",
                feedback: `Creating ${actions.length} events for you`,
                suggestions: ["View calendar", "Delete all"],
                actions,
              };
            }
          } catch (combineError) {
            console.error(
              "[VibeCal] ❌ Failed to combine multiple JSON objects:",
              combineError instanceof Error
                ? combineError.message
                : String(combineError),
            );
          }
        }

        console.error(
          "[VibeCal] ❌ JSON parse failed:",
          parseError instanceof Error ? parseError.message : String(parseError),
        );

        // Return a fallback response with helpful error
        return {
          type: "NEEDS_CLARIFICATION",
          feedback:
            "I'm having trouble processing that request. The AI response was malformed. Please try again.",
          suggestions: ["Try again", "Create event", "Help"],
        };
      }
    } catch (error) {
      console.error(
        "[VibeCal] ❌ Parse error:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        type: "NEEDS_CLARIFICATION",
        feedback:
          "I'm having trouble processing your request. Could you try rephrasing it?",
        suggestions: ["Create event", "View events", "Help"],
      };
    }
  }

  /**
   * Convenience method for parsing event creation
   */
  async parseEventText(
    text: string,
    context?: Record<string, any>,
  ): Promise<CalendarAction> {
    const options: ParseOptions = {
      systemPrompt: this.getEventSystemPrompt(),
    };
    if (context) options.context = context;
    return this.parse(text, options);
  }

  /**
   * Convenience method for parsing availability
   */
  async parseAvailability(
    text: string,
    context?: Record<string, any>,
  ): Promise<CalendarAction> {
    const options: ParseOptions = {
      systemPrompt: this.getAvailabilitySystemPrompt(),
    };
    if (context) options.context = context;
    return this.parse(text, options);
  }

  /**
   * Convenience method for parsing event updates
   */
  async parseEventUpdate(
    text: string,
    eventContext: Record<string, any>,
  ): Promise<CalendarAction> {
    return this.parse(text, {
      systemPrompt: this.getEventUpdateSystemPrompt(),
      context: eventContext,
    });
  }

  private getDefaultSystemPrompt(): string {
    return PROMPTS.DEFAULT;
  }

  private getEventSystemPrompt(): string {
    return PROMPTS.EVENT_CREATION;
  }

  private getAvailabilitySystemPrompt(): string {
    return PROMPTS.AVAILABILITY;
  }

  private getEventUpdateSystemPrompt(): string {
    return PROMPTS.EVENT_UPDATE;
  }

  /**
   * Schedule with availability context - suggests alternatives if unavailable
   */
  async scheduleWithContext(
    text: string,
    context: {
      myAvailabilities: any[];
      othersAvailabilities: any[];
      events: any[];
    },
  ): Promise<CalendarAction> {
    return this.parse(text, {
      systemPrompt: PROMPTS.SCHEDULE_WITH_CONTEXT,
      context,
    });
  }

  /**
   * Update specific availability from multiple availabilities
   */
  async updateAvailability(
    text: string,
    context: { availabilities: any[] },
  ): Promise<CalendarAction> {
    return this.parse(text, {
      systemPrompt: PROMPTS.UPDATE_AVAILABILITY,
      context,
    });
  }

  /**
   * Delete an event
   */
  async deleteEvent(
    text: string,
    context: { events: any[] },
  ): Promise<CalendarAction> {
    return this.parse(text, { systemPrompt: PROMPTS.DELETE_EVENT, context });
  }

  /**
   * Delete an availability
   */
  async deleteAvailability(
    text: string,
    context: { availabilities: any[] },
  ): Promise<CalendarAction> {
    return this.parse(text, {
      systemPrompt: PROMPTS.DELETE_AVAILABILITY,
      context,
    });
  }

  /**
   * Unified API - Automatically categorizes and routes requests
   * This is the main method users should call
   */
  async parseText(text: string, context?: any): Promise<CalendarAction> {
    try {
      // Step 1: Categorize the intent
      const intent = await this.categorizeIntent(text, context);

      // Step 2: Route to appropriate method based on intent
      switch (intent.category) {
        case "CREATE_EVENT":
          return this.parseEventText(text, context);

        case "UPDATE_EVENT":
          return this.parseEventUpdate(text, context?.currentEvent || context);

        case "DELETE_EVENT":
          return this.deleteEvent(text, context);

        case "CREATE_AVAILABILITY":
          return this.parseAvailability(text, context);

        case "UPDATE_AVAILABILITY":
          return this.updateAvailability(text, context);

        case "DELETE_AVAILABILITY":
          return this.deleteAvailability(text, context);

        case "SCHEDULE":
          return this.scheduleWithContext(text, context);

        case "NEEDS_CLARIFICATION":
          return this.parseWithClarification(text, context);

        default:
          // Fallback to clarification if unsure
          return this.parseWithClarification(text, context);
      }
    } catch (error) {
      console.error(
        "[VibeCal] ❌ parseText error:",
        error instanceof Error ? error.message : String(error),
      );
      return {
        type: "NEEDS_CLARIFICATION",
        feedback:
          "I'm having trouble processing your request. Could you try rephrasing it?",
        suggestions: ["Create event", "View events", "Help"],
      };
    }
  }

  /**
   * Categorize user intent to determine which operation to perform
   * @private
   */
  private async categorizeIntent(
    text: string,
    context?: any,
  ): Promise<{ category: string; confidence: number }> {
    try {
      const result = await askAI(
        text + (context ? `\n\nContext: ${JSON.stringify(context)}` : ""),
        PROMPTS.CATEGORIZE_INTENT,
        this.config.apiKey,
        true, // Use quick model for categorization
      );

      // Extract JSON - handle multiple objects by taking only the first
      let jsonStr = result.response.trim();

      // Remove markdown code blocks if present
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      // Find the first complete JSON object
      const firstBraceIdx = jsonStr.indexOf("{");
      if (firstBraceIdx !== -1) {
        let braceCount = 0;
        let endIdx = firstBraceIdx;

        for (let i = firstBraceIdx; i < jsonStr.length; i++) {
          if (jsonStr[i] === "{") braceCount++;
          if (jsonStr[i] === "}") braceCount--;
          if (braceCount === 0) {
            endIdx = i + 1;
            break;
          }
        }

        jsonStr = jsonStr.substring(firstBraceIdx, endIdx);
      }

      const parsed = JSON.parse(jsonStr);
      return parsed;
    } catch (error) {
      console.error(
        "[VibeCal] ❌ Categorization failed:",
        error instanceof Error ? error.message : String(error),
      );
      // If categorization fails, default to clarification
      return { category: "NEEDS_CLARIFICATION", confidence: 0 };
    }
  }

  /**
   * Parse with automatic clarification detection
   * Returns NEEDS_CLARIFICATION if context is insufficient
   */
  async parseWithClarification(
    text: string,
    context: any,
  ): Promise<CalendarAction> {
    return this.parse(text, { systemPrompt: PROMPTS.CLARIFICATION, context });
  }
}

// Only export what's actually used - VibeCal and CalendarAction are already exported above
