import { describe, it, expect } from "vitest";
import {
  classifyIntent,
  extractMetadata,
  generateCasualResponse,
} from "../intentClassifier";

describe("Intent Classifier", () => {
  describe("classifyIntent", () => {
    it("should classify greetings as CASUAL", () => {
      expect(classifyIntent("hi")).toEqual({ type: "CASUAL", confidence: 1.0 });
      expect(classifyIntent("hello")).toEqual({
        type: "CASUAL",
        confidence: 1.0,
      });
      expect(classifyIntent("hey")).toEqual({
        type: "CASUAL",
        confidence: 1.0,
      });
      expect(classifyIntent("Hi")).toEqual({ type: "CASUAL", confidence: 1.0 }); // Case insensitive
    });

    it("should classify acknowledgments as CASUAL", () => {
      expect(classifyIntent("thanks")).toEqual({
        type: "CASUAL",
        confidence: 1.0,
      });
      expect(classifyIntent("thank you")).toEqual({
        type: "CASUAL",
        confidence: 1.0,
      });
      expect(classifyIntent("ok")).toEqual({ type: "CASUAL", confidence: 1.0 });
      expect(classifyIntent("yes")).toEqual({
        type: "CASUAL",
        confidence: 1.0,
      });
      expect(classifyIntent("no")).toEqual({ type: "CASUAL", confidence: 1.0 });
    });

    it("should classify event creation as ACTION", () => {
      expect(classifyIntent("create event")).toEqual({
        type: "ACTION",
        confidence: 1.0,
      });
      expect(classifyIntent("schedule meeting")).toEqual({
        type: "ACTION",
        confidence: 1.0,
      });
      expect(classifyIntent("book appointment")).toEqual({
        type: "ACTION",
        confidence: 1.0,
      });
    });

    it("should classify event with email as ACTION", () => {
      expect(classifyIntent("create event with john@example.com")).toEqual({
        type: "ACTION",
        confidence: 1.0,
      });
      expect(classifyIntent("meeting with ali.and.louai@gmail.com")).toEqual({
        type: "ACTION",
        confidence: 1.0,
      });
    });

    it("should classify availability queries as ACTION", () => {
      expect(classifyIntent("when is john available?")).toEqual({
        type: "ACTION",
        confidence: 1.0,
      });
      expect(classifyIntent("check availability")).toEqual({
        type: "ACTION",
        confidence: 1.0,
      });
    });
  });

  describe("extractMetadata", () => {
    it("should extract single email", () => {
      const result = extractMetadata("create event with john@example.com");
      expect(result.emails).toEqual(["john@example.com"]);
    });

    it("should extract email with dots", () => {
      const result = extractMetadata(
        "create event with ali.and.louai@gmail.com",
      );
      expect(result.emails).toEqual(["ali.and.louai@gmail.com"]);
    });

    it("should extract multiple emails", () => {
      const result = extractMetadata("meeting with john@x.com and sarah@y.com");
      expect(result.emails).toContain("john@x.com");
      expect(result.emails).toContain("sarah@y.com");
      expect(result.emails).toHaveLength(2);
    });

    it("should extract names from emails", () => {
      const result = extractMetadata("meeting with john.doe@example.com");
      expect(result.names).toContain("john");
      expect(result.names).toContain("doe");
    });

    it("should extract create keywords", () => {
      const result = extractMetadata("create a new meeting");
      expect(result.keywords).toContain("create");
      expect(result.keywords).toContain("event");
    });

    it("should extract update keywords", () => {
      const result = extractMetadata("update the meeting time");
      expect(result.keywords).toContain("update");
      expect(result.keywords).toContain("event");
    });

    it("should extract delete keywords", () => {
      const result = extractMetadata("delete my appointment");
      expect(result.keywords).toContain("delete");
      expect(result.keywords).toContain("event");
    });

    it("should extract availability keywords", () => {
      const result = extractMetadata("I'm available tomorrow");
      expect(result.keywords).toContain("availability");
    });

    it("should default to 7 days duration", () => {
      const result = extractMetadata("create meeting");
      expect(result.duration.durationDays).toBe(7);
    });

    it("should extract tomorrow duration", () => {
      const result = extractMetadata("meeting tomorrow");
      expect(result.duration.durationDays).toBe(1);
    });

    it("should extract today duration", () => {
      const result = extractMetadata("meeting today");
      expect(result.duration.durationDays).toBe(1);
    });

    it("should extract this week duration", () => {
      const result = extractMetadata("meetings this week");
      expect(result.duration.durationDays).toBe(7);
    });

    it("should extract next week duration", () => {
      const result = extractMetadata("meetings next week");
      expect(result.duration.durationDays).toBe(7);
    });
  });

  describe("generateCasualResponse", () => {
    it("should generate greeting response", () => {
      const result = generateCasualResponse("hi");
      expect(result.feedback).toContain("Hi!");
      expect(result.suggestions).toContain("Create event");
    });

    it("should generate thanks response", () => {
      const result = generateCasualResponse("thanks");
      expect(result.feedback).toContain("welcome");
      expect(result.suggestions).toContain("Create event");
    });

    it("should generate acknowledgment response", () => {
      const result = generateCasualResponse("ok");
      expect(result.feedback).toContain("Got it");
      expect(result.suggestions).toContain("Create event");
    });

    it("should generate goodbye response", () => {
      const result = generateCasualResponse("bye");
      expect(result.feedback).toContain("Goodbye");
      expect(result.suggestions).toHaveLength(0);
    });
  });
});
