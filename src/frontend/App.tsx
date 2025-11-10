import { useState, useEffect, useCallback, useMemo, memo } from "react";
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
import { useHelloWorld, useCalendarEvents } from "./hooks/useBackend";
import { useOAuthIdentity } from "./hooks/useOAuthIdentity";

// Pages
import { LandingPage } from "./pages/LandingPage";
import { ContactPage } from "./pages/ContactPage";
import { AvailabilityPage } from "./pages/AvailabilityPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AvatarEditPage } from "./pages/AvatarEditPage";
import { EventsPage } from "./pages/EventsPage";
import { DeleteConfirmationPage } from "./pages/DeleteConfirmationPage";
import { QuickGatheringPage } from "./pages/QuickGatheringPage";

// Types
interface GoogleAccount {
  id: string;
  email: string;
  name: string;
  avatar: string;
  isDefault: boolean;
}

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
        })
        .catch(() => {
          // Silently handle error
        });
    }
  }, [isAuthenticated, identity, authLoading, queryClient]);

  // Use React Query to fetch backend data
  useHelloWorld();
  useCalendarEvents(isAuthenticated);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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

  // Availabilities state
  const [availabilities, setAvailabilities] = useState<Availability[]>([
    {
      id: "1",
      name: "Business Meetings",
      currentStartDate: isMobile ? new Date() : getStartOfWeek(new Date()),
    },
    {
      id: "2",
      name: "Family Meetings",
      currentStartDate: isMobile ? new Date() : getStartOfWeek(new Date()),
    },
  ]);

  // Profile state
  const [username, setUsername] = useState("John Doe");
  const [userAvatar, setUserAvatar] = useState(
    "https://images.unsplash.com/photo-1581065178047-8ee15951ede6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMHBvcnRyYWl0fGVufDF8fHx8MTc2MjAzMzEwMHww&ixlib=rb-4.1.0&q=80&w=400",
  );
  const [description, setDescription] = useState(
    "Building amazing software solutions for businesses.",
  );
  const [avatarImageSrc, setAvatarImageSrc] = useState<string | null>(null);
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([
    {
      id: "1",
      email: "john.doe@gmail.com",
      name: "John Doe",
      avatar:
        "https://images.unsplash.com/photo-1581065178047-8ee15951ede6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMHBvcnRyYWl0fGVufDF8fHx8MTc2MjAzMzEwMHww&ixlib=rb-4.1.0&q=80&w=400",
      isDefault: true,
    },
    {
      id: "2",
      email: "john.work@gmail.com",
      name: "John Work",
      avatar:
        "https://images.unsplash.com/photo-1576558656222-ba66febe3dec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHByb2Zlc3Npb25hbCUyMGhlYWRzaG90fGVufDF8fHx8MTc2MjAyNDQ4MHww&ixlib=rb-4.1.0&q=80&w=400",
      isDefault: false,
    },
  ]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const wasMobile = isMobile;
      const nowMobile = window.innerWidth < 768;
      setIsMobile(nowMobile);

      if (wasMobile !== nowMobile) {
        const startDate = nowMobile ? new Date() : getStartOfWeek(new Date());
        setAvailabilities((prev) =>
          prev.map((avail) => ({ ...avail, currentStartDate: startDate })),
        );
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobile]);

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

  const handleShareAvailability = useCallback(
    (availabilityId: string) => {
      const availability = availabilities.find((a) => a.id === availabilityId);
      if (availability) {
        const shareUrl = `${window.location.origin}/availability/${availabilityId}`;
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();

        try {
          document.execCommand("copy");
          toast.success(`Link for "${availability.name}" copied to clipboard!`);
        } catch (err) {
          toast.error("Failed to copy link");
        } finally {
          document.body.removeChild(textarea);
        }
      }
    },
    [availabilities],
  );

  const handleDeleteAvailability = useCallback(
    (availabilityId: string) => {
      navigate(`/delete-availability/${availabilityId}`);
    },
    [navigate],
  );

  const handleConfirmDeleteAvailability = useCallback(
    (availabilityId: string) => {
      const availability = availabilities.find((a) => a.id === availabilityId);
      setAvailabilities((prev) => prev.filter((a) => a.id !== availabilityId));
      toast.success(`"${availability?.name}" deleted successfully!`);
      navigate("/");
    },
    [availabilities, navigate],
  );

  const handleAvailabilityPreviousWeek = useCallback(
    (availabilityId: string) => {
      setAvailabilities((prev) =>
        prev.map((avail) => {
          if (avail.id === availabilityId) {
            const newStart = new Date(avail.currentStartDate);
            const daysToSubtract = isMobile ? 2 : 7;
            newStart.setDate(avail.currentStartDate.getDate() - daysToSubtract);
            return { ...avail, currentStartDate: newStart };
          }
          return avail;
        }),
      );
    },
    [isMobile],
  );

  const handleAvailabilityNextWeek = useCallback(
    (availabilityId: string) => {
      setAvailabilities((prev) =>
        prev.map((avail) => {
          if (avail.id === availabilityId) {
            const newStart = new Date(avail.currentStartDate);
            const daysToAdd = isMobile ? 2 : 7;
            newStart.setDate(avail.currentStartDate.getDate() + daysToAdd);
            return { ...avail, currentStartDate: newStart };
          }
          return avail;
        }),
      );
    },
    [isMobile],
  );

  const handleAvailabilityToday = useCallback(
    (availabilityId: string) => {
      setAvailabilities((prev) =>
        prev.map((avail) => {
          if (avail.id === availabilityId) {
            const newStart = isMobile ? new Date() : getStartOfWeek(new Date());
            return { ...avail, currentStartDate: newStart };
          }
          return avail;
        }),
      );
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
  const handleSetDefaultAccount = (id: string) => {
    setGoogleAccounts((accounts) =>
      accounts.map((account) => ({
        ...account,
        isDefault: account.id === id,
      })),
    );
    toast.success("Default account updated!");
  };

  const handleDeleteAccount = (id: string) => {
    const accountToDelete = googleAccounts.find((acc) => acc.id === id);
    if (accountToDelete?.isDefault) {
      toast.error(
        "Cannot delete the default account. Set another account as default first.",
      );
      return;
    }
    setGoogleAccounts((accounts) =>
      accounts.filter((account) => account.id !== id),
    );
    toast.success("Account removed successfully!");
  };

  const handleAddAccount = () => {
    const newAccount: GoogleAccount = {
      id: Date.now().toString(),
      email: `newaccount${googleAccounts.length}@gmail.com`,
      name: `New Account ${googleAccounts.length}`,
      avatar: `https://images.unsplash.com/photo-${1500000000000 + googleAccounts.length}?w=400&h=400&fit=crop`,
      isDefault: false,
    };
    setGoogleAccounts((accounts) => [...accounts, newAccount]);
    toast.success("New account added!");
  };

  const handleUpdateDescription = (desc: string) => {
    setDescription(desc);
  };

  const handleUpdateUsername = (name: string) => {
    setUsername(name);
  };

  // Avatar edit handlers
  const handleStartAvatarEdit = (imageSrc: string) => {
    setAvatarImageSrc(imageSrc);
    navigate("/avatar-edit");
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
      <Routes>
        {/* Homepage - Shows Landing or Contact based on auth */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <ContactPage
                availabilities={availabilities}
                isMobile={isMobile}
                onShareAvailability={handleShareAvailability}
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
                googleAccounts={googleAccounts}
                onSetDefaultAccount={handleSetDefaultAccount}
                onDeleteAccount={handleDeleteAccount}
                onAddAccount={handleAddAccount}
                onLogout={handleLogout}
                onUpdateDescription={handleUpdateDescription}
                onUpdateUsername={handleUpdateUsername}
                onStartAvatarEdit={handleStartAvatarEdit}
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
  const availability = availabilities.find((a: Availability) => a.id === id);

  // Memoize the callback functions to prevent AvailabilityPage from re-rendering
  const handlePreviousWeek = useCallback(() => {
    if (id) onPreviousWeek(id);
  }, [id, onPreviousWeek]);

  const handleNextWeek = useCallback(() => {
    if (id) onNextWeek(id);
  }, [id, onNextWeek]);

  const handleToday = useCallback(() => {
    if (id) onToday(id);
  }, [id, onToday]);

  const isCurrentWeekValue = useMemo(() => {
    return id ? isCurrentWeek(id) : false;
  }, [id, isCurrentWeek]);

  if (!availability || !id) {
    return <Navigate to="/" replace />;
  }

  return (
    <AvailabilityPage
      availabilityName={availability.name}
      currentStartDate={availability.currentStartDate}
      onPreviousWeek={handlePreviousWeek}
      onNextWeek={handleNextWeek}
      onToday={handleToday}
      isCurrentWeek={isCurrentWeekValue}
      isMobile={isMobile}
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
    <BrowserRouter>
      <Toaster />
      <AppContent />
    </BrowserRouter>
  );
}
