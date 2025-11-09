import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import App from "./App";
import "./index.css";

// Development mode flag
const isDevelopment = import.meta.env.DEV;

// Create a client with event logging (development only)
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only log errors in development
      if (isDevelopment) {
        console.error("🔴 [React Query] Query Error:", {
          queryKey: query.queryKey,
          error,
          timestamp: new Date().toISOString(),
        });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Only log errors in development
      if (isDevelopment) {
        console.error("🔴 [React Query] Mutation Error:", {
          mutationKey: mutation.options.mutationKey,
          error,
          timestamp: new Date().toISOString(),
        });
      }
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent refetch on window focus
      retry: 1, // Only retry once on failure
    },
  },
});

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Root element with id "root" not found in the document');
}

const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
