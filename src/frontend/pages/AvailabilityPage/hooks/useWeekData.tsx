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
    if (backendSlots.length > 0) {
      return getDaysDataFromBackend(currentStartDate, daysToShow, backendSlots);
    }
    return getDaysData(currentStartDate, daysToShow);
  }, [currentStartDate, daysToShow, backendSlots]);
};
