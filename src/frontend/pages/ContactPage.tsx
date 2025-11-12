import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { ChatMessage } from "../components/ChatMessage";
import { ChatInput } from "../components/ChatInput";
import {
  Calendar,
  User,
  CalendarDays,
  Share2,
  Expand,
  Trash2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { AUTH_CONSTANTS } from "../utils/authConstants";
import { useAIAgent } from "../hooks/useAIAgent";
import { useCalendarEvents } from "../hooks/useBackend";
import { EventFormModal } from "../components/EventFormModal";
import { startOfDay, endOfDay } from "date-fns";

// Define EventCardData locally since it's not exported from ChatMessage
type EventCardData = {
  title: string;
  start: Date;
  end: Date;
  attendees?: string[];
  action?: "created" | "updated" | "deleted";
};

interface Message {
  id: string;
  text: string;
  isAi: boolean;
  timestamp: Date;
  eventCard?: EventCardData;
  eventCards?: EventCardData[];
}

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

interface Availability {
  id: string;
  name: string;
  currentStartDate: Date;
}

interface ContactPageProps {
  availabilities: Availability[];
  isMobile: boolean;
  onShareAvailability: (id: string) => void;
  onDeleteAvailability: (id: string) => void;
  getTodayEventCount: () => number;
  newEventCount: number;
}

const WELCOME_MESSAGE =
  "Hi! I can help you manage your calendar. Try: 'Meeting tomorrow at 3pm' or 'Delete the team meeting'.";

// Helper functions
const getDaysData = (startDate: Date, count: number): DayAvailability[] => {
  const days: DayAvailability[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dayOfWeek = date.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

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

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

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

const calculateDuration = (timeSlot: TimeSlot): number => {
  const startHours = parseTimeToHours(timeSlot.start);
  const endHours = parseTimeToHours(timeSlot.end);
  return endHours - startHours;
};

const getProportionalHeight = (
  timeSlot: TimeSlot,
  maxHeightPx: number,
): number => {
  const duration = calculateDuration(timeSlot);
  const maxDuration = 9;
  return Math.round((duration / maxDuration) * maxHeightPx);
};

export function ContactPage({
  availabilities,
  isMobile,
  onShareAvailability,
  onDeleteAvailability,
  getTodayEventCount,
  newEventCount,
}: ContactPageProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  // Get calendar events
  const { data: calendarEvents = [] } = useCalendarEvents();

  // AI Agent integration
  const { processMessage, isProcessing, eventActions } = useAIAgent(
    calendarEvents,
    availabilities,
    messages,
  );

  // Get Google user avatar from localStorage
  const [userAvatar, setUserAvatar] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const picture =
      localStorage.getItem(AUTH_CONSTANTS.STORAGE_KEY_USER_PICTURE) || "";
    const name =
      localStorage.getItem(AUTH_CONSTANTS.STORAGE_KEY_USER_NAME) || "";
    setUserAvatar(picture);
    setUserName(name);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Only add welcome message once
    if (!hasInitialized.current && messages.length === 0) {
      hasInitialized.current = true;
      setTimeout(() => {
        // Check if there are events today
        const today = new Date();
        const todayStart = startOfDay(today);
        const todayEnd = endOfDay(today);

        const todayEvents = calendarEvents.filter((event) => {
          if (!event.start?.dateTime) return false;
          const eventStart = new Date(event.start.dateTime);
          return eventStart >= todayStart && eventStart <= todayEnd;
        });

        if (todayEvents.length > 0) {
          // Show the first event with countdown
          const firstEvent = todayEvents[0];
          const eventStart = new Date(firstEvent.start!.dateTime!);
          const eventEnd = new Date(firstEvent.end!.dateTime!);

          addAiMessage(
            `You have ${todayEvents.length} event${todayEvents.length > 1 ? "s" : ""} today. Here's your next one:`,
            [],
            {
              title: firstEvent.summary || "Untitled Event",
              start: eventStart,
              end: eventEnd,
              action: undefined,
            },
          );
        } else {
          addAiMessage(WELCOME_MESSAGE);
        }
      }, 800);
    }
  }, [calendarEvents]);

  const addAiMessage = (
    text: string,
    suggestions: string[] = [],
    eventCard?: any,
    eventCards?: any[],
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}`,
        text,
        isAi: true,
        timestamp: new Date(),
        eventCard,
        eventCards,
      },
    ]);
    setCurrentSuggestions(suggestions);
  };

  const addUserMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        text,
        isAi: false,
        timestamp: new Date(),
      },
    ]);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) {
      return;
    }

    addUserMessage(text);
    setCurrentSuggestions([]);

    const response = await processMessage(text);

    // Create event cards from actions
    const createEventCard = (action: any) => {
      if (action.type === "ADD_EVENT" && action.start && action.end) {
        return {
          title: action.title || "New Event",
          start: new Date(action.start),
          end: new Date(action.end),
          attendees: action.attendees,
          action: "created" as const,
        };
      } else if (action.type === "UPDATE_EVENT" && action.changes) {
        return {
          title: action.changes.title || action.event_title || "Event",
          start: action.changes.start
            ? new Date(action.changes.start)
            : new Date(),
          end: action.changes.end ? new Date(action.changes.end) : new Date(),
          attendees: action.changes.attendees,
          action: "updated" as const,
        };
      } else if (action.type === "DELETE_EVENT") {
        return {
          title: action.event_title || "Event",
          start: new Date(),
          end: new Date(),
          action: "deleted" as const,
        };
      }
      return null;
    };

    let eventCard: EventCardData | null = null;
    let eventCards: EventCardData[] | undefined;

    // Handle multiple actions
    if (response.actions && response.actions.length > 0) {
      eventCards = response.actions
        .map(createEventCard)
        .filter((card): card is NonNullable<typeof card> => card !== null);
    } else if (response.action) {
      // Single action
      eventCard = createEventCard(response.action);
    }

    // Add AI response message
    addAiMessage(
      response.feedback,
      response.suggestions,
      eventCard || undefined,
      eventCards,
    );
  };

  // Check if user has sent any messages
  const hasUserMessages = messages.some((msg) => !msg.isAi);

  return (
    <>
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="shrink-0 bg-[#f5f3ef]/80 backdrop-blur-md border-b border-[#d4cfbe]/30 px-4 md:px-8 py-4"
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="bg-[#e8e4d9]/60 hover:bg-[#8b8475] text-[#8b8475] hover:text-[#f5f3ef] border-[#d4cfbe]/40 transition-all duration-300 h-8 md:h-10 px-2 md:px-4 text-xs md:text-sm"
                  >
                    <Calendar className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
                    <span className="hidden sm:inline">Availabilities</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 bg-[#f5f3ef] border-[#d4cfbe]/40">
                  {availabilities.map((availability) => {
                    const startDate = isMobile
                      ? availability.currentStartDate
                      : getStartOfWeek(availability.currentStartDate);
                    const availabilityWeekData = getDaysData(startDate, 7);

                    return (
                      <DropdownMenuItem
                        key={availability.id}
                        className="flex flex-col gap-2 p-3 cursor-pointer hover:bg-[#e8e4d9]/60 focus:bg-[#e8e4d9]/60"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="text-[#8b8475] flex-1 truncate">
                            {availability.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-[#a8a195] hover:text-[#8b8475] hover:bg-[#d4cfbe]/40"
                              onClick={(e) => {
                                e.stopPropagation();
                                onShareAvailability(availability.id);
                              }}
                              title="Share"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-[#a8a195] hover:text-[#8b8475] hover:bg-[#d4cfbe]/40"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/availability/${availability.id}`);
                              }}
                              title="Expand"
                            >
                              <Expand className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-[#a8a195] hover:text-red-500 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteAvailability(availability.id);
                              }}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Mini Column Chart */}
                        <motion.div
                          className="flex items-end gap-0.5 h-12 w-full px-1 mt-3"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                          {availabilityWeekData.map((day, idx) => {
                            const maxHeight = 48;
                            const height =
                              day.available && day.timeSlots.length > 0
                                ? getProportionalHeight(
                                    day.timeSlots[0],
                                    maxHeight,
                                  )
                                : 0;

                            return (
                              <motion.div
                                key={idx}
                                className="flex-1 flex flex-col items-center justify-end gap-0.5"
                                initial={{
                                  opacity: 0,
                                  scale: 0.8,
                                  y: 20,
                                }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{
                                  duration: 0.5,
                                  delay: idx * 0.08,
                                  ease: "easeOut",
                                  type: "spring",
                                  stiffness: 200,
                                  damping: 15,
                                }}
                              >
                                {height > 0 ? (
                                  <motion.div
                                    className="w-full bg-green-500/70 rounded-sm"
                                    style={{ height: `${height}px` }}
                                    title={`${day.dayName}: ${day.timeSlots[0]?.start} - ${day.timeSlots[0]?.end}`}
                                    initial={{ scaleY: 0, originY: 1 }}
                                    animate={{ scaleY: 1 }}
                                    transition={{
                                      duration: 0.6,
                                      delay: idx * 0.08 + 0.2,
                                      ease: "easeOut",
                                      type: "spring",
                                      stiffness: 150,
                                      damping: 12,
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-0" />
                                )}
                                <motion.span
                                  className="text-[9px] text-[#a8a195]"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{
                                    duration: 0.3,
                                    delay: idx * 0.08 + 0.4,
                                  }}
                                >
                                  {day.dayName[0]}
                                </motion.span>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator className="bg-[#d4cfbe]/40" />
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={() => navigate("/events")}
                variant="outline"
                className="bg-[#e8e4d9]/60 hover:bg-[#8b8475] text-[#8b8475] hover:text-[#f5f3ef] border-[#d4cfbe]/40 transition-all duration-300 relative h-8 md:h-10 px-2 md:px-4 text-xs md:text-sm"
              >
                <CalendarDays className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
                <span className="hidden sm:inline">Events</span>
                {getTodayEventCount() > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 md:ml-2 bg-[#8b8475] text-[#f5f3ef] hover:bg-[#8b8475] h-4 md:h-5 px-1 md:px-1.5 min-w-[16px] md:min-w-[20px] flex items-center justify-center text-[9px] md:text-[10px]"
                  >
                    {getTodayEventCount()}
                  </Badge>
                )}
                {newEventCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 h-4 w-4 md:h-5 md:w-5 bg-red-500 rounded-full flex items-center justify-center text-[9px] md:text-[10px] text-white shadow-lg">
                    {newEventCount}
                  </span>
                )}
              </Button>

              <Button
                onClick={() => navigate("/profile")}
                variant="outline"
                className="bg-[#e8e4d9]/60 hover:bg-[#8b8475] text-[#8b8475] hover:text-[#f5f3ef] border-[#d4cfbe]/40 transition-all duration-300 h-8 md:h-10 px-2 md:px-4 text-xs md:text-sm flex items-center gap-2"
              >
                {userAvatar ? (
                  <Avatar className="h-5 w-5 md:h-6 md:w-6">
                    <AvatarImage src={userAvatar} alt={userName} />
                    <AvatarFallback className="bg-[#8b8475] text-white text-xs">
                      {userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <User className="h-3 w-3 md:h-4 md:w-4" />
                )}
                <span className="hidden sm:inline">Profile</span>
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Messages and Input - Centered when no user messages */}
      {!hasUserMessages ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isInputFocused ? 0.7 : 1 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-4xl space-y-6"
          >
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isHovered={hoveredId === message.id}
                onHover={setHoveredId}
                isOtherHovered={hoveredId !== null && hoveredId !== message.id}
              />
            ))}
          </motion.div>

          <div className="w-full max-w-4xl mt-8">
            <ChatInput
              onSendMessage={handleSendMessage}
              onFocusChange={setIsInputFocused}
              showSuggestions={currentSuggestions.length > 0}
              suggestions={currentSuggestions}
              isCentered={true}
            />
          </div>

          {/* Event Form Modal */}
          <EventFormModal
            isOpen={eventActions.isFormOpen}
            onClose={eventActions.closeForm}
            onSubmit={eventActions.handleFormSubmit}
            initialData={eventActions.formInitialData}
            mode={eventActions.editingEventId ? "edit" : "create"}
          />
        </div>
      ) : (
        <>
          {/* Messages */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isInputFocused ? 0.7 : 1 }}
            transition={{ duration: 0.3 }}
            className="flex-1 overflow-y-auto px-4 md:px-8 py-8"
          >
            <div className="max-w-4xl mx-auto space-y-6 pb-8">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isHovered={hoveredId === message.id}
                  onHover={setHoveredId}
                  isOtherHovered={
                    hoveredId !== null && hoveredId !== message.id
                  }
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </motion.div>

          {/* Input */}
          <ChatInput
            onSendMessage={handleSendMessage}
            onFocusChange={setIsInputFocused}
            showSuggestions={currentSuggestions.length > 0}
            suggestions={currentSuggestions}
          />

          {/* Event Form Modal */}
          <EventFormModal
            isOpen={eventActions.isFormOpen}
            onClose={eventActions.closeForm}
            onSubmit={eventActions.handleFormSubmit}
            initialData={eventActions.formInitialData}
            mode={eventActions.editingEventId ? "edit" : "create"}
          />
        </>
      )}
    </>
  );
}
