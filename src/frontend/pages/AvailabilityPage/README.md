# AvailabilityPage - Refactored Structure

This directory contains the refactored AvailabilityPage component, previously a monolithic 2295-line file, now organized into a clean, modular structure.

## ⚠️ Watchout List - Common Issues & Mistakes

### 1. **Timezone Conversion Bug - Times Displayed Incorrectly** ✅ FIXED

**Problem**: Availability times were displayed incorrectly based on user's timezone. For example, "9 AM to 1 PM" would show as "12 PM to 4 PM" for users in UTC+3 timezone (Baghdad).

**Root Cause**:

- The `convertBackendSlotsToUI` function in `timeCalculations.ts` was doing unnecessary timezone conversion
- It assumed backend stored times in UTC and converted them to local timezone
- But backend actually stores times as **timezone-agnostic minutes from midnight** (0-1439)
- For UTC+3: `getTimezoneOffset()` returns -180 (negative for ahead of UTC)
- Calculation: `540 - (-180) = 720` (9 AM became 12 PM) ❌

**Detection**:

- Check if displayed times don't match the backend `start_time` and `end_time` values
- Add debug logs to see the conversion: `console.log("start_time:", slot.start_time, "→", localStartMinutes)`
- Times will be off by exactly your timezone offset

**Solution Implemented**:

- Removed timezone conversion logic from `convertBackendSlotsToUI`
- Backend times are already in local timezone (just as minutes from midnight)
- Now: `localStartMinutes = slot.start_time` (use directly, no conversion)
- Result: 540 minutes → 9:00 AM ✅, 780 minutes → 1:00 PM ✅

**Code Location**: `src/frontend/pages/AvailabilityPage/utils/timeCalculations.ts` - `convertBackendSlotsToUI` function

**Prevention**:

- Backend stores times as **timezone-agnostic** minutes from midnight (0-1439)
- Don't apply timezone conversion when displaying these times
- Only convert timezones when dealing with actual Date objects or ISO strings
- Test with users in different timezones (especially UTC+/- offsets)

### 2. **Week Navigation Not Working in Sharing Mode** ✅ FIXED

**Problem**: When viewing someone else's availability (sharing mode), the Previous Week, Today, and Next Week navigation buttons don't work.

**Root Cause**:

- The navigation handlers (`onPreviousWeek`, `onNextWeek`, `onToday`) in `App.tsx` only update the `availabilityDates` state for availabilities that exist in the user's own list
- In sharing mode, `ownAvailability` is `null` because the availability ID is not in the user's list
- The `currentStartDate` passed to `AvailabilityPage` is initialized once and never updates when navigation buttons are clicked

**Detection**: Check if the availability ID exists in the user's `availabilities` list. If not, it's sharing mode.

**Solution Implemented**:

- Added local state (`sharedAvailabilityDate`) in `AvailabilityPageWrapper` for shared availabilities
- When `isViewingOthers` is true, navigation handlers update the local state instead of parent state
- The local state is used for `currentStartDate` when viewing shared availabilities
- Properly handles both mobile (2-day increments) and desktop (7-day increments) navigation

**Code Location**: `src/frontend/App.tsx` - `AvailabilityPageWrapper` component (lines ~710-800)

**Prevention**: Always test navigation in both modes:

1. Own availability (from user's list)
2. Shared availability (accessed via link, not in user's list)

### 3. **State Management Confusion**

**Problem**: Multiple sources of truth for `currentStartDate` can lead to sync issues.

**Prevention**:

- Document clearly which component owns which state
- Use memoization to prevent unnecessary recalculations
- Test state updates in both desktop and mobile modes

### 4. **Mobile vs Desktop Navigation**

**Problem**: Mobile uses 2-day increments, desktop uses 7-day increments. Easy to forget when implementing navigation.

**Prevention**:

- Always check `isMobile` flag when implementing date navigation
- Test on both mobile and desktop viewports
- Document the different behaviors clearly

### 5. **Date Initialization**

**Problem**: Initial date differs between mobile (today) and desktop (start of week).

**Prevention**:

- Use `isMobile ? new Date() : getStartOfWeek(new Date())` pattern consistently
- Document this behavior in component props

### 6. **Share Button Visibility in Sharing Mode** ✅ FIXED

**Problem**: The Share button was visible when viewing someone else's shared availability, which doesn't make sense (you can't share someone else's availability).

**Solution Implemented**:

- Added conditional rendering in `AvailabilityHeader` component
- Share button only shows when `!isViewingOthers` (viewing own availability)
- Refresh button remains visible in both modes

**Code Location**: `src/frontend/pages/AvailabilityPage/components/AvailabilityHeader.tsx`

**Prevention**: Always consider UI elements that should be mode-specific (own vs shared)

## Structure

```
AvailabilityPage/
├── index.tsx                    # Main component (orchestration)
├── types.ts                     # TypeScript interfaces
├── README.md                    # This file
├── components/
│   ├── AvailabilityHeader.tsx   # Header with navigation and actions
│   ├── CalendarGrid.tsx         # Calendar grid with days and events
│   ├── EventCard.tsx            # Individual event with time labels and resize handles
│   ├── EventToolbar.tsx         # Focused event actions toolbar
│   └── HourLabels.tsx           # Hour labels column
├── hooks/
│   ├── useDragToCreate.tsx      # Drag to create new events
│   ├── useDragToReschedule.tsx  # Drag to move/resize events
│   ├── useEventInteractions.tsx # Event click, edit, delete
│   ├── useTouchHandlers.tsx     # Mobile touch interactions
│   └── useWeekData.tsx          # Week data processing
└── utils/
    ├── constants.ts             # Constants (MIN_DURATION, etc.)
    ├── eventValidation.ts       # Overlap checking and validation
    └── timeCalculations.ts      # Time parsing and conversion
```

## Key Features

### Hooks

- **useWeekData**: Processes backend availability slots into UI-friendly format
- **useDragToCreate**: Handles desktop drag-to-create event interactions
- **useDragToReschedule**: Handles desktop drag-to-move/resize event interactions
- **useTouchHandlers**: Handles mobile touch interactions (long-press, drag)
- **useEventInteractions**: Manages event focus, edit, and delete actions

### Components

- **AvailabilityHeader**: Compact header with back button, title, week navigation, and action buttons
- **HourLabels**: Vertical hour labels column
- **CalendarGrid**: Main calendar grid with day columns, borders, and event rendering
- **EventCard**: Individual event card with title, duration, time labels, and resize handles
- **EventToolbar**: Floating toolbar for focused event actions

### Utils

- **timeCalculations.ts**: Time parsing, conversion, and calculation utilities
- **eventValidation.ts**: Event overlap checking and clipboard utilities
- **constants.ts**: Shared constants

## Benefits of Refactoring

1. **Maintainability**: Each file has a single, clear responsibility
2. **Testability**: Hooks and utilities can be tested in isolation
3. **Reusability**: Components and hooks can be reused elsewhere
4. **Readability**: Much easier to understand and navigate
5. **Performance**: Memoization and optimization are more targeted
6. **Collaboration**: Multiple developers can work on different parts

## Migration Notes

The refactored component maintains 100% feature parity with the original:

- All drag-to-create functionality preserved
- All drag-to-reschedule functionality preserved
- All mobile touch interactions preserved
- All event management (create, edit, delete) preserved
- All Google Calendar integration preserved
- All mutual availability calculation preserved

The component is imported the same way:

```typescript
import { AvailabilityPage } from "./pages/AvailabilityPage";
```

The folder structure with `index.tsx` ensures backward compatibility.

---

## 🚨 Recurring Mistakes & Best Practices

### Navigation & State Management

1. **Always test navigation in sharing mode**

   - Don't assume navigation works just because it works for own availabilities
   - Sharing mode has different state management paths
   - Test with availability IDs not in the user's list

2. **Check for null/undefined before accessing availability data**

   - `ownAvailability` can be null in sharing mode
   - `fetchedAvailability` can be null during loading or on error
   - Always provide fallbacks

3. **Memoize callback functions in wrappers**
   - Use `useCallback` for navigation handlers to prevent unnecessary re-renders
   - Use `useMemo` for computed values like `isCurrentWeek`
   - This is critical for performance with large event lists

### Mobile vs Desktop

4. **Different navigation increments**

   - Mobile: 2 days at a time
   - Desktop: 7 days (full week)
   - Always check `isMobile` flag

5. **Different initial dates**

   - Mobile: Current day (`new Date()`)
   - Desktop: Start of week (`getStartOfWeek(new Date())`)
   - Use consistent pattern across codebase

6. **Touch vs Mouse events**
   - Mobile uses touch events with long-press
   - Desktop uses mouse events with drag
   - Never mix the two - check `isMobile` flag

### Time & Timezone Handling

7. **Backend times are timezone-agnostic**

   - Backend stores times as minutes from midnight (0-1439)
   - These are NOT in UTC - they're timezone-agnostic
   - Don't apply timezone conversion when displaying
   - Only convert timezones for Date objects or ISO strings

8. **Test with different timezones**
   - Test with UTC+3 (Baghdad), UTC-5 (New York), UTC+0 (London)
   - Times should display the same regardless of user's timezone
   - Use browser DevTools to change timezone for testing

### Event Management

9. **Past event protection**

   - Always validate event times before allowing edits
   - Use `isPastEvent()` helper before drag/resize/edit
   - Show appropriate error messages

10. **Overlap detection**

- Check overlaps before creating or moving events
- Exclude the current event when checking overlaps during resize/move
- Use `checkEventOverlap()` consistently

11. **Google Calendar sync**

- All events come from Google Calendar (no local events)
- Event IDs have `calendar-` prefix in UI
- Strip prefix before calling backend APIs

### Performance

12. **Memoization is critical**

    - Use `memo()` for components that receive stable props
    - Use `useMemo()` for expensive calculations (event filtering, date calculations)
    - Use `useCallback()` for event handlers passed to child components

13. **Avoid unnecessary re-renders**
    - Don't create new objects/arrays in render
    - Use stable references for callbacks
    - Check React DevTools Profiler when debugging performance

### Debugging

14. **Console logs for state changes**

    - Log navigation clicks with availability ID
    - Log state updates in useEffect
    - Remove debug logs before committing (or use debug flag)

15. **Test both modes thoroughly**
    - Own availability mode (authenticated user viewing their own)
    - Sharing mode (viewing someone else's availability)
    - Different scenarios: empty state, many events, overlapping events

### Code Organization

16. **Keep components focused**

    - Each component should have one responsibility
    - Extract complex logic to hooks
    - Extract utilities to separate files

17. **Document complex logic**
    - Add comments for non-obvious calculations
    - Document edge cases and why they're handled that way
    - Update README when fixing bugs

---

## 📝 When You Fix a Bug

1. **Document it in the Watchout List** (top of this README)
2. **Add it to Recurring Mistakes** (this section)
3. **Write a test case** (if applicable)
4. **Update related documentation**
5. **Check if the same issue exists elsewhere** in the codebase
