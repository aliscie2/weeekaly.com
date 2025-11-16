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
import {
  generateEventName,
  validateEventTime,
} from "../../../utils/dateHelpers";

export const useDragToCreate = (
  weekData: DayAvailability[],
  events: AvailabilityEvent[],
  eventActions: any,
  dayRefs: React.MutableRefObject<(HTMLDivElement | null)[]>,
  isViewingOwnAvailability: boolean,
  currentUserEmail?: string,
  currentUserName?: string,
  ownerEmail?: string,
  ownerName?: string,
) => {
  const [isDraggingNew, setIsDraggingNew] = useState(false);
  const [dragDayIndex, setDragDayIndex] = useState<number | null>(null);
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [dragCurrentY, setDragCurrentY] = useState<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, dayIndex: number) => {
      if (!weekData[dayIndex].available) return;

      const container = dayRefs.current[dayIndex];
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const totalMinutes = getDayTotalMinutes(dayIndex, weekData);

      const dayEvents = events.filter((ev) => ev.dayIndex === dayIndex);
      const clickedEvent = dayEvents.find((event) => {
        const eventTop = (event.startMinutes / totalMinutes) * rect.height;
        const eventBottom =
          eventTop + (event.durationMinutes / totalMinutes) * rect.height;
        return y >= eventTop && y <= eventBottom;
      });

      if (clickedEvent) return;

      setIsDraggingNew(true);
      setDragDayIndex(dayIndex);
      setDragStartY(y);
      setDragCurrentY(y);
    },
    [weekData, events, dayRefs],
  );

  const handleMouseUp = useCallback(() => {
    if (isDraggingNew && dragDayIndex !== null) {
      const container = dayRefs.current[dragDayIndex];
      if (!container) {
        setIsDraggingNew(false);
        setDragDayIndex(null);
        return;
      }

      const rect = container.getBoundingClientRect();
      const totalMinutes = getDayTotalMinutes(dragDayIndex, weekData);

      const startY = Math.min(dragStartY, dragCurrentY);
      const endY = Math.max(dragStartY, dragCurrentY);
      const startMinutes = Math.max(
        0,
        pixelsToMinutes(startY, rect.height, totalMinutes),
      );
      const endMinutes = Math.min(
        totalMinutes,
        pixelsToMinutes(endY, rect.height, totalMinutes),
      );
      const durationMinutes = Math.max(MIN_DURATION, endMinutes - startMinutes);

      console.log("[useDragToCreate] 🔍 Checking overlap:", {
        dragDayIndex,
        startMinutes,
        durationMinutes,
        existingEvents: events.length,
        eventsOnThisDay: events.filter((e) => e.dayIndex === dragDayIndex)
          .length,
      });

      if (
        checkEventOverlap(dragDayIndex, startMinutes, durationMinutes, events)
      ) {
        console.log(
          "[useDragToCreate] ❌ Overlap detected! Cannot create event",
        );
        toast.error("Cannot create overlapping events");
        setIsDraggingNew(false);
        setDragDayIndex(null);
        return;
      }

      console.log("[useDragToCreate] ✅ No overlap, creating event");

      const day = weekData[dragDayIndex];
      const timeSlotStart = day.timeSlots[0]?.start || "9:00 AM";
      const baseHour = parseTimeToHours(timeSlotStart);

      const eventDate = new Date(day.date);
      const totalStartMinutes = baseHour * 60 + startMinutes;
      const hours = Math.floor(totalStartMinutes / 60);
      const minutes = totalStartMinutes % 60;
      eventDate.setHours(hours, minutes, 0, 0);

      const endDate = new Date(eventDate);
      endDate.setMinutes(endDate.getMinutes() + durationMinutes);

      const validation = validateEventTime(eventDate, endDate);
      if (!validation.isValid) {
        toast.error(validation.error || "Invalid event time");
        setIsDraggingNew(false);
        setDragDayIndex(null);
        return;
      }

      const eventName = generateEventName(eventDate);

      const attendees: Array<{ email: string; displayName?: string }> = [];

      if (currentUserEmail) {
        attendees.push({
          email: currentUserEmail,
          displayName: currentUserName,
        });
      }

      if (
        !isViewingOwnAvailability &&
        ownerEmail &&
        ownerEmail !== currentUserEmail
      ) {
        attendees.push({
          email: ownerEmail,
          displayName: ownerName,
        });
      }

      eventActions.openCreateForm({
        summary: eventName,
        start: eventDate,
        end: endDate,
        conferenceData: true,
        attendees: attendees.length > 0 ? attendees : undefined,
      });

      setIsDraggingNew(false);
      setDragDayIndex(null);
    }
  }, [
    isDraggingNew,
    dragDayIndex,
    dragStartY,
    dragCurrentY,
    weekData,
    events,
    eventActions,
    dayRefs,
    isViewingOwnAvailability,
    currentUserEmail,
    currentUserName,
    ownerEmail,
    ownerName,
  ]);

  return {
    isDraggingNew,
    dragDayIndex,
    dragStartY,
    dragCurrentY,
    setDragCurrentY,
    handleMouseDown,
    handleMouseUp,
  };
};
