import { TimeSlot, DayAvailability } from "../types";
import { PIXELS_PER_HOUR } from "./constants";

export const parseTimeToHours = (timeString: string): number => {
  const [time, period] = timeString.split(" ");
  const [hours, minutes] = time.split(":").map(Number);

  let totalHours = hours;
  if (period === "PM" && hours !== 12) {
    totalHours += 12;
  } else if (period === "AM" && hours === 12) {
    totalHours = 0;
  }

  return totalHours + minutes / 60;
};

export const calculateDuration = (timeSlot: TimeSlot): number => {
  const startHours = parseTimeToHours(timeSlot.start);
  const endHours = parseTimeToHours(timeSlot.end);
  return endHours - startHours;
};

// Calculate height based on universal PIXELS_PER_HOUR constant
const getHeightFromDuration = (durationInHours: number): number => {
  return Math.round(durationInHours * PIXELS_PER_HOUR);
};

// NEW: Calculate height from time slot using universal constant
export const getHeightFromTimeSlot = (timeSlot: TimeSlot): number => {
  const duration = calculateDuration(timeSlot);
  return getHeightFromDuration(duration);
};

export const formatDate = (date: Date): string => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${date.getDate()} ${months[date.getMonth()]}`;
};

export const pixelsToMinutes = (
  pixels: number,
  containerHeight: number,
  totalMinutes: number,
) => {
  return Math.round((pixels / containerHeight) * totalMinutes);
};

export const minutesToPixels = (
  minutes: number,
  containerHeight: number,
  totalMinutes: number,
) => {
  return (minutes / totalMinutes) * containerHeight;
};

export const getDayTotalMinutes = (
  dayIndex: number,
  weekData: DayAvailability[],
) => {
  const day = weekData[dayIndex];
  if (!day || !day.available || day.timeSlots.length === 0) return 0;
  return calculateDuration(day.timeSlots[0]) * 60;
};

const convertBackendSlotsToUI = (
  backendSlots: Array<{
    day_of_week: number;
    start_time: number;
    end_time: number;
  }>,
): Map<number, TimeSlot[]> => {
  const slotsByDay = new Map<number, TimeSlot[]>();

  // Backend stores times in LOCAL timezone already (not UTC!)
  // So we DON'T need timezone conversion - just format the times

  for (const slot of backendSlots) {
    // Use the times directly - they're already in the correct timezone
    let localStartMinutes = slot.start_time;
    let localEndMinutes = slot.end_time;
    let localDayOfWeek = slot.day_of_week;

    // Handle day overflow/underflow when converting timezones
    if (localStartMinutes < 0) {
      // Time slot starts on previous day in local timezone
      localStartMinutes += 24 * 60;
      localDayOfWeek = (localDayOfWeek - 1 + 7) % 7;
    } else if (localStartMinutes >= 24 * 60) {
      // Time slot starts on next day in local timezone
      localStartMinutes -= 24 * 60;
      localDayOfWeek = (localDayOfWeek + 1) % 7;
    }

    if (localEndMinutes < 0) {
      localEndMinutes += 24 * 60;
    } else if (localEndMinutes >= 24 * 60) {
      localEndMinutes -= 24 * 60;
    }

    // Handle slots that span across midnight in local timezone
    if (localEndMinutes <= localStartMinutes) {
      // Split into two slots: one ending at midnight, one starting at midnight next day
      const startHours = Math.floor(localStartMinutes / 60);
      const startMins = localStartMinutes % 60;

      const formatTime = (hours: number, minutes: number): string => {
        const period = hours >= 12 ? "PM" : "AM";
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes.toString().padStart(2, "0");
        return `${displayHours}:${displayMinutes} ${period}`;
      };

      // First slot: from start to midnight
      const firstSlot: TimeSlot = {
        start: formatTime(startHours, startMins),
        end: "11:59 PM",
      };

      if (!slotsByDay.has(localDayOfWeek)) {
        slotsByDay.set(localDayOfWeek, []);
      }
      slotsByDay.get(localDayOfWeek)!.push(firstSlot);

      // Second slot: from midnight to end (next day)
      const nextDay = (localDayOfWeek + 1) % 7;
      const endHours = Math.floor(localEndMinutes / 60);
      const endMins = localEndMinutes % 60;

      const secondSlot: TimeSlot = {
        start: "12:00 AM",
        end: formatTime(endHours, endMins),
      };

      if (!slotsByDay.has(nextDay)) {
        slotsByDay.set(nextDay, []);
      }
      slotsByDay.get(nextDay)!.push(secondSlot);
    } else {
      // Normal slot within same day
      const startHours = Math.floor(localStartMinutes / 60);
      const startMins = localStartMinutes % 60;
      const endHours = Math.floor(localEndMinutes / 60);
      const endMins = localEndMinutes % 60;

      const formatTime = (hours: number, minutes: number): string => {
        const period = hours >= 12 ? "PM" : "AM";
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes.toString().padStart(2, "0");
        return `${displayHours}:${displayMinutes} ${period}`;
      };

      const timeSlot: TimeSlot = {
        start: formatTime(startHours, startMins),
        end: formatTime(endHours, endMins),
      };

      if (!slotsByDay.has(localDayOfWeek)) {
        slotsByDay.set(localDayOfWeek, []);
      }
      slotsByDay.get(localDayOfWeek)!.push(timeSlot);
    }
  }

  console.log("=== [convertBackendSlotsToUI] FORMATTING TIMES ===");
  console.log("Input backendSlots:", backendSlots);
  console.log("Output slotsByDay:", slotsByDay);
  console.log("Days with slots:", Array.from(slotsByDay.keys()));
  slotsByDay.forEach((slots, day) => {
    console.log(`  Day ${day}:`, slots);
  });
  console.log("==================================================");

  return slotsByDay;
};

export const getDaysDataFromBackend = (
  startDate: Date,
  count: number,
  backendSlots: Array<{
    day_of_week: number;
    start_time: number;
    end_time: number;
  }>,
): DayAvailability[] => {
  const days: DayAvailability[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const slotsByDay = convertBackendSlotsToUI(backendSlots);

  console.log("=== [getDaysDataFromBackend] BUILDING WEEK ===");
  console.log("startDate:", startDate);
  console.log("count:", count);
  console.log("slotsByDay:", slotsByDay);

  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dayOfWeek = date.getDay();

    const timeSlots = slotsByDay.get(dayOfWeek) || [];

    console.log(
      `Building day ${i}: ${dayNames[dayOfWeek]} (dayOfWeek=${dayOfWeek}), timeSlots:`,
      timeSlots,
    );

    days.push({
      date: new Date(date),
      dayName: dayNames[dayOfWeek],
      available: timeSlots.length > 0,
      timeSlots: timeSlots,
    });
  }

  console.log("Final days array:", days);
  console.log("==============================================");

  return days;
};

export const getDaysData = (
  startDate: Date,
  count: number,
): DayAvailability[] => {
  const days: DayAvailability[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dayOfWeek = date.getDay();

    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    let timeSlots: TimeSlot[] = [];
    if (isWeekday) {
      if (dayOfWeek === 2) {
        timeSlots = [{ start: "9:00 AM", end: "3:00 PM" }];
      } else {
        timeSlots = [{ start: "9:00 AM", end: "6:00 PM" }];
      }
    }

    days.push({
      date: new Date(date),
      dayName: dayNames[dayOfWeek],
      available: isWeekday,
      timeSlots: timeSlots,
    });
  }

  return days;
};
