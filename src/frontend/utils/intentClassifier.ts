/**
 * Rule-based intent classification (no AI needed)
 * More reliable and faster than using small AI models
 */

interface IntentResult {
  type: "CASUAL" | "ACTION";
  confidence: number;
}

interface ExtractedMetadata {
  emails: string[];
  keywords: string[];
  duration: {
    start: string;
    end: string;
    durationDays: number;
  } | null;
  names: string[];
}

/**
 * Classify user intent using regex patterns
 * Returns CASUAL for greetings/acknowledgments, ACTION for everything else
 */
export function classifyIntent(text: string): IntentResult {
  const trimmed = text.trim().toLowerCase();

  // Casual patterns (greetings, acknowledgments, simple responses)
  const casualPatterns = [
    /^(hi|hello|hey|sup|yo|howdy)$/,
    /^(thanks|thank you|thx|ty)$/,
    /^(ok|okay|sure|yes|yep|yeah|yup|no|nope|nah)$/,
    /^(bye|goodbye|see you|later|cya)$/,
    /^(got it|understood|cool|nice|great)$/,
  ];

  for (const pattern of casualPatterns) {
    if (pattern.test(trimmed)) {
      return { type: "CASUAL", confidence: 1.0 };
    }
  }

  // Everything else is an action
  return { type: "ACTION", confidence: 1.0 };
}

/**
 * Extract metadata from user message using regex
 * No AI needed for basic extraction
 */
export function extractMetadata(text: string): ExtractedMetadata {
  // Extract emails
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
  const emails = text.match(emailRegex) || [];

  // Extract names (simple heuristic: capitalized words before @)
  const names: string[] = [];
  emails.forEach((email) => {
    const localPart = email.split("@")[0];
    // Split by dots, dashes, underscores
    const parts = localPart.split(/[._-]/);
    parts.forEach((part) => {
      if (part.length > 1) {
        names.push(part);
      }
    });
  });

  // Extract keywords
  const keywords: string[] = [];
  const keywordMap = {
    create: /create|add|new|schedule|book|make|set up|arrange/i,
    update: /update|change|modify|edit|reschedule|move/i,
    delete: /delete|remove|cancel|clear/i,
    availability: /available|availability|free|busy|schedule|hours/i,
    event: /meeting|event|appointment|call|lunch|dinner|coffee/i,
    check: /when|check|show|view|list|what/i,
  };

  for (const [keyword, pattern] of Object.entries(keywordMap)) {
    if (pattern.test(text)) {
      keywords.push(keyword);
    }
  }

  // Extract duration
  const duration = extractDuration(text);

  return {
    emails,
    keywords,
    duration,
    names,
  };
}

/**
 * Extract time duration from message
 * Returns null if not specified (we'll default to 7 days in the hook)
 */
function extractDuration(text: string): {
  start: string;
  end: string;
  durationDays: number;
} | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Check for "tomorrow"
  if (/tomorrow/i.test(text)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);

    return {
      start: tomorrow.toISOString(),
      end: endOfTomorrow.toISOString(),
      durationDays: 1,
    };
  }

  // Check for "today"
  if (/today/i.test(text)) {
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    return {
      start: now.toISOString(),
      end: endOfToday.toISOString(),
      durationDays: 1,
    };
  }

  // Check for "this week"
  if (/this week/i.test(text)) {
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);

    return {
      start: now.toISOString(),
      end: endOfWeek.toISOString(),
      durationDays: 7,
    };
  }

  // Check for "next week"
  if (/next week/i.test(text)) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const endOfNextWeek = new Date(nextWeek);
    endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);
    endOfNextWeek.setHours(23, 59, 59, 999);

    return {
      start: nextWeek.toISOString(),
      end: endOfNextWeek.toISOString(),
      durationDays: 7,
    };
  }

  // Return null if no duration specified
  return null;
}

/**
 * Generate friendly casual response
 */
export function generateCasualResponse(text: string): {
  feedback: string;
  suggestions: string[];
} {
  const trimmed = text.trim().toLowerCase();

  // Greetings
  if (/^(hi|hello|hey|sup|yo|howdy)$/.test(trimmed)) {
    return {
      feedback: "Hi! How can I help with your calendar today?",
      suggestions: ["Create event", "Check availability", "View events"],
    };
  }

  // Thanks
  if (/^(thanks|thank you|thx|ty)$/.test(trimmed)) {
    return {
      feedback: "You're welcome! Anything else I can help with?",
      suggestions: ["Create event", "View events", "Done"],
    };
  }

  // Acknowledgments
  if (/^(ok|okay|sure|yes|yep|yeah|yup)$/.test(trimmed)) {
    return {
      feedback: "Got it! What would you like to do next?",
      suggestions: ["Create event", "Check availability", "Done"],
    };
  }

  // No
  if (/^(no|nope|nah)$/.test(trimmed)) {
    return {
      feedback: "No problem! Let me know if you need anything else.",
      suggestions: ["Create event", "View events", "Done"],
    };
  }

  // Goodbye
  if (/^(bye|goodbye|see you|later|cya)$/.test(trimmed)) {
    return {
      feedback: "Goodbye! Have a great day!",
      suggestions: [],
    };
  }

  // Default casual response
  return {
    feedback: "I'm here to help! What would you like to do?",
    suggestions: ["Create event", "Check availability", "View events"],
  };
}
