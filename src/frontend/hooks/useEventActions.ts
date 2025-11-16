import { useState } from "react";
import { toast } from "sonner";
import { useCreateEvent, useUpdateEvent, useDeleteEvent } from "./useBackend";
import type { EventFormData } from "../components/EventFormModal";

/**
 * Reusable hook for event CRUD operations
 * Provides consistent behavior across Events Page and Availability Page
 */
export function useEventActions() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formInitialData, setFormInitialData] = useState<
    Partial<EventFormData> | undefined
  >();

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  /**
   * Open form to create a new event
   */
  const openCreateForm = (initialData?: Partial<EventFormData>) => {
    setEditingEventId(null);
    setFormInitialData(initialData);
    setIsFormOpen(true);
  };

  /**
   * Open form to edit an existing event
   */
  const openEditForm = (eventId: string, eventData: Partial<EventFormData>) => {
    setEditingEventId(eventId);
    setFormInitialData(eventData);
    setIsFormOpen(true);
  };

  /**
   * Close the form
   */
  const closeForm = () => {
    setIsFormOpen(false);
    setEditingEventId(null);
    setFormInitialData(undefined);
  };

  /**
   * Handle form submission (create or update)
   */
  const handleFormSubmit = (data: EventFormData) => {
    if (editingEventId) {
      // Update existing event
      updateEvent.mutate(
        {
          eventId: editingEventId,
          updates: {
            summary: data.summary,
            description: data.description,
            start: data.start,
            end: data.end,
            location: data.location,
            attendees: data.attendees,
          },
        },
        {
          onSuccess: () => {
            toast.success("Event updated successfully!");
            closeForm();
          },
          onError: (error: Error) => {
            console.error("[useEventActions] ❌ Update failed:", error);
            const errorMessage = error.message || "Unknown error";
            toast.error(`Failed to update event: ${errorMessage}`);
          },
        },
      );
    } else {
      // Create new event
      createEvent.mutate(data, {
        onSuccess: () => {
          toast.success("Event created successfully!");
          closeForm();
        },
        onError: (error: Error) => {
          console.error("[useEventActions] ❌ Create failed:", error);
          const errorMessage = error.message || "Unknown error";
          toast.error(`Failed to create event: ${errorMessage}`);
        },
      });
    }
  };

  /**
   * Delete an event with confirmation
   */
  const handleDeleteEvent = (
    eventId: string,
    eventTitle: string,
    onUndoCallback?: () => void,
  ) => {
    deleteEvent.mutate(eventId, {
      onSuccess: () => {
        // Show toast with undo option
        toast.success(`"${eventTitle}" deleted`, {
          duration: 3000,
          action: onUndoCallback
            ? {
                label: "Undo",
                onClick: onUndoCallback,
              }
            : undefined,
        });
      },
      onError: (error: Error) => {
        console.error("[useEventActions] ❌ Delete failed:", error);
        const errorMessage = error.message || "Unknown error";
        toast.error(`Failed to delete event: ${errorMessage}`);
      },
    });
  };

  /**
   * Cancel attendance (for events user didn't create)
   */
  const handleCancelAttendance = (eventId: string, eventTitle: string) => {
    updateEvent.mutate(
      {
        eventId,
        updates: {
          status: "cancelled",
        },
      },
      {
        onSuccess: () => {
          toast.success(`You cancelled "${eventTitle}"`);
        },
        onError: (error: Error) => {
          console.error("[useEventActions] ❌ Cancel failed:", error);
          const errorMessage = error.message || "Unknown error";
          toast.error(`Failed to cancel: ${errorMessage}`);
        },
      },
    );
  };

  /**
   * Accept an event invitation
   */
  const handleAcceptInvitation = (eventId: string, eventTitle: string) => {
    updateEvent.mutate(
      {
        eventId,
        updates: {
          attendeeResponse: "accepted",
        },
      },
      {
        onSuccess: () => {
          toast.success(`Accepted "${eventTitle}"`);
        },
        onError: (error: Error) => {
          console.error("[useEventActions] ❌ Accept failed:", error);
          const errorMessage = error.message || "Unknown error";
          toast.error(`Failed to accept invitation: ${errorMessage}`);
        },
      },
    );
  };

  /**
   * Decline an event invitation
   */
  const handleDeclineInvitation = (eventId: string, eventTitle: string) => {
    updateEvent.mutate(
      {
        eventId,
        updates: {
          attendeeResponse: "declined",
        },
      },
      {
        onSuccess: () => {
          toast.success(`Declined "${eventTitle}"`);
        },
        onError: (error: Error) => {
          console.error("[useEventActions] ❌ Decline failed:", error);
          const errorMessage = error.message || "Unknown error";
          toast.error(`Failed to decline invitation: ${errorMessage}`);
        },
      },
    );
  };

  return {
    // Form state
    isFormOpen,
    editingEventId,
    formInitialData,
    isLoading:
      createEvent.isPending || updateEvent.isPending || deleteEvent.isPending,

    // Form actions
    openCreateForm,
    openEditForm,
    closeForm,
    handleFormSubmit,

    // Event actions
    handleDeleteEvent,
    handleCancelAttendance,
    handleAcceptInvitation,
    handleDeclineInvitation,

    // Mutation states
    isCreating: createEvent.isPending,
    isUpdating: updateEvent.isPending,
    isDeleting: deleteEvent.isPending,
  };
}
