import { useState } from 'react';
import { motion } from 'motion/react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { 
  Clock, 
  Video, 
  Sparkles, 
  MapPin, 
  Calendar as CalendarIcon,
  Users,
  ArrowLeft,
  ExternalLink,
  Edit,
  Save,
  X,
  Trash2
} from 'lucide-react';
import { format, isFuture, parse } from 'date-fns';
import { Event } from './EventsPage';
import { toast } from 'sonner';

interface EventDetailsPageProps {
  event: Event;
  onBack: () => void;
  onSave?: (updatedEvent: Event) => void;
  backButtonText?: string;
}

export function EventDetailsPage({ event, onBack, onSave, backButtonText = 'Back to Events' }: EventDetailsPageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedEvent, setEditedEvent] = useState<Event>(event);

  const formatTime = (date: Date) => format(date, 'h:mm a');
  const formatDate = (date: Date) => format(date, 'EEEE, MMMM d, yyyy');
  const formatDateInput = (date: Date) => format(date, 'yyyy-MM-dd');
  const formatTimeInput = (date: Date) => format(date, 'HH:mm');

  const handleSave = () => {
    if (!editedEvent.title.trim()) {
      toast.error('Title is required');
      return;
    }
    
    if (onSave) {
      onSave(editedEvent);
      toast.success('Event updated successfully');
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedEvent(event);
    setIsEditing(false);
  };

  const handleDateChange = (dateStr: string) => {
    const currentDate = new Date(dateStr);
    const newStartTime = new Date(currentDate);
    newStartTime.setHours(editedEvent.startTime.getHours(), editedEvent.startTime.getMinutes());
    
    const newEndTime = new Date(currentDate);
    newEndTime.setHours(editedEvent.endTime.getHours(), editedEvent.endTime.getMinutes());
    
    setEditedEvent({
      ...editedEvent,
      startTime: newStartTime,
      endTime: newEndTime
    });
  };

  const handleStartTimeChange = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const newStartTime = new Date(editedEvent.startTime);
    newStartTime.setHours(hours, minutes);
    
    setEditedEvent({
      ...editedEvent,
      startTime: newStartTime
    });
  };

  const handleEndTimeChange = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const newEndTime = new Date(editedEvent.endTime);
    newEndTime.setHours(hours, minutes);
    
    setEditedEvent({
      ...editedEvent,
      endTime: newEndTime
    });
  };

  const handleRemoveAttendee = (attendeeId: string) => {
    setEditedEvent({
      ...editedEvent,
      attendees: editedEvent.attendees.filter(a => a.id !== attendeeId)
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex-1 overflow-y-auto py-4 md:py-8 px-4 md:px-8"
    >
      <div className="max-w-4xl mx-auto">
        {/* Back Button and Edit/Save/Cancel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mb-4 flex items-center justify-between gap-4"
        >
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-[#8b8475] hover:bg-[#e8e4d9]/60 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {backButtonText}
          </Button>

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  onClick={handleCancel}
                  variant="ghost"
                  size="sm"
                  className="text-[#8b8475] hover:bg-[#e8e4d9]/60"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  size="sm"
                  className="bg-[#8b8475] hover:bg-[#757064] text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setIsEditing(true)}
                variant="ghost"
                size="sm"
                className="text-[#8b8475] hover:bg-[#e8e4d9]/60"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </motion.div>

        {/* Event Header Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <Card className="bg-white/60 border-[#d4cfbe]/40 shadow-lg mb-6 overflow-hidden">
            {/* Hero Image */}
            <div 
              className="w-full h-48 md:h-64 bg-cover bg-center"
              style={{ backgroundImage: `url(${event.thumbnail})` }}
            />

            <div className="p-6 md:p-8">
              {/* Title and Status */}
              <div className="flex items-start justify-between gap-4 mb-4">
                {isEditing ? (
                  <Input
                    value={editedEvent.title}
                    onChange={(e) => setEditedEvent({ ...editedEvent, title: e.target.value })}
                    className="text-2xl md:text-3xl text-[#8b8475] border-[#d4cfbe]/40 focus:border-[#8b8475] h-auto py-2"
                    placeholder="Event title"
                  />
                ) : (
                  <h1 className="text-2xl md:text-3xl text-[#8b8475]">
                    {event.title}
                  </h1>
                )}
                {isFuture(event.startTime) && (
                  <Badge className="bg-green-100 text-green-700 border-green-200 shrink-0">
                    Upcoming
                  </Badge>
                )}
              </div>

              {/* Date & Time */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-[#8b8475]">
                  <CalendarIcon className="h-5 w-5 shrink-0" />
                  {isEditing ? (
                    <Input
                      type="date"
                      value={formatDateInput(editedEvent.startTime)}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="border-[#d4cfbe]/40 focus:border-[#8b8475] text-[#8b8475]"
                    />
                  ) : (
                    <span>{formatDate(event.startTime)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[#8b8475]">
                  <Clock className="h-5 w-5 shrink-0" />
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={formatTimeInput(editedEvent.startTime)}
                        onChange={(e) => handleStartTimeChange(e.target.value)}
                        className="border-[#d4cfbe]/40 focus:border-[#8b8475] text-[#8b8475]"
                      />
                      <span>-</span>
                      <Input
                        type="time"
                        value={formatTimeInput(editedEvent.endTime)}
                        onChange={(e) => handleEndTimeChange(e.target.value)}
                        className="border-[#d4cfbe]/40 focus:border-[#8b8475] text-[#8b8475]"
                      />
                    </div>
                  ) : (
                    <span>{formatTime(event.startTime)} - {formatTime(event.endTime)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[#8b8475]">
                  <MapPin className="h-5 w-5 shrink-0" />
                  {isEditing ? (
                    <Input
                      value={editedEvent.location || ''}
                      onChange={(e) => setEditedEvent({ ...editedEvent, location: e.target.value })}
                      className="border-[#d4cfbe]/40 focus:border-[#8b8475] text-[#8b8475]"
                      placeholder="Add location"
                    />
                  ) : (
                    <span>{event.location || 'No location'}</span>
                  )}
                </div>
              </div>

              {/* Google Meet Link */}
              {event.meetLink && (
                <Button
                  onClick={() => window.open(event.meetLink, '_blank')}
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white mb-6"
                >
                  <Video className="h-4 w-4 mr-2" />
                  Join Google Meet
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              )}

              <Separator className="mb-6 bg-[#d4cfbe]/40" />

              {/* AI Summary / Description */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-[#8b8475]" />
                  <h2 className="text-lg text-[#8b8475]">
                    {isEditing ? 'Description' : 'AI Summary'}
                  </h2>
                </div>
                <div className="bg-[#f5f3ef]/50 border border-[#d4cfbe]/40 rounded-xl p-4 md:p-6">
                  {isEditing ? (
                    <Textarea
                      value={editedEvent.aiSummary}
                      onChange={(e) => setEditedEvent({ ...editedEvent, aiSummary: e.target.value })}
                      className="min-h-[200px] border-[#d4cfbe]/40 focus:border-[#8b8475] text-[#8b8475] resize-none"
                      placeholder="Add description"
                    />
                  ) : (
                    <div className="text-[#8b8475] leading-relaxed whitespace-pre-line space-y-4">
                      {event.aiSummary.split('\n\n').map((section, index) => (
                        <div key={index}>
                          {section.split('\n').map((line, lineIndex) => {
                            const isBullet = line.trim().startsWith('•');
                            const isHeading = line.endsWith(':') && !isBullet && line.length < 50;
                            
                            if (isHeading) {
                              return (
                                <p key={lineIndex} className="text-[#8b8475] mb-2 mt-3 first:mt-0">
                                  {line}
                                </p>
                              );
                            } else if (isBullet) {
                              return (
                                <p key={lineIndex} className="text-[#8b8475]/90 ml-2 mb-1.5">
                                  {line}
                                </p>
                              );
                            } else if (line.trim()) {
                              return (
                                <p key={lineIndex} className="text-[#8b8475]/90">
                                  {line}
                                </p>
                              );
                            }
                            return null;
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Separator className="mb-6 bg-[#d4cfbe]/40" />

              {/* Attendees */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-[#8b8475]" />
                  <h2 className="text-lg text-[#8b8475]">
                    Attendees ({isEditing ? editedEvent.attendees.length : event.attendees.length})
                  </h2>
                </div>

                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {(isEditing ? editedEvent.attendees : event.attendees).map((attendee) => (
                      <motion.div
                        key={attendee.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card className="p-4 bg-[#f5f3ef]/50 border-[#d4cfbe]/40">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 border-2 border-[#e8e4d9]">
                              <AvatarImage src={attendee.avatar} alt={attendee.name} className="object-cover" />
                              <AvatarFallback className="bg-[#8b8475] text-white">
                                {attendee.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-[#8b8475]">{attendee.name}</p>
                              <p className="text-sm text-[#a8a195] truncate">{attendee.email}</p>
                            </div>
                            {isEditing && (
                              <Button
                                onClick={() => handleRemoveAttendee(attendee.id)}
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
