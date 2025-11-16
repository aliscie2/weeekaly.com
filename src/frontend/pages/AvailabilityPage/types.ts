export interface TimeSlot {
  start: string;
  end: string;
}

export interface DayAvailability {
  date: Date;
  dayName: string;
  available: boolean;
  timeSlots: TimeSlot[];
}

export interface AvailabilityEvent {
  id: string;
  dayIndex: number;
  startMinutes: number;
  durationMinutes: number;
  title: string;
  color: string;
  isFromCalendar?: boolean;
  meetLink?: string;
  invitationStatus?: "accepted" | "pending" | "declined" | "mixed";
  isBlocked?: boolean;
}

export interface AvailabilityPageProps {
  availabilityId: string;
  availabilityName: string;
  currentStartDate: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  isCurrentWeek: boolean;
  isMobile: boolean;
  availabilitySlots?: Array<{
    day_of_week: number;
    start_time: number;
    end_time: number;
  }>;
  ownerEmail?: string;
  ownerName?: string;
  isViewingOthers?: boolean;
  currentUserAvailability?: {
    id: string;
    name: string;
    slots: Array<{
      day_of_week: number;
      start_time: number;
      end_time: number;
    }>;
  };
}
