import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  lazy,
  Suspense,
} from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { useQueryClient } from "@tanstack/react-query";
import { backendActor, setAuthenticatedActor } from "./utils/actor";
import {
  useHelloWorld,
  useCalendarEvents,
  useAvailabilities,
  useAvailabilityById,
} from "./hooks/useBackend";
import { useOAuthIdentity } from "./hooks/useOAuthIdentity";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DiagnosticPanel } from "./components/DiagnosticPanel";
import { Button } from "./components/ui/button";

// Eager load critical pages
import { LandingPage } from "./pages/LandingPage";
import { ContactPage } from "./pages/ContactPage";

// Lazy load non-critical pages for code splitting
const AvailabilityPage = lazy(() =>
  import("./pages/AvailabilityPage/index").then((m) => ({
    default: m.AvailabilityPage,
  })),
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const AvatarEditPage = lazy(() =>
  import("./pages/AvatarEditPage").then((m) => ({ default: m.AvatarEditPage })),
);
const EventsPage = lazy(() =>
  import("./pages/EventsPage").then((m) => ({ default: m.EventsPage })),
);
const DeleteConfirmationPage = lazy(() =>
  import("./pages/DeleteConfirmationPage").then((m) => ({
    default: m.DeleteConfirmationPage,
  })),
);
const QuickGatheringPage = lazy(() =>
  import("./pages/QuickGatheringPage").then((m) => ({
    default: m.QuickGatheringPage,
  })),
);

// Loading component for lazy-loaded routes
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f5f3ef] via-[#ebe8e0] to-[#e8e4d9]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
  </div>
);

// Types
interface Availability {
  id: string;
  name: string;
  currentStartDate: Date;
}

interface EventAttendee {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface Event {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: EventAttendee[];
  meetLink?: string;
  aiSummary: string;
  thumbnail: string;
  location?: string;
  createdBy: string;
}

// Helper functions
const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

const CURRENT_USER_ID = "current-user";

function AppContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // OAuth identity hook
  const {
    login: loginWithOAuth,
    logout: logoutOAuth,
    identity,
    isAuthenticated,
    isLoading: authLoading,
  } = useOAuthIdentity();

  // Update backend actor when identity changes
  useEffect(() => {
    if (isAuthenticated && identity) {
      setAuthenticatedActor(identity);

      backendActor
        .get_caller()
        .then(() => {
          return backendActor.get_user_info();
        })
        .then(async () => {
          queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
          queryClient.invalidateQueries({ queryKey: ["availabilities"] });

          // Update profile with Google user data
          const name = localStorage.getItem("ic-user-name") || "";
          const picture = localStorage.getItem("ic-user-picture") || "";

          if (name) setUsername(name);
          if (picture) setUserAvatar(picture);
        })
        .catch(() => {
          // Silently handle error
        });
    }
  }, [isAuthenticated, identity, authLoading, queryClient]);

  // Use React Query to fetch backend data
  useHelloWorld();
  useCalendarEvents(isAuthenticated);
  const { data: backendAvailabilities = [] } =
    useAvailabilities(isAuthenticated);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Track current start dates for each availability (for navigation)
  const [availabilityDates, setAvailabilityDates] = useState<
    Record<string, Date>
  >({});

  // Convert backend availabilities to app format
  const availabilities = useMemo(() => {
    return backendAvailabilities.map((avail: any) => ({
      id: avail.id,
      name: avail.title,
      currentStartDate:
        availabilityDates[avail.id] ||
        (isMobile ? new Date() : getStartOfWeek(new Date())),
    }));
  }, [backendAvailabilities, isMobile, availabilityDates]);

  // Events state
  const [events] = useState<Event[]>([
    {
      id: "1",
      title: "Q4 Strategy Planning Meeting",
      startTime: new Date(2025, 10, 2, 14, 0),
      endTime: new Date(2025, 10, 2, 15, 30),
      attendees: [
        {
          id: "a1",
          name: "Sarah Johnson",
          email: "sarah.j@company.com",
          avatar:
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
        },
        {
          id: "a2",
          name: "Mike Chen",
          email: "mike.c@company.com",
          avatar:
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
        },
        {
          id: "a3",
          name: "Emily Davis",
          email: "emily.d@company.com",
          avatar:
            "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400",
        },
      ],
      meetLink: "https://meet.google.com/abc-defg-hij",
      aiSummary:
        "Quarterly strategy review focusing on revenue targets, market expansion opportunities, and team restructuring for 2026.",
      thumbnail:
        "https://images.unsplash.com/photo-1431540015161-0bf868a2d407?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG1lZXRpbmclMjByb29tfGVufDF8fHx8MTc2MjA1ODY0MHww&ixlib=rb-4.1.0&q=80&w=1080",
      location: "Conference Room A",
      createdBy: "a1",
    },
    {
      id: "2",
      title: "Coffee Chat with Product Team",
      startTime: new Date(2025, 10, 3, 10, 0),
      endTime: new Date(2025, 10, 3, 11, 0),
      attendees: [
        {
          id: "a4",
          name: "Alex Rivera",
          email: "alex.r@company.com",
          avatar:
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
        },
        {
          id: "a5",
          name: "Jessica Wong",
          email: "jessica.w@company.com",
          avatar:
            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
        },
      ],
      meetLink: "https://meet.google.com/xyz-abcd-efg",
      aiSummary:
        "Informal discussion about upcoming product features, user feedback analysis, and brainstorming session for UI improvements.",
      thumbnail:
        "https://images.unsplash.com/photo-1634663071594-d61168cbc8d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBzaG9wJTIwY2FzdWFsfGVufDF8fHx8MTc2MjA1ODY0MHww&ixlib=rb-4.1.0&q=80&w=1080",
      location: "The Local Cafe",
      createdBy: CURRENT_USER_ID,
    },
  ]);

  const [newEventCount] = useState(2);

  // Mock contacts for quick gathering
  const mockContacts = [
    {
      id: "c1",
      name: "Sarah Johnson",
      email: "sarah.j@company.com",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
      distance: 2.3,
      available: true,
    },
    {
      id: "c2",
      name: "Mike Chen",
      email: "mike.c@company.com",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      distance: 4.1,
      available: true,
    },
    {
      id: "c3",
      name: "Emily Davis",
      email: "emily.d@company.com",
      avatar:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400",
      distance: 1.8,
      available: false,
    },
    {
      id: "c4",
      name: "Alex Rivera",
      email: "alex.r@company.com",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
      distance: 7.2,
      available: true,
    },
    {
      id: "c5",
      name: "Jessica Wong",
      email: "jessica.w@company.com",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400",
      distance: 3.5,
      available: true,
    },
  ];

  // Profile state
  const [username, setUsername] = useState("John Doe");
  const [userAvatar, setUserAvatar] = useState(
    "https://images.unsplash.com/photo-1581065178047-8ee15951ede6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMHBvcnRyYWl0fGVufDF8fHx8MTc2MjAzMzEwMHww&ixlib=rb-4.1.0&q=80&w=400",
  );
  const [description, setDescription] = useState(
    "Building amazing software solutions for businesses.",
  );
  const [avatarImageSrc, setAvatarImageSrc] = useState<string | null>(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // No automatic redirect - homepage handles auth state

  // Handlers
  const handleLogin = async () => {
    const success = await loginWithOAuth("google");
    if (success) {
      toast.success("Successfully authenticated!");
      // Don't navigate - let the homepage re-render with auth state
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    logoutOAuth();
    queryClient.clear();
    toast.success("Logged out successfully!");
    // Navigate to homepage which will show landing page
    navigate("/");
  };

  const handleDeleteAvailability = useCallback(
    (availabilityId: string) => {
      navigate(`/delete-availability/${availabilityId}`);
    },
    [navigate],
  );

  const handleConfirmDeleteAvailability = useCallback(
    async (availabilityId: string) => {
      const availability = availabilities.find((a) => a.id === availabilityId);

      try {
        console.log("[App] 🗑️ Deleting availability:", availabilityId);

        const result = await backendActor.delete_availability(availabilityId);

        if ("Err" in result) {
          console.error("[App] ❌ Delete failed:", result.Err);
          toast.error(`Failed to delete: ${result.Err}`);
          return;
        }

        console.log("[App] ✅ Availability deleted");

        // Invalidate cache to refresh the list
        queryClient.invalidateQueries({ queryKey: ["availabilities"] });

        toast.success(`"${availability?.name}" deleted successfully!`);
        navigate("/");
      } catch (error) {
        console.error("[App] ❌ Delete error:", error);
        toast.error("Failed to delete availability");
      }
    },
    [availabilities, navigate, queryClient],
  );

  const handleAvailabilityPreviousWeek = useCallback(
    (availabilityId: string) => {
      setAvailabilityDates((prev) => {
        const currentDate =
          prev[availabilityId] ||
          (isMobile ? new Date() : getStartOfWeek(new Date()));
        const newDate = new Date(currentDate);
        if (isMobile) {
          // Move back 2 days for mobile
          newDate.setDate(newDate.getDate() - 2);
        } else {
          // Move back 7 days for desktop
          newDate.setDate(newDate.getDate() - 7);
        }
        return { ...prev, [availabilityId]: newDate };
      });
    },
    [isMobile],
  );

  const handleAvailabilityNextWeek = useCallback(
    (availabilityId: string) => {
      setAvailabilityDates((prev) => {
        const currentDate =
          prev[availabilityId] ||
          (isMobile ? new Date() : getStartOfWeek(new Date()));
        const newDate = new Date(currentDate);
        if (isMobile) {
          // Move forward 2 days for mobile
          newDate.setDate(newDate.getDate() + 2);
        } else {
          // Move forward 7 days for desktop
          newDate.setDate(newDate.getDate() + 7);
        }
        return { ...prev, [availabilityId]: newDate };
      });
    },
    [isMobile],
  );

  const handleAvailabilityToday = useCallback(
    (availabilityId: string) => {
      setAvailabilityDates((prev) => {
        const today = isMobile ? new Date() : getStartOfWeek(new Date());
        return { ...prev, [availabilityId]: today };
      });
    },
    [isMobile],
  );

  const isAvailabilityCurrentWeek = useCallback(
    (availabilityId: string) => {
      const availability = availabilities.find((a) => a.id === availabilityId);
      if (!availability) return false;

      if (isMobile) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const current = new Date(availability.currentStartDate);
        current.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor(
          (current.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        return daysDiff >= 0 && daysDiff <= 1;
      } else {
        const todayWeekStart = getStartOfWeek(new Date());
        return (
          availability.currentStartDate.getTime() === todayWeekStart.getTime()
        );
      }
    },
    [availabilities, isMobile],
  );

  // Profile handlers
  const handleUpdateDescription = (desc: string) => {
    setDescription(desc);
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: { x: number; y: number; width: number; height: number },
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height,
    );

    return canvas.toDataURL("image/jpeg");
  };

  const handleSaveAvatar = async (croppedAreaPixels: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    try {
      if (avatarImageSrc && croppedAreaPixels) {
        const croppedImage = await getCroppedImg(
          avatarImageSrc,
          croppedAreaPixels,
        );
        setUserAvatar(croppedImage);
        toast.success("Avatar updated!");
        setAvatarImageSrc(null);
        navigate("/profile");
      }
    } catch (e) {
      toast.error("Failed to update avatar");
    }
  };

  const getTodayEventCount = useCallback(() => {
    return events.filter((event) => {
      const eventDate = event.startTime;
      const today = new Date();
      return (
        eventDate.getDate() === today.getDate() &&
        eventDate.getMonth() === today.getMonth() &&
        eventDate.getFullYear() === today.getFullYear()
      );
    }).length;
  }, [events]);

  // Protected route wrapper
  const ProtectedRoute = useCallback(
    ({ children }: { children: React.ReactNode }) => {
      if (!isAuthenticated && !authLoading) {
        return <Navigate to="/" replace />;
      }
      return <>{children}</>;
    },
    [isAuthenticated, authLoading],
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#f5f3ef] via-[#ebe8e0] to-[#e8e4d9]">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Homepage - Shows Landing or Contact based on auth */}
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <ContactPage
                  availabilities={availabilities}
                  isMobile={isMobile}
                  onDeleteAvailability={handleDeleteAvailability}
                  getTodayEventCount={getTodayEventCount}
                  newEventCount={newEventCount}
                />
              ) : (
                <LandingPage onLogin={handleLogin} />
              )
            }
          />

          {/* Contact Page (Chat) - Redirect to homepage if not authenticated */}
          <Route path="/contact" element={<Navigate to="/" replace />} />

          {/* Availability Page */}
          <Route
            path="/availability/:id"
            element={
              <ProtectedRoute>
                <AvailabilityPageWrapper
                  availabilities={availabilities}
                  isMobile={isMobile}
                  onPreviousWeek={handleAvailabilityPreviousWeek}
                  onNextWeek={handleAvailabilityNextWeek}
                  onToday={handleAvailabilityToday}
                  isCurrentWeek={isAvailabilityCurrentWeek}
                />
              </ProtectedRoute>
            }
          />

          {/* Profile Page */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage
                  username={username}
                  userAvatar={userAvatar}
                  description={description}
                  onLogout={handleLogout}
                  onUpdateDescription={handleUpdateDescription}
                />
              </ProtectedRoute>
            }
          />

          {/* Avatar Edit Page */}
          <Route
            path="/avatar-edit"
            element={
              <ProtectedRoute>
                {avatarImageSrc && (
                  <AvatarEditPage
                    imageSrc={avatarImageSrc}
                    onSave={handleSaveAvatar}
                  />
                )}
              </ProtectedRoute>
            }
          />

          {/* Events Page */}
          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <EventsPage currentUserId={CURRENT_USER_ID} />
              </ProtectedRoute>
            }
          />

          {/* Quick Gathering Page */}
          <Route
            path="/quick-gathering"
            element={
              <ProtectedRoute>
                <QuickGatheringPage contacts={mockContacts} />
              </ProtectedRoute>
            }
          />

          {/* Delete Availability Confirmation */}
          <Route
            path="/delete-availability/:id"
            element={
              <ProtectedRoute>
                <DeleteAvailabilityWrapper
                  availabilities={availabilities}
                  onConfirm={handleConfirmDeleteAvailability}
                />
              </ProtectedRoute>
            }
          />

          {/* Catch all - redirect to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

// Wrapper components to handle URL params
interface AvailabilityPageWrapperProps {
  availabilities: Availability[];
  isMobile: boolean;
  onPreviousWeek: (id: string) => void;
  onNextWeek: (id: string) => void;
  onToday: (id: string) => void;
  isCurrentWeek: (id: string) => boolean;
}

const AvailabilityPageWrapper = memo(function AvailabilityPageWrapper({
  availabilities,
  isMobile,
  onPreviousWeek,
  onNextWeek,
  onToday,
  isCurrentWeek,
}: AvailabilityPageWrapperProps) {
  const { id } = useParams();
  const navigate = useNavigate();

  // Check if this is the user's own availability
  const ownAvailability = availabilities.find((a: Availability) => a.id === id);

  // If not found in user's list, try to fetch from backend (someone else's availability)
  const {
    data: fetchedAvailability,
    isLoading,
    error,
  } = useAvailabilityById(
    id,
    !ownAvailability && !!id, // Only fetch if not in user's list
  );

  // Get current user's availabilities (for mutual availability feature)
  // MUST be called before any conditional returns (React hooks rule)
  const { data: backendAvailabilities = [] } = useAvailabilities();

  // Local state for shared availability navigation (when viewing someone else's availability)
  // FIX: Navigation buttons weren't working in sharing mode because parent state only tracks
  // availabilities in the user's own list. For shared availabilities, we maintain local state.
  const [sharedAvailabilityDate, setSharedAvailabilityDate] = useState<Date>(
    () => (isMobile ? new Date() : getStartOfWeek(new Date())),
  );

  // Determine if viewing someone else's availability
  const isViewingOthers = !ownAvailability && !!fetchedAvailability;

  // Memoize the callback functions to prevent AvailabilityPage from re-rendering
  const handlePreviousWeek = useCallback(() => {
    console.log("[AvailabilityPageWrapper] ⬅️ Previous week clicked, id:", id);
    if (isViewingOthers) {
      // For shared availabilities, update local state
      setSharedAvailabilityDate((prev) => {
        const newDate = new Date(prev);
        if (isMobile) {
          newDate.setDate(newDate.getDate() - 2); // Move back 2 days for mobile
        } else {
          newDate.setDate(newDate.getDate() - 7); // Move back 7 days for desktop
        }
        return newDate;
      });
    } else if (id) {
      // For own availabilities, use parent state management
      onPreviousWeek(id);
    }
  }, [id, isViewingOthers, isMobile, onPreviousWeek]);

  const handleNextWeek = useCallback(() => {
    console.log("[AvailabilityPageWrapper] ➡️ Next week clicked, id:", id);
    if (isViewingOthers) {
      // For shared availabilities, update local state
      setSharedAvailabilityDate((prev) => {
        const newDate = new Date(prev);
        if (isMobile) {
          newDate.setDate(newDate.getDate() + 2); // Move forward 2 days for mobile
        } else {
          newDate.setDate(newDate.getDate() + 7); // Move forward 7 days for desktop
        }
        return newDate;
      });
    } else if (id) {
      // For own availabilities, use parent state management
      onNextWeek(id);
    }
  }, [id, isViewingOthers, isMobile, onNextWeek]);

  const handleToday = useCallback(() => {
    console.log("[AvailabilityPageWrapper] 📍 Today clicked, id:", id);
    if (isViewingOthers) {
      // For shared availabilities, update local state
      const today = isMobile ? new Date() : getStartOfWeek(new Date());
      setSharedAvailabilityDate(today);
    } else if (id) {
      // For own availabilities, use parent state management
      onToday(id);
    }
  }, [id, isViewingOthers, isMobile, onToday]);

  const isCurrentWeekValue = useMemo(() => {
    if (isViewingOthers) {
      // For shared availabilities, check against local state
      if (isMobile) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const current = new Date(sharedAvailabilityDate);
        current.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor(
          (current.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        return daysDiff >= 0 && daysDiff <= 1;
      } else {
        const todayWeekStart = getStartOfWeek(new Date());
        return sharedAvailabilityDate.getTime() === todayWeekStart.getTime();
      }
    }
    return id ? isCurrentWeek(id) : false;
  }, [id, isViewingOthers, isMobile, sharedAvailabilityDate, isCurrentWeek]);

  // Loading state while fetching someone else's availability
  if (!ownAvailability && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f5f3ef] via-[#ebe8e0] to-[#e8e4d9]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-[#8b8475]">Loading availability...</p>
        </div>
      </div>
    );
  }

  // Error state - availability doesn't exist (404)
  if (!ownAvailability && (error || !fetchedAvailability)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f5f3ef] via-[#ebe8e0] to-[#e8e4d9] px-4">
        <div className="text-center max-w-md">
          <h1 className="text-6xl font-bold text-[#8b8475] mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-[#8b8475] mb-4">
            Availability Not Found
          </h2>
          <p className="text-[#a8a195] mb-8">
            The availability you're looking for doesn't exist or has been
            removed.
          </p>
          <Button
            onClick={() => navigate("/")}
            className="bg-[#8b8475] hover:bg-[#6d6659] text-white"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Determine which availability to use
  const availability =
    ownAvailability ||
    (fetchedAvailability
      ? {
          id: fetchedAvailability.id,
          name: fetchedAvailability.title,
          currentStartDate: sharedAvailabilityDate, // Use local state for shared availabilities
        }
      : null);

  if (!availability || !id) {
    return <Navigate to="/" replace />;
  }

  // Get slots and owner info from fetched availability if viewing someone else's
  const slots = fetchedAvailability?.slots;

  // DEBUG: Log the raw response from backend
  console.log(
    "[AvailabilityPageWrapper] 🔍 Raw fetchedAvailability:",
    fetchedAvailability,
  );
  console.log(
    "[AvailabilityPageWrapper] 🔍 All keys:",
    fetchedAvailability ? Object.keys(fetchedAvailability) : "none",
  );

  // Handle Rust Option<String> which might be serialized as [] or [value]
  const rawOwnerEmail = (fetchedAvailability as any)?.owner_email;
  const rawOwnerName = (fetchedAvailability as any)?.owner_name;

  console.log("[AvailabilityPageWrapper] 📧 Raw owner_email:", rawOwnerEmail);
  console.log("[AvailabilityPageWrapper] 📧 Raw owner_name:", rawOwnerName);

  const ownerEmail = Array.isArray(rawOwnerEmail)
    ? rawOwnerEmail.length > 0
      ? rawOwnerEmail[0]
      : undefined
    : rawOwnerEmail;
  const ownerName = Array.isArray(rawOwnerName)
    ? rawOwnerName.length > 0
      ? rawOwnerName[0]
      : undefined
    : rawOwnerName;

  console.log("[AvailabilityPageWrapper] ✅ Processed ownerEmail:", ownerEmail);
  console.log("[AvailabilityPageWrapper] ✅ Processed ownerName:", ownerName);

  // Get current user's first availability for mutual availability feature
  const currentUserAvailability = backendAvailabilities[0]
    ? {
        id: backendAvailabilities[0].id,
        name: backendAvailabilities[0].title,
        slots: backendAvailabilities[0].slots || [],
      }
    : undefined;

  return (
    <AvailabilityPage
      availabilityId={id}
      availabilityName={availability.name}
      currentStartDate={availability.currentStartDate}
      onPreviousWeek={handlePreviousWeek}
      onNextWeek={handleNextWeek}
      onToday={handleToday}
      isCurrentWeek={isCurrentWeekValue}
      isMobile={isMobile}
      availabilitySlots={slots}
      ownerEmail={ownerEmail}
      ownerName={ownerName}
      isViewingOthers={isViewingOthers}
      currentUserAvailability={currentUserAvailability}
    />
  );
});

interface DeleteAvailabilityWrapperProps {
  availabilities: Availability[];
  onConfirm: (id: string) => void;
}

const DeleteAvailabilityWrapper = memo(function DeleteAvailabilityWrapper({
  availabilities,
  onConfirm,
}: DeleteAvailabilityWrapperProps) {
  const navigate = useNavigate();
  const { id } = useParams();
  const availability = availabilities.find((a: Availability) => a.id === id);

  const handleConfirm = useCallback(() => {
    if (id) onConfirm(id);
  }, [id, onConfirm]);

  const handleCancel = useCallback(() => {
    navigate("/");
  }, [navigate]);

  if (!availability || !id) {
    return <Navigate to="/" replace />;
  }

  return (
    <DeleteConfirmationPage
      itemName={availability.name}
      itemType="Availability"
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
});

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster />
        <AppContent />
        {import.meta.env.VITE_DFX_NETWORK == "local" && <DiagnosticPanel />}
      </BrowserRouter>
    </ErrorBoundary>
  );
}
