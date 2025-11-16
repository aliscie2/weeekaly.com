import { memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DayAvailability, AvailabilityEvent } from "../types";
import { CurrentTimeLine } from "../../../components/CurrentTimeLine";
import { EventCard } from "./EventCard";
import {
  parseTimeToHours,
  getHeightFromTimeSlot,
  formatDate,
  pixelsToMinutes,
  minutesToPixels,
  getDayTotalMinutes,
} from "../utils/timeCalculations";
import { MIN_DURATION, PIXELS_PER_HOUR } from "../utils/constants";

interface CalendarGridProps {
  weekData: DayAvailability[];
  events: AvailabilityEvent[];
  sharedCalendarEvents: any[]; // Shared calendar events to create gaps in green columns
  isMobile: boolean;
  isFirstMount: boolean;
  dayRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  hoveredDayIndex: number | null;
  hoverTimeMinutes: number;
  focusedEventId: string | null;
  isDraggingNew: boolean;
  dragDayIndex: number | null;
  dragStartY: number;
  dragCurrentY: number;
  draggingEventId: string | null;
  previewStartMinutes: number;
  previewDurationMinutes: number;
  onMouseDown: (e: React.MouseEvent, dayIndex: number) => void;
  onMouseMove: (e: React.MouseEvent, dayIndex: number) => void;
  onMouseLeave: () => void;
  onTouchStart: (e: React.TouchEvent, dayIndex: number) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onEventClick: (e: React.MouseEvent, eventId: string) => void;
  onEventDragStart: (
    e: React.MouseEvent,
    eventId: string,
    type: "move" | "resize-top" | "resize-bottom",
  ) => void;
  onEventTouchStart: (
    e: React.TouchEvent,
    eventId: string,
    type: "move" | "resize-top" | "resize-bottom",
  ) => void;
  setFocusedEventId: (id: string | null) => void;
}

export const CalendarGrid = memo(function CalendarGrid(
  props: CalendarGridProps,
) {
  const {
    weekData,
    events,
    sharedCalendarEvents,
    isMobile,
    isFirstMount,
    dayRefs,
    hoveredDayIndex,
    hoverTimeMinutes,
    focusedEventId,
    isDraggingNew,
    dragDayIndex,
    dragStartY,
    dragCurrentY,
    draggingEventId,
    previewStartMinutes,
    previewDurationMinutes,
    onMouseDown,
    onMouseMove,
    onMouseLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onEventClick,
    onEventDragStart,
    onEventTouchStart,
    setFocusedEventId,
  } = props;

  // Find the earliest start time across all available days
  let earliestStartHour = 24;
  weekData.forEach((day) => {
    if (day.available && day.timeSlots.length > 0) {
      const startHour = parseTimeToHours(day.timeSlots[0].start);
      earliestStartHour = Math.min(earliestStartHour, startHour);
    }
  });

  // Calculate green segments with gaps for busy times
  const greenSegments: Record<
    number,
    Array<{ start: number; end: number }>
  > = {};

  weekData.forEach((day, dayIndex) => {
    if (!day.available || day.timeSlots.length === 0) {
      greenSegments[dayIndex] = [];
      return;
    }

    const totalMinutes = getDayTotalMinutes(dayIndex, weekData);
    const dayBusyBlocks: Array<{ start: number; end: number }> = [];

    // Convert shared calendar events to minute blocks for this day
    // BUT: Only create gaps for events where the viewer is NOT invited
    // If viewer is invited, it will show as a blue box (from their own calendar)
    sharedCalendarEvents.forEach((gEvent: any) => {
      const startDate = new Date(
        gEvent.start?.dateTime || gEvent.start?.date || "",
      );
      const endDate = new Date(gEvent.end?.dateTime || gEvent.end?.date || "");

      // Check if event is on this day
      if (
        startDate.getFullYear() === day.date.getFullYear() &&
        startDate.getMonth() === day.date.getMonth() &&
        startDate.getDate() === day.date.getDate()
      ) {
        // Check if this shared event is also in the viewer's events (same event ID)
        const sharedEventId = gEvent.id;
        const isViewerInvited = events.some(
          (e) => e.id === `calendar-${sharedEventId}`,
        );

        // Only create a gap if viewer is NOT invited to this event
        if (!isViewerInvited) {
          const timeSlotStart = day.timeSlots[0]?.start || "9:00 AM";
          const baseHour = parseTimeToHours(timeSlotStart);
          const eventHour = startDate.getHours() + startDate.getMinutes() / 60;
          const startMinutes = Math.max(
            0,
            Math.round((eventHour - baseHour) * 60),
          );
          const durationMs = endDate.getTime() - startDate.getTime();
          const durationMinutes = Math.round(durationMs / (1000 * 60));

          if (startMinutes >= 0 && startMinutes < totalMinutes) {
            dayBusyBlocks.push({
              start: startMinutes,
              end: Math.min(startMinutes + durationMinutes, totalMinutes),
            });
          }
        }
      }
    });

    // Sort busy blocks by start time
    dayBusyBlocks.sort((a, b) => a.start - b.start);

    // Create green segments (gaps between busy blocks)
    const segments: Array<{ start: number; end: number }> = [];
    let currentStart = 0;

    dayBusyBlocks.forEach((block) => {
      if (block.start > currentStart) {
        segments.push({ start: currentStart, end: block.start });
      }
      currentStart = Math.max(currentStart, block.end);
    });

    if (currentStart < totalMinutes) {
      segments.push({ start: currentStart, end: totalMinutes });
    }

    greenSegments[dayIndex] = segments;
  });

  return (
    <div className={`grid ${isMobile ? "grid-cols-2" : "grid-cols-7"} flex-1`}>
      {weekData.map((day, i) => {
        // Use universal PIXELS_PER_HOUR constant for height calculation
        const height =
          day.available && day.timeSlots.length > 0
            ? getHeightFromTimeSlot(day.timeSlots[0])
            : PIXELS_PER_HOUR * 9; // Default 9 hours
        const isLastDay = i === weekData.length - 1;
        const totalMinutes = getDayTotalMinutes(i, weekData);

        let dayEvents = events.filter((ev) => ev.dayIndex === i);

        if (isDraggingNew && dragDayIndex === i) {
          const startY = Math.min(dragStartY, dragCurrentY);
          const endY = Math.max(dragStartY, dragCurrentY);
          const startMinutes = Math.max(
            0,
            pixelsToMinutes(startY, height, totalMinutes),
          );
          const endMinutes = Math.min(
            totalMinutes,
            pixelsToMinutes(endY, height, totalMinutes),
          );
          const durationMinutes = Math.max(
            MIN_DURATION,
            endMinutes - startMinutes,
          );

          const previewEvent: AvailabilityEvent = {
            id: "preview-new-event",
            dayIndex: i,
            startMinutes,
            durationMinutes,
            title: "New Event",
            color: "#3b82f6",
            isFromCalendar: false,
          };

          dayEvents = [...dayEvents, previewEvent];
        }

        return (
          <motion.div
            key={i}
            initial={isFirstMount ? { opacity: 0, y: 20 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
            className={`flex flex-col items-center ${!isLastDay ? "border-r border-[#d4cfbe]/30" : ""}`}
          >
            <span
              className={`text-[#a8a195] mb-2 ${isMobile ? "text-xs" : "text-sm"}`}
            >
              {day.dayName} {formatDate(day.date)}
            </span>
            {day.available ? (
              <>
                {/* Visual spacer to align columns based on start time */}
                {(() => {
                  const dayStartHour = parseTimeToHours(day.timeSlots[0].start);
                  const hoursDifference = dayStartHour - earliestStartHour;
                  if (hoursDifference > 0) {
                    // Use universal PIXELS_PER_HOUR constant for spacer
                    const spacerHeight = hoursDifference * PIXELS_PER_HOUR;
                    return <div style={{ height: `${spacerHeight}px` }} />;
                  }
                  return null;
                })()}
                <div
                  ref={(el) => {
                    dayRefs.current[i] = el;
                  }}
                  className="w-full relative cursor-crosshair select-none"
                  style={{
                    height: `${height}px`,
                    touchAction:
                      isMobile && (props.onTouchStart || focusedEventId)
                        ? "none"
                        : "auto",
                  }}
                  onMouseDown={(e) => !isMobile && onMouseDown(e, i)}
                  onMouseMove={(e) => !isMobile && onMouseMove(e, i)}
                  onMouseLeave={onMouseLeave}
                  onTouchStart={(e) => isMobile && onTouchStart(e, i)}
                  onTouchMove={(e) => isMobile && onTouchMove(e)}
                  onTouchEnd={() => isMobile && onTouchEnd()}
                  onClick={(e) => {
                    if (focusedEventId && e.target === e.currentTarget) {
                      setFocusedEventId(null);
                    }
                  }}
                >
                  {/* Render green segments with gaps for busy times */}
                  {greenSegments[i]?.map((segment, segIdx) => {
                    const segmentTop = minutesToPixels(
                      segment.start,
                      height,
                      totalMinutes,
                    );
                    const segmentHeight = minutesToPixels(
                      segment.end - segment.start,
                      height,
                      totalMinutes,
                    );

                    return (
                      <div
                        key={`segment-${segIdx}`}
                        className="absolute left-0 right-0 bg-green-500/70 pointer-events-none"
                        style={{
                          top: `${segmentTop}px`,
                          height: `${segmentHeight}px`,
                        }}
                      />
                    );
                  })}

                  {/* Hover Time Indicator */}
                  {hoveredDayIndex === i &&
                    !isDraggingNew &&
                    !draggingEventId && (
                      <div
                        className="absolute left-0 right-0 pointer-events-none z-30"
                        style={{
                          top: `${minutesToPixels(hoverTimeMinutes, height, totalMinutes)}px`,
                        }}
                      >
                        <div className="w-full h-[2px] bg-white/80 shadow-sm" />
                        <div className="absolute left-2 -top-3 bg-white/95 text-[#8b8475] text-xs px-2 py-0.5 rounded shadow-md whitespace-nowrap">
                          {(() => {
                            const timeSlot = day.timeSlots[0];
                            const startHours = parseTimeToHours(timeSlot.start);
                            const totalHours =
                              startHours + hoverTimeMinutes / 60;
                            const hours = Math.floor(totalHours);
                            const mins = Math.round((totalHours - hours) * 60);
                            const period = hours >= 12 ? "PM" : "AM";
                            const displayHours =
                              hours > 12
                                ? hours - 12
                                : hours === 0
                                  ? 12
                                  : hours;
                            return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
                          })()}
                        </div>
                      </div>
                    )}

                  {/* Current Time Line */}
                  {day.available && day.timeSlots.length > 0 && (
                    <CurrentTimeLine
                      dayDate={day.date}
                      startHour={parseTimeToHours(day.timeSlots[0].start)}
                      endHour={parseTimeToHours(day.timeSlots[0].end)}
                      containerHeight={height}
                    />
                  )}

                  {/* Events */}
                  <AnimatePresence>
                    {dayEvents.map((event) => {
                      const isFocused = focusedEventId === event.id;
                      const isBeingDragged = draggingEventId === event.id;
                      const isPreview = event.id === "preview-new-event";

                      const displayStartMinutes = isBeingDragged
                        ? previewStartMinutes
                        : event.startMinutes;
                      const displayDurationMinutes = isBeingDragged
                        ? previewDurationMinutes
                        : event.durationMinutes;

                      const top = minutesToPixels(
                        displayStartMinutes,
                        height,
                        totalMinutes,
                      );
                      const eventHeight = minutesToPixels(
                        displayDurationMinutes,
                        height,
                        totalMinutes,
                      );

                      return (
                        <EventCard
                          key={event.id}
                          event={event}
                          isFocused={isFocused}
                          isBeingDragged={isBeingDragged}
                          isPreview={isPreview}
                          displayStartMinutes={displayStartMinutes}
                          displayDurationMinutes={displayDurationMinutes}
                          top={top}
                          eventHeight={eventHeight}
                          weekData={weekData}
                          draggingEventId={draggingEventId}
                          previewStartMinutes={previewStartMinutes}
                          previewDurationMinutes={previewDurationMinutes}
                          isMobile={isMobile}
                          onEventClick={onEventClick}
                          onEventDragStart={onEventDragStart}
                          onEventTouchStart={onEventTouchStart}
                        />
                      );
                    })}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <div
                className="w-full bg-[#e8e4d9]/50"
                style={{ height: `${height}px` }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
});
