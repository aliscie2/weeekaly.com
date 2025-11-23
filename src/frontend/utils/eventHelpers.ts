/**
 * Event utility functions
 * Centralized logic for event time extraction, conflict checking, and filtering
 */

export interface CalendarEventInput {
  id: string;
  summary?: string;
  title?: string;
  start?: string | { dateTime?: string; date?: string };
  end?: string | { dateTime?: string; date?: string };
  startTime?: string;
  endTime?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  location?: string;
  description?: string;
  conferenceData?: any;
}

interface EventTimes {
  startDateTime: string;
  endDateTime: string;
}

/**
 * Extract start and end times from various event formats
 */
export function getEventTimes(event: CalendarEventInput): EventTimes {
  const startValue = event.start;
  const endValue = event.end;

  return {
    startDateTime:
      typeof startValue === "string"
        ? startValue
        : startValue?.dateTime || event.startTime || "",
    endDateTime:
      typeof endValue === "string"
        ? endValue
        : endValue?.dateTime || event.endTime || "",
  };
}

/**
 * Check if a new event conflicts with existing events
 */
export function checkEventConflict(
  events: CalendarEventInput[],
  newStart: Date,
  newEnd: Date,
): boolean {
  const newStartMs = newStart.getTime();
  const newEndMs = newEnd.getTime();

  return events.some((existingEvent) => {
    const { startDateTime, endDateTime } = getEventTimes(existingEvent);
    if (!startDateTime || !endDateTime) return false;

    const existingStart = new Date(startDateTime);
    const existingEnd = new Date(endDateTime);
    const oldStartMs = existingStart.getTime();
    const oldEndMs = existingEnd.getTime();

    // Check for overlap: new event starts before existing ends AND new event ends after existing starts
    return newStartMs < oldEndMs && newEndMs > oldStartMs;
  });
}

/**
 * Filter events to only include future events within a date range
 */
export function filterFutureEvents(
  events: CalendarEventInput[],
  startDate: Date,
  endDate: Date,
): CalendarEventInput[] {
  const now = new Date();

  return events.filter((event) => {
    const { startDateTime } = getEventTimes(event);
    if (!startDateTime) return false;

    const eventStart = new Date(startDateTime);
    return (
      eventStart >= now && eventStart >= startDate && eventStart <= endDate
    );
  });
}

/**
 * Get event title from various formats
 */
export function getEventTitle(event: CalendarEventInput): string {
  return event.summary || event.title || "Untitled Event";
}

/**
 * Convert event times to minimal format for AI context
 */
export function toMinimalEventTime(event: CalendarEventInput) {
  const { startDateTime, endDateTime } = getEventTimes(event);
  return {
    s: startDateTime,
    e: endDateTime,
  };
}
