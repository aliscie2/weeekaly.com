import { describe, test, expect, beforeEach } from "vitest";
import {
  createTestUser,
  createTimeSlot,
  createAvailabilityRequest,
} from "../utils";

describe("Availability CRUD Operations", () => {
  beforeEach(async () => {
    // Reset to a clean state for each test
    await globalThis.testPic.resetTime();
  });

  describe("Create Availability", () => {
    test("should create availability with valid data", async () => {
      const { identity } = await createTestUser("alice");
      globalThis.testActor.setIdentity(identity);

      const request = createAvailabilityRequest(
        "Work Hours",
        "Available for business meetings",
        [
          createTimeSlot(1, 540, 1020), // Mon 9am-5pm
          createTimeSlot(2, 540, 1020), // Tue 9am-5pm
        ],
      );

      const result = await globalThis.testActor.create_availability(request);

      expect("Ok" in result).toBe(true);
      if ("Ok" in result) {
        expect(result.Ok.id).toBeDefined();
        expect(result.Ok.id.length).toBe(6);
        expect(result.Ok.title).toBe("Work Hours");
        expect(result.Ok.description).toBe("Available for business meetings");
        expect(result.Ok.slots.length).toBe(2);
        expect(result.Ok.timezone).toBe("America/New_York");
      }
    });

    test("should reject empty title", async () => {
      const { identity } = await createTestUser("bob");
      globalThis.testActor.setIdentity(identity);

      const request = createAvailabilityRequest(
        "", // Empty title
        "Description",
        [createTimeSlot(1, 540, 1020)],
      );

      const result = await globalThis.testActor.create_availability(request);

      expect("Err" in result).toBe(true);
      if ("Err" in result) {
        expect(result.Err).toContain("title must be 1-100 characters");
      }
    });

    test("should reject title longer than 100 characters", async () => {
      const { identity } = await createTestUser("charlie");
      globalThis.testActor.setIdentity(identity);

      const longTitle = "a".repeat(101);
      const request = createAvailabilityRequest(longTitle, "Description", [
        createTimeSlot(1, 540, 1020),
      ]);

      const result = await globalThis.testActor.create_availability(request);

      expect("Err" in result).toBe(true);
      if ("Err" in result) {
        expect(result.Err).toContain("title must be 1-100 characters");
      }
    });

    test("should reject description longer than 500 characters", async () => {
      const { identity } = await createTestUser("dave");
      globalThis.testActor.setIdentity(identity);

      const longDesc = "a".repeat(501);
      const request = createAvailabilityRequest("Title", longDesc, [
        createTimeSlot(1, 540, 1020),
      ]);

      const result = await globalThis.testActor.create_availability(request);

      expect("Err" in result).toBe(true);
      if ("Err" in result) {
        expect(result.Err).toContain("description must be 0-500 characters");
      }
    });

    test("should reject empty slots array", async () => {
      const { identity } = await createTestUser("eve");
      globalThis.testActor.setIdentity(identity);

      const request = createAvailabilityRequest("Title", "Description", []);

      const result = await globalThis.testActor.create_availability(request);

      expect("Err" in result).toBe(true);
      if ("Err" in result) {
        expect(result.Err).toContain("at least 1 slot is required");
      }
    });

    test("should reject invalid day of week", async () => {
      const { identity } = await createTestUser("frank");
      globalThis.testActor.setIdentity(identity);

      const request = createAvailabilityRequest(
        "Title",
        "Description",
        [createTimeSlot(7, 540, 1020)], // Invalid day (should be 0-6)
      );

      const result = await globalThis.testActor.create_availability(request);

      expect("Err" in result).toBe(true);
      if ("Err" in result) {
        expect(result.Err).toContain("day_of_week must be 0-6");
      }
    });

    test("should reject invalid time range", async () => {
      const { identity } = await createTestUser("grace");
      globalThis.testActor.setIdentity(identity);

      const request = createAvailabilityRequest(
        "Title",
        "Description",
        [createTimeSlot(1, 1020, 540)], // End before start
      );

      const result = await globalThis.testActor.create_availability(request);

      expect("Err" in result).toBe(true);
      if ("Err" in result) {
        expect(result.Err).toContain("start_time must be less than end_time");
      }
    });

    test("should reject overlapping slots on same day", async () => {
      const { identity } = await createTestUser("henry");
      globalThis.testActor.setIdentity(identity);

      const request = createAvailabilityRequest("Title", "Description", [
        createTimeSlot(1, 540, 720), // Mon 9am-12pm
        createTimeSlot(1, 660, 900), // Mon 11am-3pm (overlaps!)
      ]);

      const result = await globalThis.testActor.create_availability(request);

      expect("Err" in result).toBe(true);
      if ("Err" in result) {
        expect(result.Err).toContain("Overlapping slots");
      }
    });

    test("should allow same time slots on different days", async () => {
      const { identity } = await createTestUser("iris");
      globalThis.testActor.setIdentity(identity);

      const request = createAvailabilityRequest(
        "Work Week",
        "Mon-Fri availability",
        [
          createTimeSlot(1, 540, 1020), // Mon 9am-5pm
          createTimeSlot(2, 540, 1020), // Tue 9am-5pm
          createTimeSlot(3, 540, 1020), // Wed 9am-5pm
          createTimeSlot(4, 540, 1020), // Thu 9am-5pm
          createTimeSlot(5, 540, 1020), // Fri 9am-5pm
        ],
      );

      const result = await globalThis.testActor.create_availability(request);

      expect("Ok" in result).toBe(true);
      if ("Ok" in result) {
        expect(result.Ok.slots.length).toBe(5);
      }
    });
  });

  describe("Get Availability", () => {
    test("should retrieve availability by ID", async () => {
      const { identity } = await createTestUser("jack");
      globalThis.testActor.setIdentity(identity);

      // Create availability
      const createRequest = createAvailabilityRequest(
        "Test Availability",
        "Test description",
        [createTimeSlot(1, 540, 1020)],
      );
      const createResult =
        await globalThis.testActor.create_availability(createRequest);
      expect("Ok" in createResult).toBe(true);

      if ("Ok" in createResult) {
        const availabilityId = createResult.Ok.id;

        // Retrieve availability
        const getResult =
          await globalThis.testActor.get_availability(availabilityId);

        expect("Ok" in getResult).toBe(true);
        if ("Ok" in getResult) {
          expect(getResult.Ok.id).toBe(availabilityId);
          expect(getResult.Ok.title).toBe("Test Availability");
        }
      }
    });

    test("should return error for non-existent ID", async () => {
      const { identity } = await createTestUser("kate");
      globalThis.testActor.setIdentity(identity);

      const result = await globalThis.testActor.get_availability("nonexistent");

      expect("Err" in result).toBe(true);
      if ("Err" in result) {
        expect(result.Err).toContain("Availability not found");
      }
    });
  });

  describe("Update Availability", () => {
    test("should update availability title", async () => {
      const { identity } = await createTestUser("leo");
      globalThis.testActor.setIdentity(identity);

      // Create availability
      const createRequest = createAvailabilityRequest(
        "Original Title",
        "Description",
        [createTimeSlot(1, 540, 1020)],
      );
      const createResult =
        await globalThis.testActor.create_availability(createRequest);
      expect("Ok" in createResult).toBe(true);

      if ("Ok" in createResult) {
        const availabilityId = createResult.Ok.id;

        // Update title
        const updateResult = await globalThis.testActor.update_availability({
          id: availabilityId,
          title: ["Updated Title"],
          description: [],
          slots: [],
          timezone: [],
        });

        expect("Ok" in updateResult).toBe(true);
        if ("Ok" in updateResult) {
          expect(updateResult.Ok.title).toBe("Updated Title");
          expect(updateResult.Ok.description).toBe("Description"); // Unchanged
        }
      }
    });

    test("should update availability slots", async () => {
      const { identity } = await createTestUser("mary");
      globalThis.testActor.setIdentity(identity);

      // Create availability
      const createRequest = createAvailabilityRequest("Title", "Description", [
        createTimeSlot(1, 540, 1020),
      ]);
      const createResult =
        await globalThis.testActor.create_availability(createRequest);
      expect("Ok" in createResult).toBe(true);

      if ("Ok" in createResult) {
        const availabilityId = createResult.Ok.id;

        // Update slots
        const newSlots = [
          createTimeSlot(1, 600, 900), // Mon 10am-3pm
          createTimeSlot(2, 600, 900), // Tue 10am-3pm
        ];

        const updateResult = await globalThis.testActor.update_availability({
          id: availabilityId,
          title: [],
          description: [],
          slots: [newSlots],
          timezone: [],
        });

        expect("Ok" in updateResult).toBe(true);
        if ("Ok" in updateResult) {
          expect(updateResult.Ok.slots.length).toBe(2);
          expect(updateResult.Ok.slots[0].start_time).toBe(600);
        }
      }
    });

    test("should reject update from non-owner", async () => {
      // Create availability as user1
      const { identity: identity1 } = await createTestUser("user1");
      globalThis.testActor.setIdentity(identity1);

      const createRequest = createAvailabilityRequest("Title", "Description", [
        createTimeSlot(1, 540, 1020),
      ]);
      const createResult =
        await globalThis.testActor.create_availability(createRequest);
      expect("Ok" in createResult).toBe(true);

      if ("Ok" in createResult) {
        const availabilityId = createResult.Ok.id;

        // Try to update as user2
        const { identity: identity2 } = await createTestUser("user2");
        globalThis.testActor.setIdentity(identity2);

        const updateResult = await globalThis.testActor.update_availability({
          id: availabilityId,
          title: ["Hacked Title"],
          description: [],
          slots: [],
          timezone: [],
        });

        expect("Err" in updateResult).toBe(true);
        if ("Err" in updateResult) {
          expect(updateResult.Err).toContain("Only the owner can update");
        }
      }
    });
  });

  describe("Delete Availability", () => {
    test("should delete availability", async () => {
      const { identity } = await createTestUser("nancy");
      globalThis.testActor.setIdentity(identity);

      // Create availability
      const createRequest = createAvailabilityRequest(
        "To Delete",
        "Description",
        [createTimeSlot(1, 540, 1020)],
      );
      const createResult =
        await globalThis.testActor.create_availability(createRequest);
      expect("Ok" in createResult).toBe(true);

      if ("Ok" in createResult) {
        const availabilityId = createResult.Ok.id;

        // Delete availability
        const deleteResult =
          await globalThis.testActor.delete_availability(availabilityId);
        expect("Ok" in deleteResult).toBe(true);

        // Verify it's deleted
        const getResult =
          await globalThis.testActor.get_availability(availabilityId);
        expect("Err" in getResult).toBe(true);
      }
    });

    test("should reject delete from non-owner", async () => {
      // Create as user1
      const { identity: identity1 } = await createTestUser("owner");
      globalThis.testActor.setIdentity(identity1);

      const createRequest = createAvailabilityRequest("Title", "Description", [
        createTimeSlot(1, 540, 1020),
      ]);
      const createResult =
        await globalThis.testActor.create_availability(createRequest);
      expect("Ok" in createResult).toBe(true);

      if ("Ok" in createResult) {
        const availabilityId = createResult.Ok.id;

        // Try to delete as user2
        const { identity: identity2 } = await createTestUser("attacker");
        globalThis.testActor.setIdentity(identity2);

        const deleteResult =
          await globalThis.testActor.delete_availability(availabilityId);
        expect("Err" in deleteResult).toBe(true);
        if ("Err" in deleteResult) {
          expect(deleteResult.Err).toContain("Only the owner can delete");
        }
      }
    });
  });

  describe("List User Availabilities", () => {
    test("should list all availabilities for user", async () => {
      const { identity } = await createTestUser("oscar");
      globalThis.testActor.setIdentity(identity);

      // Create multiple availabilities
      const requests = [
        createAvailabilityRequest("Work", "Work hours", [
          createTimeSlot(1, 540, 1020),
        ]),
        createAvailabilityRequest("Personal", "Personal time", [
          createTimeSlot(6, 600, 900),
        ]),
        createAvailabilityRequest("Gym", "Gym time", [
          createTimeSlot(3, 360, 420),
        ]),
      ];

      for (const request of requests) {
        const result = await globalThis.testActor.create_availability(request);
        expect("Ok" in result).toBe(true);
      }

      // List availabilities
      const list = await globalThis.testActor.list_user_availabilities();
      expect(list.length).toBe(3);
      expect(list.map((a) => a.title).sort()).toEqual([
        "Gym",
        "Personal",
        "Work",
      ]);
    });

    test("should return empty list for user with no availabilities", async () => {
      const { identity } = await createTestUser("paula");
      globalThis.testActor.setIdentity(identity);

      const list = await globalThis.testActor.list_user_availabilities();
      expect(list.length).toBe(0);
    });
  });
});
