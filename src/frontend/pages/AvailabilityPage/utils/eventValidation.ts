import { toast } from "sonner";
import { AvailabilityEvent } from "../types";

export const checkEventOverlap = (
  dayIndex: number,
  startMinutes: number,
  durationMinutes: number,
  events: AvailabilityEvent[],
  excludeEventId?: string,
): boolean => {
  const endMinutes = startMinutes + durationMinutes;

  const dayEvents = events.filter(
    (ev) => ev.dayIndex === dayIndex && ev.id !== excludeEventId,
  );

  for (const event of dayEvents) {
    const eventEnd = event.startMinutes + event.durationMinutes;

    if (startMinutes < eventEnd && endMinutes > event.startMinutes) {
      return true;
    }
  }

  return false;
};

export const copyToClipboard = (text: string) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
    toast.success("Calendar link copied!");
  } catch (err) {
    toast.error("Failed to copy link");
  } finally {
    document.body.removeChild(textarea);
  }
};
