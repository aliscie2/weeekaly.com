import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "./ui/button";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Share2,
  Trash2,
  Video,
  RefreshCw,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { EventFormModal } from "./EventFormModal";
import { useEventActions } from "../hooks/useEventActions";
import { useCalendarEvents } from "../hooks/useBackend";
import {
  isPastEvent,
  generateEventName,
  validateEventTime,
} from "../utils/dateHelpers";

interface TimeSlot {
  start: string;
  end: string;
}

interface DayAvailability {
  date: Date;
  dayName: string;
  available: boolean;
  timeSlots: TimeSlot[];
}

interface AvailabilityEvent {
  id: string;
  dayIndex: number; // Which day in the week
  startMinutes: number; // Minutes from start of availability slot
  durationMinutes: number; // Duration in minutes
  title: string;
  color: string;
  isFromCalendar?: boolean; // True if from Google Calendar (read-only)
  meetLink?: string; // Google Meet link if available
}

interface AvailabilityPageProps {
  availabilityName: string;
  currentStartDate: Date;
  onBack: () => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  isCurrentWeek: boolean;
  isMobile: boolean;
}

// Helper function to get days data starting from a specific date
const getDaysData = (startDate: Date, count: number): DayAvailability[] => {
  const days: DayAvailability[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dayOfWeek = date.getDay();

    // Available Mon-Fri with 9 AM - 6 PM slots
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    // Tuesday (dayOfWeek === 2) has different time slot
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

// Helper function to parse time string to hours
const parseTimeToHours = (timeString: string): number => {
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

// Calculate duration in hours from time slot
const calculateDuration = (timeSlot: TimeSlot): number => {
  const startHours = parseTimeToHours(timeSlot.start);
  const endHours = parseTimeToHours(timeSlot.end);
  return endHours - startHours;
};

// Calculate proportional height based on duration
const getProportionalHeight = (
  timeSlot: TimeSlot,
  maxHeightPx: number,
): number => {
  const duration = calculateDuration(timeSlot);
  const maxDuration = 9; // 9 hours is the reference (9 AM - 6 PM)
  return Math.round((duration / maxDuration) * maxHeightPx);
};

const formatDate = (date: Date): string => {
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

const copyToClipboard = (text: string) => {
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

export function AvailabilityPage({
  availabilityName,
  currentStartDate,
  onBack,
  onPreviousWeek,
  onNextWeek,
  onToday,
  isCurrentWeek,
  isMobile,
}: AvailabilityPageProps) {
  const daysToShow = isMobile ? 2 : 7;
  const weekData = getDaysData(currentStartDate, daysToShow);

  // ALL events come from Google Calendar only (no local events)
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Fetch Google Calendar events (same hook as EventsPage!)
  const {
    data: googleEvents = [],
    refetch: refetchEvents,
    isRefetching,
  } = useCalendarEvents(true);

  // Use event actions hook for Google Calendar integration
  const eventActions = useEventActions();

  /**
   * Convert Google Calendar events to AvailabilityEvents for display on grid
   * Memoized to avoid recalculating on every render
   */
  const convertGoogleEventsToAvailabilityEvents =
    useCallback((): AvailabilityEvent[] => {
      const availabilityEvents: AvailabilityEvent[] = [];

      googleEvents.forEach((gEvent) => {
        const eventStart = new Date(
          gEvent.start?.dateTime || gEvent.start?.date || "",
        );
        const eventEnd = new Date(
          gEvent.end?.dateTime || gEvent.end?.date || "",
        );

        // Find which day in weekData this event belongs to
        // Events come from Google Calendar already in browser timezone
        const dayIndex = weekData.findIndex((day) => {
          // Compare year, month, and date directly (no timezone conversion)
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

        // Only show events that fall within the current week view
        if (dayIndex === -1) return;

        if (!weekData[dayIndex].available) return;

        const day = weekData[dayIndex];
        if (day.timeSlots.length === 0) return;

        // Calculate startMinutes from the day's time slot start
        const timeSlotStart = day.timeSlots[0].start;
        const baseHour = parseTimeToHours(timeSlotStart);

        const eventHour = eventStart.getHours() + eventStart.getMinutes() / 60;
        const startMinutes = Math.max(
          0,
          Math.round((eventHour - baseHour) * 60),
        );

        // Calculate duration
        const durationMs = eventEnd.getTime() - eventStart.getTime();
        const durationMinutes = Math.round(durationMs / (1000 * 60));

        // Only show if event is within the visible time range
        const dayTotalMinutes = calculateDuration(day.timeSlots[0]) * 60;
        if (startMinutes >= 0 && startMinutes < dayTotalMinutes) {
          availabilityEvents.push({
            id: `calendar-${gEvent.id}`,
            dayIndex,
            startMinutes,
            durationMinutes: Math.min(
              durationMinutes,
              dayTotalMinutes - startMinutes,
            ),
            title: gEvent.summary || "Untitled Event",
            color: "#3b82f6", // Blue for calendar events
            isFromCalendar: true,
            meetLink: gEvent.hangoutLink,
          });
        }
      });

      return availabilityEvents;
    }, [googleEvents, weekData]);

  // ALL events come from Google Calendar only - memoized for performance
  const events = useMemo(
    () => convertGoogleEventsToAvailabilityEvents(),
    [convertGoogleEventsToAvailabilityEvents],
  );

  // Drag state for creating new events
  const [isDraggingNew, setIsDraggingNew] = useState(false);
  const [dragDayIndex, setDragDayIndex] = useState<number | null>(null);
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [dragCurrentY, setDragCurrentY] = useState<number>(0);

  // Drag state for rescheduling existing events
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

  // UI state
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);
  const [hoverTimeMinutes, setHoverTimeMinutes] = useState<number>(0);
  const dayRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Touch state for mobile
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [touchStartPos, setTouchStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);

  const MIN_DURATION = 15; // 15 minutes minimum
  const LONG_PRESS_DURATION = 500; // 500ms for long press

  // Convert pixel position to minutes
  const pixelsToMinutes = (
    pixels: number,
    containerHeight: number,
    totalMinutes: number,
  ) => {
    return Math.round((pixels / containerHeight) * totalMinutes);
  };

  // Convert minutes to pixel position
  const minutesToPixels = (
    minutes: number,
    containerHeight: number,
    totalMinutes: number,
  ) => {
    return (minutes / totalMinutes) * containerHeight;
  };

  // Get total available minutes for a day
  const getDayTotalMinutes = (dayIndex: number) => {
    const day = weekData[dayIndex];
    if (!day || !day.available || day.timeSlots.length === 0) return 0;
    return calculateDuration(day.timeSlots[0]) * 60;
  };

  // Check if an event would overlap with existing events
  const checkEventOverlap = useCallback(
    (
      dayIndex: number,
      startMinutes: number,
      durationMinutes: number,
      excludeEventId?: string,
    ): boolean => {
      const endMinutes = startMinutes + durationMinutes;

      // Check against ALL events on the same day
      const dayEvents = events.filter(
        (ev) => ev.dayIndex === dayIndex && ev.id !== excludeEventId,
      );

      for (const event of dayEvents) {
        const eventEnd = event.startMinutes + event.durationMinutes;

        // Two events overlap if:
        // Event A starts before Event B ends AND Event A ends after Event B starts
        if (startMinutes < eventEnd && endMinutes > event.startMinutes) {
          return true; // Overlap detected
        }
      }

      return false; // No overlap
    },
    [events],
  );

  // Handle hover time tracking
  const handleCalendarMouseMove = useCallback(
    (e: React.MouseEvent, dayIndex: number) => {
      const container = dayRefs.current[dayIndex];
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const totalMinutes = getDayTotalMinutes(dayIndex);
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

  // Handle drag to create new event (DESKTOP ONLY - must drag, not just click)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, dayIndex: number) => {
      if (!weekData[dayIndex].available) return;

      const container = dayRefs.current[dayIndex];
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const totalMinutes = getDayTotalMinutes(dayIndex);

      // Check if clicking on existing event - if so, don't start drag
      const dayEvents = events.filter((ev) => ev.dayIndex === dayIndex);
      const clickedEvent = dayEvents.find((event) => {
        const eventTop = minutesToPixels(
          event.startMinutes,
          rect.height,
          totalMinutes,
        );
        const eventBottom =
          eventTop +
          minutesToPixels(event.durationMinutes, rect.height, totalMinutes);
        return y >= eventTop && y <= eventBottom;
      });

      if (clickedEvent) {
        // User clicked on event - don't start drag for new event
        return;
      }

      // Start drag for new event creation
      setIsDraggingNew(true);
      setDragDayIndex(dayIndex);
      setDragStartY(y);
      setDragCurrentY(y);
    },
    [weekData, events],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      // Handle dragging new event
      if (isDraggingNew && dragDayIndex !== null) {
        const container = dayRefs.current[dragDayIndex];
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const y = e.clientY - rect.top;
        setDragCurrentY(y);
        return;
      }

      // Handle dragging existing event to reschedule or resize
      if (draggingEventId && originalEventData && dragType) {
        const container = dayRefs.current[originalEventData.dayIndex];
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const totalMinutes = getDayTotalMinutes(originalEventData.dayIndex);

        // Calculate delta based on mouse movement
        const deltaY = e.clientY - dragStartY;
        const deltaMinutes = pixelsToMinutes(deltaY, rect.height, totalMinutes);

        if (dragType === "move") {
          // Move entire event
          let newStartMinutes = originalEventData.startMinutes + deltaMinutes;
          newStartMinutes = Math.max(0, newStartMinutes);
          newStartMinutes = Math.min(
            newStartMinutes,
            totalMinutes - originalEventData.durationMinutes,
          );

          setPreviewStartMinutes(newStartMinutes);
          setPreviewDurationMinutes(originalEventData.durationMinutes);
        } else if (dragType === "resize-top") {
          // Resize from top (change start time)
          let newStartMinutes = originalEventData.startMinutes + deltaMinutes;
          let newDuration = originalEventData.durationMinutes - deltaMinutes;

          // Clamp values
          newStartMinutes = Math.max(0, newStartMinutes);
          newDuration = Math.max(MIN_DURATION, newDuration);

          // Ensure we don't exceed the original end time
          const originalEndMinutes =
            originalEventData.startMinutes + originalEventData.durationMinutes;
          if (newStartMinutes + newDuration > originalEndMinutes) {
            newStartMinutes = originalEndMinutes - newDuration;
          }

          setPreviewStartMinutes(newStartMinutes);
          setPreviewDurationMinutes(newDuration);
        } else if (dragType === "resize-bottom") {
          // Resize from bottom (change end time)
          let newDuration = originalEventData.durationMinutes + deltaMinutes;

          // Clamp values
          newDuration = Math.max(MIN_DURATION, newDuration);

          // Ensure we don't exceed available time
          const maxDuration = totalMinutes - originalEventData.startMinutes;
          newDuration = Math.min(newDuration, maxDuration);

          setPreviewStartMinutes(originalEventData.startMinutes);
          setPreviewDurationMinutes(newDuration);
        }
      }
    },
    [
      isDraggingNew,
      draggingEventId,
      dragDayIndex,
      originalEventData,
      dragStartY,
    ],
  );

  const handleMouseUp = useCallback(() => {
    // Handle creating new event
    if (isDraggingNew && dragDayIndex !== null) {
      const container = dayRefs.current[dragDayIndex];
      if (!container) {
        setIsDraggingNew(false);
        setDragDayIndex(null);
        return;
      }

      const rect = container.getBoundingClientRect();
      const totalMinutes = getDayTotalMinutes(dragDayIndex);

      // Calculate start and end minutes
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

      // Check for overlap
      if (checkEventOverlap(dragDayIndex, startMinutes, durationMinutes)) {
        toast.error("Cannot create overlapping events");
        setIsDraggingNew(false);
        setDragDayIndex(null);
        return;
      }

      // Get the day and calculate actual date/time
      const day = weekData[dragDayIndex];
      const timeSlotStart = day.timeSlots[0]?.start || "9:00 AM";
      const baseHour = parseTimeToHours(timeSlotStart);

      // Calculate start date/time
      const eventDate = new Date(day.date);
      const totalStartMinutes = baseHour * 60 + startMinutes;
      const hours = Math.floor(totalStartMinutes / 60);
      const minutes = totalStartMinutes % 60;
      eventDate.setHours(hours, minutes, 0, 0);

      // Calculate end date/time
      const endDate = new Date(eventDate);
      endDate.setMinutes(endDate.getMinutes() + durationMinutes);

      // Validate: Check if in the past
      const validation = validateEventTime(eventDate, endDate);
      if (!validation.isValid) {
        toast.error(validation.error || "Invalid event time");
        setIsDraggingNew(false);
        setDragDayIndex(null);
        return;
      }

      // Generate event name
      const eventName = generateEventName(eventDate);

      // Open creation dialog with pre-filled data
      eventActions.openCreateForm({
        summary: eventName,
        start: eventDate,
        end: endDate,
        conferenceData: true, // Auto-enable Google Meet
      });

      // Reset drag state
      setIsDraggingNew(false);
      setDragDayIndex(null);
      return;
    }

    // Handle rescheduling or resizing existing event
    if (draggingEventId && originalEventData && dragType) {
      const event = events.find((ev) => ev.id === draggingEventId);
      if (!event) {
        setDraggingEventId(null);
        setDragType(null);
        setOriginalEventData(null);
        return;
      }

      // Check for overlap at new position/size
      if (
        checkEventOverlap(
          originalEventData.dayIndex,
          previewStartMinutes,
          previewDurationMinutes,
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

      // Calculate new start and end times
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

      // Validate: Check if new time is in the past
      const validation = validateEventTime(eventDate, endDate);
      if (!validation.isValid) {
        const action = dragType === "move" ? "reschedule" : "resize";
        toast.error(validation.error || `Cannot ${action} to past time`);
        setDraggingEventId(null);
        setDragType(null);
        setOriginalEventData(null);
        return;
      }

      // Extract the actual Google Calendar event ID
      const calendarEventId = event.id.replace("calendar-", "");

      // Find the original Google Calendar event to get all details
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

      // Open edit form with updated times
      eventActions.openEditForm(calendarEventId, {
        summary: googleEvent.summary || event.title,
        description: googleEvent.description,
        start: eventDate, // NEW start time
        end: endDate, // NEW end time
        location: googleEvent.location,
        attendees: googleEvent.attendees?.map((a) => ({
          email: a.email,
          displayName: a.displayName,
        })),
        conferenceData: !!googleEvent.hangoutLink,
      });

      // Reset drag state
      setDraggingEventId(null);
      setDragType(null);
      setOriginalEventData(null);
      setFocusedEventId(null);
    }
  }, [
    isDraggingNew,
    draggingEventId,
    dragType,
    dragDayIndex,
    dragStartY,
    dragCurrentY,
    originalEventData,
    previewStartMinutes,
    previewDurationMinutes,
    weekData,
    events,
    googleEvents,
    eventActions,
    checkEventOverlap,
  ]);

  // Handle event click - focus event (show toolbar)
  const handleEventClick = useCallback(
    (e: React.MouseEvent, eventId: string) => {
      e.stopPropagation();
      setFocusedEventId(eventId);
    },
    [],
  );

  // Handle event drag start - reschedule event (move entire event)
  const handleEventDragStart = useCallback(
    (
      e: React.MouseEvent,
      eventId: string,
      type: "move" | "resize-top" | "resize-bottom",
    ) => {
      e.stopPropagation();

      const event = events.find((ev) => ev.id === eventId);
      if (!event || !event.isFromCalendar) return;

      // Check if event is in the past
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

      // Start dragging
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

    // Extract the actual Google Calendar event ID
    const calendarEventId = event.id.replace("calendar-", "");

    eventActions.handleDeleteEvent(calendarEventId, event.title);
    setFocusedEventId(null);
    setShowDeleteDialog(false);
  }, [focusedEventId, events, eventActions]);

  /**
   * Handle editing a calendar event
   */
  const handleEditEvent = useCallback(() => {
    if (!focusedEventId) return;

    const event = events.find((ev) => ev.id === focusedEventId);
    if (!event || !event.isFromCalendar) return;

    // Check if event is in the past
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

    // Extract the actual Google Calendar event ID and find the original event
    const calendarEventId = event.id.replace("calendar-", "");
    const googleEvent = googleEvents.find((ge) => ge.id === calendarEventId);
    if (!googleEvent) {
      toast.error("Event not found");
      return;
    }

    // Open edit form with event data
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
      attendees: googleEvent.attendees?.map((a) => ({
        email: a.email,
        displayName: a.displayName,
      })),
      conferenceData: !!googleEvent.hangoutLink,
    });

    setFocusedEventId(null);
  }, [focusedEventId, events, weekData, googleEvents, eventActions]);

  // ========== TOUCH EVENT HANDLERS FOR MOBILE ==========

  // Handle touch start for long press to create event
  const handleTouchStart = useCallback(
    (e: React.TouchEvent, dayIndex: number) => {
      if (!isMobile || !weekData[dayIndex].available) return;

      const touch = e.touches[0];
      const container = dayRefs.current[dayIndex];
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const y = touch.clientY - rect.top;
      const totalMinutes = getDayTotalMinutes(dayIndex);
      const startMinutes = Math.max(
        0,
        pixelsToMinutes(y, rect.height, totalMinutes),
      );

      // Check if touching existing event
      const dayEvents = events.filter((ev) => ev.dayIndex === dayIndex);
      const touchedEvent = dayEvents.find((event) => {
        const eventTop = minutesToPixels(
          event.startMinutes,
          rect.height,
          totalMinutes,
        );
        const eventBottom =
          eventTop +
          minutesToPixels(event.durationMinutes, rect.height, totalMinutes);
        return y >= eventTop && y <= eventBottom;
      });

      // Store touch start position
      setTouchStartPos({ x: touch.clientX, y: touch.clientY });

      if (!touchedEvent) {
        // Start long press timer for creating new event
        const timer = setTimeout(() => {
          // Create 15-minute event
          const day = weekData[dayIndex];
          const timeSlotStart = day.timeSlots[0]?.start || "9:00 AM";
          const baseHour = parseTimeToHours(timeSlotStart);

          const eventDate = new Date(day.date);
          const totalStartMinutes = baseHour * 60 + startMinutes;
          const hours = Math.floor(totalStartMinutes / 60);
          const minutes = totalStartMinutes % 60;
          eventDate.setHours(hours, minutes, 0, 0);

          const endDate = new Date(eventDate);
          endDate.setMinutes(endDate.getMinutes() + 15); // 15 minutes

          // Validate time
          const validation = validateEventTime(eventDate, endDate);
          if (!validation.isValid) {
            toast.error(validation.error || "Invalid event time");
            return;
          }

          // Check for overlap
          if (checkEventOverlap(dayIndex, startMinutes, 15)) {
            toast.error("Cannot create overlapping events");
            return;
          }

          // Haptic feedback if available
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }

          const eventName = generateEventName(eventDate);
          eventActions.openCreateForm({
            summary: eventName,
            start: eventDate,
            end: endDate,
            conferenceData: true,
          });

          setLongPressTimer(null);
        }, LONG_PRESS_DURATION);

        setLongPressTimer(timer);
      }
    },
    [isMobile, weekData, events, eventActions, checkEventOverlap],
  );

  // Handle touch move
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile) return;

      const touch = e.touches[0];
      if (!touch) return;

      // Cancel long press if user moves finger too much
      if (longPressTimer && touchStartPos) {
        const deltaX = Math.abs(touch.clientX - touchStartPos.x);
        const deltaY = Math.abs(touch.clientY - touchStartPos.y);

        if (deltaX > 10 || deltaY > 10) {
          clearTimeout(longPressTimer);
          setLongPressTimer(null);
        }
      }

      // Handle dragging existing event
      if (isTouchDragging && draggingEventId && originalEventData) {
        // Note: preventDefault is handled by native event listener with passive: false

        const container = dayRefs.current[originalEventData.dayIndex];
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const totalMinutes = getDayTotalMinutes(originalEventData.dayIndex);

        const deltaY = touch.clientY - dragStartY;
        const deltaMinutes = pixelsToMinutes(deltaY, rect.height, totalMinutes);

        // Use requestAnimationFrame for smoother updates
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
    ],
  );

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!isMobile) return;

    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    setTouchStartPos(null);

    // Handle end of drag
    if (isTouchDragging && draggingEventId && originalEventData) {
      const event = events.find((ev) => ev.id === draggingEventId);
      if (!event) {
        setIsTouchDragging(false);
        setDraggingEventId(null);
        setDragType(null);
        setOriginalEventData(null);
        return;
      }

      // Check for overlap
      if (
        checkEventOverlap(
          originalEventData.dayIndex,
          previewStartMinutes,
          previewDurationMinutes,
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

      // Calculate new times and open edit form
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
          attendees: googleEvent.attendees?.map((a) => ({
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
      setFocusedEventId(null);
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
    checkEventOverlap,
  ]);

  // Handle touch start on event (for dragging)
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

      // Check if event is in the past
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

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    },
    [isMobile, events, weekData],
  );

  // Add/remove event listeners for drag (mouse and touch)
  useEffect(() => {
    if (isDraggingNew || draggingEventId || isTouchDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [
    isDraggingNew,
    draggingEventId,
    isTouchDragging,
    handleMouseMove,
    handleMouseUp,
  ]);

  // Add touch event listeners to day containers with passive: false
  useEffect(() => {
    if (!isMobile) return;

    const containers = dayRefs.current.filter(Boolean);

    const handleTouchMoveNative = (e: TouchEvent) => {
      if (isTouchDragging || longPressTimer) {
        e.preventDefault(); // This works because passive: false
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
  }, [isMobile, isTouchDragging, longPressTimer]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex-1 overflow-y-auto pt-4 md:pt-6 pb-8 md:pb-12 px-2 md:px-8"
      onClick={(e) => {
        // If clicking on the background (not an event), unfocus
        if (focusedEventId && e.target === e.currentTarget) {
          setFocusedEventId(null);
        }
      }}
    >
      <div
        className="max-w-6xl mx-auto"
        onClick={(e) => {
          // Also check clicks on the container
          if (
            focusedEventId &&
            (e.target as HTMLElement).classList.contains("max-w-6xl")
          ) {
            setFocusedEventId(null);
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          {/* Compact Header - All in one row */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="px-2 md:px-4 mb-3"
          >
            <div className="flex items-center justify-between gap-2">
              {/* Left: Back button */}
              <Button
                variant="ghost"
                onClick={onBack}
                size={isMobile ? "sm" : "default"}
                className="text-[#8b8475] hover:text-[#8b8475] hover:bg-[#e8e4d9]/60 group flex-shrink-0"
              >
                <ArrowLeft
                  className={`${isMobile ? "h-4 w-4" : "h-4 w-4 mr-2"} transition-transform group-hover:-translate-x-1`}
                />
                {!isMobile && "Back"}
              </Button>

              {/* Center: Title and Week Navigation */}
              <div className="flex items-center gap-1 md:gap-3 flex-1 justify-center min-w-0">
                <h1
                  className={`text-[#8b8475] truncate ${isMobile ? "text-sm max-w-[120px]" : "max-w-[200px]"}`}
                >
                  {availabilityName}
                </h1>

                <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onPreviousWeek}
                    className={`text-[#8b8475] hover:bg-[#e8e4d9]/60 ${isMobile ? "h-8 w-8" : "h-9 w-9"}`}
                  >
                    <ChevronLeft
                      className={`${isMobile ? "h-4 w-4" : "h-4 w-4"}`}
                    />
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={onToday}
                    size={isMobile ? "sm" : "default"}
                    className={`text-[#8b8475] hover:bg-[#e8e4d9]/60 ${isMobile ? "px-2 text-xs min-w-[44px]" : "px-3 text-xs"}`}
                    disabled={isCurrentWeek}
                  >
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const displayStartDate = new Date(currentStartDate);
                      displayStartDate.setHours(0, 0, 0, 0);

                      // Calculate the end of the displayed week
                      const displayEndDate = new Date(displayStartDate);
                      displayEndDate.setDate(
                        displayStartDate.getDate() + daysToShow - 1,
                      );

                      // Check if today falls within the displayed week range
                      if (
                        today >= displayStartDate &&
                        today <= displayEndDate
                      ) {
                        return isMobile ? "Now" : "Today";
                      }

                      // Calculate difference from today to the start of the displayed week
                      const diffMs =
                        displayStartDate.getTime() - today.getTime();
                      const diffDays = Math.round(
                        diffMs / (1000 * 60 * 60 * 24),
                      );

                      const absDays = Math.abs(diffDays);
                      const sign = diffDays > 0 ? "+" : "-";

                      if (absDays >= 7) {
                        const weeks = Math.floor(absDays / 7);
                        return `${sign}${weeks}w`;
                      }

                      return `${sign}${absDays}d`;
                    })()}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNextWeek}
                    className={`text-[#8b8475] hover:bg-[#e8e4d9]/60 ${isMobile ? "h-8 w-8" : "h-9 w-9"}`}
                  >
                    <ChevronRight
                      className={`${isMobile ? "h-4 w-4" : "h-4 w-4"}`}
                    />
                  </Button>
                </div>
              </div>

              {/* Right: Refresh and Share buttons */}
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  onClick={() => {
                    refetchEvents();
                    toast.success("Refreshing calendar...");
                  }}
                  variant="outline"
                  size={isMobile ? "sm" : "sm"}
                  disabled={isRefetching}
                  className="bg-[#e8e4d9]/60 hover:bg-[#8b8475] text-[#8b8475] hover:text-[#f5f3ef] border-[#d4cfbe]/40"
                  title="Refresh calendar events"
                >
                  <RefreshCw
                    className={`${isMobile ? "h-4 w-4" : "h-4 w-4 mr-2"} ${isRefetching ? "animate-spin" : ""}`}
                  />
                  {!isMobile && "Refresh"}
                </Button>
                <Button
                  onClick={() => copyToClipboard(window.location.href)}
                  variant="outline"
                  size={isMobile ? "sm" : "sm"}
                  className="bg-[#e8e4d9]/60 hover:bg-[#8b8475] text-[#8b8475] hover:text-[#f5f3ef] border-[#d4cfbe]/40"
                >
                  <Share2
                    className={`${isMobile ? "h-4 w-4" : "h-4 w-4 mr-2"}`}
                  />
                  {!isMobile && "Share"}
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Calendar Grid with Hour Labels */}
          <div className="flex gap-2">
            {/* Hour labels column */}
            <div className="flex flex-col pt-8">
              {(() => {
                // Find the first available day to get time slots
                const firstAvailableDay = weekData.find((d) => d.available);
                if (
                  !firstAvailableDay ||
                  firstAvailableDay.timeSlots.length === 0
                )
                  return null;

                const startHour = parseTimeToHours(
                  firstAvailableDay.timeSlots[0].start,
                );
                const endHour = parseTimeToHours(
                  firstAvailableDay.timeSlots[0].end,
                );
                const hours = [];

                for (
                  let h = Math.floor(startHour);
                  h <= Math.floor(endHour);
                  h++
                ) {
                  const period = h >= 12 ? "PM" : "AM";
                  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
                  hours.push(`${displayHour} ${period}`);
                }

                const maxHeight = isMobile ? 720 : 900; // Increased height: 80-100px per hour
                const height = getProportionalHeight(
                  firstAvailableDay.timeSlots[0],
                  maxHeight,
                );
                const hourHeight = height / (endHour - startHour);

                return hours.map((hour, idx) => (
                  <div
                    key={idx}
                    className={`text-[#a8a195] ${isMobile ? "text-xs" : "text-sm"} pr-2 flex-shrink-0`}
                    style={{
                      height: `${hourHeight}px`,
                      lineHeight: `${hourHeight}px`,
                    }}
                  >
                    {hour}
                  </div>
                ));
              })()}
            </div>

            {/* Days grid */}
            <div
              className={`grid ${isMobile ? "grid-cols-2" : "grid-cols-7"} flex-1`}
            >
              {weekData.map((day, i) => {
                const maxHeight = isMobile ? 720 : 900; // Increased height for better visibility
                const height = day.available
                  ? getProportionalHeight(day.timeSlots[0], maxHeight)
                  : maxHeight;
                const isLastDay = i === weekData.length - 1;
                const totalMinutes = getDayTotalMinutes(i);

                // Get events for this day, including preview event if dragging
                let dayEvents = events.filter((ev) => ev.dayIndex === i);

                // Add preview event if user is dragging to create new event on this day
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

                  // Create a temporary preview event that will render with the same code
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
                    initial={{ opacity: 0, y: 20 }}
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
                      <div
                        ref={(el) => (dayRefs.current[i] = el)}
                        className="w-full bg-green-500/70 relative cursor-crosshair select-none"
                        style={{
                          height: `${height}px`,
                          touchAction:
                            isMobile && (isTouchDragging || focusedEventId)
                              ? "none"
                              : "auto",
                        }}
                        onMouseDown={(e) => !isMobile && handleMouseDown(e, i)}
                        onMouseMove={(e) =>
                          !isMobile && handleCalendarMouseMove(e, i)
                        }
                        onMouseLeave={handleCalendarMouseLeave}
                        onTouchStart={(e) => isMobile && handleTouchStart(e, i)}
                        onTouchMove={(e) => isMobile && handleTouchMove(e)}
                        onTouchEnd={() => isMobile && handleTouchEnd()}
                        onClick={(e) => {
                          // If clicking on calendar background (not an event), unfocus
                          if (focusedEventId && e.target === e.currentTarget) {
                            setFocusedEventId(null);
                          }
                        }}
                      >
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
                              {/* Horizontal line */}
                              <div className="w-full h-[2px] bg-white/80 shadow-sm" />
                              {/* Time label */}
                              <div className="absolute left-2 -top-3 bg-white/95 text-[#8b8475] text-xs px-2 py-0.5 rounded shadow-md whitespace-nowrap">
                                {(() => {
                                  const timeSlot = day.timeSlots[0];
                                  const startHours = parseTimeToHours(
                                    timeSlot.start,
                                  );
                                  const totalHours =
                                    startHours + hoverTimeMinutes / 60;
                                  const hours = Math.floor(totalHours);
                                  const mins = Math.round(
                                    (totalHours - hours) * 60,
                                  );
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

                        {/* Events (includes preview event when dragging) */}
                        <AnimatePresence>
                          {dayEvents.map((event) => {
                            const isFocused = focusedEventId === event.id;
                            const isBeingDragged = draggingEventId === event.id;
                            const isPreview = event.id === "preview-new-event";

                            // Use preview position/size if this event is being dragged, otherwise use actual position
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
                                  border: isFocused
                                    ? "2px solid white"
                                    : "none",
                                  zIndex: isFocused ? 10 : isPreview ? 10 : 1,
                                  opacity: 1, // Keep full opacity even when dragging
                                  transition:
                                    isBeingDragged || isPreview
                                      ? "none"
                                      : "all 0.2s ease",
                                }}
                                onClick={(e) => {
                                  if (!isBeingDragged && !isPreview) {
                                    handleEventClick(e, event.id);
                                  }
                                }}
                                onMouseDown={(e) => {
                                  if (
                                    isFocused &&
                                    !isBeingDragged &&
                                    !isPreview
                                  ) {
                                    handleEventDragStart(e, event.id, "move");
                                  }
                                }}
                                onTouchStart={(e) => {
                                  if (
                                    isMobile &&
                                    isFocused &&
                                    !isBeingDragged &&
                                    !isPreview
                                  ) {
                                    handleEventTouchStart(e, event.id, "move");
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

                                {/* Start time label - appears above event when focused (stays during drag) */}
                                <AnimatePresence>
                                  {(isFocused || isPreview) && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: 5 }}
                                      className="absolute -top-9 left-1/2 -translate-x-1/2 bg-white text-[#8b8475] text-base font-medium px-2 py-1 rounded shadow-md whitespace-nowrap z-30 pointer-events-none"
                                    >
                                      {(() => {
                                        const day = weekData[event.dayIndex];
                                        const timeSlotStart =
                                          day.timeSlots[0]?.start || "9:00 AM";
                                        const baseHour =
                                          parseTimeToHours(timeSlotStart);
                                        // Use preview times if dragging, otherwise use actual event times
                                        const displayStartMinutes =
                                          isBeingDragged &&
                                          draggingEventId === event.id
                                            ? previewStartMinutes
                                            : event.startMinutes;
                                        const totalStartMinutes =
                                          baseHour * 60 + displayStartMinutes;
                                        const hours = Math.floor(
                                          totalStartMinutes / 60,
                                        );
                                        const mins = totalStartMinutes % 60;
                                        const period =
                                          hours >= 12 ? "PM" : "AM";
                                        const displayHours =
                                          hours > 12
                                            ? hours - 12
                                            : hours === 0
                                              ? 12
                                              : hours;
                                        return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
                                      })()}
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
                                        const day = weekData[event.dayIndex];
                                        const timeSlotStart =
                                          day.timeSlots[0]?.start || "9:00 AM";
                                        const baseHour =
                                          parseTimeToHours(timeSlotStart);
                                        // Use preview times if dragging, otherwise use actual event times
                                        const displayStartMinutes =
                                          isBeingDragged &&
                                          draggingEventId === event.id
                                            ? previewStartMinutes
                                            : event.startMinutes;
                                        const displayDurationMinutes =
                                          isBeingDragged &&
                                          draggingEventId === event.id
                                            ? previewDurationMinutes
                                            : event.durationMinutes;
                                        const totalEndMinutes =
                                          baseHour * 60 +
                                          displayStartMinutes +
                                          displayDurationMinutes;
                                        const hours = Math.floor(
                                          totalEndMinutes / 60,
                                        );
                                        const mins = totalEndMinutes % 60;
                                        const period =
                                          hours >= 12 ? "PM" : "AM";
                                        const displayHours =
                                          hours > 12
                                            ? hours - 12
                                            : hours === 0
                                              ? 12
                                              : hours;
                                        return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
                                      })()}
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                {/* Resize handle - Top */}
                                <AnimatePresence>
                                  {isFocused &&
                                    !isBeingDragged &&
                                    !isPreview && (
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
                                          handleEventDragStart(
                                            e,
                                            event.id,
                                            "resize-top",
                                          );
                                        }}
                                        onTouchStart={(e) => {
                                          if (isMobile) {
                                            e.stopPropagation();
                                            handleEventTouchStart(
                                              e,
                                              event.id,
                                              "resize-top",
                                            );
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
                                  {isFocused &&
                                    !isBeingDragged &&
                                    !isPreview && (
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
                                          handleEventDragStart(
                                            e,
                                            event.id,
                                            "resize-bottom",
                                          );
                                        }}
                                        onTouchStart={(e) => {
                                          if (isMobile) {
                                            e.stopPropagation();
                                            handleEventTouchStart(
                                              e,
                                              event.id,
                                              "resize-bottom",
                                            );
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
                          })}
                        </AnimatePresence>
                      </div>
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
          </div>

          {/* Focused Event Actions */}
          <AnimatePresence>
            {focusedEventId &&
              (() => {
                const focusedEvent = events.find(
                  (ev) => ev.id === focusedEventId,
                );
                if (!focusedEvent) return null;

                const isCalendarEvent = focusedEvent.isFromCalendar;

                // Use preview times if dragging, otherwise use actual event times
                const isBeingDragged = draggingEventId === focusedEventId;
                const displayStartMinutes = isBeingDragged
                  ? previewStartMinutes
                  : focusedEvent.startMinutes;
                const displayDurationMinutes = isBeingDragged
                  ? previewDurationMinutes
                  : focusedEvent.durationMinutes;

                // Calculate start and end times
                const day = weekData[focusedEvent.dayIndex];
                const timeSlotStart = day.timeSlots[0]?.start || "9:00 AM";
                const baseHour = parseTimeToHours(timeSlotStart);

                const eventDate = new Date(day.date);
                const totalStartMinutes = baseHour * 60 + displayStartMinutes;
                const startHours = Math.floor(totalStartMinutes / 60);
                const startMins = totalStartMinutes % 60;
                eventDate.setHours(startHours, startMins, 0, 0);

                const endDate = new Date(eventDate);
                endDate.setMinutes(
                  endDate.getMinutes() + displayDurationMinutes,
                );

                const isPast = isPastEvent(endDate);

                // Format times for display
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5 md:gap-2 bg-white/95 backdrop-blur-md px-3 md:px-4 py-2 md:py-3 rounded-2xl shadow-xl border border-[#d4cfbe]/40 z-50 max-w-[calc(100vw-2rem)] mx-4"
                  >
                    {isCalendarEvent && (
                      <>
                        {/* Edit button - disabled for past events */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleEditEvent}
                          disabled={isPast}
                          className="text-[#8b8475] hover:text-[#6b6558] hover:bg-[#e8e4d9]/60 h-8 w-8 md:h-9 md:w-9 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                          title={
                            isPast ? "Cannot edit past events" : "Edit event"
                          }
                        >
                          <Edit className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        </Button>

                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleDeleteEvent}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 md:h-9 md:w-9 flex-shrink-0"
                          title="Delete event"
                        >
                          <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        </Button>

                        {/* Google Meet button */}
                        {focusedEvent.meetLink && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              window.open(focusedEvent.meetLink, "_blank")
                            }
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 md:h-9 md:w-9 flex-shrink-0"
                            title="Join Google Meet"
                          >
                            <Video className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </Button>
                        )}
                      </>
                    )}

                    {/* Close button (always shown) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFocusedEventId(null)}
                      className="text-[#a8a195] hover:bg-[#e8e4d9]/60 h-8 w-8 md:h-9 md:w-9 flex-shrink-0"
                      title="Close"
                    >
                      <span className="text-base md:text-lg">✕</span>
                    </Button>
                  </motion.div>
                );
              })()}
          </AnimatePresence>

          {/* Delete Confirmation Dialog */}
          <AlertDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
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
                  onClick={confirmDeleteEvent}
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Event Form Modal */}
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
}
