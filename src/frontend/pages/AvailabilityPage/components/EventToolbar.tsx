import { memo } from "react";
import { motion } from "motion/react";
import { Button } from "../../../components/ui/button";
import { Trash2, Video, Edit, Check, X } from "lucide-react";
import { AvailabilityEvent } from "../types";

interface GoogleCalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
  self?: boolean;
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  attendees?: GoogleCalendarAttendee[];
  organizer?: {
    email: string;
    self?: boolean;
  };
  creator?: {
    email: string;
    self?: boolean;
  };
}

interface EventToolbarProps {
  focusedEvent: AvailabilityEvent | undefined;
  googleEvent: GoogleCalendarEvent | undefined;
  isPast: boolean;
  isMobile: boolean;
  currentUserEmail?: string;
  onEdit: () => void;
  onDelete: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}

export const EventToolbar = memo(function EventToolbar({
  focusedEvent,
  googleEvent,
  isPast,
  isMobile,
  currentUserEmail,
  onEdit,
  onDelete,
  onAccept,
  onDecline,
  onClose,
}: EventToolbarProps) {
  if (!focusedEvent) return null;

  const isCalendarEvent = focusedEvent.isFromCalendar;

  // Check if this is an invitation that hasn't been accepted yet
  const currentUserAttendee = googleEvent?.attendees?.find(
    (attendee) => attendee.self || attendee.email === currentUserEmail,
  );
  const isInvitation = currentUserAttendee && !googleEvent?.organizer?.self;
  const isPendingInvitation =
    isInvitation &&
    (currentUserAttendee.responseStatus === "needsAction" ||
      !currentUserAttendee.responseStatus);
  const isAccepted = currentUserAttendee?.responseStatus === "accepted";

  // Get attendee stats for ALL participants (organizer and invitees see the same info)
  const attendees = googleEvent?.attendees || [];

  let attendeeStats = null;
  if (attendees.length > 1) {
    // Organizer is automatically considered accepted
    const isAcceptedAttendee = (a: GoogleCalendarAttendee) =>
      a.responseStatus === "accepted" ||
      googleEvent?.organizer?.email === a.email;

    // Show stats for all attendees
    const accepted = attendees.filter((a) => isAcceptedAttendee(a)).length;
    const declined = attendees.filter(
      (a) => a.responseStatus === "declined",
    ).length;
    const pending = attendees.filter(
      (a) => !isAcceptedAttendee(a) && a.responseStatus !== "declined",
    ).length;

    attendeeStats = { accepted, declined, pending, total: attendees.length };
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md px-3 md:px-4 py-2 md:py-3 rounded-2xl shadow-xl border border-[#d4cfbe]/40 z-50 max-w-[calc(100vw-2rem)] mx-4"
    >
      {/* Attendee stats for organizers */}
      {attendeeStats && (
        <div className="flex items-center gap-2 pr-2 border-r border-[#d4cfbe]/40">
          <div className="flex items-center gap-1 text-xs">
            {attendeeStats.accepted > 0 && (
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                ✓ {attendeeStats.accepted}
              </span>
            )}
            {attendeeStats.pending > 0 && (
              <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">
                ⏱ {attendeeStats.pending}
              </span>
            )}
            {attendeeStats.declined > 0 && (
              <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                ✕ {attendeeStats.declined}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 md:gap-2">
        {isCalendarEvent && (
          <>
            {/* Show Accept/Decline buttons for pending invitations */}
            {isPendingInvitation && !isPast && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size={isMobile ? "sm" : "default"}
                  onClick={onAccept}
                  className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 md:h-9 px-3 flex-shrink-0 gap-1.5"
                  title="Accept invitation"
                >
                  <Check className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  {!isMobile && "Accept"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size={isMobile ? "sm" : "default"}
                  onClick={onDecline}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 md:h-9 px-3 flex-shrink-0 gap-1.5"
                  title="Decline invitation"
                >
                  <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  {!isMobile && "Decline"}
                </Button>
              </>
            )}

            {/* Show status badge for accepted/declined invitations */}
            {isInvitation && !isPendingInvitation && (
              <div
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  isAccepted
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {isAccepted ? "✓ Accepted" : "Declined"}
              </div>
            )}

            {/* Show Edit/Delete buttons for own events or accepted invitations */}
            {(!isInvitation || isAccepted) && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onEdit}
                  disabled={isPast}
                  className="text-[#8b8475] hover:text-[#6b6558] hover:bg-[#e8e4d9]/60 h-8 w-8 md:h-9 md:w-9 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  title={isPast ? "Cannot edit past events" : "Edit event"}
                >
                  <Edit className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 md:h-9 md:w-9 flex-shrink-0"
                  title="Delete event"
                >
                  <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </Button>
              </>
            )}

            {/* Show Google Meet link if available */}
            {focusedEvent.meetLink && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => window.open(focusedEvent.meetLink, "_blank")}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 md:h-9 md:w-9 flex-shrink-0"
                title="Join Google Meet"
              >
                <Video className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            )}
          </>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-[#a8a195] hover:bg-[#e8e4d9]/60 h-8 w-8 md:h-9 md:w-9 flex-shrink-0"
          title="Close"
        >
          <span className="text-base md:text-lg">✕</span>
        </Button>
      </div>
    </motion.div>
  );
});
