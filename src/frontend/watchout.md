# Watchout - Known Issues and Regressions

## Fixed Issues (11/2/2025)

### Calendar Grid Spacing and Borders (FIXED)
**Previous Problem:** Excessive spacing between day columns with individual borders/outlines that made each day look separate.

**Solution Applied:**
- Removed all gap classes from the grid (`gap-1 md:gap-2` → no gap)
- Removed all border/outline classes from individual day boxes
- Removed rounded corners (`rounded-2xl`) from day boxes
- Added vertical dividers only: `border-r border-[#d4cfbe]/30` between columns (not on last column)
- Days now stick together as a continuous calendar with subtle vertical separators

**Design Intent:** Calendar should feel like one unified component, not separate cards.

## Critical Issues (11/2/2025)

### 1. Availability Page Calendar Navigation Not Working
**Problem:** The Previous/Today/Next buttons on the availability page don't update the displayed week.

**Root Cause:** Each availability in the `availabilities` state has its own static `weekData` that was set at initialization. When navigation buttons update `currentStartDate`, they don't update the individual availability's `weekData`.

**Solution Needed:** 
- Each availability should store a `currentStartDate` instead of static `weekData`
- Generate `weekData` dynamically based on that `currentStartDate`
- Or pass `currentStartDate` to the AvailabilityPage and generate weekData there

### 2. Too Much Spacing in Calendar Grid
**Problem:** Excessive padding/margins between day columns and around the calendar makes it not fit properly on screen.

**Current State:**
- Grid gap: `gap-2 md:gap-4` (too much space between columns)
- Container padding: `px-6 md:px-12` (too much horizontal padding)

**Solution:** Reduce gaps and padding to minimal values.

### 3. Mobile Pagination Missing
**Problem:** Mobile version should show 2 days at a time with swipe/pagination functionality, but currently just shows a static 2-column grid.

**Previous Behavior:** 
- Mobile showed 2 days per page
- User could swipe or use arrows to see next 2 days
- This was working before

**Current Behavior:** 
- Shows `grid-cols-2` which displays first 2 days of the 7-day array statically
- No pagination controls
- No swipe functionality

**Solution:** 
- Implement proper mobile pagination showing only 2 days at a time
- Add swipe gestures or ensure arrow navigation works for 2-day increments
- Make sure the 2 visible days update when navigating

## Architecture Notes

### Availability Data Structure
```typescript
interface Availability {
  id: string;
  name: string;
  weekData: DayAvailability[]; // THIS IS THE PROBLEM - static data
}
```

Should be:
```typescript
interface Availability {
  id: string;
  name: string;
  currentStartDate: Date; // Track current view date
  // weekData generated dynamically
}
```

### Navigation Functions
Located in App.tsx around line 573-608:
- `goToPreviousWeek()` - Updates `currentStartDate`
- `goToNextWeek()` - Updates `currentStartDate`
- `goToToday()` - Updates `currentStartDate`
- `isCurrentWeek()` - Checks if viewing current week

These work correctly but operate on the wrong state.

## Prevention
- Always test navigation immediately after implementing calendar features
- Ensure mobile responsive behavior is tested separately
- Don't store computed/derived data in state - compute it on demand
- Test with different availability contexts (not just the main calendar)
