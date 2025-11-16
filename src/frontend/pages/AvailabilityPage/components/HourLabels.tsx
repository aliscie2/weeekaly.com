import { memo } from "react";
import { DayAvailability } from "../types";
import { parseTimeToHours } from "../utils/timeCalculations";
import { PIXELS_PER_HOUR } from "../utils/constants";

interface HourLabelsProps {
  weekData: DayAvailability[];
  isMobile: boolean;
}

export const HourLabels = memo(function HourLabels({
  weekData,
  isMobile,
}: HourLabelsProps) {
  // Find the earliest start time across all available days
  let earliestStartHour = 24;

  weekData.forEach((day) => {
    if (day.available && day.timeSlots.length > 0) {
      const startHour = parseTimeToHours(day.timeSlots[0].start);
      earliestStartHour = Math.min(earliestStartHour, startHour);
    }
  });

  // If no available days, return null
  if (earliestStartHour === 24) {
    return null;
  }

  // Find the longest day to determine how many hours to show
  let longestDayEndHour = 0;
  weekData.forEach((day) => {
    if (day.available && day.timeSlots.length > 0) {
      const endHour = parseTimeToHours(day.timeSlots[0].end);
      longestDayEndHour = Math.max(longestDayEndHour, endHour);
    }
  });

  // Generate hour labels from earliest start to longest end
  const hours: Array<{ label: string; hour: number }> = [];
  const startHourFloor = Math.floor(earliestStartHour);
  const endHourFloor = Math.ceil(longestDayEndHour);

  for (let h = startHourFloor; h <= endHourFloor; h++) {
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    hours.push({
      label: `${displayHour} ${period}`,
      hour: h,
    });
  }

  // Calculate total height needed
  const totalDuration = longestDayEndHour - earliestStartHour;
  const totalHeight = totalDuration * PIXELS_PER_HOUR;

  return (
    <div
      className="relative pt-8"
      style={{ height: `${totalHeight}px`, minWidth: "60px" }}
    >
      {hours.map(({ label, hour }, idx) => {
        // Position each label at the exact pixel position for that hour
        const topPosition = (hour - earliestStartHour) * PIXELS_PER_HOUR;

        return (
          <div
            key={idx}
            className={`absolute right-0 text-right text-[#a8a195] ${isMobile ? "text-xs" : "text-sm"} pr-2`}
            style={{
              top: `${topPosition}px`,
              transform: "translateY(-50%)", // Center the label on the hour line
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
});
