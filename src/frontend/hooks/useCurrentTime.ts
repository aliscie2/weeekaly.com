import { useState, useEffect, useRef } from "react";

/**
 * Custom hook that provides the current time and updates at a specified interval.
 * Optimized to prevent unnecessary re-renders across multiple components.
 *
 * @param updateIntervalMs - How often to update the time (default: 1000ms = 1 second)
 * @returns Current Date object that updates at the specified interval
 */
export function useCurrentTime(updateIntervalMs: number = 1000): Date {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Update immediately on mount
    setCurrentTime(new Date());

    // Set up interval to update time
    intervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, updateIntervalMs);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [updateIntervalMs]);

  return currentTime;
}

/**
 * Hook that calculates time remaining until a target date.
 * Returns null if the target date is in the past.
 *
 * @param targetDate - The date to count down to
 * @param updateIntervalMs - How often to update (default: 1000ms)
 * @returns Object with time remaining or null if past
 */
export function useCountdown(
  targetDate: Date | null,
  updateIntervalMs: number = 1000,
): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
} | null {
  const currentTime = useCurrentTime(updateIntervalMs);

  if (!targetDate) return null;

  const now = currentTime.getTime();
  const target = targetDate.getTime();
  const diff = target - now;

  // If the target is in the past, return null
  if (diff <= 0) return null;

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
  };
}
