import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, Share2, Trash2, Expand } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

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

export interface AvailabilityEvent {
  id: string;
  dayIndex: number; // Which day in the week
  startMinutes: number; // Minutes from start of availability slot
  durationMinutes: number; // Duration in minutes
  title: string;
  color: string;
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
  onExpandEvent?: (event: AvailabilityEvent, dayDate: Date, timeSlotStart: string) => void;
}

// Helper function to get days data starting from a specific date
const getDaysData = (startDate: Date, count: number): DayAvailability[] => {
  const days: DayAvailability[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
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
        timeSlots = [{ start: '9:00 AM', end: '3:00 PM' }];
      } else {
        timeSlots = [{ start: '9:00 AM', end: '6:00 PM' }];
      }
    }
    
    days.push({
      date: new Date(date),
      dayName: dayNames[dayOfWeek],
      available: isWeekday,
      timeSlots: timeSlots
    });
  }
  
  return days;
};

// Helper function to parse time string to hours
const parseTimeToHours = (timeString: string): number => {
  const [time, period] = timeString.split(' ');
  const [hours, minutes] = time.split(':').map(Number);
  
  let totalHours = hours;
  if (period === 'PM' && hours !== 12) {
    totalHours += 12;
  } else if (period === 'AM' && hours === 12) {
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
const getProportionalHeight = (timeSlot: TimeSlot, maxHeightPx: number): number => {
  const duration = calculateDuration(timeSlot);
  const maxDuration = 9; // 9 hours is the reference (9 AM - 6 PM)
  return Math.round((duration / maxDuration) * maxHeightPx);
};

const formatDate = (date: Date): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
};

// Format time to compact version (e.g., "9:00 AM" -> "9AM")
const formatTimeCompact = (timeString: string): string => {
  return timeString.replace(':00', '').replace(' ', '');
};

// Format minutes to time string
const formatMinutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
};

const copyToClipboard = (text: string) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  
  try {
    document.execCommand('copy');
    toast.success('Calendar link copied!');
  } catch (err) {
    toast.error('Failed to copy link');
  } finally {
    document.body.removeChild(textarea);
  }
};

const EVENT_COLORS = [
  '#ef4444', // red
  '#f59e0b', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
];

export function AvailabilityPage({
  availabilityName,
  currentStartDate,
  onBack,
  onPreviousWeek,
  onNextWeek,
  onToday,
  isCurrentWeek,
  isMobile,
  onExpandEvent
}: AvailabilityPageProps) {
  const daysToShow = isMobile ? 2 : 7;
  const weekData = getDaysData(currentStartDate, daysToShow);
  
  const [events, setEvents] = useState<AvailabilityEvent[]>([]);
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingDayIndex, setCreatingDayIndex] = useState<number | null>(null);
  const [dragType, setDragType] = useState<'move' | 'resize-top' | 'resize-bottom' | null>(null);
  const [dragEventId, setDragEventId] = useState<string | null>(null);
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [dragStartMinutes, setDragStartMinutes] = useState<number>(0);
  const [dragStartDuration, setDragStartDuration] = useState<number>(0);
  const [pendingEventData, setPendingEventData] = useState<{dayIndex: number, startMinutes: number} | null>(null);
  const [showHoldTooltip, setShowHoldTooltip] = useState(false);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);
  const [hoverTimeMinutes, setHoverTimeMinutes] = useState<number>(0);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dayRefs = useRef<(HTMLDivElement | null)[]>([]);

  const MIN_DURATION = 5; // 5 minutes
  const MAX_DURATION = 180; // 3 hours

  // Generate a random color for new events
  const getRandomColor = () => {
    return EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)];
  };

  // Convert pixel position to minutes
  const pixelsToMinutes = (pixels: number, containerHeight: number, totalMinutes: number) => {
    return Math.round((pixels / containerHeight) * totalMinutes);
  };

  // Convert minutes to pixel position
  const minutesToPixels = (minutes: number, containerHeight: number, totalMinutes: number) => {
    return (minutes / totalMinutes) * containerHeight;
  };

  // Get total available minutes for a day
  const getDayTotalMinutes = (dayIndex: number) => {
    const day = weekData[dayIndex];
    if (!day || !day.available || day.timeSlots.length === 0) return 0;
    return calculateDuration(day.timeSlots[0]) * 60;
  };

  // Check if an event would overlap with existing events
  const checkEventOverlap = useCallback((
    dayIndex: number,
    startMinutes: number,
    durationMinutes: number,
    excludeEventId?: string
  ): boolean => {
    const endMinutes = startMinutes + durationMinutes;
    
    // Check against all events on the same day
    const dayEvents = events.filter(ev => 
      ev.dayIndex === dayIndex && ev.id !== excludeEventId
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
  }, [events]);

  // Handle hover time tracking
  const handleCalendarMouseMove = useCallback((e: React.MouseEvent, dayIndex: number) => {
    const container = dayRefs.current[dayIndex];
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = getDayTotalMinutes(dayIndex);
    const minutes = Math.max(0, Math.min(totalMinutes, pixelsToMinutes(y, rect.height, totalMinutes)));
    
    setHoveredDayIndex(dayIndex);
    setHoverTimeMinutes(minutes);
  }, [weekData]);

  const handleCalendarMouseLeave = useCallback(() => {
    setHoveredDayIndex(null);
  }, []);

  // Handle creating event on desktop (click and drag)
  const handleMouseDown = useCallback((e: React.MouseEvent, dayIndex: number) => {
    if (!weekData[dayIndex].available) return;
    
    const container = dayRefs.current[dayIndex];
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = getDayTotalMinutes(dayIndex);
    const startMinutes = Math.max(0, pixelsToMinutes(y, rect.height, totalMinutes));
    
    // Store pending event data but don't create yet - wait for drag
    setPendingEventData({ dayIndex, startMinutes });
    setDragStartY(e.clientY);
    setDragStartMinutes(startMinutes);
    setDragStartDuration(MIN_DURATION);
  }, [weekData]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Check if we have pending event data (user clicked but hasn't dragged yet)
    if (pendingEventData && !isCreating && !dragEventId) {
      const deltaY = Math.abs(e.clientY - dragStartY);
      const DRAG_THRESHOLD = 5; // pixels
      
      // Only create event if user has dragged at least 5 pixels
      if (deltaY >= DRAG_THRESHOLD) {
        // Check if this would overlap with existing events
        if (checkEventOverlap(pendingEventData.dayIndex, pendingEventData.startMinutes, MIN_DURATION)) {
          toast.error('Cannot create overlapping events');
          setPendingEventData(null);
          return;
        }
        
        const newEvent: AvailabilityEvent = {
          id: `event-${Date.now()}`,
          dayIndex: pendingEventData.dayIndex,
          startMinutes: pendingEventData.startMinutes,
          durationMinutes: MIN_DURATION,
          title: 'New Event',
          color: getRandomColor()
        };
        
        setEvents(prev => [...prev, newEvent]);
        setIsCreating(true);
        setCreatingDayIndex(pendingEventData.dayIndex);
        setDragEventId(newEvent.id);
        setDragType('resize-bottom');
        setPendingEventData(null);
      }
      return;
    }
    
    if (!isCreating && !dragEventId) return;
    
    const dayIndex = isCreating ? creatingDayIndex : 
      events.find(ev => ev.id === dragEventId)?.dayIndex;
    
    if (dayIndex === null || dayIndex === undefined) return;
    
    const container = dayRefs.current[dayIndex];
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const totalMinutes = getDayTotalMinutes(dayIndex);
    
    if (isCreating || dragType === 'resize-bottom') {
      const deltaY = e.clientY - dragStartY;
      const deltaMinutes = pixelsToMinutes(deltaY, rect.height, totalMinutes);
      let newDuration = Math.max(MIN_DURATION, dragStartDuration + deltaMinutes);
      newDuration = Math.min(newDuration, MAX_DURATION);
      
      // Ensure event doesn't exceed available time
      const event = events.find(ev => ev.id === dragEventId);
      if (event) {
        const maxDuration = totalMinutes - event.startMinutes;
        newDuration = Math.min(newDuration, maxDuration);
        
        // Check for overlap with other events
        if (!checkEventOverlap(dayIndex, event.startMinutes, newDuration, dragEventId)) {
          setEvents(prev => prev.map(ev => 
            ev.id === dragEventId ? { ...ev, durationMinutes: newDuration } : ev
          ));
        }
      }
    } else if (dragType === 'resize-top') {
      const deltaY = e.clientY - dragStartY;
      const deltaMinutes = pixelsToMinutes(deltaY, rect.height, totalMinutes);
      const event = events.find(ev => ev.id === dragEventId);
      
      if (event) {
        let newStartMinutes = dragStartMinutes + deltaMinutes;
        let newDuration = dragStartDuration - deltaMinutes;
        
        // Clamp values
        newStartMinutes = Math.max(0, newStartMinutes);
        newDuration = Math.max(MIN_DURATION, newDuration);
        newDuration = Math.min(newDuration, MAX_DURATION);
        
        // Ensure event doesn't exceed available time
        const maxEnd = totalMinutes;
        if (newStartMinutes + newDuration > maxEnd) {
          newStartMinutes = maxEnd - newDuration;
        }
        
        // Check for overlap with other events
        if (!checkEventOverlap(dayIndex, newStartMinutes, newDuration, dragEventId)) {
          setEvents(prev => prev.map(ev => 
            ev.id === dragEventId ? 
              { ...ev, startMinutes: newStartMinutes, durationMinutes: newDuration } : ev
          ));
        }
      }
    } else if (dragType === 'move') {
      const deltaY = e.clientY - dragStartY;
      const deltaMinutes = pixelsToMinutes(deltaY, rect.height, totalMinutes);
      const event = events.find(ev => ev.id === dragEventId);
      
      if (event) {
        let newStartMinutes = dragStartMinutes + deltaMinutes;
        newStartMinutes = Math.max(0, newStartMinutes);
        newStartMinutes = Math.min(newStartMinutes, totalMinutes - event.durationMinutes);
        
        // Check for overlap with other events
        if (!checkEventOverlap(dayIndex, newStartMinutes, event.durationMinutes, dragEventId)) {
          setEvents(prev => prev.map(ev => 
            ev.id === dragEventId ? { ...ev, startMinutes: newStartMinutes } : ev
          ));
        }
      }
    }
  }, [pendingEventData, isCreating, dragEventId, creatingDayIndex, dragType, dragStartY, dragStartMinutes, dragStartDuration, events, weekData, checkEventOverlap]);

  const handleMouseUp = useCallback(() => {
    // If we have pending event data, user just clicked without dragging - cancel it
    if (pendingEventData) {
      setPendingEventData(null);
    }
    
    setIsCreating(false);
    setCreatingDayIndex(null);
    setDragEventId(null);
    setDragType(null);
  }, [pendingEventData]);

  // Handle creating event on mobile (tap and hold)
  const handleTouchStart = useCallback((e: React.TouchEvent, dayIndex: number) => {
    if (!weekData[dayIndex].available) return;
    
    // Prevent creating new event if one is already focused
    if (focusedEventId) return;
    
    const container = dayRefs.current[dayIndex];
    if (!container) return;
    
    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    const y = touch.clientY - rect.top;
    
    // Show tooltip centered at top of screen for visibility
    setShowHoldTooltip(true);
    
    touchTimerRef.current = setTimeout(() => {
      const totalMinutes = getDayTotalMinutes(dayIndex);
      const startMinutes = Math.max(0, pixelsToMinutes(y, rect.height, totalMinutes));
      
      // Check if this would overlap with existing events
      if (checkEventOverlap(dayIndex, startMinutes, 15)) {
        toast.error('Cannot create overlapping events');
        // Hide tooltip after a delay
        tooltipHideTimerRef.current = setTimeout(() => {
          setShowHoldTooltip(false);
        }, 1000);
        return;
      }
      
      const newEvent: AvailabilityEvent = {
        id: `event-${Date.now()}`,
        dayIndex,
        startMinutes,
        durationMinutes: 15, // Default 15 minutes on mobile
        title: 'New Event',
        color: getRandomColor()
      };
      
      setEvents(prev => [...prev, newEvent]);
      setFocusedEventId(newEvent.id);
      toast.success('Event created! Use handles to resize.');
      
      // Hide tooltip after event is created, with delay so user can read it
      tooltipHideTimerRef.current = setTimeout(() => {
        setShowHoldTooltip(false);
      }, 1000);
    }, 500); // 500ms hold to create
  }, [weekData, focusedEventId, checkEventOverlap]);

  const handleTouchEnd = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    // Hide tooltip after a delay so user has time to read it
    tooltipHideTimerRef.current = setTimeout(() => {
      setShowHoldTooltip(false);
    }, 1000);
  }, []);

  // Event drag handlers
  const handleEventMouseDown = useCallback((e: React.MouseEvent, eventId: string, type: 'move' | 'resize-top' | 'resize-bottom') => {
    e.stopPropagation();
    const event = events.find(ev => ev.id === eventId);
    if (!event) return;
    
    setDragEventId(eventId);
    setDragType(type);
    setDragStartY(e.clientY);
    setDragStartMinutes(event.startMinutes);
    setDragStartDuration(event.durationMinutes);
    setFocusedEventId(eventId);
  }, [events]);

  // Touch handlers for event resizing on mobile
  const handleEventTouchStart = useCallback((e: React.TouchEvent, eventId: string, type: 'move' | 'resize-top' | 'resize-bottom') => {
    e.stopPropagation();
    const event = events.find(ev => ev.id === eventId);
    if (!event) return;
    
    const touch = e.touches[0];
    setDragEventId(eventId);
    setDragType(type);
    setDragStartY(touch.clientY);
    setDragStartMinutes(event.startMinutes);
    setDragStartDuration(event.durationMinutes);
    setFocusedEventId(eventId);
  }, [events]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!dragEventId) return;
    
    // Prevent scrolling during drag
    e.preventDefault();
    
    const touch = e.touches[0];
    
    const dayIndex = events.find(ev => ev.id === dragEventId)?.dayIndex;
    if (dayIndex === null || dayIndex === undefined) return;
    
    const container = dayRefs.current[dayIndex];
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const totalMinutes = getDayTotalMinutes(dayIndex);
    
    if (dragType === 'resize-bottom') {
      const deltaY = touch.clientY - dragStartY;
      const deltaMinutes = pixelsToMinutes(deltaY, rect.height, totalMinutes);
      let newDuration = Math.max(MIN_DURATION, dragStartDuration + deltaMinutes);
      newDuration = Math.min(newDuration, MAX_DURATION);
      
      const event = events.find(ev => ev.id === dragEventId);
      if (event) {
        const maxDuration = totalMinutes - event.startMinutes;
        newDuration = Math.min(newDuration, maxDuration);
        
        // Check for overlap with other events
        if (!checkEventOverlap(dayIndex, event.startMinutes, newDuration, dragEventId)) {
          setEvents(prev => prev.map(ev => 
            ev.id === dragEventId ? { ...ev, durationMinutes: newDuration } : ev
          ));
        }
      }
    } else if (dragType === 'resize-top') {
      const deltaY = touch.clientY - dragStartY;
      const deltaMinutes = pixelsToMinutes(deltaY, rect.height, totalMinutes);
      const event = events.find(ev => ev.id === dragEventId);
      
      if (event) {
        let newStartMinutes = dragStartMinutes + deltaMinutes;
        let newDuration = dragStartDuration - deltaMinutes;
        
        newStartMinutes = Math.max(0, newStartMinutes);
        newDuration = Math.max(MIN_DURATION, newDuration);
        newDuration = Math.min(newDuration, MAX_DURATION);
        
        const maxEnd = totalMinutes;
        if (newStartMinutes + newDuration > maxEnd) {
          newStartMinutes = maxEnd - newDuration;
        }
        
        // Check for overlap with other events
        if (!checkEventOverlap(dayIndex, newStartMinutes, newDuration, dragEventId)) {
          setEvents(prev => prev.map(ev => 
            ev.id === dragEventId ? 
              { ...ev, startMinutes: newStartMinutes, durationMinutes: newDuration } : ev
          ));
        }
      }
    } else if (dragType === 'move') {
      const deltaY = touch.clientY - dragStartY;
      const deltaMinutes = pixelsToMinutes(deltaY, rect.height, totalMinutes);
      const event = events.find(ev => ev.id === dragEventId);
      
      if (event) {
        let newStartMinutes = dragStartMinutes + deltaMinutes;
        newStartMinutes = Math.max(0, newStartMinutes);
        newStartMinutes = Math.min(newStartMinutes, totalMinutes - event.durationMinutes);
        
        // Check for overlap with other events
        if (!checkEventOverlap(dayIndex, newStartMinutes, event.durationMinutes, dragEventId)) {
          setEvents(prev => prev.map(ev => 
            ev.id === dragEventId ? { ...ev, startMinutes: newStartMinutes } : ev
          ));
        }
      }
    }
  }, [dragEventId, dragType, dragStartY, dragStartMinutes, dragStartDuration, events, weekData, checkEventOverlap]);

  const handleTouchEndResize = useCallback(() => {
    setDragEventId(null);
    setDragType(null);
  }, []);

  const handleDeleteEvent = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  const confirmDeleteEvent = useCallback(() => {
    if (focusedEventId) {
      setEvents(prev => prev.filter(ev => ev.id !== focusedEventId));
      setFocusedEventId(null);
      setShowDeleteDialog(false);
      toast.success('Event deleted');
    }
  }, [focusedEventId]);

  const handleExpandEvent = useCallback(() => {
    if (focusedEventId && onExpandEvent) {
      const event = events.find(ev => ev.id === focusedEventId);
      if (event) {
        const day = weekData[event.dayIndex];
        const timeSlotStart = day.timeSlots[0]?.start || '9:00 AM';
        onExpandEvent(event, day.date, timeSlotStart);
      }
    }
  }, [focusedEventId, events, weekData, onExpandEvent]);

  // Add/remove event listeners
  useEffect(() => {
    if (pendingEventData || isCreating || dragEventId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEndResize);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEndResize);
      };
    }
  }, [pendingEventData, isCreating, dragEventId, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEndResize]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
      }
      if (tooltipHideTimerRef.current) {
        clearTimeout(tooltipHideTimerRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex-1 overflow-y-auto py-8 md:py-12 px-2 md:px-8"
      onClick={(e) => {
        // If clicking on the background (not an event), unfocus
        if (focusedEventId && e.target === e.currentTarget) {
          setFocusedEventId(null);
        }
      }}
    >
      <div className="max-w-6xl mx-auto" onClick={(e) => {
        // Also check clicks on the container
        if (focusedEventId && (e.target as HTMLElement).classList.contains('max-w-6xl')) {
          setFocusedEventId(null);
        }
      }}>
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
                <ArrowLeft className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4 mr-2'} transition-transform group-hover:-translate-x-1`} />
                {!isMobile && 'Back'}
              </Button>
              
              {/* Center: Title and Week Navigation */}
              <div className="flex items-center gap-1 md:gap-3 flex-1 justify-center min-w-0">
                <h1 className={`text-[#8b8475] truncate ${isMobile ? 'text-sm max-w-[120px]' : 'max-w-[200px]'}`}>
                  {availabilityName}
                </h1>
                
                <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onPreviousWeek}
                    className={`text-[#8b8475] hover:bg-[#e8e4d9]/60 ${isMobile ? 'h-8 w-8' : 'h-9 w-9'}`}
                  >
                    <ChevronLeft className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    onClick={onToday}
                    size={isMobile ? "sm" : "default"}
                    className={`text-[#8b8475] hover:bg-[#e8e4d9]/60 ${isMobile ? 'px-2 text-xs min-w-[44px]' : 'px-3 text-xs'}`}
                    disabled={isCurrentWeek}
                  >
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const displayStartDate = new Date(currentStartDate);
                      displayStartDate.setHours(0, 0, 0, 0);
                      
                      // Calculate the end of the displayed week
                      const displayEndDate = new Date(displayStartDate);
                      displayEndDate.setDate(displayStartDate.getDate() + daysToShow - 1);
                      
                      // Check if today falls within the displayed week range
                      if (today >= displayStartDate && today <= displayEndDate) {
                        return isMobile ? 'Now' : 'Today';
                      }
                      
                      // Calculate difference from today to the start of the displayed week
                      const diffMs = displayStartDate.getTime() - today.getTime();
                      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                      
                      const absDays = Math.abs(diffDays);
                      const sign = diffDays > 0 ? '+' : '-';
                      
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
                    className={`text-[#8b8475] hover:bg-[#e8e4d9]/60 ${isMobile ? 'h-8 w-8' : 'h-9 w-9'}`}
                  >
                    <ChevronRight className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4'}`} />
                  </Button>
                </div>
              </div>
              
              {/* Right: Share button */}
              <Button
                onClick={() => copyToClipboard(window.location.href)}
                variant="outline"
                size={isMobile ? "sm" : "sm"}
                className="bg-[#e8e4d9]/60 hover:bg-[#8b8475] text-[#8b8475] hover:text-[#f5f3ef] border-[#d4cfbe]/40 flex-shrink-0"
              >
                <Share2 className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4 mr-2'}`} />
                {!isMobile && 'Share'}
              </Button>
            </div>
          </motion.div>
          
          {/* Calendar Grid with Hour Labels */}
          <div className="flex gap-2">
            {/* Hour labels column */}
            <div className="flex flex-col pt-8">
              {(() => {
                // Find the first available day to get time slots
                const firstAvailableDay = weekData.find(d => d.available);
                if (!firstAvailableDay || firstAvailableDay.timeSlots.length === 0) return null;
                
                const startHour = parseTimeToHours(firstAvailableDay.timeSlots[0].start);
                const endHour = parseTimeToHours(firstAvailableDay.timeSlots[0].end);
                const hours = [];
                
                for (let h = Math.floor(startHour); h <= Math.floor(endHour); h++) {
                  const period = h >= 12 ? 'PM' : 'AM';
                  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
                  hours.push(`${displayHour} ${period}`);
                }
                
                const maxHeight = isMobile ? 720 : 900; // Increased height: 80-100px per hour
                const height = getProportionalHeight(firstAvailableDay.timeSlots[0], maxHeight);
                const hourHeight = height / (endHour - startHour);
                
                return hours.map((hour, idx) => (
                  <div 
                    key={idx} 
                    className={`text-[#a8a195] ${isMobile ? 'text-xs' : 'text-sm'} pr-2 flex-shrink-0`}
                    style={{ height: `${hourHeight}px`, lineHeight: `${hourHeight}px` }}
                  >
                    {hour}
                  </div>
                ));
              })()}
            </div>

            {/* Days grid */}
            <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-7'} flex-1`}>
              {weekData.map((day, i) => {
                const maxHeight = isMobile ? 720 : 900; // Increased height for better visibility
                const height = day.available ? getProportionalHeight(day.timeSlots[0], maxHeight) : maxHeight;
                const isLastDay = i === weekData.length - 1;
                const totalMinutes = getDayTotalMinutes(i);
                const dayEvents = events.filter(ev => ev.dayIndex === i);
                
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                    className={`flex flex-col items-center ${!isLastDay ? 'border-r border-[#d4cfbe]/30' : ''}`}
                  >
                    <span className={`text-[#a8a195] mb-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      {day.dayName} {formatDate(day.date)}
                    </span>
                    {day.available ? (
                      <div 
                        ref={el => dayRefs.current[i] = el}
                        className="w-full bg-green-500/70 relative cursor-crosshair select-none"
                        style={{ height: `${height}px` }}
                        onMouseDown={(e) => !isMobile && handleMouseDown(e, i)}
                        onMouseMove={(e) => !isMobile && handleCalendarMouseMove(e, i)}
                        onMouseLeave={handleCalendarMouseLeave}
                        onTouchStart={(e) => isMobile && handleTouchStart(e, i)}
                        onTouchEnd={handleTouchEnd}
                        onClick={(e) => {
                          // If clicking on calendar background (not an event), unfocus
                          if (focusedEventId && e.target === e.currentTarget) {
                            setFocusedEventId(null);
                          }
                        }}
                      >
                        {/* Hover Time Indicator */}
                        {hoveredDayIndex === i && !isCreating && !dragEventId && (
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
                                const startHours = parseTimeToHours(timeSlot.start);
                                const totalHours = startHours + (hoverTimeMinutes / 60);
                                const hours = Math.floor(totalHours);
                                const mins = Math.round((totalHours - hours) * 60);
                                const period = hours >= 12 ? 'PM' : 'AM';
                                const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
                                return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
                              })()}
                            </div>
                          </div>
                        )}

                        {/* Events */}
                        <AnimatePresence>
                          {dayEvents.map(event => {
                            const top = minutesToPixels(event.startMinutes, height, totalMinutes);
                            const eventHeight = minutesToPixels(event.durationMinutes, height, totalMinutes);
                            const isFocused = focusedEventId === event.id;
                            
                            return (
                              <motion.div
                                key={event.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="absolute left-1 right-1 rounded-md shadow-lg cursor-move"
                                style={{
                                  top: `${top}px`,
                                  height: `${eventHeight}px`,
                                  backgroundColor: event.color,
                                  border: isFocused ? '2px solid white' : 'none',
                                  zIndex: isFocused ? 10 : 1,
                                  touchAction: 'none' // Prevent default touch behaviors like scrolling
                                }}
                                onMouseDown={(e) => !isMobile && handleEventMouseDown(e, event.id, 'move')}
                                onTouchStart={(e) => {
                                  if (isMobile) {
                                    e.preventDefault(); // Prevent scrolling immediately
                                    handleEventTouchStart(e, event.id, 'move');
                                  }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFocusedEventId(event.id);
                                }}
                              >
                                {/* Event content */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-2 pointer-events-none gap-0.5">
                                  <div className="truncate max-w-full text-sm">{event.title}</div>
                                  <div className="text-xs opacity-90">
                                    {event.durationMinutes}m
                                  </div>
                                </div>

                                {/* Resize handle - Top */}
                                <AnimatePresence>
                                  {isFocused && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0 }}
                                      className={`absolute -top-2 left-1/2 -translate-x-1/2 bg-white rounded-full cursor-ns-resize shadow-md z-20 ${isMobile ? 'w-8 h-8' : 'w-5 h-5'}`}
                                      style={{ touchAction: 'none' }}
                                      onMouseDown={(e) => !isMobile && handleEventMouseDown(e, event.id, 'resize-top')}
                                      onTouchStart={(e) => {
                                        if (isMobile) {
                                          e.preventDefault();
                                          handleEventTouchStart(e, event.id, 'resize-top');
                                        }
                                      }}
                                    />
                                  )}
                                </AnimatePresence>

                                {/* Resize handle - Bottom */}
                                <AnimatePresence>
                                  {isFocused && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0 }}
                                      className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white rounded-full cursor-ns-resize shadow-md z-20 ${isMobile ? 'w-8 h-8' : 'w-5 h-5'}`}
                                      style={{ touchAction: 'none' }}
                                      onMouseDown={(e) => !isMobile && handleEventMouseDown(e, event.id, 'resize-bottom')}
                                      onTouchStart={(e) => {
                                        if (isMobile) {
                                          e.preventDefault();
                                          handleEventTouchStart(e, event.id, 'resize-bottom');
                                        }
                                      }}
                                    />
                                  )}
                                </AnimatePresence>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <div className="w-full bg-[#e8e4d9]/50" style={{ height: `${height}px` }} />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Focused Event Actions */}
          <AnimatePresence>
            {focusedEventId && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-2 bg-white/95 backdrop-blur-md px-3 py-3 rounded-full shadow-xl border border-[#d4cfbe]/40 z-50"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDeleteEvent}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 h-9 w-9"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleExpandEvent}
                  className="text-[#8b8475] hover:bg-[#e8e4d9]/60 h-9 w-9"
                >
                  <Expand className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFocusedEventId(null)}
                  className="text-[#a8a195] hover:bg-[#e8e4d9]/60 h-9 w-9"
                >
                  <span className="text-lg">✕</span>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hold to Create Tooltip */}
          <AnimatePresence>
            {showHoldTooltip && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="fixed top-20 left-1/2 -translate-x-1/2 pointer-events-none z-50"
              >
                <div className="bg-[#8b8475] text-white px-4 py-2 rounded-lg shadow-lg text-xs whitespace-nowrap">
                  Keep holding to create event
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent className="bg-[#f5f3ef] border-[#d4cfbe]/40">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-[#8b8475]">Delete Event</AlertDialogTitle>
                <AlertDialogDescription className="text-[#a8a195]">
                  Are you sure you want to delete this event? This action cannot be undone.
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
        </motion.div>
      </div>
    </motion.div>
  );
}
