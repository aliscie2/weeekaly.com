import { memo } from "react";
import { useCountdown } from "../hooks/useCurrentTime";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  /**
   * The target date/time to count down to
   */
  targetDate: Date;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * Displays a countdown timer to an upcoming event.
 * Shows "Already passed" if the event is in the past.
 */
export const CountdownTimer = memo(function CountdownTimer({
  targetDate,
  className = "",
}: CountdownTimerProps) {
  const countdown = useCountdown(targetDate, 1000); // Update every second

  // If countdown is null, the event has passed
  if (!countdown) {
    return (
      <div
        className={`flex items-center gap-1.5 text-xs text-red-600 font-medium ${className}`}
      >
        <Clock className="h-3.5 w-3.5" />
        <span>Already passed</span>
      </div>
    );
  }

  const { days, hours, minutes, seconds } = countdown;

  // Format the countdown display based on time remaining
  let displayText = "";
  
  if (days > 0) {
    // Show days and hours if more than 1 day away
    displayText = `${days}d ${hours}h`;
  } else if (hours > 0) {
    // Show hours and minutes if less than 1 day
    displayText = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    // Show minutes and seconds if less than 1 hour
    displayText = `${minutes}m ${seconds}s`;
  } else {
    // Show only seconds if less than 1 minute
    displayText = `${seconds}s`;
  }

  return (
    <div
      className={`flex items-center gap-1.5 text-xs text-green-600 font-medium ${className}`}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>Starts in {displayText}</span>
    </div>
  );
});
