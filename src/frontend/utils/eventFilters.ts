/**
 * Event filtering utilities
 * Consolidates duplicate event filtering logic across the application
 */

export type FilterScope = "all" | "today" | "tomorrow" | "week" | "month";

export interface EventLike {
  id?: string;
  start?: { dateTime?: string } | string;
  end?: { dateTime?: string } | string;
  summary?: string;
  title?: string;
}

/**
 * Get the date from an event object
 */
function getEventDate(event: EventLike): Date {
  const startValue = event.start;

  // Handle string format
  if (typeof startValue === "string") {
    return new Date(startValue);
  }

  // Handle object with dateTime property
  if (startValue && typeof startValue === "object" && startValue.dateTime) {
    return new Date(startValue.dateTime);
  }

  // Fallback to current date
  console.error("[eventFilters] ❌ Could not parse event date:", event);
  return new Date();
}

/**
 * Filter events by scope
 */
export function filterEventsByScope(
  events: EventLike[],
  scope: FilterScope,
): EventLike[] {
  if (scope === "all") {
    return events;
  }

  const now = new Date();

  switch (scope) {
    case "today": {
      const today = now.toDateString();
      return events.filter((e) => getEventDate(e).toDateString() === today);
    }

    case "tomorrow": {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toDateString();
      return events.filter(
        (e) => getEventDate(e).toDateString() === tomorrowStr,
      );
    }

    case "week": {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const filtered = events.filter((e) => {
        const eventDate = getEventDate(e);
        return eventDate >= weekStart && eventDate < weekEnd;
      });

      return filtered;
    }

    case "month": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      return events.filter((e) => {
        const eventDate = getEventDate(e);
        return eventDate >= monthStart && eventDate <= monthEnd;
      });
    }

    default:
      return events;
  }
}

/**
 * Get scope label for display
 */
export function getScopeLabel(scope: FilterScope): string {
  const labels: Record<FilterScope, string> = {
    all: "total",
    today: "today",
    tomorrow: "tomorrow",
    week: "this week",
    month: "this month",
  };
  return labels[scope];
}

/**
 * Parse scope from message text
 */
export function parseScopeFromMessage(message: string): FilterScope {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes("today")) return "today";
  if (lowerMsg.includes("tomorrow")) return "tomorrow";
  if (lowerMsg.includes("this week") || lowerMsg.includes("week"))
    return "week";
  if (lowerMsg.includes("this month") || lowerMsg.includes("month"))
    return "month";

  return "all";
}
