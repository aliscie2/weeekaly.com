/**
 * Date helper utilities for event validation and formatting
 */

/**
 * Check if a date/time is in the past
 */
export const isPastDateTime = (date: Date): boolean => {
  const now = new Date();
  return date < now;
};

/**
 * Check if an event has already ended (is in the past)
 */
export const isPastEvent = (endDate: Date): boolean => {
  return isPastDateTime(endDate);
};

/**
 * Generate a descriptive event name based on date and time
 * Format: "Meeting on [Day], [Month] [Date], [Year] at [Time]"
 * Example: "Meeting on Monday, November 9, 2025 at 10:00 AM"
 */
export const generateEventName = (date: Date): string => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const dayName = dayNames[date.getDay()];
  const monthName = monthNames[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const displayMinutes = minutes.toString().padStart(2, '0');
  
  return `Meeting on ${dayName}, ${monthName} ${day}, ${year} at ${displayHours}:${displayMinutes} ${period}`;
};

/**
 * Format duration in minutes to readable string
 */
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${mins} min`;
};

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate event time (not in past, valid duration, etc.)
 */
export const validateEventTime = (start: Date, end: Date): ValidationResult => {
  // Check if start time is in the past
  if (isPastDateTime(start)) {
    return {
      isValid: false,
      error: 'Cannot create events in the past'
    };
  }
  
  // Check if end is after start
  if (end <= start) {
    return {
      isValid: false,
      error: 'End time must be after start time'
    };
  }
  
  // Check minimum duration (15 minutes)
  const durationMs = end.getTime() - start.getTime();
  const durationMinutes = durationMs / (1000 * 60);
  if (durationMinutes < 15) {
    return {
      isValid: false,
      error: 'Event must be at least 15 minutes long'
    };
  }
  
  // Check maximum duration (8 hours)
  if (durationMinutes > 480) {
    return {
      isValid: false,
      error: 'Event cannot be longer than 8 hours'
    };
  }
  
  return { isValid: true };
};
