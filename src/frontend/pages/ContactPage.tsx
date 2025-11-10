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

interface Message {
  id: string;
  text: string;
  isAi: boolean;
  timestamp: Date;
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

const QUESTIONS = [
  "Welcome! I'm here to help you build your dream software system. What type of project are you looking to create?",
  "What's the main problem you're trying to solve with this software?",
  "Who will be the primary users of your system?",
  "Do you have a specific timeline in mind for this project?",
  "What's your budget range for this project?",
];

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
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

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
    // Only add welcome message once, even in React Strict Mode
    if (!hasInitialized.current && messages.length === 0) {
      hasInitialized.current = true;
      setTimeout(() => {
        addAiMessage(QUESTIONS[0]);
      }, 800);
    }
  }, []);

  const addAiMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `ai-${Date.now()}`,
        text,
        isAi: true,
        timestamp: new Date(),
      },
    ]);
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

    setTimeout(() => {
      if (currentQuestion < QUESTIONS.length - 1) {
        setCurrentQuestion((prev) => prev + 1);
        addAiMessage(QUESTIONS[currentQuestion + 1]);
      } else if (currentQuestion === QUESTIONS.length - 1) {
        addAiMessage(
          "Thank you for sharing! Based on your responses, I'd love to know more. Is there anything specific you'd like to add about your vision?",
        );
        setCurrentQuestion((prev) => prev + 1);
      }
    }, 800);
  };

  const handleSendMessage = (text: string) => {
    if (text.trim()) {
      addUserMessage(text);
    }
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
              showSuggestions={currentQuestion < QUESTIONS.length}
              isCentered={true}
            />
          </div>
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
            showSuggestions={currentQuestion < QUESTIONS.length}
          />
        </>
      )}
    </>
  );
}
