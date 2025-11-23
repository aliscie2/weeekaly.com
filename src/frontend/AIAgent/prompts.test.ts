/**
 * Simple prompt validation tests
 * Run manually to test AI responses with edge cases
 */

import { PROMPTS } from "./prompts";

// Test cases for CATEGORIZE_MESSAGE (Quick Model)
const quickModelTests = [
  {
    name: "Simple greeting",
    input: "hi",
    expected: { type: "CASUAL", hasMetadata: false },
  },
  {
    name: "Meeting with email - no time",
    input: "create a meeting with john@example.com",
    expected: {
      type: "ACTION",
      emails: ["john@example.com"],
      durationDays: 7, // Should default to 7 days
    },
  },
  {
    name: "Email with dots (real-world case)",
    input: "create an event with ali.and.louai@gmail.com",
    expected: {
      type: "ACTION",
      emails: ["ali.and.louai@gmail.com"],
      durationDays: 7,
    },
  },
  {
    name: "Meeting tomorrow",
    input: "meeting with sarah@test.com tomorrow",
    expected: {
      type: "ACTION",
      emails: ["sarah@test.com"],
      durationDays: 1,
    },
  },
  {
    name: "Multiple emails",
    input: "schedule with john@x.com and sarah@y.com",
    expected: {
      type: "ACTION",
      emails: ["john@x.com", "sarah@y.com"],
      durationDays: 7,
    },
  },
];

// Test cases for GENERIC_CALENDAR_ASSISTANT (Full Model)
const fullModelTests = [
  {
    name: "Create event with attendees - should NOT include start/end",
    context: {
      extracted: {
        emails: ["john@example.com"],
        mutualAvailability: [
          { start: "2024-11-18T09:00:00", end: "2024-11-18T10:00:00" },
          { start: "2024-11-18T14:00:00", end: "2024-11-18T15:00:00" },
        ],
      },
    },
    input: "create meeting with john@example.com",
    expected: {
      type: "ADD_EVENT",
      hasAttendees: true,
      hasStart: false, // CRITICAL: Should NOT have start/end
      hasEnd: false,
    },
  },
  {
    name: "User specifies time - should STILL not include start/end",
    context: {
      extracted: {
        emails: ["john@example.com"],
        mutualAvailability: [
          { start: "2024-11-18T09:00:00", end: "2024-11-18T10:00:00" },
        ],
      },
    },
    input: "meeting with john@example.com at 9am tomorrow",
    expected: {
      type: "ADD_EVENT",
      hasAttendees: true,
      hasStart: false, // System will validate 9am
      hasEnd: false,
    },
  },
  {
    name: "Solo event - can include start/end",
    context: {
      extracted: {
        emails: [],
        mutualAvailability: [],
      },
    },
    input: "meeting tomorrow at 3pm",
    expected: {
      type: "ADD_EVENT",
      hasAttendees: false,
      hasStart: true, // OK for solo events
      hasEnd: true,
    },
  },
  {
    name: "Check availability",
    context: {
      extracted: {
        emails: ["john@example.com"],
        mutualAvailability: [
          { start: "2024-11-18T09:00:00", end: "2024-11-18T10:00:00" },
        ],
      },
    },
    input: "when is john@example.com available?",
    expected: {
      type: "CHECK_AVAILABILITY",
      hasEmails: true,
    },
  },
  {
    name: "Book after checking availability",
    context: {
      hist: [
        { txt: "when is john@example.com available?", ai: false },
        { txt: "Here are the available times...", ai: true },
      ],
      extracted: {
        emails: ["john@example.com"],
        mutualAvailability: [
          { start: "2024-11-18T09:00:00", end: "2024-11-18T10:00:00" },
        ],
      },
    },
    input: "book the earliest time",
    expected: {
      type: "ADD_EVENT",
      hasAttendees: true,
      hasStart: false, // Should let system handle it
      hasEnd: false,
    },
  },
];

// Helper to validate response structure
function validateQuickModel(response: any, expected: any): string[] {
  const errors: string[] = [];

  if (response.type !== expected.type) {
    errors.push(`Expected type "${expected.type}", got "${response.type}"`);
  }

  if (expected.emails) {
    const actualEmails = response.metadata?.emails || [];
    expected.emails.forEach((email: string) => {
      if (!actualEmails.includes(email)) {
        errors.push(`Missing email: ${email}`);
      }
    });
  }

  if (expected.durationDays !== undefined) {
    const actualDays = response.metadata?.duration?.durationDays;
    if (actualDays !== expected.durationDays) {
      errors.push(`Expected ${expected.durationDays} days, got ${actualDays}`);
    }
  }

  return errors;
}

function validateFullModel(response: any, expected: any): string[] {
  const errors: string[] = [];

  if (response.type !== expected.type) {
    errors.push(`Expected type "${expected.type}", got "${response.type}"`);
  }

  if (expected.hasAttendees !== undefined) {
    const hasAttendees =
      Array.isArray(response.attendees) && response.attendees.length > 0;
    if (hasAttendees !== expected.hasAttendees) {
      errors.push(
        `Expected hasAttendees=${expected.hasAttendees}, got ${hasAttendees}`,
      );
    }
  }

  if (expected.hasStart !== undefined) {
    const hasStart = !!response.start;
    if (hasStart !== expected.hasStart) {
      errors.push(
        `CRITICAL: Expected hasStart=${expected.hasStart}, got ${hasStart}`,
      );
    }
  }

  if (expected.hasEnd !== undefined) {
    const hasEnd = !!response.end;
    if (hasEnd !== expected.hasEnd) {
      errors.push(
        `CRITICAL: Expected hasEnd=${expected.hasEnd}, got ${hasEnd}`,
      );
    }
  }

  return errors;
}

// Print test results
console.log("═══════════════════════════════════════════════════");
console.log("🧪 AI PROMPT VALIDATION TESTS");
console.log("═══════════════════════════════════════════════════");
console.log("");

console.log("📋 QUICK MODEL TESTS (CATEGORIZE_MESSAGE):");
console.log("Prompt length:", PROMPTS.CATEGORIZE_MESSAGE.length, "characters");
console.log("");

quickModelTests.forEach((test, idx) => {
  console.log(`${idx + 1}. ${test.name}`);
  console.log(`   Input: "${test.input}"`);
  console.log(
    `   Expected: type=${test.expected.type}, emails=${test.expected.emails?.length || 0}, days=${test.expected.durationDays || "N/A"}`,
  );
  console.log("");
});

console.log("═══════════════════════════════════════════════════");
console.log("");

console.log("📋 FULL MODEL TESTS (GENERIC_CALENDAR_ASSISTANT):");
console.log(
  "Prompt length:",
  PROMPTS.GENERIC_CALENDAR_ASSISTANT.length,
  "characters",
);
console.log("");

fullModelTests.forEach((test, idx) => {
  console.log(`${idx + 1}. ${test.name}`);
  console.log(`   Input: "${test.input}"`);
  console.log(`   Expected: type=${test.expected.type}`);
  if (test.expected.hasStart !== undefined) {
    console.log(
      `   CRITICAL: Should ${test.expected.hasStart ? "HAVE" : "NOT HAVE"} start/end fields`,
    );
  }
  console.log("");
});

console.log("═══════════════════════════════════════════════════");
console.log("");
console.log("✅ Test structure validated");
console.log("📝 To run actual AI tests:");
console.log("   1. Copy prompts to AI playground");
console.log("   2. Test with each input");
console.log("   3. Verify responses match expected structure");
console.log("");
console.log("🎯 KEY VALIDATION POINTS:");
console.log("   - Quick model: Always 7 days when no time specified");
console.log("   - Full model: NEVER include start/end when attendees exist");
console.log("   - Full model: System validates times, not AI");
console.log("");

export {
  quickModelTests,
  fullModelTests,
  validateQuickModel,
  validateFullModel,
};
