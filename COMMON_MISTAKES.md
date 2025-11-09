# 📚 Lessons Learned - Critical Mistakes to Avoid

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
window.indexedDB.databases().then(dbs => 
  dbs.forEach(db => window.indexedDB.deleteDatabase(db.name))
);
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
return eventStart.getFullYear() === day.date.getFullYear() &&
       eventStart.getMonth() === day.date.getMonth() &&
       eventStart.getDate() === day.date.getDate(); // ✅ Compare components
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

| Issue | ❌ Wrong | ✅ Right |
|-------|---------|---------|
| **Logout** | Clear one key | Clear ALL storage |
| **Timezone** | Manual conversion | Compare date components |
| **Events** | Local + Calendar | Calendar only |
| **Cache** | Long staleTime | Zero-cache for user data |
| **Logging** | Log in loops | Log summaries only |

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
  
  element.addEventListener('touchmove', handleTouchMoveNative, { passive: false });
  
  return () => element.removeEventListener('touchmove', handleTouchMoveNative);
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


