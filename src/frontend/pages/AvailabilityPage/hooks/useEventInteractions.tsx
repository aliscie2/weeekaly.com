import { useState, useCallback } from "react";
import { toast } from "sonner";
import { AvailabilityEvent, DayAvailability } from "../types";
import { parseTimeToHours } from "../utils/timeCalculations";
import { isPastEvent } from "../../../utils/dateHelpers";

export const useEventInteractions = (
  events: AvailabilityEvent[],
  weekData: DayAvailability[],
  googleEvents: any[],
  eventActions: any,
) => {
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleEventClick = useCallback(
    (e: React.MouseEvent, eventId: string) => {
      e.stopPropagation();
      setFocusedEventId(eventId);
    },
    [],
  );

  const handleDeleteEvent = useCallback(() => {
    if (!focusedEventId) return;

    const event = events.find((ev) => ev.id === focusedEventId);
    if (!event || !event.isFromCalendar) return;

    setShowDeleteDialog(true);
  }, [focusedEventId, events]);

  const confirmDeleteEvent = useCallback(() => {
    if (!focusedEventId) return;

    const event = events.find((ev) => ev.id === focusedEventId);
    if (!event || !event.isFromCalendar) return;

    const calendarEventId = event.id.replace("calendar-", "");

    eventActions.handleDeleteEvent(calendarEventId, event.title);
    setFocusedEventId(null);
    setShowDeleteDialog(false);
  }, [focusedEventId, events, eventActions]);

  const handleEditEvent = useCallback(() => {
    if (!focusedEventId) return;

    const event = events.find((ev) => ev.id === focusedEventId);
    if (!event || !event.isFromCalendar) return;

    const day = weekData[event.dayIndex];
    const timeSlotStart = day.timeSlots[0]?.start || "9:00 AM";
    const baseHour = parseTimeToHours(timeSlotStart);

    const eventDate = new Date(day.date);
    const totalMinutes = baseHour * 60 + event.startMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    eventDate.setHours(hours, minutes, 0, 0);

    const endDate = new Date(eventDate);
    endDate.setMinutes(endDate.getMinutes() + event.durationMinutes);

    if (isPastEvent(endDate)) {
      toast.error("Cannot edit past events");
      return;
    }

    const calendarEventId = event.id.replace("calendar-", "");
    const googleEvent = googleEvents.find((ge) => ge.id === calendarEventId);
    if (!googleEvent) {
      toast.error("Event not found");
      return;
    }

    const startDateTime =
      googleEvent.start?.dateTime || googleEvent.start?.date;
    const endDateTime = googleEvent.end?.dateTime || googleEvent.end?.date;

    if (!startDateTime || !endDateTime) {
      toast.error("Invalid event date/time");
      return;
    }

    eventActions.openEditForm(calendarEventId, {
      summary: googleEvent.summary || event.title,
      description: googleEvent.description,
      start: new Date(startDateTime),
      end: new Date(endDateTime),
      location: googleEvent.location,
      attendees: googleEvent.attendees?.map((a: any) => ({
        email: a.email,
        displayName: a.displayName,
      })),
      conferenceData: !!googleEvent.hangoutLink,
    });

    setFocusedEventId(null);
  }, [focusedEventId, events, weekData, googleEvents, eventActions]);

  return {
    focusedEventId,
    setFocusedEventId,
    showDeleteDialog,
    setShowDeleteDialog,
    handleEventClick,
    handleDeleteEvent,
    confirmDeleteEvent,
    handleEditEvent,
  };
};
