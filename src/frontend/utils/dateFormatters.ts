/**
 * Centralized date formatting utilities
 * Memoized formatters for consistent date/time display
 */

// Memoized formatter instances for better performance
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const dayNameFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const shortDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/**
 * Format time only (e.g., "2:30 PM")
 */
export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

/**
 * Format date only (e.g., "Nov 15")
 */
export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/**
 * Format day name with date (e.g., "Monday, November 15")
 */
export function formatDayName(date: Date): string {
  return dayNameFormatter.format(date);
}

/**
 * Format short day (e.g., "Mon, Nov 15")
 */
export function formatShortDay(date: Date): string {
  return shortDayFormatter.format(date);
}

/**
 * Format duration in minutes to human-readable string
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}min`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${mins}min`;
  }
}

/**
 * Calculate duration between two dates in minutes
 */
export function calculateDuration(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Get current timezone
 */
export function getCurrentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Get timezone offset in hours
 */
export function getTimezoneOffset(): number {
  return -new Date().getTimezoneOffset() / 60;
}
