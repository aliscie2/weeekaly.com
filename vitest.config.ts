import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src/frontend"),
      "#/": resolve(__dirname, "./tests"),
      $: resolve(__dirname, "./src"),
    },
  },
  test: {
    // Only include backend tests
    include: ["tests/backend/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],

    // Exclude unnecessary directories
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.dfx/**"],

    // Enable global test functions (describe, test, expect)
    globals: true,

    // Use Node.js environment
    environment: "node",

    // Setup files - runs in same context as tests
    setupFiles: ["./tests/backend/test-setup.ts"],

    // Timeouts
    testTimeout: 30000, // 30 seconds per test
    hookTimeout: 120000, // 2 minutes for setup/teardown

    // Run tests sequentially to share PocketIC instance
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Isolate tests to prevent interference
    isolate: false,
  },
});
