import { useState, useRef, useCallback, useEffect, useMemo, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { EventFormModal } from "../../components/EventFormModal";
import { useEventActions } from "../../hooks/useEventActions";
import {
  useCalendarEvents,
  useAvailabilities,
  useSharedCalendarEvents,
} from "../../hooks/useBackend";
import { isPastEvent } from "../../utils/dateHelpers";
import {
  getAvailabilitySummary,
  type Availability as AvailabilityType,
  type AvailabilityEvent as AvailabilityEventType,
} from "../../utils/availabilityHelpers";

import { AvailabilityPageProps, AvailabilityEvent } from "./types";
import { useWeekData } from "./hooks/useWeekData";
import { useEventInteractions } from "./hooks/useEventInteractions";
import { useDragToCreate } from "./hooks/useDragToCreate";
import { useDragToReschedule } from "./hooks/useDragToReschedule";
import { useTouchHandlers } from "./hooks/useTouchHandlers";
import { AvailabilityHeader } from "./components/AvailabilityHeader";
import { HourLabels } from "./components/HourLabels";
import { EventToolbar } from "./components/EventToolbar";
import { CalendarGrid } from "./components/CalendarGrid";
import {
  parseTimeToHours,
  pixelsToMinutes,
  getDayTotalMinutes,
  calculateDuration,
} from "./utils/timeCalculations";

export const AvailabilityPage = memo(function AvailabilityPage(
  props: AvailabilityPageProps,
) {
  const {
    availabilityId,
    availabilityName,
    currentStartDate,
    onPreviousWeek,
    onNextWeek,
    onToday,
    isCurrentWeek,
    isMobile,
    availabilitySlots,
    ownerEmail,
    ownerName,
    isViewingOthers = false,
    currentUserAvailability,
  } = props;

  const renderCount = useRef(0);
  renderCount.current++;

  const daysToShow = isMobile ? 2 : 7;
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
    }
  }, []);

  const { data: backendAvailabilities = [] } =
    useAvailabilities(!availabilitySlots);
  const backendAvail = !availabilitySlots
    ? backendAvailabilities.find((a: any) => a.id === availabilityId)
    : null;

  const backendSlots = availabilitySlots || backendAvail?.slots || [];

  // Fetch shared calendar events if viewing someone else's availability
  const { data: sharedCalendarEvents = [] } = useSharedCalendarEvents(
    isViewingOthers ? ownerEmail : undefined,
    isViewingOthers && !!ownerEmail,
  );

  const weekData = useWeekData(currentStartDate, daysToShow, backendSlots);

  const isViewingOwnAvailability = !availabilitySlots;

  const currentUserEmail = localStorage.getItem("ic-user-email") || undefined;
  const currentUserName = localStorage.getItem("ic-user-name") || undefined;

  const {
    data: googleEvents = [],
    refetch: refetchEvents,
    isRefetching,
  } = useCalendarEvents(isViewingOwnAvailability);

  const prevEventsLengthRef = useRef(googleEvents.length);
  useEffect(() => {
    if (prevEventsLengthRef.current !== googleEvents.length) {
      prevEventsLengthRef.current = googleEvents.length;
    }
  }, [googleEvents]);

  const eventActions = useEventActions();

  const events = useMemo(() => {
    const availabilityEvents: AvailabilityEvent[] = [];

    // Show user's own calendar events (always)
    googleEvents.forEach((gEvent) => {
      const eventStart = new Date(
        gEvent.start?.dateTime || gEvent.start?.date || "",
      );
      const eventEnd = new Date(gEvent.end?.dateTime || gEvent.end?.date || "");

      const dayIndex = weekData.findIndex((day) => {
        const eventYear = eventStart.getFullYear();
        const eventMonth = eventStart.getMonth();
        const eventDate = eventStart.getDate();

        const dayYear = day.date.getFullYear();
        const dayMonth = day.date.getMonth();
        const dayDate = day.date.getDate();

        return (
          eventYear === dayYear &&
          eventMonth === dayMonth &&
          eventDate === dayDate
        );
      });

      if (dayIndex === -1) return;
      if (!weekData[dayIndex].available) return;

      const day = weekData[dayIndex];
      if (day.timeSlots.length === 0) return;

      const timeSlotStart = day.timeSlots[0].start;
      const baseHour = parseTimeToHours(timeSlotStart);

      const eventHour = eventStart.getHours() + eventStart.getMinutes() / 60;
      const startMinutes = Math.max(0, Math.round((eventHour - baseHour) * 60));

      const durationMs = eventEnd.getTime() - eventStart.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));

      const dayTotalMinutes = calculateDuration(day.timeSlots[0]) * 60;
      if (startMinutes >= 0 && startMinutes < dayTotalMinutes) {
        // Calculate invitation status for ALL participants (organizer and invitees)
        let invitationStatus:
          | "accepted"
          | "pending"
          | "declined"
          | "mixed"
          | undefined;
        let eventColor = "#3b82f6"; // Default blue

        const attendees = gEvent.attendees || [];

        // If there are multiple attendees (it's an event with invitations)
        if (attendees.length > 1) {
          // Organizer is automatically considered accepted
          const isAccepted = (a: any) =>
            a.responseStatus === "accepted" ||
            a.organizer === true ||
            gEvent.organizer?.email === a.email;

          const hasDeclined = attendees.some(
            (a) => a.responseStatus === "declined",
          );
          const hasPending = attendees.some(
            (a) => !isAccepted(a) && a.responseStatus !== "declined",
          );
          const allAccepted = attendees.every((a) => isAccepted(a));

          if (hasDeclined && hasPending) {
            invitationStatus = "mixed";
            eventColor = "#f97316"; // Orange (has both declined and pending)
          } else if (hasDeclined) {
            invitationStatus = "declined";
            eventColor = "#ef4444"; // Red (someone declined)
          } else if (hasPending) {
            invitationStatus = "pending";
            eventColor = "#f97316"; // Orange (waiting for response)
          } else if (allAccepted) {
            invitationStatus = "accepted";
            eventColor = "#3b82f6"; // Blue (all accepted)
          }
        }

        availabilityEvents.push({
          id: `calendar-${gEvent.id}`,
          dayIndex,
          startMinutes,
          durationMinutes: Math.min(
            durationMinutes,
            dayTotalMinutes - startMinutes,
          ),
          title: gEvent.summary || "Untitled Event",
          color: eventColor,
          isFromCalendar: true,
          meetLink: gEvent.hangoutLink,
          invitationStatus,
        });
      }
    });

    return availabilityEvents;
  }, [googleEvents, weekData]);

  // Don't create blocked event boxes - we'll use busy times to create gaps in green columns instead
  const allEvents = useMemo(() => {
    return events; // Only show user's own events, no gray boxes
  }, [events]);

  const mutualAvailability = useMemo(() => {
    if (!isViewingOthers || !currentUserAvailability || !availabilitySlots) {
      return null;
    }

    const currentUserSlots = Array.isArray(currentUserAvailability.slots)
      ? currentUserAvailability.slots
      : [];
    const otherUserSlots = Array.isArray(availabilitySlots)
      ? availabilitySlots
      : [];

    if (currentUserSlots.length === 0 || otherUserSlots.length === 0) {
      return null;
    }

    const weekStart = new Date(currentStartDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + daysToShow);
    weekEnd.setHours(23, 59, 59, 999);

    const availabilitiesForSummary: AvailabilityType[] = [
      {
        id: currentUserAvailability.id,
        owner: "current-user",
        title: currentUserAvailability.name,
        description: "",
        slots: currentUserSlots,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        created_at: BigInt(0),
        updated_at: BigInt(0),
      },
      {
        id: availabilityId,
        owner: "other-user",
        title: availabilityName,
        description: "",
        slots: otherUserSlots,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        created_at: BigInt(0),
        updated_at: BigInt(0),
      },
    ];

    const eventsForSummary: AvailabilityEventType[] = googleEvents.map(
      (gEvent) => ({
        startTime: new Date(gEvent.start?.dateTime || gEvent.start?.date || ""),
        endTime: new Date(gEvent.end?.dateTime || gEvent.end?.date || ""),
      }),
    );

    const summary = getAvailabilitySummary(
      availabilitiesForSummary,
      eventsForSummary,
      weekStart,
      weekEnd,
    );

    return summary;
  }, [
    isViewingOthers,
    currentUserAvailability,
    availabilitySlots,
    availabilityId,
    availabilityName,
    currentStartDate,
    daysToShow,
    googleEvents,
  ]);

  const dayRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);
  const [hoverTimeMinutes, setHoverTimeMinutes] = useState<number>(0);

  const handleCalendarMouseMove = useCallback(
    (e: React.MouseEvent, dayIndex: number) => {
      const container = dayRefs.current[dayIndex];
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const totalMinutes = getDayTotalMinutes(dayIndex, weekData);
      const minutes = Math.max(
        0,
        Math.min(totalMinutes, pixelsToMinutes(y, rect.height, totalMinutes)),
      );

      setHoveredDayIndex(dayIndex);
      setHoverTimeMinutes(minutes);
    },
    [weekData],
  );

  const handleCalendarMouseLeave = useCallback(() => {
    setHoveredDayIndex(null);
  }, []);

  const eventInteractions = useEventInteractions(
    allEvents,
    weekData,
    googleEvents,
    eventActions,
  );

  const dragToCreate = useDragToCreate(
    weekData,
    allEvents,
    eventActions,
    dayRefs,
    isViewingOwnAvailability,
    currentUserEmail,
    currentUserName,
    ownerEmail,
    ownerName,
  );

  const dragToReschedule = useDragToReschedule(
    allEvents,
    weekData,
    googleEvents,
    eventActions,
    dayRefs,
  );

  const touchHandlers = useTouchHandlers(
    isMobile,
    weekData,
    allEvents,
    googleEvents,
    eventActions,
    dayRefs,
    isViewingOwnAvailability,
    currentUserEmail,
    currentUserName,
    ownerEmail,
    ownerName,
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragToCreate.isDraggingNew && dragToCreate.dragDayIndex !== null) {
        const container = dayRefs.current[dragToCreate.dragDayIndex];
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const y = e.clientY - rect.top;
        dragToCreate.setDragCurrentY(y);
        return;
      }

      if (dragToReschedule.draggingEventId) {
        dragToReschedule.handleMouseMove(e);
      }
    },
    [dragToCreate, dragToReschedule],
  );

  const handleMouseUp = useCallback(() => {
    dragToCreate.handleMouseUp();
    dragToReschedule.handleMouseUp();
  }, [dragToCreate, dragToReschedule]);

  useEffect(() => {
    if (
      dragToCreate.isDraggingNew ||
      dragToReschedule.draggingEventId ||
      touchHandlers.isTouchDragging
    ) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [
    dragToCreate.isDraggingNew,
    dragToReschedule.draggingEventId,
    touchHandlers.isTouchDragging,
    handleMouseMove,
    handleMouseUp,
  ]);

  useEffect(() => {
    if (!isMobile) return;

    const containers = dayRefs.current.filter(Boolean);

    const handleTouchMoveNative = (e: TouchEvent) => {
      if (touchHandlers.isTouchDragging || touchHandlers.longPressTimer) {
        e.preventDefault();
      }
    };

    containers.forEach((container) => {
      if (container) {
        container.addEventListener("touchmove", handleTouchMoveNative, {
          passive: false,
        });
      }
    });

    return () => {
      containers.forEach((container) => {
        if (container) {
          container.removeEventListener("touchmove", handleTouchMoveNative);
        }
      });
    };
  }, [isMobile, touchHandlers.isTouchDragging, touchHandlers.longPressTimer]);

  const focusedEvent = allEvents.find(
    (ev) => ev.id === eventInteractions.focusedEventId,
  );
  const focusedGoogleEvent = focusedEvent
    ? googleEvents.find(
        (ge) => ge.id === focusedEvent.id.replace("calendar-", ""),
      )
    : undefined;

  const isPastFocusedEvent = focusedEvent
    ? (() => {
        const day = weekData[focusedEvent.dayIndex];
        const timeSlotStart = day.timeSlots[0]?.start || "9:00 AM";
        const baseHour = parseTimeToHours(timeSlotStart);
        const eventDate = new Date(day.date);
        const totalMinutes = baseHour * 60 + focusedEvent.startMinutes;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        eventDate.setHours(hours, minutes, 0, 0);
        const endDate = new Date(eventDate);
        endDate.setMinutes(endDate.getMinutes() + focusedEvent.durationMinutes);
        return isPastEvent(endDate);
      })()
    : false;

  return (
    <motion.div
      initial={isFirstMount.current ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex-1 overflow-y-auto pt-4 md:pt-6 pb-8 md:pb-12 px-2 md:px-8"
      onClick={(e) => {
        if (eventInteractions.focusedEventId && e.target === e.currentTarget) {
          eventInteractions.setFocusedEventId(null);
        }
      }}
    >
      <div
        className="max-w-6xl mx-auto"
        onClick={(e) => {
          if (
            eventInteractions.focusedEventId &&
            (e.target as HTMLElement).classList.contains("max-w-6xl")
          ) {
            eventInteractions.setFocusedEventId(null);
          }
        }}
      >
        <motion.div
          initial={isFirstMount.current ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <AvailabilityHeader
            availabilityName={availabilityName}
            currentStartDate={currentStartDate}
            daysToShow={daysToShow}
            isCurrentWeek={isCurrentWeek}
            isMobile={isMobile}
            isViewingOthers={isViewingOthers}
            hasMutualAvailability={!!mutualAvailability}
            isRefetching={isRefetching}
            onPreviousWeek={onPreviousWeek}
            onNextWeek={onNextWeek}
            onToday={onToday}
            onRefresh={refetchEvents}
            isFirstMount={isFirstMount.current}
          />

          <div className="flex gap-2">
            <HourLabels weekData={weekData} isMobile={isMobile} />

            <CalendarGrid
              weekData={weekData}
              events={allEvents}
              sharedCalendarEvents={sharedCalendarEvents}
              isMobile={isMobile}
              isFirstMount={isFirstMount.current}
              dayRefs={dayRefs}
              hoveredDayIndex={hoveredDayIndex}
              hoverTimeMinutes={hoverTimeMinutes}
              focusedEventId={eventInteractions.focusedEventId}
              isDraggingNew={dragToCreate.isDraggingNew}
              dragDayIndex={dragToCreate.dragDayIndex}
              dragStartY={dragToCreate.dragStartY}
              dragCurrentY={dragToCreate.dragCurrentY}
              draggingEventId={
                dragToReschedule.draggingEventId ||
                touchHandlers.draggingEventId
              }
              previewStartMinutes={
                dragToReschedule.previewStartMinutes ||
                touchHandlers.previewStartMinutes
              }
              previewDurationMinutes={
                dragToReschedule.previewDurationMinutes ||
                touchHandlers.previewDurationMinutes
              }
              onMouseDown={dragToCreate.handleMouseDown}
              onMouseMove={handleCalendarMouseMove}
              onMouseLeave={handleCalendarMouseLeave}
              onTouchStart={touchHandlers.handleTouchStart}
              onTouchMove={touchHandlers.handleTouchMove}
              onTouchEnd={touchHandlers.handleTouchEnd}
              onEventClick={eventInteractions.handleEventClick}
              onEventDragStart={dragToReschedule.handleEventDragStart}
              onEventTouchStart={touchHandlers.handleEventTouchStart}
              setFocusedEventId={eventInteractions.setFocusedEventId}
            />
          </div>

          <AnimatePresence>
            {eventInteractions.focusedEventId && (
              <EventToolbar
                focusedEvent={focusedEvent}
                googleEvent={focusedGoogleEvent}
                isPast={isPastFocusedEvent}
                isMobile={isMobile}
                currentUserEmail={currentUserEmail}
                onEdit={eventInteractions.handleEditEvent}
                onDelete={eventInteractions.handleDeleteEvent}
                onAccept={async () => {
                  if (focusedEvent) {
                    const calendarEventId = focusedEvent.id.replace(
                      "calendar-",
                      "",
                    );
                    await eventActions.handleAcceptInvitation(
                      calendarEventId,
                      focusedEvent.title,
                    );
                    eventInteractions.setFocusedEventId(null);
                    // Refetch calendar multiple times to ensure color updates
                    setTimeout(() => refetchEvents(), 500);
                    setTimeout(() => refetchEvents(), 1500);
                    setTimeout(() => refetchEvents(), 3000);
                  }
                }}
                onDecline={async () => {
                  if (focusedEvent) {
                    const calendarEventId = focusedEvent.id.replace(
                      "calendar-",
                      "",
                    );
                    await eventActions.handleDeclineInvitation(
                      calendarEventId,
                      focusedEvent.title,
                    );
                    eventInteractions.setFocusedEventId(null);
                    // Refetch calendar multiple times to ensure color updates
                    setTimeout(() => refetchEvents(), 500);
                    setTimeout(() => refetchEvents(), 1500);
                    setTimeout(() => refetchEvents(), 3000);
                  }
                }}
                onClose={() => eventInteractions.setFocusedEventId(null)}
              />
            )}
          </AnimatePresence>

          <AlertDialog
            open={eventInteractions.showDeleteDialog}
            onOpenChange={eventInteractions.setShowDeleteDialog}
          >
            <AlertDialogContent className="bg-[#f5f3ef] border-[#d4cfbe]/40">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-[#8b8475]">
                  Delete Event
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[#a8a195]">
                  Are you sure you want to delete this event? This action cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-[#e8e4d9]/60 text-[#8b8475] hover:bg-[#e8e4d9] border-[#d4cfbe]/40">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={eventInteractions.confirmDeleteEvent}
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <EventFormModal
            isOpen={eventActions.isFormOpen}
            onClose={eventActions.closeForm}
            onSubmit={eventActions.handleFormSubmit}
            initialData={eventActions.formInitialData}
            isLoading={eventActions.isLoading}
            mode={eventActions.editingEventId ? "edit" : "create"}
          />
        </motion.div>
      </div>
    </motion.div>
  );
});
