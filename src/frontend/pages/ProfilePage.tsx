import { useMemo } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
  Star,
  Plus,
  LogOut,
  Mail,
  Edit2,
  Camera,
  ArrowLeft,
} from "lucide-react";
import { Card } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { AUTH_CONSTANTS } from "../utils/authConstants";

interface ProfilePageProps {
  username: string;
  userAvatar: string;
  description: string;
  onLogout: () => void;
  onUpdateDescription: (desc: string) => void;
}

export function ProfilePage({
  username,
  userAvatar,
  description,
  onLogout,
  onUpdateDescription,
}: ProfilePageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get Google user data from localStorage - memoized to prevent unnecessary recalculations
  const googleUserData = useMemo(() => {
    const email =
      localStorage.getItem(AUTH_CONSTANTS.STORAGE_KEY_USER_EMAIL) || "";
    const name =
      localStorage.getItem(AUTH_CONSTANTS.STORAGE_KEY_USER_NAME) || username;
    const picture =
      localStorage.getItem(AUTH_CONSTANTS.STORAGE_KEY_USER_PICTURE) ||
      userAvatar;

    return { email, name, picture };
  }, [username, userAvatar]);

  /**
   * Handle logout with complete cleanup
   * Clears all cached data and stored user information
   */
  const handleLogoutWithCleanup = () => {
    // 1. Clear React Query cache (all calendar events, etc.)
    queryClient.clear();

    // 2. Remove all queries to prevent any cached data from being used
    queryClient.removeQueries();

    // 3. Clear localStorage completely (not just calendar_user_email)
    localStorage.clear();

    // 4. Clear sessionStorage (PKCE verifier, etc.)
    sessionStorage.clear();

    // 5. Clear any IndexedDB data (if used by React Query)
    if (window.indexedDB) {
      window.indexedDB
        .databases()
        .then((dbs) => {
          dbs.forEach((db) => {
            if (db.name) {
              window.indexedDB.deleteDatabase(db.name);
            }
          });
        })
        .catch(() => {
          // Silently fail if IndexedDB cleanup fails
        });
    }

    // 6. Show success message
    toast.success("Logged out successfully");

    // 7. Call the original logout handler
    onLogout();
  };

  const handleAvatarClick = () => {
    toast.info(
      "This feature is coming later. You can update your photo from your Google account.",
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex-1 overflow-y-auto py-8 md:py-12 px-4 md:px-8"
    >
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-4"
        >
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-[#8b8475] hover:text-[#8b8475] hover:bg-[#e8e4d9]/60 -ml-2 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
            Back
          </Button>
        </motion.div>

        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-white/60 border border-[#d4cfbe]/40 rounded-3xl p-6 md:p-8 shadow-lg mb-6"
        >
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative group">
                    <Avatar
                      className="h-24 w-24 md:h-32 md:w-32 border-4 border-[#e8e4d9] cursor-pointer"
                      onClick={handleAvatarClick}
                    >
                      <AvatarImage
                        src={googleUserData.picture || userAvatar}
                        alt={googleUserData.name || username}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-[#8b8475] text-white text-2xl md:text-3xl">
                        {(googleUserData.name || username)
                          .charAt(0)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      onClick={handleAvatarClick}
                      className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
                    >
                      <Camera className="h-8 w-8 text-white" />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    This feature is coming later. You can update your photo from
                    your Google account.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl text-[#8b8475]">
                  {googleUserData.name || username}
                </h1>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() =>
                          toast.info("This feature is coming later")
                        }
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#a8a195] hover:text-[#8b8475] hover:bg-[#e8e4d9]/60"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>This feature is coming later</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2 mb-3 text-[#a8a195]">
                <Mail className="h-4 w-4" />
                <p className="text-sm">{googleUserData.email}</p>
              </div>
              <textarea
                value={description}
                onChange={(e) => onUpdateDescription(e.target.value)}
                placeholder="Add a description about yourself..."
                className="w-full bg-[#f5f3ef] border border-[#d4cfbe]/40 rounded-xl p-3 text-[#8b8475] placeholder:text-[#a8a195] resize-none focus:outline-none focus:ring-2 focus:ring-[#8b8475]/20 transition-all"
                rows={3}
              />
            </div>

            {/* Logout Button */}
            <Button
              onClick={handleLogoutWithCleanup}
              variant="outline"
              className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </motion.div>

        {/* Google Accounts Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="bg-white/60 border border-[#d4cfbe]/40 rounded-3xl p-6 md:p-8 shadow-lg"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl text-[#8b8475]">
              Email Accounts
            </h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() =>
                      toast.info(
                        "Currently you can have only one email. Coming later you can have multiple emails connected.",
                      )
                    }
                    size="sm"
                    className="bg-[#8b8475] hover:bg-[#6b6558] text-[#f5f3ef]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Email
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Currently you can have only one email. Coming later you can
                    have multiple emails connected.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Separator className="mb-6 bg-[#d4cfbe]/40" />

          <div className="space-y-4">
            {googleUserData.email && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
              >
                <Card className="p-4 bg-[#f5f3ef]/50 border-[#d4cfbe]/40">
                  <div className="flex items-center gap-4">
                    {/* Account Avatar */}
                    <Avatar className="h-12 w-12 border-2 border-[#e8e4d9]">
                      <AvatarImage
                        src={googleUserData.picture}
                        alt={googleUserData.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-[#8b8475] text-white">
                        {googleUserData.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Account Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[#8b8475] truncate">
                          {googleUserData.name}
                        </p>
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500 flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-1 text-sm text-[#a8a195]">
                        <Mail className="h-3 w-3" />
                        <p className="truncate">{googleUserData.email}</p>
                      </div>
                    </div>

                    {/* Default Badge */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="px-3 py-1 bg-yellow-50 border border-yellow-200 rounded-full text-xs text-yellow-700">
                        Default
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
