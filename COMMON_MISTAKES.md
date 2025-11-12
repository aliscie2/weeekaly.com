# Common Mistakes & Lessons Learned

Critical mistakes encountered during development and how to avoid them.

## Overview

Critical mistakes encountered during development and how to avoid them. This document consolidates known issues, regressions, and important lessons.

---

## 1. Account Switching & Cache Persistence ⚠️

**Problem:** After logout/login with different account, old account's data still showed.

**Root Cause:** React Query cache, localStorage, sessionStorage, and IndexedDB all persisted.

**Solution:**

```typescript
// On logout - clear EVERYTHING
queryClient.clear();
queryClient.removeQueries();
localStorage.clear();
sessionStorage.clear();
window.indexedDB
  .databases()
  .then((dbs) => dbs.forEach((db) => window.indexedDB.deleteDatabase(db.name)));
```

**Prevention:**

- ✅ Clear ALL storage on logout (not just one key)
- ✅ Use `staleTime: 0, gcTime: 0` for user-specific data
- ✅ Implement account change detection
- ✅ Test account switching explicitly

---

## 2. Timezone Handling ⚠️

**Problem:** Events showing on wrong dates (Nov 11 event appeared on Nov 5).

**Misconception:** "Need to convert timezones manually"

**Truth:** Google Calendar API already returns events in browser timezone.

**Wrong:**

```typescript
const dayStart = new Date(day.date);
dayStart.setHours(0, 0, 0, 0);
return eventStart >= dayStart; // ❌ Comparing timestamps
```

**Right:**

```typescript
return (
  eventStart.getFullYear() === day.date.getFullYear() &&
  eventStart.getMonth() === day.date.getMonth() &&
  eventStart.getDate() === day.date.getDate()
); // ✅ Compare components
```

**Prevention:**

- ✅ Trust browser timezone handling
- ✅ Compare date components, not timestamps
- ✅ Log timezone info when debugging
- ✅ Never manually convert unless absolutely necessary

---

## 3. Local vs Calendar Events ⚠️

**Problem:** Two types of events (local temporary + calendar) caused confusion.

**Solution:** Single source of truth - ALL events from Google Calendar only.

**Wrong:**

```typescript
const [localEvents, setLocalEvents] = useState([]);
const events = [...localEvents, ...calendarEvents]; // ❌ Two sources
```

**Right:**

```typescript
const events = convertGoogleEventsToAvailabilityEvents(); // ✅ One source
```

**Prevention:**

- ✅ Single source of truth for data
- ✅ No temporary/local state for persistent data
- ✅ Save to backend immediately (with confirmation)
- ✅ Clear data flow

---

## 4. Excessive Console Logging ⚠️

**Problem:** Hundreds of logs making debugging impossible.

**Wrong:**

```typescript
events.forEach(e => {
  console.log('Processing:', e); // ❌ Logs 50+ times
  console.log('Details:', {...}); // ❌ More spam
});
```

**Right:**

```typescript
console.log(`📅 Viewing week: ${start} - ${end} | Total: ${events.length}`);
console.log(`📊 Showing ${visible} of ${total} events`);
```

**Prevention:**

- ✅ Log summaries, not individual items
- ✅ Use emojis for visual scanning
- ✅ Remove debug logs before commit
- ✅ Log only actionable information

---

## 5. React Query Cache ⚠️

**Problem:** Stale data served even after logout.

**Misunderstanding:**

- `staleTime: 2 minutes` = Data considered fresh for 2 minutes
- `gcTime: 5 minutes` = Data stays in memory for 5 minutes
- Cache survives logout!

**Solution for user-specific data:**

```typescript
{
  staleTime: 0,    // Always fetch fresh
  gcTime: 0,       // Don't cache
  refetchInterval: 5 * 60 * 1000  // Still poll periodically
}
```

**Prevention:**

- ✅ Zero-cache for user-specific data
- ✅ Understand staleTime vs gcTime
- ✅ Clear cache on logout
- ✅ Test with React Query DevTools

---

## Quick Reference: Common Pitfalls

| Issue            | ❌ Wrong                | ✅ Right                 |
| ---------------- | ----------------------- | ------------------------ |
| **Logout**       | Clear one key           | Clear ALL storage        |
| **Timezone**     | Manual conversion       | Compare date components  |
| **Events**       | Local + Calendar        | Calendar only            |
| **Cache**        | Long staleTime          | Zero-cache for user data |
| **Logging**      | Log in loops            | Log summaries only       |
| **API Mutation** | Throw placeholder error | Implement actual API     |
| **Error Msgs**   | Generic "not available" | Specific error details   |
| **Cache Update** | No invalidation         | Invalidate after mutate  |

---

## 6. Calendar Grid Spacing and Borders ⚠️

**Problem:** Excessive spacing between day columns with individual borders/outlines that made each day look separate.

**Wrong:**

```typescript
<div className="gap-1 md:gap-2 rounded-2xl border"> // ❌ Too much spacing
```

**Right:**

```typescript
<div className="border-r border-[#d4cfbe]/30"> // ✅ Subtle vertical dividers only
```

**Prevention:**

- ✅ Remove gaps between calendar columns
- ✅ Use vertical dividers only (not borders around each day)
- ✅ Calendar should feel like one unified component
- ✅ Test responsive design at different screen sizes

---

## 7. Date/Time Calculation for Events ⚠️

**Problem:** Events created from Availability Page appeared at wrong date/time in Google Calendar.

**Critical Requirements:**

1. Get correct day from `weekData[dayIndex]` - this has the actual date
2. Get time slot start time (e.g., "9:00 AM") from `day.timeSlots[0].start`
3. Add offset minutes from drag position to base time
4. Create Date object with exact date and time
5. Convert to Google Calendar format with timezone

**Prevention:**

- ✅ Always log date/time calculations for debugging
- ✅ Verify in Google Calendar web UI that event appears at correct date/time
- ✅ Test with different days and time slots
- ✅ Use user's local timezone: `Intl.DateTimeFormat().resolvedOptions().timeZone`

---

## 8. Mobile Touch Events and Scroll Prevention ⚠️

**Problem:** React's synthetic touch events are passive by default, so `preventDefault()` doesn't work to prevent scrolling during drag.

**Wrong:**

```typescript
const handleTouchMove = (e: React.TouchEvent) => {
  e.preventDefault(); // ❌ Doesn't work - passive by default
};
```

**Right:**

```typescript
useEffect(() => {
  const handleTouchMoveNative = (e: TouchEvent) => {
    if (isDragging) {
      e.preventDefault(); // ✅ Works with passive: false
    }
  };

  element.addEventListener("touchmove", handleTouchMoveNative, {
    passive: false,
  });

  return () => element.removeEventListener("touchmove", handleTouchMoveNative);
}, [isDragging]);
```

**Prevention:**

- ✅ Use native event listeners with `passive: false` for scroll prevention
- ✅ Keep React synthetic events for touch detection and calculations
- ✅ Only prevent scroll when actively dragging
- ✅ Test on real mobile devices (iOS and Android)

---

## 9. Calendar Navigation Not Working ⚠️

**Problem:** Previous/Today/Next buttons don't update the displayed week because each availability has static `weekData`.

**Wrong:**

```typescript
interface Availability {
  weekData: DayAvailability[]; // ❌ Static data
}
```

**Right:**

```typescript
interface Availability {
  currentStartDate: Date; // ✅ Track current view date
  // weekData generated dynamically
}
```

**Prevention:**

- ✅ Don't store computed/derived data in state
- ✅ Compute data on demand based on current date
- ✅ Always test navigation immediately after implementing calendar features
- ✅ Log current week range when debugging

---

## 10. Mobile Pagination Missing ⚠️

**Problem:** Mobile version should show 2 days at a time with swipe/pagination, but shows static 2-column grid.

**Solution Needed:**

- Implement proper mobile pagination showing only 2 days at a time
- Add swipe gestures or ensure arrow navigation works for 2-day increments
- Make sure the 2 visible days update when navigating

**Prevention:**

- ✅ Test mobile responsive behavior separately
- ✅ Ensure pagination controls work on mobile
- ✅ Test swipe gestures on real devices

---

## Known Issues & Regressions

### Fixed Issues (11/9/2025)

#### ✅ Availability Page Now Shows Calendar Events

- **Issue:** AvailabilityPage was not displaying Google Calendar events
- **Solution:** Added `useCalendarEvents()` hook and event conversion
- **Visual Design:** Blue calendar events (read-only) vs colored local events (editable)

#### ✅ Calendar Grid Spacing

- **Issue:** Excessive spacing between day columns
- **Solution:** Removed gaps, added subtle vertical dividers only

### Current Issues

#### ⚠️ Calendar Navigation Not Working

- Previous/Today/Next buttons don't update displayed week
- Each availability has static `weekData` instead of dynamic generation

#### ⚠️ Mobile Pagination Missing

- Mobile shows static 2-column grid instead of paginated 2-day view
- No swipe functionality

---

## 11. Breaking Working Code During "Fixes" ⚠️⚠️⚠️

**Problem:** AI/Developer assumes code is broken and "fixes" it, actually breaking working functionality.

**Real Example:**

```typescript
// WORKING CODE (before "fix")
export function useCalendarEvents(enabled: boolean = true) {
  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: async () => {
      // Fetch from Google Calendar API
      const response = await fetch(googleCalendarUrl, { ... });
      return response.json();
    },
    enabled: enabled,  // ✅ Query runs when enabled
  });
}

// BROKEN CODE (after "fix")
export function useCalendarEvents(_enabled: boolean = true) {
  return useQuery({
    queryKey: ["calendar-events"],
    queryFn: async () => {
      return [];  // ❌ Always returns empty!
    },
    enabled: false,  // ❌ Query never runs!
  });
}
```

**What Happened:**

1. User reported "events not showing after login"
2. AI saw `useCalendarEvents` and assumed it was incomplete
3. AI "fixed" it by disabling the query and returning empty array
4. This broke the working Google Calendar integration
5. Had to recreate the entire implementation

**Root Cause:**

- **Assumption without verification:** Didn't check if code was already working
- **No testing before changes:** Didn't verify current behavior
- **Incomplete context:** Didn't understand the full data flow
- **Premature optimization:** Tried to "improve" without understanding

**Prevention:**

- ✅ **ALWAYS test current behavior before making changes**
- ✅ **Ask "Is this actually broken?" before fixing**
- ✅ **Check git history to see if code was recently working**
- ✅ **Look for related code that depends on this functionality**
- ✅ **Add console.logs to understand current behavior first**
- ✅ **If user says "it was working before", believe them!**
- ✅ **Make minimal changes - don't rewrite working code**
- ✅ **Test after every change to verify nothing broke**

**Red Flags That Code Might Be Working:**

- 🚩 Code has proper error handling
- 🚩 Code has detailed logging
- 🚩 Code follows project patterns
- 🚩 Code has TypeScript types defined
- 🚩 User says "it was working before"
- 🚩 Related features work (e.g., create/update events work)

**When User Reports Issue:**

1. **First:** Understand what's actually broken
2. **Second:** Check if it ever worked (git history)
3. **Third:** Add debugging to see current behavior
4. **Fourth:** Make minimal targeted fix
5. **Fifth:** Test that fix doesn't break other things

**Golden Rule:**

> **"If you don't understand why code exists, don't delete it or disable it."**

---

## 12. Performance Issues - Lag During Drag & Multiple Refreshes ⚠️

**Problem:** UI lags during drag operations and page refreshes multiple times after mutations.

**Symptoms:**

- Dragging events feels sluggish/frozen
- Page refreshes 2-3 times after creating/updating events
- Console shows multiple refetch logs

**Investigation Approach:**

```typescript
// 1. Add render tracking
const renderCount = useRef(0);
renderCount.current++;
console.log(`[Component] 🎨 Render #${renderCount.current}`);

// 2. Add performance timing to expensive operations
const startTime = performance.now();
// ... expensive operation ...
const duration = performance.now() - startTime;
console.log(`Operation took ${duration.toFixed(2)}ms`);

// 3. Track React Query refetches
useEffect(() => {
  console.log("[Component] 📊 Data updated:", { count: data.length });
}, [data]);

// 4. Add timing to mouse move handlers
const handleMouseMove = (e) => {
  const moveStartTime = performance.now();
  // ... handle move ...
  const duration = performance.now() - moveStartTime;
  if (duration > 16) {
    // Slower than 60fps
    console.warn("⚠️ Slow mouse move:", `${duration.toFixed(2)}ms`);
  }
};
```

**Common Causes:**

1. **React StrictMode double rendering** - Intentional in development
2. **Heavy computations in render** - Not memoized properly
3. **Multiple cache invalidations** - Triggering cascading refetches
4. **Expensive operations in mouse move** - Blocking the main thread
5. **Large state objects** - Causing full re-renders
6. **Missing dependencies in useCallback/useMemo** - Recreating functions
7. **Component remounting** - Parent re-renders causing child unmount/remount

**Solutions:**

```typescript
// ✅ Memoize expensive computations with DIRECT dependencies
// ❌ WRONG: Depending on callback
const events = useMemo(
  () => convertGoogleEventsToAvailabilityEvents(),
  [convertGoogleEventsToAvailabilityEvents] // Callback recreates every render!
);

// ✅ RIGHT: Depend on actual data
const events = useMemo(
  () => {
    // Inline conversion logic here
    return googleEvents.map(/* ... */);
  },
  [googleEvents, weekData] // Direct dependencies
);

// ✅ Use requestAnimationFrame for smooth drag updates
const handleMouseMove = (e: MouseEvent) => {
  const newPosition = calculatePosition(e);

  // Wrap state updates in requestAnimationFrame
  requestAnimationFrame(() => {
    setPreviewPosition(newPosition);
  });
};

// ✅ Debounce expensive operations
const debouncedUpdate = useMemo(
  () => debounce((value) => updateState(value), 100),
  []
);

// ✅ Batch state updates (automatic in React 18)
setPreviewStartMinutes(newStart);
setPreviewDurationMinutes(newDuration);

// ✅ Single cache invalidation point
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
  // Don't invalidate multiple times or in multiple places
}

// ✅ Disable StrictMode in production (it's only for development)
// In index.tsx:
root.render(
  import.meta.env.DEV ? (
    <StrictMode><App /></StrictMode>
  ) : (
    <App />
  )
);
```

**Prevention:**

- ✅ Profile with React DevTools Profiler
- ✅ Use performance.now() to measure timing
- ✅ Log render counts during development
- ✅ Check for unnecessary re-renders
- ✅ Memoize expensive computations
- ✅ Use requestAnimationFrame for animations
- ✅ Batch state updates
- ✅ Single source of cache invalidation

---

## 13. Incomplete API Integration - Throwing Errors Instead of Implementation ⚠️⚠️⚠️

**Problem:** Mutation hooks throw errors immediately instead of implementing actual API calls.

**Real Example:**

```typescript
// BROKEN CODE - Always throws error
export function useCreateEvent() {
  return useMutation({
    mutationFn: async (_input: EventFormData) => {
      throw new Error("Calendar integration not available"); // ❌ Never works!
    },
  });
}
```

**What Happened:**

1. Developer created placeholder hooks with error throws
2. Forgot to implement actual Google Calendar API calls
3. Every create/update/delete operation failed immediately
4. Error message was confusing: "Calendar integration not available"
5. Users couldn't create any events

**Root Cause:**

- **Incomplete implementation:** Placeholder code left in production
- **No testing:** Mutations never tested before deployment
- **Poor error messages:** Generic error didn't explain the real issue
- **Missing cache invalidation:** Even if it worked, UI wouldn't update

**Correct Implementation:**

```typescript
// ✅ WORKING CODE - Implements actual API call
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EventFormData) => {
      console.log("[useCreateEvent] 🔄 Creating event...", input);

      // 1. Check authentication
      const isAuth = await backendActor.is_authenticated();
      if (!isAuth) {
        throw new Error("User not authenticated");
      }

      // 2. Get access token
      const accessToken = localStorage.getItem("ic-access-token");
      if (!accessToken) {
        throw new Error("No access token found. Please log in again.");
      }

      // 3. Build event object
      const event = {
        summary: input.summary,
        description: input.description || "",
        start: {
          dateTime: input.start.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: input.end.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        location: input.location || "",
        attendees: input.attendees || [],
        conferenceData: input.conferenceData
          ? {
              createRequest: {
                requestId: `meet-${Date.now()}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            }
          : undefined,
      };

      // 4. Call Google Calendar API
      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        },
      );

      // 5. Handle errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "[useCreateEvent] ❌ API error:",
          response.status,
          errorText,
        );

        if (response.status === 401) {
          localStorage.removeItem("ic-access-token");
          throw new Error("Session expired. Please log in again.");
        }

        throw new Error(
          `Failed to create event: ${response.status} ${errorText}`,
        );
      }

      // 6. Return created event
      const createdEvent = await response.json();
      console.log("[useCreateEvent] ✅ Event created:", createdEvent);
      return createdEvent;
    },
    onSuccess: () => {
      // 7. Invalidate cache to refresh UI
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      console.log("[useCreateEvent] ✅ Cache invalidated");
    },
  });
}
```

**Prevention:**

- ✅ **Never leave placeholder code that throws errors**
- ✅ **Test all CRUD operations before deployment**
- ✅ **Add comprehensive logging at each step**
- ✅ **Provide specific error messages (not generic)**
- ✅ **Always invalidate cache after mutations**
- ✅ **Handle authentication errors gracefully**
- ✅ **Check for access tokens before API calls**
- ✅ **Use proper timezone handling**
- ✅ **Test with React Query DevTools**

**Red Flags:**

- 🚩 Function immediately throws error
- 🚩 No actual API call in mutation
- 🚩 Generic error message
- 🚩 No cache invalidation
- 🚩 No logging
- 🚩 Underscore prefix on parameters (`_input`)

**Testing Checklist:**

- [ ] Create event works
- [ ] Update event works
- [ ] Delete event works
- [ ] UI refreshes after each operation
- [ ] Error messages are specific and helpful
- [ ] Authentication errors handled
- [ ] Token expiration handled
- [ ] Console logs show progress

---

## 14. React Re-rendering Issues - Entire App Re-renders on Button Clicks ⚠️⚠️⚠️

**Problem:** Clicking any button (previous day, today, next day, refresh, create event, save changes) causes the entire app to re-render and components to unmount/remount.

**Symptoms:**

```
🔴 AppContent render
🟡 AvailabilityPageWrapper render
🟡 AvailabilityPageWrapper render  // Renders twice!
[AvailabilityPage] ❌ UNMOUNTED
[AvailabilityPage] ✅ MOUNTED - isFirstMount: true
[AvailabilityPage] ❌ UNMOUNTED
[AvailabilityPage] ✅ MOUNTED - isFirstMount: false
```

**Root Cause - Unstable Function References:**

Every time parent component re-renders, it creates new function references, causing child components to think props changed even when values are the same.

**Wrong:**

```typescript
function AppContent() {
  const [availabilities, setAvailabilities] = useState([...]);

  // ❌ New function created on every render
  const handleAvailabilityPreviousWeek = (id: string) => {
    setAvailabilities(prev => /* ... */);
  };

  // ❌ New function created on every render
  const handleAvailabilityNextWeek = (id: string) => {
    setAvailabilities(prev => /* ... */);
  };

  return (
    <AvailabilityPageWrapper
      onPreviousWeek={handleAvailabilityPreviousWeek}  // New reference!
      onNextWeek={handleAvailabilityNextWeek}          // New reference!
    />
  );
}

// ❌ Not memoized - re-renders even with same props
function AvailabilityPageWrapper({ onPreviousWeek, onNextWeek }) {
  return (
    <AvailabilityPage
      onPreviousWeek={() => onPreviousWeek(id)}  // New function every render!
      onNextWeek={() => onNextWeek(id)}          // New function every render!
    />
  );
}
```

**Right:**

```typescript
function AppContent() {
  const [availabilities, setAvailabilities] = useState([...]);

  // ✅ Stable function reference with useCallback
  const handleAvailabilityPreviousWeek = useCallback((id: string) => {
    setAvailabilities(prev =>
      prev.map(avail => {
        if (avail.id === id) {
          const newStart = new Date(avail.currentStartDate);
          const daysToSubtract = isMobile ? 2 : 7;
          newStart.setDate(avail.currentStartDate.getDate() - daysToSubtract);
          return { ...avail, currentStartDate: newStart };
        }
        return avail;
      })
    );
  }, [isMobile]);

  // ✅ Stable function reference with useCallback
  const handleAvailabilityNextWeek = useCallback((id: string) => {
    setAvailabilities(prev =>
      prev.map(avail => {
        if (avail.id === id) {
          const newStart = new Date(avail.currentStartDate);
          const daysToAdd = isMobile ? 2 : 7;
          newStart.setDate(avail.currentStartDate.getDate() + daysToAdd);
          return { ...avail, currentStartDate: newStart };
        }
        return avail;
      })
    );
  }, [isMobile]);

  return (
    <AvailabilityPageWrapper
      onPreviousWeek={handleAvailabilityPreviousWeek}  // Stable reference!
      onNextWeek={handleAvailabilityNextWeek}          // Stable reference!
    />
  );
}

// ✅ Memoized wrapper - only re-renders when props actually change
const AvailabilityPageWrapper = memo(function AvailabilityPageWrapper({
  onPreviousWeek,
  onNextWeek,
  onToday,
  isCurrentWeek,
  availabilities,
  isMobile,
}) {
  const { id } = useParams();
  const availability = availabilities.find(a => a.id === id);

  // ✅ Stable function references inside wrapper
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
      onPreviousWeek={handlePreviousWeek}      // Stable reference!
      onNextWeek={handleNextWeek}              // Stable reference!
      onToday={handleToday}                    // Stable reference!
      isCurrentWeek={isCurrentWeekValue}       // Stable value!
      isMobile={isMobile}
    />
  );
});
```

**The Cascade of Re-renders:**

1. User clicks button → State changes in `AppContent`
2. `AppContent` re-renders → Creates new handler functions
3. `AvailabilityPageWrapper` receives "new" props (different function references)
4. Wrapper re-renders → Creates new inline arrow functions
5. `AvailabilityPage` receives "new" props (different function references)
6. Even though `AvailabilityPage` is wrapped in `memo()`, it re-renders because props changed
7. Component unmounts and remounts (if `key` prop was used incorrectly)

**Additional Issues:**

```typescript
// ❌ WRONG: key prop causes unmount/remount
<AvailabilityPage
  key={id}  // Don't use key unless you WANT to remount
  {...props}
/>

// ✅ RIGHT: No key prop, component updates in place
<AvailabilityPage
  {...props}
/>

// ❌ WRONG: ProtectedRoute recreated every render
const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated) return <Navigate to="/" />;
  return <>{children}</>;
};

// ✅ RIGHT: ProtectedRoute memoized with useCallback
const ProtectedRoute = useCallback(
  ({ children }: { children: React.ReactNode }) => {
    if (!isAuthenticated && !authLoading) {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  },
  [isAuthenticated, authLoading]
);
```

**Prevention Checklist:**

- ✅ **Wrap ALL handler functions in `useCallback`** with proper dependencies
- ✅ **Wrap ALL computed values in `useMemo`** with proper dependencies
- ✅ **Memoize wrapper components with `memo()`**
- ✅ **Avoid inline arrow functions in JSX** - create stable callbacks instead
- ✅ **Don't use `key` prop unless you want to force remount**
- ✅ **Add render tracking during development** to catch issues early
- ✅ **Test button clicks immediately** after implementing features
- ✅ **Use React DevTools Profiler** to identify unnecessary re-renders

**Debugging Re-renders:**

```typescript
// Add to components to track renders
const renderCount = useRef(0);
renderCount.current++;
console.log(`[ComponentName] 🎨 RENDER #${renderCount.current}`);

// Track mount/unmount
useEffect(() => {
  console.log("[ComponentName] ✅ MOUNTED");
  return () => {
    console.log("[ComponentName] ❌ UNMOUNTED");
  };
}, []);

// Track when specific props change
useEffect(() => {
  console.log("[ComponentName] 📊 Props changed:", { prop1, prop2 });
}, [prop1, prop2]);
```

**Red Flags:**

- 🚩 Component renders multiple times on single button click
- 🚩 "UNMOUNTED" followed by "MOUNTED" in console
- 🚩 Handler functions not wrapped in `useCallback`
- 🚩 Inline arrow functions in JSX: `onClick={() => handler(id)}`
- 🚩 Wrapper components not memoized with `memo()`
- 🚩 Using `key` prop on components that shouldn't remount
- 🚩 ProtectedRoute or similar wrappers recreated every render

**Performance Impact:**

- Laggy UI during interactions
- Animations restart/stutter
- Form inputs lose focus
- Scroll position resets
- Network requests duplicated
- Poor user experience

**Solution Summary:**

1. **Stabilize all function references** with `useCallback`
2. **Stabilize all computed values** with `useMemo`
3. **Memoize wrapper components** with `memo()`
4. **Remove unnecessary `key` props**
5. **Test with render tracking enabled**

---

## Architecture Notes

### Google Calendar Event Structure

```typescript
{
  id: string;
  summary: string;  // Title
  start: { dateTime: '2025-10-04T12:00:00+03:00', timeZone: 'Asia/Baghdad' };
  end: { dateTime: '2025-10-04T13:00:00+03:00', timeZone: 'Asia/Baghdad' };
  attendees: [{ email: string, displayName?: string }];
  creator: { email: string, self: boolean };
  status: "confirmed" | "tentative" | "cancelled";
}
```

### Data Flow

```
User Action → useEventActions Hook → React Query Mutation →
Google Calendar API → Cache Invalidation → UI Auto-updates
```

---
