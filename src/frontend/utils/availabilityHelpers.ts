/**
 * Availability Helper Functions
 *
 * Core utilities for calculating availability summaries by combining
 * multiple users' availabilities and events to determine free/busy times.
 */

// Types (exported for use in production code)
interface TimeSlot {
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: number; // Minutes from midnight (0-1439)
  end_time: number; // Minutes from midnight (0-1439)
}

export interface Availability {
  id: string;
  owner: string; // Principal as string
  title: string;
  description: string;
  slots: TimeSlot[];
  timezone: string;
  created_at: bigint;
  updated_at: bigint;
}

export interface AvailabilityEvent {
  startTime: Date;
  endTime: Date;
}

interface TimeBlock {
  start: Date;
  end: Date;
}

/**
 * Expand a recurring time slot to an actual time block for a specific date
 *
 * @param slot - The recurring time slot
 * @param date - The date to expand the slot for
 * @param timezone - IANA timezone string (currently unused, for future enhancement)
 * @returns Time block with start/end dates, or null if slot doesn't apply to this date
 */
function expandTimeSlotForDate(slot: TimeSlot, date: Date): TimeBlock | null {
  // Check if slot's day_of_week matches the date's day of week
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  if (slot.day_of_week !== dayOfWeek) {
    return null;
  }

  // Convert start_time/end_time (minutes from midnight) to actual Date objects
  const start = new Date(date);
  start.setHours(Math.floor(slot.start_time / 60), slot.start_time % 60, 0, 0);

  const end = new Date(date);
  end.setHours(Math.floor(slot.end_time / 60), slot.end_time % 60, 0, 0);

  return { start, end };
}

/**
 * Merge overlapping time blocks into consolidated blocks
 *
 * @param blocks - Array of time blocks to merge
 * @returns Array of merged time blocks with no overlaps
 */
function mergeTimeBlocks(blocks: TimeBlock[]): TimeBlock[] {
  if (blocks.length === 0) return [];

  // Sort by start time
  const sorted = [...blocks].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  // Merge overlapping blocks
  const merged: TimeBlock[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlapping or adjacent - merge by extending the end time
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      // Not overlapping - add as new block
      merged.push({ ...current });
    }
  }

  return merged;
}

interface AvailabilityStatus {
  start: number; // Unix timestamp in milliseconds
  end: number; // Unix timestamp in milliseconds
  free: boolean;
}

/**
 * Subtract event blocks from availability blocks to get free/busy status
 *
 * @param availabilityBlocks - Time blocks when users are available
 * @param eventBlocks - Time blocks when users have events (busy)
 * @returns Array of availability status blocks (free or busy)
 */
function subtractEvents(
  availabilityBlocks: TimeBlock[],
  eventBlocks: TimeBlock[],
): AvailabilityStatus[] {
  const result: AvailabilityStatus[] = [];

  for (const avail of availabilityBlocks) {
    let currentStart = avail.start;

    // Find events that overlap with this availability block
    const overlappingEvents = eventBlocks
      .filter((event) => event.start < avail.end && event.end > avail.start)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    for (const event of overlappingEvents) {
      // Add free time before event (if any)
      if (currentStart < event.start) {
        result.push({
          start: currentStart.getTime(),
          end: event.start.getTime(),
          free: true,
        });
      }

      // Add busy time (event)
      const busyStart = Math.max(currentStart.getTime(), event.start.getTime());
      const busyEnd = Math.min(avail.end.getTime(), event.end.getTime());

      result.push({
        start: busyStart,
        end: busyEnd,
        free: false,
      });

      // Move current start to after this event
      currentStart = new Date(
        Math.max(currentStart.getTime(), event.end.getTime()),
      );
    }

    // Add remaining free time after all events (if any)
    if (currentStart < avail.end) {
      result.push({
        start: currentStart.getTime(),
        end: avail.end.getTime(),
        free: true,
      });
    }
  }

  return result;
}

/**
 * Find intersection of time blocks (times when ALL blocks overlap)
 *
 * @param blocksByUser - Array of time block arrays, one per user
 * @returns Array of time blocks where all users are available
 */
function intersectTimeBlocks(blocksByUser: TimeBlock[][]): TimeBlock[] {
  if (blocksByUser.length === 0) return [];
  if (blocksByUser.length === 1) return blocksByUser[0];

  // Start with first user's blocks
  let result = blocksByUser[0];

  // Intersect with each subsequent user's blocks
  for (let i = 1; i < blocksByUser.length; i++) {
    const newResult: TimeBlock[] = [];

    for (const block1 of result) {
      for (const block2 of blocksByUser[i]) {
        // Find overlap between block1 and block2
        const overlapStart = Math.max(
          block1.start.getTime(),
          block2.start.getTime(),
        );
        const overlapEnd = Math.min(block1.end.getTime(), block2.end.getTime());

        // If there's an overlap, add it
        if (overlapStart < overlapEnd) {
          newResult.push({
            start: new Date(overlapStart),
            end: new Date(overlapEnd),
          });
        }
      }
    }

    result = mergeTimeBlocks(newResult);
  }

  return result;
}

/**
 * Calculate mutual availability for multiple users
 *
 * Takes all users' availabilities and events, returns only the time slots
 * where ALL users are free (intersection of availabilities minus all events).
 *
 * @param currentUserAvailability - Current user's availability object
 * @param otherUsersAvailabilities - Array of other users' availability objects
 * @param currentUserEvents - Current user's events
 * @param otherUsersEvents - Other users' events
 * @param startTime - Start of time range (defaults to now)
 * @param endTime - End of time range (defaults to 7 days from now)
 * @returns Array of free time blocks where all users are available
 */
export function calculateMutualAvailability(
  currentUserAvailability: any,
  otherUsersAvailabilities: any[],
  currentUserEvents: any[],
  otherUsersEvents: any[],
  startTime?: Date,
  endTime?: Date,
): Array<{ start: number; end: number; free: boolean }> {
  if (!currentUserAvailability || otherUsersAvailabilities.length === 0) {
    return [];
  }

  // Default time range: now to 7 days from now
  const start =
    startTime ||
    (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    })();

  const end =
    endTime ||
    (() => {
      const d = new Date(start);
      d.setDate(d.getDate() + 7);
      return d;
    })();

  // Combine all availabilities
  const allAvailabilities: Availability[] = [
    {
      id: currentUserAvailability.id,
      owner: "current-user",
      title: currentUserAvailability.name || currentUserAvailability.title,
      description: "",
      slots: currentUserAvailability.slots || [],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      created_at: BigInt(0),
      updated_at: BigInt(0),
    },
    ...otherUsersAvailabilities.map((avail: any) => ({
      id: avail.id,
      owner: avail.owner,
      title: avail.title,
      description: avail.description || "",
      slots: avail.slots || [],
      timezone:
        avail.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      created_at: BigInt(avail.created_at || 0),
      updated_at: BigInt(avail.updated_at || 0),
    })),
  ];

  // Combine all events (current user + others)
  const allEvents = [...currentUserEvents, ...otherUsersEvents];
  const availabilityEvents: AvailabilityEvent[] = allEvents.map((e: any) => ({
    startTime: new Date(
      e.start?.dateTime || e.start?.date || e.startTime || new Date(),
    ),
    endTime: new Date(
      e.end?.dateTime || e.end?.date || e.endTime || new Date(),
    ),
  }));

  // Calculate mutual free time
  return getAvailabilitySummary(
    allAvailabilities,
    availabilityEvents,
    start,
    end,
  );
}

/**
 * Get availability summary for multiple users
 *
 * Combines multiple users' availabilities and events to produce a single
 * timeline showing when time is free or busy. This is a generic merge that
 * doesn't filter for "all users free" - it just shows the combined availability.
 *
 * @param availabilities - Array of availabilities from multiple users
 * @param events - Array of events from multiple users
 * @param startTime - Start of the time range to analyze
 * @param endTime - End of the time range to analyze
 * @returns Array of availability status blocks showing free/busy times
 *
 * @example
 * ```typescript
 * const summary = getAvailabilitySummary(
 *   [userAvailability, otherUserAvailability],
 *   [userEvents, otherUserEvents],
 *   new Date('2024-01-01T09:00:00'),
 *   new Date('2024-01-01T17:00:00')
 * );
 * // Returns: [
 * //   { start: 1704096000000, end: 1704099600000, free: true },   // 9am-10am free
 * //   { start: 1704099600000, end: 1704103200000, free: false },  // 10am-11am busy
 * //   { start: 1704103200000, end: 1704117600000, free: true }    // 11am-3pm free
 * // ]
 * ```
 */
export function getAvailabilitySummary(
  availabilities: Availability[],
  events: AvailabilityEvent[],
  startTime: Date,
  endTime: Date,
) {
  // 1. Expand availability slots for EACH user separately
  const availabilityBlocksByUser: TimeBlock[][] = [];

  // Iterate through each day in the range
  const currentDate = new Date(startTime);
  currentDate.setHours(0, 0, 0, 0);

  const endDate = new Date(endTime);
  endDate.setHours(23, 59, 59, 999);

  // For EACH user, collect their availability blocks
  for (const availability of availabilities) {
    const userBlocks: TimeBlock[] = [];
    const dateIterator = new Date(currentDate);

    while (dateIterator <= endDate) {
      for (const slot of availability.slots) {
        const block = expandTimeSlotForDate(slot, dateIterator);
        if (block) {
          // Only include blocks that overlap with our time range
          if (block.end > startTime && block.start < endTime) {
            const trimmedBlock = {
              start: new Date(
                Math.max(block.start.getTime(), startTime.getTime()),
              ),
              end: new Date(Math.min(block.end.getTime(), endTime.getTime())),
            };
            userBlocks.push(trimmedBlock);
          }
        }
      }
      dateIterator.setDate(dateIterator.getDate() + 1);
    }

    // Merge overlapping blocks for this user
    availabilityBlocksByUser.push(mergeTimeBlocks(userBlocks));
  }

  // 2. Find INTERSECTION of all users' availability (mutual free time)
  const mutualAvailability = intersectTimeBlocks(availabilityBlocksByUser);

  // 3. Convert ALL events to time blocks
  const eventBlocks: TimeBlock[] = events
    .map((event) => ({
      start: new Date(event.startTime),
      end: new Date(event.endTime),
    }))
    .filter((block) => {
      return block.end > startTime && block.start < endTime;
    })
    .map((block) => ({
      start: new Date(Math.max(block.start.getTime(), startTime.getTime())),
      end: new Date(Math.min(block.end.getTime(), endTime.getTime())),
    }));

  // 4. Subtract ALL events from mutual availability
  const statusBlocks = subtractEvents(mutualAvailability, eventBlocks);

  // 5. Return only FREE blocks (filter out busy times)
  return statusBlocks.filter((block) => block.free);
}
