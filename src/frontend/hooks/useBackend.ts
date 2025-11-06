import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backendActor } from '../utils/actor';

/**
 * Hook to fetch hello world message from backend
 * Automatically caches and prevents duplicate calls
 */
export function useHelloWorld() {
  return useQuery({
    queryKey: ['hello-world'],
    queryFn: async () => {
      const result = await backendActor.hello_world();
      return result;
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
}

/**
 * Hook to fetch user info from backend
 * Automatically caches and prevents duplicate calls
 */
export function useUserInfo() {
  return useQuery({
    queryKey: ['user-info'],
    queryFn: async () => {
      const result = await backendActor.get_user_info();
      return result;
    },
    staleTime: 1 * 60 * 1000, // Consider data fresh for 1 minute
  });
}

/**
 * Hook to fetch calendar events with optimized auto-refresh
 * Polls every 5 minutes (reduced from 30 seconds for better performance)
 * 
 * @param enabled - Whether to enable polling (default: true)
 */
export function useCalendarEvents(enabled: boolean = true) {
  return useQuery({
    queryKey: ['calendar-events'],
    queryFn: async () => {
      // Dynamically import to avoid circular dependencies
      const { fetchGoogleCalendarEvents, CALENDAR_CONSTANTS } = await import('../utils/googleCalendar');
      const events = await fetchGoogleCalendarEvents();
      
      return events;
    },
    enabled, // Only run if enabled
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes (96% reduction in API calls)
    refetchIntervalInBackground: false, // Stop polling when tab is inactive (saves battery)
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    retry: 3, // Retry failed requests
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
}
