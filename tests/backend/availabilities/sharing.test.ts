import { describe, test, expect, beforeEach } from "vitest";
import {
  createTestUser,
  createTimeSlot,
  createAvailabilityRequest,
} from "../utils";

describe("Availability Sharing & Regeneration", () => {
  beforeEach(async () => {
    await globalThis.testPic.resetTime();
  });

  describe("Regenerate Availability ID", () => {
    test("should regenerate availability ID", async () => {
      const { identity } = await createTestUser("alice");
      globalThis.testActor.setIdentity(identity);

      // Create availability
      const createRequest = createAvailabilityRequest(
        "Shared Availability",
        "Can be shared",
        [createTimeSlot(1, 540, 1020)],
      );
      const createResult =
        await globalThis.testActor.create_availability(createRequest);
      expect("Ok" in createResult).toBe(true);

      if ("Ok" in createResult) {
        const oldId = createResult.Ok.id;

        // Regenerate ID
        const regenResult =
          await globalThis.testActor.regenerate_availability_id(oldId);
        expect("Ok" in regenResult).toBe(true);

        if ("Ok" in regenResult) {
          const newId = regenResult.Ok;

          // Verify new ID is different
          expect(newId).not.toBe(oldId);
          expect(newId.length).toBe(6);

          // Verify old ID no longer works
          const oldGetResult =
            await globalThis.testActor.get_availability(oldId);
          expect("Err" in oldGetResult).toBe(true);

          // Verify new ID works
          const newGetResult =
            await globalThis.testActor.get_availability(newId);
          expect("Ok" in newGetResult).toBe(true);
          if ("Ok" in newGetResult) {
            expect(newGetResult.Ok.title).toBe("Shared Availability");
          }
        }
      }
    });

    test("should reject regeneration from non-owner", async () => {
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

        // Try to regenerate as user2
        const { identity: identity2 } = await createTestUser("attacker");
        globalThis.testActor.setIdentity(identity2);

        const regenResult =
          await globalThis.testActor.regenerate_availability_id(availabilityId);
        expect("Err" in regenResult).toBe(true);
        if ("Err" in regenResult) {
          expect(regenResult.Err).toContain("Only the owner can regenerate");
        }
      }
    });

    test("should preserve availability data after regeneration", async () => {
      const { identity } = await createTestUser("bob");
      globalThis.testActor.setIdentity(identity);

      // Create availability with specific data
      const createRequest = createAvailabilityRequest(
        "Important Meeting Times",
        "These are my important meeting times",
        [createTimeSlot(1, 540, 720), createTimeSlot(3, 780, 1020)],
      );
      const createResult =
        await globalThis.testActor.create_availability(createRequest);
      expect("Ok" in createResult).toBe(true);

      if ("Ok" in createResult) {
        const oldId = createResult.Ok.id;
        const originalData = createResult.Ok;

        // Regenerate ID
        const regenResult =
          await globalThis.testActor.regenerate_availability_id(oldId);
        expect("Ok" in regenResult).toBe(true);

        if ("Ok" in regenResult) {
          const newId = regenResult.Ok;

          // Get new availability
          const newGetResult =
            await globalThis.testActor.get_availability(newId);
          expect("Ok" in newGetResult).toBe(true);

          if ("Ok" in newGetResult) {
            const newData = newGetResult.Ok;

            // Verify all data is preserved except ID
            expect(newData.title).toBe(originalData.title);
            expect(newData.description).toBe(originalData.description);
            expect(newData.slots.length).toBe(originalData.slots.length);
            expect(newData.timezone).toBe(originalData.timezone);
            expect(newData.owner.toString()).toBe(
              originalData.owner.toString(),
            );
          }
        }
      }
    });

    test("should update user availability list after regeneration", async () => {
      const { identity } = await createTestUser("charlie");
      globalThis.testActor.setIdentity(identity);

      // Create availability
      const createRequest = createAvailabilityRequest("Test", "Description", [
        createTimeSlot(1, 540, 1020),
      ]);
      const createResult =
        await globalThis.testActor.create_availability(createRequest);
      expect("Ok" in createResult).toBe(true);

      if ("Ok" in createResult) {
        const oldId = createResult.Ok.id;

        // Regenerate ID
        const regenResult =
          await globalThis.testActor.regenerate_availability_id(oldId);
        expect("Ok" in regenResult).toBe(true);

        if ("Ok" in regenResult) {
          const newId = regenResult.Ok;

          // List user availabilities
          const list = await globalThis.testActor.list_user_availabilities();
          expect(list.length).toBe(1);
          expect(list[0].id).toBe(newId);
          expect(list[0].id).not.toBe(oldId);
        }
      }
    });
  });

  describe("Owner Email and Name Storage", () => {
    test("should store owner email and name when creating availability", async () => {
      const { identity } = await createTestUser("test_user");
      globalThis.testActor.setIdentity(identity);

      // Create availability with email and name
      const createRequest = {
        ...createAvailabilityRequest(
          "Test Availability",
          "Testing email storage",
          [createTimeSlot(1, 540, 1020)],
        ),
        owner_email: ["ali@gmail.com"],
        owner_name: ["Ali Test"],
      };

      const createResult =
        await globalThis.testActor.create_availability(createRequest);

      console.log("📧 [TEST] Create result:", createResult);

      expect("Ok" in createResult).toBe(true);

      if ("Ok" in createResult) {
        const availability = createResult.Ok;

        console.log("📧 [TEST] Owner email:", availability.owner_email);
        console.log("📧 [TEST] Owner name:", availability.owner_name);

        // Verify email and name are stored
        expect(availability.owner_email).toEqual(["ali@gmail.com"]);
        expect(availability.owner_name).toEqual(["Ali Test"]);

        // Get the availability and verify fields are preserved
        const getResult = await globalThis.testActor.get_availability(
          availability.id,
        );
        expect("Ok" in getResult).toBe(true);

        if ("Ok" in getResult) {
          const fetchedAvailability = getResult.Ok;
          console.log(
            "📧 [TEST] Fetched owner email:",
            fetchedAvailability.owner_email,
          );
          console.log(
            "📧 [TEST] Fetched owner name:",
            fetchedAvailability.owner_name,
          );

          // Verify data persists
          expect(fetchedAvailability.owner_email).toEqual(["ali@gmail.com"]);
          expect(fetchedAvailability.owner_name).toEqual(["Ali Test"]);
        }
      }
    });

    test("should return availability with owner contact info", async () => {
      const { identity } = await createTestUser("alice_with_email");
      globalThis.testActor.setIdentity(identity);

      // Create availability
      const createRequest = createAvailabilityRequest(
        "Alice's Availability",
        "Testing contact info",
        [createTimeSlot(2, 600, 900)],
      );
      const createResult =
        await globalThis.testActor.create_availability(createRequest);

      expect("Ok" in createResult).toBe(true);

      if ("Ok" in createResult) {
        const availabilityId = createResult.Ok.id;

        // Fetch as another user (simulating public access)
        const { identity: bobIdentity } = await createTestUser("bob_viewer");
        globalThis.testActor.setIdentity(bobIdentity);

        const getResult =
          await globalThis.testActor.get_availability(availabilityId);
        expect("Ok" in getResult).toBe(true);

        if ("Ok" in getResult) {
          const availability = getResult.Ok;

          console.log(
            "📧 [TEST] Public view - owner email:",
            availability.owner_email,
          );
          console.log(
            "📧 [TEST] Public view - owner name:",
            availability.owner_name,
          );

          // Verify structure exists
          expect(availability).toHaveProperty("owner_email");
          expect(availability).toHaveProperty("owner_name");
          expect(availability.title).toBe("Alice's Availability");
        }
      }
    });
  });

  describe("Search by Email", () => {
    test("should find availabilities by email", async () => {
      // Note: This test requires OAuth integration to populate email index
      // For now, we'll test the function exists and returns empty for unknown email
      const result = await globalThis.testActor.search_availabilities_by_email(
        "unknown@example.com",
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe("Search by Username", () => {
    test("should find availabilities by username", async () => {
      // Note: This test requires OAuth integration to populate username index
      // For now, we'll test the function exists and returns empty for unknown username
      const result =
        await globalThis.testActor.search_availabilities_by_username(
          "unknown_user",
        );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe("Search by Principal", () => {
    test("should find availabilities by principal", async () => {
      const { identity, principal } = await createTestUser("dave");
      globalThis.testActor.setIdentity(identity);

      // Create availabilities
      const requests = [
        createAvailabilityRequest("Work", "Work hours", [
          createTimeSlot(1, 540, 1020),
        ]),
        createAvailabilityRequest("Personal", "Personal time", [
          createTimeSlot(6, 600, 900),
        ]),
      ];

      for (const request of requests) {
        const result = await globalThis.testActor.create_availability(request);
        expect("Ok" in result).toBe(true);
      }

      // Search by principal
      const searchResult =
        await globalThis.testActor.search_availabilities_by_principal(
          principal,
        );
      expect(searchResult.length).toBe(2);
      expect(searchResult.map((a) => a.title).sort()).toEqual([
        "Personal",
        "Work",
      ]);
    });

    test("should return empty for principal with no availabilities", async () => {
      const { principal } = await createTestUser("eve");

      const searchResult =
        await globalThis.testActor.search_availabilities_by_principal(
          principal,
        );
      expect(searchResult.length).toBe(0);
    });
  });
});
