# PocketIC Backend Testing

## Overview

This directory contains backend tests using PocketIC to run Internet Computer canisters locally.

## How It Works

### Setup Flow

1. **Test Setup** (runs once for all tests via `setupFiles`)

   - Start PocketIC server
   - Create PocketIC instance
   - Deploy backend canister
   - Store in global variables: `testPic`, `testActor`, `backendCanisterId`
   - Setup time manipulation helpers

2. **Run Tests**

   - Use `testActor` to call canister functions
   - Use `testPic` for time manipulation

3. **Teardown**
   - Stop PocketIC server after all tests complete

### Key Files

- **vitest.config.ts** - Configures test runner with setupFiles
- **tests/backend/test-setup.ts** - Runs once before all tests, deploys canisters
- **tests/backend/utils.ts** - Helper functions for creating test data

### Global Variables

Available in all tests:

```typescript
globalThis.testPic; // PocketIC instance
globalThis.testActor; // Backend canister actor
globalThis.backendCanisterId; // Backend canister ID
globalThis.oneHourLater(); // Move time forward 1 hour
globalThis.timeLater(ms); // Move time forward by milliseconds
```

### Writing Tests

```typescript
import { describe, test, expect } from "vitest";

describe("My Feature", () => {
  test("should work", async () => {
    // testActor is available globally
    const result = await testActor.my_function();
    expect(result).toBeDefined();
  });

  test("should handle time", async () => {
    // Move time forward 1 hour
    await oneHourLater();

    // Or move forward by specific amount
    await timeLater(5 * 60 * 1000); // 5 minutes
  });
});
```

### Time Manipulation

```typescript
// Reset to current time
await testPic.resetTime();

// Get current time
const now = await testPic.getTime();

// Set specific time
await testPic.setTime(new Date("2024-01-01"));

// Helper: Move 1 hour forward
await oneHourLater();

// Helper: Move forward by milliseconds
await timeLater(60 * 60 * 1000); // 1 hour
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/backend/availabilities/basic.test.ts

# Run with watch mode
npm test -- --watch

# Run with UI
npm test -- --ui
```

### Configuration

- **Test Timeout**: 30 seconds per test
- **Hook Timeout**: 120 seconds for setup/teardown
- **Pool**: Single fork to share PocketIC instance across tests
- **Isolation**: Disabled to allow shared state

### Important Notes

1. **Setup runs once** - The PocketIC instance and canister deployment happen once for all tests
2. **Shared state** - Tests share the same canister instance, so be careful with state modifications
3. **Time manipulation** - Use `testPic.resetTime()` in `beforeEach` to reset time between tests
4. **Identity switching** - Use `testActor.setIdentity()` to test with different users

### Troubleshooting

**Error: "PocketIC not initialized"**

- Cause: Setup failed or didn't complete
- Fix: Check test-setup.ts logs for errors

**Tests timeout**

- Cause: PocketIC operations take time
- Fix: Increase timeout in vitest.config.ts

**Module not found errors**

- Cause: Path aliases not working in test files
- Fix: Use relative paths or check vitest.config.ts resolve.alias
