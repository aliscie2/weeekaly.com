import { memo } from "react";
import { useCurrentTime } from "../hooks/useCurrentTime";

interface CurrentTimeLineProps {
  /**
   * The date of the day this timeline is for
   */
  dayDate: Date;
  /**
   * Start hour of the availability slot (e.g., 9 for 9 AM)
   */
  startHour: number;
  /**
   * End hour of the availability slot (e.g., 18 for 6 PM)
   */
  endHour: number;
  /**
   * Height of the calendar container in pixels
   */
  containerHeight: number;
}

/**
 * Displays a red line indicating the current time on the availability calendar.
 * Only shows if the current time falls within the day and time range.
 */
export const CurrentTimeLine = memo(function CurrentTimeLine({
  dayDate,
  startHour,
  endHour,
  containerHeight,
}: CurrentTimeLineProps) {
  const currentTime = useCurrentTime(60000); // Update every minute (sufficient for time line)

  // Check if current time is on the same day
  const now = currentTime;
  const isSameDay =
    now.getFullYear() === dayDate.getFullYear() &&
    now.getMonth() === dayDate.getMonth() &&
    now.getDate() === dayDate.getDate();

  if (!isSameDay) return null;

  // Get current hour as decimal (e.g., 14.5 for 2:30 PM)
  const currentHour = now.getHours() + now.getMinutes() / 60;

  // Check if current time is within the availability range
  if (currentHour < startHour || currentHour > endHour) return null;

  // Calculate position as percentage of container height
  const totalHours = endHour - startHour;
  const hoursFromStart = currentHour - startHour;
  const positionPercent = (hoursFromStart / totalHours) * 100;
  const positionPx = (positionPercent / 100) * containerHeight;

  // Format current time for display
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const timeString = `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;

  return (
    <div
      className="absolute left-0 right-0 pointer-events-none z-40"
      style={{ top: `${positionPx}px` }}
    >
      {/* Red line */}
      <div className="w-full h-[2px] bg-red-500 shadow-lg" />
      
      {/* Time label with red background */}
      <div className="absolute left-2 -top-3 bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
        {timeString}
      </div>
      
      {/* Optional: Red dot at the start of the line */}
      <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full shadow-lg" />
    </div>
  );
});
