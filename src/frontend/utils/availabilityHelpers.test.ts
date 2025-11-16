import { describe, test, expect } from "vitest";
import {
  expandTimeSlotForDate,
  mergeTimeBlocks,
  subtractEvents,
  getAvailabilitySummary,
  findCommonFreeTime,
  formatTimeBlock,
  getBlockDuration,
  type TimeSlot,
  type Availability,
  type AvailabilityEvent,
  type AvailabilityStatus,
} from "./availabilityHelpers";

describe("expandTimeSlotForDate", () => {
  test("should expand slot for matching day of week", () => {
    const slot: TimeSlot = {
      day_of_week: 1, // Monday
      start_time: 540, // 9:00 AM
      end_time: 1020, // 5:00 PM
    };

    const monday = new Date("2024-01-01T00:00:00"); // This is a Monday
    const result = expandTimeSlotForDate(slot, monday);

    expect(result).not.toBeNull();
    expect(result?.start.getHours()).toBe(9);
    expect(result?.start.getMinutes()).toBe(0);
    expect(result?.end.getHours()).toBe(17);
    expect(result?.end.getMinutes()).toBe(0);
  });

  test("should return null for non-matching day of week", () => {
    const slot: TimeSlot = {
      day_of_week: 1, // Monday
      start_time: 540,
      end_time: 1020,
    };

    const tuesday = new Date("2024-01-02T00:00:00"); // This is a Tuesday
    const result = expandTimeSlotForDate(slot, tuesday);

    expect(result).toBeNull();
  });

  test("should handle midnight times correctly", () => {
    const slot: TimeSlot = {
      day_of_week: 0, // Sunday
      start_time: 0, // 12:00 AM
      end_time: 60, // 1:00 AM
    };

    const sunday = new Date("2023-12-31T00:00:00"); // This is a Sunday
    const result = expandTimeSlotForDate(slot, sunday);

    expect(result).not.toBeNull();
    expect(result?.start.getHours()).toBe(0);
    expect(result?.end.getHours()).toBe(1);
  });
});

describe("mergeTimeBlocks", () => {
  test("should merge overlapping blocks", () => {
    const blocks = [
      {
        start: new Date("2024-01-01T09:00:00"),
        end: new Date("2024-01-01T12:00:00"),
      },
      {
        start: new Date("2024-01-01T11:00:00"),
        end: new Date("2024-01-01T15:00:00"),
      },
    ];

    const result = mergeTimeBlocks(blocks);

    expect(result.length).toBe(1);
    expect(result[0].start.getHours()).toBe(9);
    expect(result[0].end.getHours()).toBe(15);
  });

  test("should not merge non-overlapping blocks", () => {
    const blocks = [
      {
        start: new Date("2024-01-01T09:00:00"),
        end: new Date("2024-01-01T10:00:00"),
      },
      {
        start: new Date("2024-01-01T14:00:00"),
        end: new Date("2024-01-01T15:00:00"),
      },
    ];

    const result = mergeTimeBlocks(blocks);

    expect(result.length).toBe(2);
  });

  test("should handle empty array", () => {
    const result = mergeTimeBlocks([]);
    expect(result.length).toBe(0);
  });

  test("should merge multiple overlapping blocks", () => {
    const blocks = [
      {
        start: new Date("2024-01-01T09:00:00"),
        end: new Date("2024-01-01T11:00:00"),
      },
      {
        start: new Date("2024-01-01T10:00:00"),
        end: new Date("2024-01-01T13:00:00"),
      },
      {
        start: new Date("2024-01-01T12:00:00"),
        end: new Date("2024-01-01T15:00:00"),
      },
    ];

    const result = mergeTimeBlocks(blocks);

    expect(result.length).toBe(1);
    expect(result[0].start.getHours()).toBe(9);
    expect(result[0].end.getHours()).toBe(15);
  });
});

describe("subtractEvents", () => {
  test("should subtract event from availability", () => {
    const availability = [
      {
        start: new Date("2024-01-01T09:00:00"),
        end: new Date("2024-01-01T17:00:00"),
      },
    ];

    const events = [
      {
        start: new Date("2024-01-01T10:00:00"),
        end: new Date("2024-01-01T11:00:00"),
      },
    ];

    const result = subtractEvents(availability, events);

    expect(result.length).toBe(3);
    expect(result[0].free).toBe(true); // 9am-10am
    expect(result[1].free).toBe(false); // 10am-11am (event)
    expect(result[2].free).toBe(true); // 11am-5pm
  });

  test("should handle multiple events", () => {
    const availability = [
      {
        start: new Date("2024-01-01T09:00:00"),
        end: new Date("2024-01-01T17:00:00"),
      },
    ];

    const events = [
      {
        start: new Date("2024-01-01T10:00:00"),
        end: new Date("2024-01-01T11:00:00"),
      },
      {
        start: new Date("2024-01-01T14:00:00"),
        end: new Date("2024-01-01T15:00:00"),
      },
    ];

    const result = subtractEvents(availability, events);

    expect(result.length).toBe(5);
    expect(result[0].free).toBe(true); // 9am-10am
    expect(result[1].free).toBe(false); // 10am-11am
    expect(result[2].free).toBe(true); // 11am-2pm
    expect(result[3].free).toBe(false); // 2pm-3pm
    expect(result[4].free).toBe(true); // 3pm-5pm
  });

  test("should handle no events", () => {
    const availability = [
      {
        start: new Date("2024-01-01T09:00:00"),
        end: new Date("2024-01-01T17:00:00"),
      },
    ];

    const result = subtractEvents(availability, []);

    expect(result.length).toBe(1);
    expect(result[0].free).toBe(true);
  });

  test("should handle event covering entire availability", () => {
    const availability = [
      {
        start: new Date("2024-01-01T09:00:00"),
        end: new Date("2024-01-01T17:00:00"),
      },
    ];

    const events = [
      {
        start: new Date("2024-01-01T08:00:00"),
        end: new Date("2024-01-01T18:00:00"),
      },
    ];

    const result = subtractEvents(availability, events);

    expect(result.length).toBe(1);
    expect(result[0].free).toBe(false);
  });
});

describe("getAvailabilitySummary", () => {
  const createAvailability = (slots: TimeSlot[]): Availability => ({
    id: "test-id",
    owner: "test-principal",
    title: "Test Availability",
    description: "Test description",
    slots,
    timezone: "America/New_York",
    created_at: BigInt(Date.now()),
    updated_at: BigInt(Date.now()),
  });

  test("should return free time when no events", () => {
    const availability = createAvailability([
      { day_of_week: 1, start_time: 540, end_time: 1020 }, // Mon 9am-5pm
    ]);

    const events: AvailabilityEvent[] = [];
    const startTime = new Date("2024-01-01T09:00:00"); // Monday
    const endTime = new Date("2024-01-01T17:00:00");

    const result = getAvailabilitySummary(
      [availability],
      events,
      startTime,
      endTime,
    );

    expect(result.length).toBe(1);
    expect(result[0].free).toBe(true);
  });

  test("should subtract event from availability", () => {
    const availability = createAvailability([
      { day_of_week: 1, start_time: 540, end_time: 1020 }, // Mon 9am-5pm
    ]);

    const events: AvailabilityEvent[] = [
      {
        startTime: new Date("2024-01-01T10:00:00"),
        endTime: new Date("2024-01-01T11:00:00"),
      },
    ];

    const startTime = new Date("2024-01-01T09:00:00");
    const endTime = new Date("2024-01-01T17:00:00");

    const result = getAvailabilitySummary(
      [availability],
      events,
      startTime,
      endTime,
    );

    expect(result.length).toBe(3);
    expect(result[0].free).toBe(true); // 9am-10am
    expect(result[1].free).toBe(false); // 10am-11am (event)
    expect(result[2].free).toBe(true); // 11am-5pm
  });

  test("should merge overlapping availability slots", () => {
    const availability = createAvailability([
      { day_of_week: 1, start_time: 540, end_time: 720 }, // Mon 9am-12pm
      { day_of_week: 1, start_time: 660, end_time: 1020 }, // Mon 11am-5pm (overlaps)
    ]);

    const events: AvailabilityEvent[] = [];
    const startTime = new Date("2024-01-01T09:00:00");
    const endTime = new Date("2024-01-01T17:00:00");

    const result = getAvailabilitySummary(
      [availability],
      events,
      startTime,
      endTime,
    );

    // Should merge into one block: 9am-5pm
    expect(result.length).toBe(1);
    expect(result[0].free).toBe(true);
  });

  test("should combine multiple users availabilities", () => {
    const user1 = createAvailability([
      { day_of_week: 1, start_time: 540, end_time: 720 }, // Mon 9am-12pm
    ]);

    const user2 = createAvailability([
      { day_of_week: 1, start_time: 780, end_time: 1020 }, // Mon 1pm-5pm
    ]);

    const events: AvailabilityEvent[] = [];
    const startTime = new Date("2024-01-01T09:00:00");
    const endTime = new Date("2024-01-01T17:00:00");

    const result = getAvailabilitySummary(
      [user1, user2],
      events,
      startTime,
      endTime,
    );

    // Should have two separate blocks (no overlap)
    expect(result.length).toBe(2);
    expect(result[0].free).toBe(true); // 9am-12pm
    expect(result[1].free).toBe(true); // 1pm-5pm
  });

  test("should handle multi-day range", () => {
    const availability = createAvailability([
      { day_of_week: 1, start_time: 540, end_time: 1020 }, // Mon 9am-5pm
      { day_of_week: 2, start_time: 540, end_time: 1020 }, // Tue 9am-5pm
    ]);

    const events: AvailabilityEvent[] = [];
    const startTime = new Date("2024-01-01T00:00:00"); // Monday
    const endTime = new Date("2024-01-02T23:59:59"); // Tuesday

    const result = getAvailabilitySummary(
      [availability],
      events,
      startTime,
      endTime,
    );

    // Should have blocks for both days
    expect(result.length).toBe(2);
    expect(result[0].free).toBe(true);
    expect(result[1].free).toBe(true);
  });
});

describe("findCommonFreeTime", () => {
  test("should find intersection of free times", () => {
    const user1: AvailabilityStatus[] = [
      {
        start: new Date("2024-01-01T09:00:00").getTime(),
        end: new Date("2024-01-01T15:00:00").getTime(),
        free: true,
      },
    ];

    const user2: AvailabilityStatus[] = [
      {
        start: new Date("2024-01-01T11:00:00").getTime(),
        end: new Date("2024-01-01T17:00:00").getTime(),
        free: true,
      },
    ];

    const result = findCommonFreeTime([user1, user2]);

    expect(result.length).toBe(1);
    expect(new Date(result[0].start).getHours()).toBe(11);
    expect(new Date(result[0].end).getHours()).toBe(15);
  });

  test("should return empty array when no overlap", () => {
    const user1: AvailabilityStatus[] = [
      {
        start: new Date("2024-01-01T09:00:00").getTime(),
        end: new Date("2024-01-01T12:00:00").getTime(),
        free: true,
      },
    ];

    const user2: AvailabilityStatus[] = [
      {
        start: new Date("2024-01-01T14:00:00").getTime(),
        end: new Date("2024-01-01T17:00:00").getTime(),
        free: true,
      },
    ];

    const result = findCommonFreeTime([user1, user2]);

    expect(result.length).toBe(0);
  });

  test("should handle empty array", () => {
    const result = findCommonFreeTime([]);
    expect(result.length).toBe(0);
  });
});

describe("formatTimeBlock", () => {
  test("should format time block correctly", () => {
    const block: AvailabilityStatus = {
      start: new Date("2024-01-01T09:00:00").getTime(),
      end: new Date("2024-01-01T17:00:00").getTime(),
      free: true,
    };

    const result = formatTimeBlock(block);
    expect(result).toBe("9:00 AM - 5:00 PM");
  });

  test("should handle PM times", () => {
    const block: AvailabilityStatus = {
      start: new Date("2024-01-01T14:30:00").getTime(),
      end: new Date("2024-01-01T16:45:00").getTime(),
      free: true,
    };

    const result = formatTimeBlock(block);
    expect(result).toBe("2:30 PM - 4:45 PM");
  });
});

describe("getBlockDuration", () => {
  test("should calculate duration in minutes", () => {
    const block: AvailabilityStatus = {
      start: new Date("2024-01-01T09:00:00").getTime(),
      end: new Date("2024-01-01T10:30:00").getTime(),
      free: true,
    };

    const result = getBlockDuration(block);
    expect(result).toBe(90);
  });

  test("should handle hour-long blocks", () => {
    const block: AvailabilityStatus = {
      start: new Date("2024-01-01T14:00:00").getTime(),
      end: new Date("2024-01-01T15:00:00").getTime(),
      free: true,
    };

    const result = getBlockDuration(block);
    expect(result).toBe(60);
  });
});
