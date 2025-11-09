import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { X, Calendar, Clock, MapPin, Users } from "lucide-react";

import { isPastDateTime } from "../utils/dateHelpers";

export interface EventFormData {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  conferenceData?: boolean;
}

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EventFormData) => void;
  initialData?: Partial<EventFormData>;
  isLoading?: boolean;
  mode: "create" | "edit";
}

export function EventFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
  mode,
}: EventFormModalProps) {
  const [formData, setFormData] = useState<EventFormData>({
    summary: "",
    description: "",
    start: new Date(),
    end: new Date(Date.now() + 3600000), // 1 hour later
    location: "",
    attendees: [],
    conferenceData: true, // Auto-enable Google Meet by default
  });

  const [attendeeEmail, setAttendeeEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form with initial data
  useEffect(() => {
    if (initialData) {
      setFormData({
        summary: initialData.summary || "",
        description: initialData.description || "",
        start: initialData.start || new Date(),
        end: initialData.end || new Date(Date.now() + 3600000),
        location: initialData.location || "",
        attendees: initialData.attendees || [],
        conferenceData: true, // Always add Google Meet
      });
    }
  }, [initialData, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.summary.trim()) {
      newErrors.summary = "Title is required";
    }

    // Check if start time is in the past (only for new events)
    if (mode === "create" && isPastDateTime(formData.start)) {
      newErrors.start = "Cannot create events in the past";
    }

    if (formData.end <= formData.start) {
      newErrors.end = "End time must be after start time";
    }

    // Check minimum duration (15 minutes)
    const durationMs = formData.end.getTime() - formData.start.getTime();
    const durationMinutes = durationMs / (1000 * 60);
    if (durationMinutes < 15) {
      newErrors.end = "Event must be at least 15 minutes long";
    }

    // Check maximum duration (8 hours)
    if (durationMinutes > 480) {
      newErrors.end = "Event cannot be longer than 8 hours";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit(formData);
  };

  const handleAddAttendee = () => {
    const email = attendeeEmail.trim();
    if (!email) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrors({ ...errors, attendee: "Invalid email format" });
      return;
    }

    // Check if already added
    if (formData.attendees?.some((a) => a.email === email)) {
      setErrors({ ...errors, attendee: "Email already added" });
      return;
    }

    setFormData({
      ...formData,
      attendees: [...(formData.attendees || []), { email }],
    });
    setAttendeeEmail("");
    setErrors({ ...errors, attendee: "" });
  };

  const handleRemoveAttendee = (email: string) => {
    setFormData({
      ...formData,
      attendees: formData.attendees?.filter((a) => a.email !== email),
    });
  };

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const parseDateTimeLocal = (value: string): Date => {
    return new Date(value);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="bg-[#f5f3ef] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#d4cfbe]/40">
            <h2 className="text-2xl text-[#8b8475]">
              {mode === "create" ? "Create New Event" : "Edit Event"}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-[#a8a195] hover:text-[#8b8475]"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="overflow-y-auto max-h-[calc(90vh-140px)]"
          >
            <div className="p-6 space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="summary" className="text-[#8b8475]">
                  Event Title *
                </Label>
                <Input
                  id="summary"
                  value={formData.summary}
                  onChange={(e) =>
                    setFormData({ ...formData, summary: e.target.value })
                  }
                  placeholder="Team Meeting"
                  className={`bg-white/60 border-[#d4cfbe]/40 ${errors.summary ? "border-red-500" : ""}`}
                />
                {errors.summary && (
                  <p className="text-sm text-red-500">{errors.summary}</p>
                )}
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="start"
                    className="text-[#8b8475] flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Start Time *
                  </Label>
                  <Input
                    id="start"
                    type="datetime-local"
                    value={formatDateTimeLocal(formData.start)}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        start: parseDateTimeLocal(e.target.value),
                      })
                    }
                    className={`bg-white/60 border-[#d4cfbe]/40 ${errors.start ? "border-red-500" : ""}`}
                  />
                  {errors.start && (
                    <p className="text-sm text-red-500">{errors.start}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="end"
                    className="text-[#8b8475] flex items-center gap-2"
                  >
                    <Clock className="h-4 w-4" />
                    End Time *
                  </Label>
                  <Input
                    id="end"
                    type="datetime-local"
                    value={formatDateTimeLocal(formData.end)}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        end: parseDateTimeLocal(e.target.value),
                      })
                    }
                    className={`bg-white/60 border-[#d4cfbe]/40 ${errors.end ? "border-red-500" : ""}`}
                  />
                  {errors.end && (
                    <p className="text-sm text-red-500">{errors.end}</p>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label
                  htmlFor="location"
                  className="text-[#8b8475] flex items-center gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  Location
                </Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="Conference Room A"
                  className="bg-white/60 border-[#d4cfbe]/40"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-[#8b8475]">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Add event details..."
                  rows={4}
                  className="bg-white/60 border-[#d4cfbe]/40 resize-none"
                />
              </div>

              {/* Attendees */}
              <div className="space-y-2">
                <Label className="text-[#8b8475] flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Attendees
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={attendeeEmail}
                    onChange={(e) => setAttendeeEmail(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" &&
                      (e.preventDefault(), handleAddAttendee())
                    }
                    placeholder="email@example.com"
                    className="bg-white/60 border-[#d4cfbe]/40"
                  />
                  <Button
                    type="button"
                    onClick={handleAddAttendee}
                    variant="outline"
                    className="bg-[#e8e4d9]/60 hover:bg-[#8b8475] text-[#8b8475] hover:text-[#f5f3ef] border-[#d4cfbe]/40"
                  >
                    Add
                  </Button>
                </div>
                {errors.attendee && (
                  <p className="text-sm text-red-500">{errors.attendee}</p>
                )}

                {/* Attendee chips */}
                {formData.attendees && formData.attendees.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.attendees.map((attendee) => (
                      <div
                        key={attendee.email}
                        className="flex items-center gap-2 bg-[#8b8475]/10 text-[#8b8475] px-3 py-1 rounded-full text-sm"
                      >
                        <span>{attendee.email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttendee(attendee.email)}
                          className="hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Google Meet - Always enabled, no UI needed */}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[#d4cfbe]/40 bg-[#e8e4d9]/30">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="bg-white/60 hover:bg-[#e8e4d9]/60 text-[#8b8475] border-[#d4cfbe]/40"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-[#8b8475] hover:bg-[#6b6558] text-[#f5f3ef]"
              >
                {isLoading
                  ? "Saving..."
                  : mode === "create"
                    ? "Create Event"
                    : "Save Changes"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
