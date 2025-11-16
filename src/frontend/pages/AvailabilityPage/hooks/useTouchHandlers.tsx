import { useState, useCallback } from "react";
import { toast } from "sonner";
import { AvailabilityEvent, DayAvailability } from "../types";
import {
  parseTimeToHours,
  pixelsToMinutes,
  getDayTotalMinutes,
} from "../utils/timeCalculations";
import { checkEventOverlap } from "../utils/eventValidation";
import { LONG_PRESS_DURATION, MIN_DURATION } from "../utils/constants";
import {
  generateEventName,
  validateEventTime,
  isPastEvent,
} from "../../../utils/dateHelpers";

export const useTouchHandlers = (
  isMobile: boolean,
  weekData: DayAvailability[],
  events: AvailabilityEvent[],
  googleEvents: any[],
  eventActions: any,
  dayRefs: React.MutableRefObject<(HTMLDivElement | null)[]>,
  isViewingOwnAvailability: boolean,
  currentUserEmail?: string,
  currentUserName?: string,
  ownerEmail?: string,
  ownerName?: string,
) => {
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [touchStartPos, setTouchStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
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

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, dayIndex: number) => {
      if (!isMobile || !weekData[dayIndex].available) return;

      const touch = e.touches[0];
      const container = dayRefs.current[dayIndex];
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const y = touch.clientY - rect.top;
      const totalMinutes = getDayTotalMinutes(dayIndex, weekData);
      const startMinutes = Math.max(
        0,
        pixelsToMinutes(y, rect.height, totalMinutes),
      );

      const dayEvents = events.filter((ev) => ev.dayIndex === dayIndex);
      const touchedEvent = dayEvents.find((event) => {
        const eventTop = (event.startMinutes / totalMinutes) * rect.height;
        const eventBottom =
          eventTop + (event.durationMinutes / totalMinutes) * rect.height;
        return y >= eventTop && y <= eventBottom;
      });

      setTouchStartPos({ x: touch.clientX, y: touch.clientY });

      if (!touchedEvent) {
        const timer = setTimeout(() => {
          const day = weekData[dayIndex];
          const timeSlotStart = day.timeSlots[0]?.start || "9:00 AM";
          const baseHour = parseTimeToHours(timeSlotStart);

          const eventDate = new Date(day.date);
          const totalStartMinutes = baseHour * 60 + startMinutes;
          const hours = Math.floor(totalStartMinutes / 60);
          const minutes = totalStartMinutes % 60;
          eventDate.setHours(hours, minutes, 0, 0);

          const endDate = new Date(eventDate);
          endDate.setMinutes(endDate.getMinutes() + 15);

          const validation = validateEventTime(eventDate, endDate);
          if (!validation.isValid) {
            toast.error(validation.error || "Invalid event time");
            return;
          }

          if (checkEventOverlap(dayIndex, startMinutes, 15, events)) {
            toast.error("Cannot create overlapping events");
            return;
          }

          if (navigator.vibrate) {
            navigator.vibrate(50);
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

          setLongPressTimer(null);
        }, LONG_PRESS_DURATION);

        setLongPressTimer(timer);
      }
    },
    [
      isMobile,
      weekData,
      events,
      eventActions,
      dayRefs,
      isViewingOwnAvailability,
      currentUserEmail,
      currentUserName,
      ownerEmail,
      ownerName,
    ],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile) return;

      const touch = e.touches[0];
      if (!touch) return;

      if (longPressTimer && touchStartPos) {
        const deltaX = Math.abs(touch.clientX - touchStartPos.x);
        const deltaY = Math.abs(touch.clientY - touchStartPos.y);

        if (deltaX > 10 || deltaY > 10) {
          clearTimeout(longPressTimer);
          setLongPressTimer(null);
        }
      }

      if (isTouchDragging && draggingEventId && originalEventData) {
        const container = dayRefs.current[originalEventData.dayIndex];
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const totalMinutes = getDayTotalMinutes(
          originalEventData.dayIndex,
          weekData,
        );

        const deltaY = touch.clientY - dragStartY;
        const deltaMinutes = pixelsToMinutes(deltaY, rect.height, totalMinutes);

        requestAnimationFrame(() => {
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
              originalEventData.startMinutes +
              originalEventData.durationMinutes;
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
        });
      }
    },
    [
      isMobile,
      longPressTimer,
      touchStartPos,
      isTouchDragging,
      draggingEventId,
      originalEventData,
      dragType,
      dragStartY,
      weekData,
      dayRefs,
    ],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isMobile) return;

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    setTouchStartPos(null);

    if (isTouchDragging && draggingEventId && originalEventData) {
      const event = events.find((ev) => ev.id === draggingEventId);
      if (!event) {
        setIsTouchDragging(false);
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
        setIsTouchDragging(false);
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
        toast.error(validation.error || "Invalid event time");
        setIsTouchDragging(false);
        setDraggingEventId(null);
        setDragType(null);
        setOriginalEventData(null);
        return;
      }

      const calendarEventId = event.id.replace("calendar-", "");
      const googleEvent = googleEvents.find((ge) => ge.id === calendarEventId);

      if (googleEvent) {
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
      }

      setIsTouchDragging(false);
      setDraggingEventId(null);
      setDragType(null);
      setOriginalEventData(null);
    }
  }, [
    isMobile,
    longPressTimer,
    isTouchDragging,
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

  const handleEventTouchStart = useCallback(
    (
      e: React.TouchEvent,
      eventId: string,
      type: "move" | "resize-top" | "resize-bottom",
    ) => {
      if (!isMobile) return;

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

      const touch = e.touches[0];

      setIsTouchDragging(true);
      setDraggingEventId(eventId);
      setDragType(type);
      setOriginalEventData({
        dayIndex: event.dayIndex,
        startMinutes: event.startMinutes,
        durationMinutes: event.durationMinutes,
      });
      setPreviewStartMinutes(event.startMinutes);
      setPreviewDurationMinutes(event.durationMinutes);
      setDragStartY(touch.clientY);

      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    },
    [isMobile, events, weekData],
  );

  return {
    longPressTimer,
    isTouchDragging,
    draggingEventId: draggingEventId,
    dragType: dragType,
    originalEventData: originalEventData,
    previewStartMinutes: previewStartMinutes,
    previewDurationMinutes: previewDurationMinutes,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleEventTouchStart,
  };
};
