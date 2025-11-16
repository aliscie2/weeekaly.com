import { useState, useCallback } from "react";
import { toast } from "sonner";
import { AvailabilityEvent, DayAvailability } from "../types";
import {
  parseTimeToHours,
  pixelsToMinutes,
  getDayTotalMinutes,
} from "../utils/timeCalculations";
import { checkEventOverlap } from "../utils/eventValidation";
import { MIN_DURATION } from "../utils/constants";
import { isPastEvent, validateEventTime } from "../../../utils/dateHelpers";

export const useDragToReschedule = (
  events: AvailabilityEvent[],
  weekData: DayAvailability[],
  googleEvents: any[],
  eventActions: any,
  dayRefs: React.MutableRefObject<(HTMLDivElement | null)[]>,
) => {
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<
    "move" | "resize-top" | "resize-bottom" | null
  >(null);
  const [originalEventData, setOriginalEventData] = useState<{
    dayIndex: number;
    startMinutes: number;
    durationMinutes: number;
  } | null>(null);
  const [previewStartMinutes, setPreviewStartMinutes] = useState<number>(0);
  const [previewDurationMinutes, setPreviewDurationMinutes] =
    useState<number>(0);
  const [dragStartY, setDragStartY] = useState<number>(0);

  const handleEventDragStart = useCallback(
    (
      e: React.MouseEvent,
      eventId: string,
      type: "move" | "resize-top" | "resize-bottom",
    ) => {
      e.stopPropagation();

      const event = events.find((ev) => ev.id === eventId);
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
        toast.error("Cannot reschedule past events");
        return;
      }

      setDraggingEventId(eventId);
      setDragType(type);
      setOriginalEventData({
        dayIndex: event.dayIndex,
        startMinutes: event.startMinutes,
        durationMinutes: event.durationMinutes,
      });
      setPreviewStartMinutes(event.startMinutes);
      setPreviewDurationMinutes(event.durationMinutes);
      setDragStartY(e.clientY);
    },
    [events, weekData],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (draggingEventId && originalEventData && dragType) {
        const container = dayRefs.current[originalEventData.dayIndex];
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const totalMinutes = getDayTotalMinutes(
          originalEventData.dayIndex,
          weekData,
        );

        const deltaY = e.clientY - dragStartY;
        const deltaMinutes = pixelsToMinutes(deltaY, rect.height, totalMinutes);

        if (dragType === "move") {
          let newStartMinutes = originalEventData.startMinutes + deltaMinutes;
          newStartMinutes = Math.max(0, newStartMinutes);
          newStartMinutes = Math.min(
            newStartMinutes,
            totalMinutes - originalEventData.durationMinutes,
          );

          setPreviewStartMinutes(newStartMinutes);
          setPreviewDurationMinutes(originalEventData.durationMinutes);
        } else if (dragType === "resize-top") {
          let newStartMinutes = originalEventData.startMinutes + deltaMinutes;
          let newDuration = originalEventData.durationMinutes - deltaMinutes;

          newStartMinutes = Math.max(0, newStartMinutes);
          newDuration = Math.max(MIN_DURATION, newDuration);

          const originalEndMinutes =
            originalEventData.startMinutes + originalEventData.durationMinutes;
          if (newStartMinutes + newDuration > originalEndMinutes) {
            newStartMinutes = originalEndMinutes - newDuration;
          }

          setPreviewStartMinutes(newStartMinutes);
          setPreviewDurationMinutes(newDuration);
        } else if (dragType === "resize-bottom") {
          let newDuration = originalEventData.durationMinutes + deltaMinutes;
          newDuration = Math.max(MIN_DURATION, newDuration);

          const maxDuration = totalMinutes - originalEventData.startMinutes;
          newDuration = Math.min(newDuration, maxDuration);

          setPreviewStartMinutes(originalEventData.startMinutes);
          setPreviewDurationMinutes(newDuration);
        }
      }
    },
    [
      draggingEventId,
      originalEventData,
      dragType,
      dragStartY,
      weekData,
      dayRefs,
    ],
  );

  const handleMouseUp = useCallback(() => {
    if (draggingEventId && originalEventData && dragType) {
      const event = events.find((ev) => ev.id === draggingEventId);
      if (!event) {
        setDraggingEventId(null);
        setDragType(null);
        setOriginalEventData(null);
        return;
      }

      if (
        checkEventOverlap(
          originalEventData.dayIndex,
          previewStartMinutes,
          previewDurationMinutes,
          events,
          draggingEventId,
        )
      ) {
        const action = dragType === "move" ? "reschedule" : "resize";
        toast.error(`Cannot ${action}: would overlap with another event`);
        setDraggingEventId(null);
        setDragType(null);
        setOriginalEventData(null);
        return;
      }

      const day = weekData[originalEventData.dayIndex];
      const timeSlotStart = day.timeSlots[0]?.start || "9:00 AM";
      const baseHour = parseTimeToHours(timeSlotStart);

      const eventDate = new Date(day.date);
      const totalStartMinutes = baseHour * 60 + previewStartMinutes;
      const hours = Math.floor(totalStartMinutes / 60);
      const minutes = totalStartMinutes % 60;
      eventDate.setHours(hours, minutes, 0, 0);

      const endDate = new Date(eventDate);
      endDate.setMinutes(endDate.getMinutes() + previewDurationMinutes);

      const validation = validateEventTime(eventDate, endDate);
      if (!validation.isValid) {
        const action = dragType === "move" ? "reschedule" : "resize";
        toast.error(validation.error || `Cannot ${action} to past time`);
        setDraggingEventId(null);
        setDragType(null);
        setOriginalEventData(null);
        return;
      }

      const calendarEventId = event.id.replace("calendar-", "");
      const googleEvent = googleEvents.find((ge) => ge.id === calendarEventId);
      if (!googleEvent) {
        toast.error("Event not found");
        setDraggingEventId(null);
        setOriginalEventData(null);
        return;
      }

      const startDateTime =
        googleEvent.start?.dateTime || googleEvent.start?.date;
      const endDateTime = googleEvent.end?.dateTime || googleEvent.end?.date;

      if (!startDateTime || !endDateTime) {
        toast.error("Invalid event date/time");
        setDraggingEventId(null);
        setDragType(null);
        setOriginalEventData(null);
        return;
      }

      eventActions.openEditForm(calendarEventId, {
        summary: googleEvent.summary || event.title,
        description: googleEvent.description,
        start: eventDate,
        end: endDate,
        location: googleEvent.location,
        attendees: googleEvent.attendees?.map((a: any) => ({
          email: a.email,
          displayName: a.displayName,
        })),
        conferenceData: !!googleEvent.hangoutLink,
      });

      setDraggingEventId(null);
      setDragType(null);
      setOriginalEventData(null);
    }
  }, [
    draggingEventId,
    originalEventData,
    dragType,
    previewStartMinutes,
    previewDurationMinutes,
    events,
    weekData,
    googleEvents,
    eventActions,
  ]);

  return {
    draggingEventId,
    dragType,
    originalEventData,
    previewStartMinutes,
    previewDurationMinutes,
    setPreviewStartMinutes,
    setPreviewDurationMinutes,
    handleEventDragStart,
    handleMouseMove,
    handleMouseUp,
  };
};
