import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { PageHelmet } from "../components/PageHelmet";
import { ChatMessage } from "../components/ChatMessage";
import { ChatInput } from "../components/ChatInput";
import {
  Calendar,
  User,
  CalendarDays,
  Expand,
  Trash2,
  Link as LinkIcon,
  Star,
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
import {
  useCalendarEvents,
  useAvailabilities,
  useSetFavoriteAvailability,
} from "../hooks/useBackend";
import { EventFormModal } from "../components/EventFormModal";
import { startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";

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
  onDeleteAvailability: (id: string) => void;
  getTodayEventCount: () => number;
  newEventCount: number;
}

const WELCOME_MESSAGE =
  "Hi! I can help you manage your calendar. Try: 'Meeting tomorrow at 3pm' or 'Delete the team meeting'.";

// Helper functions
const convertBackendSlotsToUI = (
  backendSlots: Array<{
    day_of_week: number;
    start_time: number;
    end_time: number;
  }>,
): Map<number, TimeSlot[]> => {
  const slotsByDay = new Map<number, TimeSlot[]>();

  for (const slot of backendSlots) {
    const startHours = Math.floor(slot.start_time / 60);
    const startMinutes = slot.start_time % 60;
    const endHours = Math.floor(slot.end_time / 60);
    const endMinutes = slot.end_time % 60;

    const formatTime = (hours: number, minutes: number): string => {
      const period = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, "0");
      return `${displayHours}:${displayMinutes} ${period}`;
    };

    const timeSlot: TimeSlot = {
      start: formatTime(startHours, startMinutes),
      end: formatTime(endHours, endMinutes),
    };

    if (!slotsByDay.has(slot.day_of_week)) {
      slotsByDay.set(slot.day_of_week, []);
    }
    slotsByDay.get(slot.day_of_week)!.push(timeSlot);
  }

  return slotsByDay;
};

const getDaysDataFromBackend = (
  startDate: Date,
  count: number,
  backendSlots: Array<{
    day_of_week: number;
    start_time: number;
    end_time: number;
  }>,
): DayAvailability[] => {
  const days: DayAvailability[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const slotsByDay = convertBackendSlotsToUI(backendSlots);

  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dayOfWeek = date.getDay();

    const timeSlots = slotsByDay.get(dayOfWeek) || [];

    days.push({
      date: new Date(date),
      dayName: dayNames[dayOfWeek],
      available: timeSlots.length > 0,
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

const copyAvailabilityLink = async (availabilityId: string) => {
  const baseUrl = window.location.origin;
  const link = `${baseUrl}/availability/${availabilityId}`;

  try {
    // Try modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(link);
      toast.success("Availability link copied!");
    } else {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = link;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (successful) {
        toast.success("Availability link copied!");
      } else {
        throw new Error("Copy command failed");
      }
    }
  } catch (err) {
    console.error("Failed to copy:", err);
    toast.error("Failed to copy link");
  }
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
  onDeleteAvailability,
  getTodayEventCount,
  newEventCount,
}: ContactPageProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState<
    string | null
  >(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  // Get calendar events
  const { data: calendarEvents = [] } = useCalendarEvents();

  // Get full backend availabilities with slots
  const { data: backendAvailabilities = [] } = useAvailabilities(true);

  // Sort availabilities by display_order
  const sortedAvailabilities = useMemo(() => {
    return [...availabilities].sort((a, b) => {
      const aBackend = backendAvailabilities.find((ba: any) => ba.id === a.id);
      const bBackend = backendAvailabilities.find((bb: any) => bb.id === b.id);
      const aOrder = aBackend?.display_order ?? 999;
      const bOrder = bBackend?.display_order ?? 999;
      return aOrder - bOrder;
    });
  }, [availabilities, backendAvailabilities]);

  // Set favorite availability mutation
  const setFavoriteAvailability = useSetFavoriteAvailability();

  // AI Agent integration
  const { processMessage, isProcessing, eventActions } = useAIAgent(
    calendarEvents,
    availabilities,
    messages,
    selectedAvailabilityId,
  );

  // Get Google user avatar from localStorage
  const [userAvatar, setUserAvatar] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const picture =
      localStorage.getItem(AUTH_CONSTANTS.STORAGE_KEY_USER_PICTURE) || "";
    const name =
      localStorage.getItem(AUTH_CONSTANTS.STORAGE_KEY_USER_NAME) || "";

    console.log("🖼️ [ContactPage] Loading user avatar from localStorage:", {
      picture,
      name,
      hasPicture: !!picture,
      pictureLength: picture.length,
      storageKey: AUTH_CONSTANTS.STORAGE_KEY_USER_PICTURE,
      allStorageKeys: Object.keys(localStorage),
    });

    // Test if the picture URL is accessible
    if (picture) {
      const img = new Image();
      img.onload = () => {
        console.log("✅ [ContactPage] Avatar image loaded successfully");
      };
      img.onerror = (error) => {
        console.error("❌ [ContactPage] Failed to load avatar image:", {
          url: picture,
          error,
        });
      };
      img.src = picture;
    }

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
      <PageHelmet title="Chat" />
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
                  {sortedAvailabilities.map((availability) => {
                    const startDate = isMobile
                      ? availability.currentStartDate
                      : getStartOfWeek(availability.currentStartDate);

                    // Find the backend availability data with slots
                    const backendAvail = backendAvailabilities.find(
                      (a: any) => a.id === availability.id,
                    );
                    const backendSlots = backendAvail?.slots || [];

                    const availabilityWeekData = getDaysDataFromBackend(
                      startDate,
                      7,
                      backendSlots,
                    );

                    return (
                      <DropdownMenuItem
                        key={availability.id}
                        className={`flex flex-col gap-2 p-3 cursor-pointer hover:bg-[#e8e4d9]/60 focus:bg-[#e8e4d9]/60 ${
                          selectedAvailabilityId === availability.id
                            ? "bg-[#8b8475]/10 border-l-2 border-[#8b8475]"
                            : ""
                        }`}
                        onSelect={(e) => e.preventDefault()}
                        onClick={() =>
                          setSelectedAvailabilityId(availability.id)
                        }
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span
                            className={`flex-1 truncate ${
                              selectedAvailabilityId === availability.id
                                ? "text-[#8b8475] font-medium"
                                : "text-[#8b8475]"
                            }`}
                          >
                            {availability.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${
                                backendAvailabilities.find(
                                  (a: any) => a.id === availability.id,
                                )?.is_favorite
                                  ? "text-yellow-500"
                                  : "text-[#a8a195]"
                              } hover:text-yellow-500 hover:bg-[#d4cfbe]/40`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setFavoriteAvailability.mutate(availability.id);
                              }}
                              title={
                                backendAvailabilities.find(
                                  (a: any) => a.id === availability.id,
                                )?.is_favorite
                                  ? "Remove from favorites"
                                  : "Set as favorite"
                              }
                            >
                              <Star
                                className={`h-3.5 w-3.5 ${
                                  backendAvailabilities.find(
                                    (a: any) => a.id === availability.id,
                                  )?.is_favorite
                                    ? "fill-current"
                                    : ""
                                }`}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-[#a8a195] hover:text-[#8b8475] hover:bg-[#d4cfbe]/40"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await copyAvailabilityLink(availability.id);
                              }}
                              title="Copy Link"
                            >
                              <LinkIcon className="h-3.5 w-3.5" />
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
                    <AvatarImage
                      src={userAvatar}
                      alt={userName}
                      referrerPolicy="no-referrer"
                    />
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
