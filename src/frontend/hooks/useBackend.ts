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

// Add more backend query hooks here as needed
// Example:
// export function useUserProfile() {
//   return useQuery({
//     queryKey: ['user-profile'],
//     queryFn: async () => {
//       const result = await backendActor.get_user_profile();
//       return result;
//     },
//   });
// }
