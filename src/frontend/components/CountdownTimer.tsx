import { memo } from "react";
import { useCountdown, useCurrentTime } from "../hooks/useCurrentTime";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  /**
   * The start date/time of the event
   */
  startDate: Date;
  /**
   * The end date/time of the event
   */
  endDate: Date;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Displays a countdown timer for an event.
 * - Shows "Already passed" if both start and end times are in the past
 * - Shows "Ends in X" if event has started but not ended
 * - Shows "Starts in X" if event hasn't started yet
 */
export const CountdownTimer = memo(function CountdownTimer({
  startDate,
  endDate,
  className = "",
}: CountdownTimerProps) {
  const currentTime = useCurrentTime(1000);
  const startCountdown = useCountdown(startDate, 1000);
  const endCountdown = useCountdown(endDate, 1000);

  const now = currentTime.getTime();
  const start = startDate.getTime();
  const end = endDate.getTime();

  // If both start and end times are older than current time, event has passed
  if (now > end) {
    return (
      <div
        className={`flex items-center gap-1.5 text-xs text-red-600 font-medium ${className}`}
      >
        <Clock className="h-3.5 w-3.5" />
        <span>Already passed</span>
      </div>
    );
  }

  // If start time is older than current time but end time is later, event is ongoing
  if (now >= start && now <= end) {
    if (!endCountdown) return null;

    const { minutes, seconds } = endCountdown;
    const displayText = `${minutes}m ${seconds}s`;

    return (
      <div
        className={`flex items-center gap-1.5 text-xs text-orange-600 font-medium ${className}`}
      >
        <Clock className="h-3.5 w-3.5" />
        <span>Ends in {displayText}</span>
      </div>
    );
  }

  // If start time is later than current time, event hasn't started
  if (!startCountdown) return null;

  const { minutes, seconds } = startCountdown;
  const displayText = `${minutes}m ${seconds}s`;

  return (
    <div
      className={`flex items-center gap-1.5 text-xs text-green-600 font-medium ${className}`}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>Starts in {displayText}</span>
    </div>
  );
});
