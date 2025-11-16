import { memo } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Share2,
  RefreshCw,
} from "lucide-react";
import { copyToClipboard } from "../utils/eventValidation";
import { toast } from "sonner";

interface AvailabilityHeaderProps {
  availabilityName: string;
  currentStartDate: Date;
  daysToShow: number;
  isCurrentWeek: boolean;
  isMobile: boolean;
  isViewingOthers: boolean;
  hasMutualAvailability: boolean;
  isRefetching: boolean;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onRefresh: () => void;
  isFirstMount: boolean;
}

export const AvailabilityHeader = memo(function AvailabilityHeader({
  availabilityName,
  currentStartDate,
  daysToShow,
  isCurrentWeek,
  isMobile,
  isViewingOthers,
  hasMutualAvailability,
  isRefetching,
  onPreviousWeek,
  onNextWeek,
  onToday,
  onRefresh,
  isFirstMount,
}: AvailabilityHeaderProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={isFirstMount ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="px-2 md:px-4 mb-3"
    >
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/")}
          size={isMobile ? "sm" : "default"}
          className="text-[#8b8475] hover:text-[#8b8475] hover:bg-[#e8e4d9]/60 group flex-shrink-0"
        >
          <ArrowLeft
            className={`${isMobile ? "h-4 w-4" : "h-4 w-4 mr-2"} transition-transform group-hover:-translate-x-1`}
          />
          {!isMobile && "Back"}
        </Button>

        <div className="flex items-center gap-1 md:gap-3 flex-1 justify-center min-w-0">
          <div className="flex flex-col items-center gap-0.5">
            <h1
              className={`text-[#8b8475] truncate ${isMobile ? "text-sm max-w-[120px]" : "max-w-[200px]"}`}
            >
              {availabilityName}
            </h1>
            {isViewingOthers && hasMutualAvailability && (
              <span className="text-[10px] text-[#a8a195] whitespace-nowrap">
                Mutual Availability
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                console.log("[AvailabilityHeader] Previous week clicked");
                onPreviousWeek();
              }}
              className={`text-[#8b8475] hover:bg-[#e8e4d9]/60 ${isMobile ? "h-8 w-8" : "h-9 w-9"}`}
            >
              <ChevronLeft className={`${isMobile ? "h-4 w-4" : "h-4 w-4"}`} />
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                console.log("[AvailabilityHeader] Today clicked");
                onToday();
              }}
              size={isMobile ? "sm" : "default"}
              className={`text-[#8b8475] hover:bg-[#e8e4d9]/60 ${isMobile ? "px-2 text-xs min-w-[44px]" : "px-3 text-xs"}`}
              disabled={isCurrentWeek}
            >
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const displayStartDate = new Date(currentStartDate);
                displayStartDate.setHours(0, 0, 0, 0);

                const displayEndDate = new Date(displayStartDate);
                displayEndDate.setDate(
                  displayStartDate.getDate() + daysToShow - 1,
                );

                if (today >= displayStartDate && today <= displayEndDate) {
                  return isMobile ? "Now" : "Today";
                }

                const diffMs = displayStartDate.getTime() - today.getTime();
                const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

                const absDays = Math.abs(diffDays);
                const sign = diffDays > 0 ? "+" : "-";

                if (absDays >= 7) {
                  const weeks = Math.floor(absDays / 7);
                  return `${sign}${weeks}w`;
                }

                return `${sign}${absDays}d`;
              })()}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                console.log("[AvailabilityHeader] Next week clicked");
                onNextWeek();
              }}
              className={`text-[#8b8475] hover:bg-[#e8e4d9]/60 ${isMobile ? "h-8 w-8" : "h-9 w-9"}`}
            >
              <ChevronRight className={`${isMobile ? "h-4 w-4" : "h-4 w-4"}`} />
            </Button>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Button
            type="button"
            onClick={() => {
              onRefresh();
              toast.success("Refreshing calendar...");
            }}
            variant="outline"
            size={isMobile ? "sm" : "sm"}
            disabled={isRefetching}
            className="bg-[#e8e4d9]/60 hover:bg-[#8b8475] text-[#8b8475] hover:text-[#f5f3ef] border-[#d4cfbe]/40"
            title="Refresh calendar events"
          >
            <RefreshCw
              className={`${isMobile ? "h-4 w-4" : "h-4 w-4 mr-2"} ${isRefetching ? "animate-spin" : ""}`}
            />
            {!isMobile && "Refresh"}
          </Button>
          {/* Only show Share button when viewing own availability */}
          {!isViewingOthers && (
            <Button
              type="button"
              onClick={() => copyToClipboard(window.location.href)}
              variant="outline"
              size={isMobile ? "sm" : "sm"}
              className="bg-[#e8e4d9]/60 hover:bg-[#8b8475] text-[#8b8475] hover:text-[#f5f3ef] border-[#d4cfbe]/40"
            >
              <Share2 className={`${isMobile ? "h-4 w-4" : "h-4 w-4 mr-2"}`} />
              {!isMobile && "Share"}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
});
