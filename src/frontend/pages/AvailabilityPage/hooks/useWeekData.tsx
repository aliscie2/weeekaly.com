import { useMemo } from "react";
import { DayAvailability } from "../types";
import { getDaysDataFromBackend, getDaysData } from "../utils/timeCalculations";

export const useWeekData = (
  currentStartDate: Date,
  daysToShow: number,
  backendSlots: Array<{
    day_of_week: number;
    start_time: number;
    end_time: number;
  }>,
): DayAvailability[] => {
  return useMemo(() => {
    console.log("=== [useWeekData] PROCESSING ===");
    console.log("backendSlots:", backendSlots);
    console.log("backendSlots.length:", backendSlots.length);

    if (backendSlots.length > 0) {
      console.log("✅ Using REAL backend data (getDaysDataFromBackend)");
      const result = getDaysDataFromBackend(
        currentStartDate,
        daysToShow,
        backendSlots,
      );
      console.log("Result from getDaysDataFromBackend:", result);
      return result;
    }

    console.log("⚠️ Using DUMMY data (getDaysData) - backendSlots is empty!");
    return getDaysData(currentStartDate, daysToShow);
  }, [currentStartDate, daysToShow, backendSlots]);
};
