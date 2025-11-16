import { memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AvailabilityEvent, DayAvailability } from "../types";
import { parseTimeToHours } from "../utils/timeCalculations";

interface EventCardProps {
  event: AvailabilityEvent;
  isFocused: boolean;
  isBeingDragged: boolean;
  isPreview: boolean;
  displayStartMinutes: number;
  displayDurationMinutes: number;
  top: number;
  eventHeight: number;
  weekData: DayAvailability[];
  draggingEventId: string | null;
  previewStartMinutes: number;
  previewDurationMinutes: number;
  isMobile: boolean;
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
}

export const EventCard = memo(function EventCard({
  event,
  isFocused,
  isBeingDragged,
  isPreview,
  displayDurationMinutes,
  top,
  eventHeight,
  weekData,
  draggingEventId,
  previewStartMinutes,
  previewDurationMinutes,
  isMobile,
  onEventClick,
  onEventDragStart,
  onEventTouchStart,
}: EventCardProps) {
  // Blocked slots are non-interactive
  if (event.isBlocked) {
    return (
      <motion.div
        key={event.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="absolute left-1 right-1 rounded-md bg-gray-400/50 cursor-not-allowed pointer-events-none"
        style={{
          top: `${top}px`,
          height: `${eventHeight}px`,
        }}
        title="This time is not available"
      >
        <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs font-medium">
          Busy
        </div>
      </motion.div>
    );
  }

  const formatEventTime = (minutes: number) => {
    const day = weekData[event.dayIndex];
    const timeSlotStart = day.timeSlots[0]?.start || "9:00 AM";
    const baseHour = parseTimeToHours(timeSlotStart);
    const totalMinutes = baseHour * 60 + minutes;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
  };

  return (
    <motion.div
      key={event.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`absolute left-1 right-1 rounded-md shadow-lg ${
        isPreview
          ? "pointer-events-none"
          : isFocused && !isBeingDragged
            ? "cursor-move"
            : "cursor-pointer"
      }`}
      style={{
        top: `${top}px`,
        height: `${eventHeight}px`,
        backgroundColor: event.color,
        border: isFocused ? "2px solid white" : "none",
        zIndex: isFocused ? 10 : isPreview ? 10 : 1,
        opacity: 1,
        transition: isBeingDragged || isPreview ? "none" : "all 0.2s ease",
      }}
      onClick={(e) => {
        if (!isBeingDragged && !isPreview) {
          onEventClick(e, event.id);
        }
      }}
      onMouseDown={(e) => {
        if (isFocused && !isBeingDragged && !isPreview) {
          onEventDragStart(e, event.id, "move");
        }
      }}
      onTouchStart={(e) => {
        if (isMobile && isFocused && !isBeingDragged && !isPreview) {
          onEventTouchStart(e, event.id, "move");
        }
      }}
    >
      {/* Event content - Title and duration */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-2 pointer-events-none">
        <div className="truncate max-w-full text-sm font-medium">
          {event.title}
        </div>
        <div className="text-xs mt-1 opacity-90">
          {Math.round(displayDurationMinutes)} min
        </div>
      </div>

      {/* Invitation status indicator (top-right corner) */}
      {event.invitationStatus && (
        <div className="absolute top-1 right-1 pointer-events-none">
          {event.invitationStatus === "declined" && (
            <div className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium shadow-sm">
              Declined
            </div>
          )}
          {event.invitationStatus === "pending" && (
            <div className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium shadow-sm">
              Pending
            </div>
          )}
          {event.invitationStatus === "mixed" && (
            <div className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium shadow-sm">
              Mixed
            </div>
          )}
          {event.invitationStatus === "accepted" && (
            <div className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium shadow-sm">
              ✓
            </div>
          )}
        </div>
      )}

      {/* Start time label - appears above event when focused (stays during drag) */}
      <AnimatePresence>
        {(isFocused || isPreview) && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute -top-9 left-1/2 -translate-x-1/2 bg-white text-[#8b8475] text-base font-medium px-2 py-1 rounded shadow-md whitespace-nowrap z-30 pointer-events-none"
          >
            {formatEventTime(
              isBeingDragged && draggingEventId === event.id
                ? previewStartMinutes
                : event.startMinutes,
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* End time label - appears below event when focused (stays during drag) */}
      <AnimatePresence>
        {(isFocused || isPreview) && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute -bottom-9 left-1/2 -translate-x-1/2 bg-white text-[#8b8475] text-base font-medium px-2 py-1 rounded shadow-md whitespace-nowrap z-30 pointer-events-none"
          >
            {(() => {
              const startMins =
                isBeingDragged && draggingEventId === event.id
                  ? previewStartMinutes
                  : event.startMinutes;
              const durationMins =
                isBeingDragged && draggingEventId === event.id
                  ? previewDurationMinutes
                  : event.durationMinutes;
              return formatEventTime(startMins + durationMins);
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resize handle - Top */}
      <AnimatePresence>
        {isFocused && !isBeingDragged && !isPreview && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className={`absolute -top-2 left-1/2 -translate-x-1/2 bg-white rounded-full cursor-ns-resize shadow-md z-20 ${
              isMobile ? "w-11 h-11" : "w-6 h-6"
            } flex items-center justify-center border-2 border-blue-500`}
            style={{ touchAction: "none" }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onEventDragStart(e, event.id, "resize-top");
            }}
            onTouchStart={(e) => {
              if (isMobile) {
                e.stopPropagation();
                onEventTouchStart(e, event.id, "resize-top");
              }
            }}
            title="Drag to change start time"
          >
            <div className="w-2 h-0.5 bg-blue-500 rounded" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resize handle - Bottom */}
      <AnimatePresence>
        {isFocused && !isBeingDragged && !isPreview && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white rounded-full cursor-ns-resize shadow-md z-20 ${
              isMobile ? "w-11 h-11" : "w-6 h-6"
            } flex items-center justify-center border-2 border-blue-500`}
            style={{ touchAction: "none" }}
            onMouseDown={(e) => {
              e.stopPropagation();
              onEventDragStart(e, event.id, "resize-bottom");
            }}
            onTouchStart={(e) => {
              if (isMobile) {
                e.stopPropagation();
                onEventTouchStart(e, event.id, "resize-bottom");
              }
            }}
            title="Drag to change end time"
          >
            <div className="w-2 h-0.5 bg-blue-500 rounded" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
