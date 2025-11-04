import { useState } from 'react';
import { motion } from 'motion/react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Badge } from './ui/badge';
import { Clock, Video, Sparkles, Calendar as CalendarIcon, ArrowLeft, Trash2, XCircle } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth, isPast, isFuture } from 'date-fns';

export interface EventAttendee {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface Event {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: EventAttendee[];
  meetLink?: string;
  aiSummary: string;
  thumbnail: string;
  location?: string;
  createdBy: string; // User ID of the event creator
}

interface EventsPageProps {
  events: Event[];
  onEventClick: (eventId: string) => void;
  onBack: () => void;
  currentUserId: string;
  onCancelEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onCreateEvent: () => void;
  onQuickGathering: () => void;
}

export function EventsPage({ events, onEventClick, onBack, currentUserId, onCancelEvent, onDeleteEvent, onCreateEvent, onQuickGathering }: EventsPageProps) {
  const [activeFilter, setActiveFilter] = useState<'today' | 'week' | 'month' | 'past'>('today');

  const filterEvents = (filter: 'today' | 'week' | 'month' | 'past') => {
    return events.filter(event => {
      const eventDate = event.startTime;
      
      switch (filter) {
        case 'today':
          return isToday(eventDate) || (isFuture(eventDate) && !isThisWeek(eventDate));
        case 'week':
          return isThisWeek(eventDate) && isFuture(eventDate);
        case 'month':
          return isThisMonth(eventDate) && isFuture(eventDate);
        case 'past':
          return isPast(eventDate) && !isToday(eventDate);
        default:
          return true;
      }
    }).sort((a, b) => {
      // For past events, show most recent first
      if (filter === 'past') {
        return b.startTime.getTime() - a.startTime.getTime();
      }
      // For future events, show soonest first
      return a.startTime.getTime() - b.startTime.getTime();
    });
  };

  const filteredEvents = filterEvents(activeFilter);

  const formatTime = (date: Date) => format(date, 'h:mm a');
  const formatDate = (date: Date) => format(date, 'MMM d, yyyy');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex-1 overflow-hidden flex flex-col py-4 md:py-8 px-4 md:px-8"
    >
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-4"
        >
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-[#8b8475] hover:text-[#8b8475] hover:bg-[#e8e4d9]/60 -ml-2 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
            Back
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-4 md:mb-6"
        >
          <h1 className="text-2xl md:text-3xl text-[#8b8475] mb-2">My Events</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              onClick={onCreateEvent}
              className="bg-[#8b8475] hover:bg-[#6b6558] text-[#f5f3ef] h-9 px-4 text-sm"
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              Create New Event
            </Button>
            {/* TODO future feature <Button
              onClick={onQuickGathering}
              variant="outline"
              className="bg-[#e8e4d9]/60 hover:bg-[#8b8475] text-[#8b8475] hover:text-[#f5f3ef] border-[#d4cfbe]/40 h-9 px-4 text-sm"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Quick Gathering
            </Button> */}
          </div>
        </motion.div>

        {/* Filters */}
        <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as any)} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="bg-[#e8e4d9]/60 border border-[#d4cfbe]/40 mb-4 w-full grid grid-cols-4 h-auto">
            <TabsTrigger 
              value="today" 
              className="data-[state=active]:bg-[#8b8475] data-[state=active]:text-[#f5f3ef] text-xs md:text-sm py-2"
            >
              Today
            </TabsTrigger>
            <TabsTrigger 
              value="week"
              className="data-[state=active]:bg-[#8b8475] data-[state=active]:text-[#f5f3ef] text-xs md:text-sm py-2"
            >
              This Week
            </TabsTrigger>
            <TabsTrigger 
              value="month"
              className="data-[state=active]:bg-[#8b8475] data-[state=active]:text-[#f5f3ef] text-xs md:text-sm py-2"
            >
              This Month
            </TabsTrigger>
            <TabsTrigger 
              value="past"
              className="data-[state=active]:bg-[#8b8475] data-[state=active]:text-[#f5f3ef] text-xs md:text-sm py-2"
            >
              Past
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeFilter} className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full pr-2">
              <div className="space-y-3">
                {filteredEvents.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12 text-[#a8a195]"
                  >
                    No events found for this period
                  </motion.div>
                ) : (
                  filteredEvents.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.4 }}
                    >
                      <Card
                        onClick={() => onEventClick(event.id)}
                        className="bg-white/60 border-[#d4cfbe]/40 hover:shadow-lg transition-all cursor-pointer overflow-hidden"
                      >
                        <div className="flex gap-3 p-3 md:p-4">
                          {/* Thumbnail */}
                          <div className="shrink-0">
                            <div 
                              className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-cover bg-center border-2 border-[#e8e4d9]"
                              style={{ backgroundImage: `url(${event.thumbnail})` }}
                            />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="text-[#8b8475] text-sm md:text-base line-clamp-1">
                                {event.title}
                              </h3>
                              {isFuture(event.startTime) && (
                                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs shrink-0">
                                  Upcoming
                                </Badge>
                              )}
                            </div>

                            {/* Time */}
                            <div className="flex items-center gap-1 text-xs text-[#8b8475] mb-2">
                              <Clock className="h-3 w-3" />
                              <span>{formatTime(event.startTime)} - {formatTime(event.endTime)}</span>
                              <span className="text-[#a8a195] ml-1">• {formatDate(event.startTime)}</span>
                            </div>

                            {/* AI Summary */}
                            <div className="flex items-start gap-1 mb-3">
                              <Sparkles className="h-3 w-3 text-[#8b8475] shrink-0 mt-0.5" />
                              <p className="text-xs text-[#a8a195] line-clamp-2">
                                {event.aiSummary}
                              </p>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between gap-2">
                              {/* Attendees */}
                              <div className="flex items-center -space-x-2">
                                {event.attendees.slice(0, 4).map((attendee) => (
                                  <Avatar key={attendee.id} className="h-6 w-6 border-2 border-white">
                                    <AvatarImage src={attendee.avatar} alt={attendee.name} className="object-cover" />
                                    <AvatarFallback className="bg-[#8b8475] text-white text-xs">
                                      {attendee.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                                {event.attendees.length > 4 && (
                                  <div className="h-6 w-6 rounded-full bg-[#8b8475] border-2 border-white flex items-center justify-center text-xs text-white">
                                    +{event.attendees.length - 4}
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-1">
                                {/* Google Meet Link */}
                                {event.meetLink && (
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(event.meetLink, '_blank');
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 border-blue-200 h-7 px-2 text-xs"
                                  >
                                    <Video className="h-3 w-3 mr-1" />
                                    Join
                                  </Button>
                                )}
                                
                                {/* Delete or Cancel Button */}
                                {event.createdBy === currentUserId ? (
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteEvent(event.id);
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border-red-200 h-7 px-2 text-xs"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCancelEvent(event.id);
                                    }}
                                    size="sm"
                                    variant="outline"
                                    className="bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-700 border-orange-200 h-7 px-2 text-xs"
                                  >
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Cancel
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </motion.div>
  );
}
