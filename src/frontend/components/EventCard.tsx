import { Calendar, Clock, Users } from "lucide-react";
import { format } from "date-fns";
import { CountdownTimer } from "./CountdownTimer";

interface EventCardProps {
  title: string;
  start: Date;
  end: Date;
  attendees?: string[];
  action?: "created" | "updated" | "deleted";
}

export function EventCard({
  title,
  start,
  end,
  attendees,
  action = "created",
}: EventCardProps) {
  const actionColors = {
    created: "bg-green-50 border-green-200 text-green-800",
    updated: "bg-blue-50 border-blue-200 text-blue-800",
    deleted: "bg-red-50 border-red-200 text-red-800",
  };

  const actionText = {
    created: "✓ Event Created",
    updated: "✓ Event Updated",
    deleted: "✓ Event Deleted",
  };

  return (
    <div
      className={`inline-block rounded-lg border p-3 ${action ? actionColors[action] : "bg-[#f5f3ef] border-[#d4cfbe]/40 text-[#6b6558]"} max-w-xs`}
    >
      {action && (
        <div className="text-xs font-medium mb-2">{actionText[action]}</div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <Calendar className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span className="text-sm font-medium">{title}</span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Clock className="h-3 w-3 shrink-0" />
          <span>
            {format(start, "MMM d, h:mm a")} - {format(end, "h:mm a")}
          </span>
        </div>

        {attendees && attendees.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Users className="h-3 w-3 shrink-0" />
            <span>
              {attendees.length} attendee{attendees.length > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Show countdown timer when no action (just displaying event info) */}
        {!action && (
          <div className="mt-2 pt-2 border-t border-[#d4cfbe]/40">
            <CountdownTimer startDate={start} endDate={end} />
          </div>
        )}
      </div>
    </div>
  );
}
