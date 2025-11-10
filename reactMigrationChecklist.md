# React 19 Migration Checklist

## Overview

Migrating from React 18 to React 19.2.0 to take advantage of:

- **Better automatic batching** - Reduces re-renders
- **Improved concurrent rendering** - Smoother UI updates
- **New hooks** - `useOptimistic`, `useFormStatus`, `use()`
- **Server Components** - (Optional, for future)
- **Actions** - Better form handling
- **Performance improvements** - Faster rendering

---

## Pre-Migration Checklist

### 1. Current Setup Audit

- [x] Current React version: 18.x
- [x] Using TypeScript: Yes
- [x] Using Vite: Yes
- [x] Using React Router: Yes (v6)
- [x] Using React Query: Yes (@tanstack/react-query)
- [x] Using Framer Motion: Yes (motion/react)

### 2. Dependencies to Update

- [ ] `react` → 19.2.0
- [ ] `react-dom` → 19.2.0
- [ ] `@types/react` → 19.2.0
- [ ] `@types/react-dom` → 19.2.0
- [ ] Check compatibility of all React-dependent libraries

### 3. Breaking Changes to Address

#### ✅ **Removed APIs** (Check if we use these)

- [ ] ~~`ReactDOM.render`~~ → Already using `createRoot` ✅
- [ ] ~~`ReactDOM.hydrate`~~ → Not used ✅
- [ ] ~~`ReactDOM.unmountComponentAtNode`~~ → Not used ✅
- [ ] ~~`ReactDOM.findDOMNode`~~ → Not used ✅
- [ ] ~~Legacy Context API~~ → Not used ✅

#### ⚠️ **Changed Behaviors**

- [ ] **Refs as props** - `ref` is now a regular prop (no more `forwardRef` needed)
- [ ] **Cleanup functions** - Effects cleanup timing changed
- [ ] **Hydration errors** - More strict hydration mismatch detection
- [ ] **Suspense behavior** - Changed fallback behavior

---

## Migration Steps

### Step 1: Update Package Versions

```bash
# Update React and React DOM
npm install react@19.2.0 react-dom@19.2.0

# Update TypeScript types
npm install -D @types/react@19.2.0 @types/react-dom@19.2.0
```

### Step 2: Check Dependency Compatibility

```bash
# Check for peer dependency issues
npm ls react react-dom

# Update incompatible packages
npm outdated
```

**Known Compatible Versions:**

- `react-router-dom`: 6.x (compatible)
- `@tanstack/react-query`: 5.x (compatible)
- `framer-motion`: Latest (check compatibility)
- `sonner`: Latest (check compatibility)

### Step 3: Code Changes Required

#### 3.1 Remove `forwardRef` (Optional - New Feature)

**Before (React 18):**

```typescript
const MyComponent = forwardRef<HTMLDivElement, Props>((props, ref) => {
  return <div ref={ref}>{props.children}</div>;
});
```

**After (React 19):**

```typescript
const MyComponent = ({ ref, ...props }: Props & { ref?: Ref<HTMLDivElement> }) => {
  return <div ref={ref}>{props.children}</div>;
};
```

#### 3.2 Update Effect Cleanup (If Needed)

**React 19 Change:** Cleanup functions run more predictably.

```typescript
// Ensure cleanup is idempotent
useEffect(() => {
  const subscription = subscribe();

  return () => {
    // This now runs more reliably
    subscription.unsubscribe();
  };
}, []);
```

#### 3.3 Use New Hooks (Optional Enhancements)

**`use()` Hook - For Promises and Context:**

```typescript
// Before
const [data, setData] = useState(null);
useEffect(() => {
  fetchData().then(setData);
}, []);

// After (React 19)
const data = use(fetchData()); // Suspends until resolved
```

**`useOptimistic()` - For Optimistic Updates:**

```typescript
// Perfect for our calendar mutations!
const [optimisticEvents, addOptimisticEvent] = useOptimistic(
  events,
  (state, newEvent) => [...state, newEvent],
);

// When creating event
addOptimisticEvent(newEvent); // Shows immediately
createEvent.mutate(newEvent); // Syncs with server
```

**`useFormStatus()` - For Form States:**

```typescript
// In EventFormModal
const { pending, data, method, action } = useFormStatus();

return (
  <button disabled={pending}>
    {pending ? 'Saving...' : 'Save Event'}
  </button>
);
```

### Step 4: Update StrictMode (Optional)

React 19 StrictMode has additional checks. Consider conditional rendering:

```typescript
// src/frontend/index.tsx
root.render(
  import.meta.env.DEV ? (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>
  ) : (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
);
```

### Step 5: Test Critical Paths

- [ ] **Authentication flow** - Login/logout
- [ ] **Calendar events** - Fetch, create, update, delete
- [ ] **Drag and drop** - Event creation and rescheduling
- [ ] **Navigation** - All routes work
- [ ] **Forms** - Event form modal
- [ ] **Mobile** - Touch events work

---

## Post-Migration Optimizations

### 1. Use `useOptimistic` for Calendar Events

**File:** `src/frontend/hooks/useEventActions.ts`

```typescript
import { useOptimistic } from "react";

export function useEventActions() {
  const [optimisticEvents, addOptimisticEvent] = useOptimistic(
    events,
    (state, newEvent) => [...state, newEvent],
  );

  const handleFormSubmit = (data: EventFormData) => {
    // Show event immediately (optimistic)
    const tempEvent = { ...data, id: `temp-${Date.now()}` };
    addOptimisticEvent(tempEvent);

    // Sync with server
    createEvent.mutate(data, {
      onSuccess: () => {
        // Optimistic update confirmed
      },
      onError: () => {
        // Revert optimistic update
        toast.error("Failed to create event");
      },
    });
  };

  return { optimisticEvents, handleFormSubmit };
}
```

### 2. Use Actions for Form Handling

**File:** `src/frontend/components/EventFormModal.tsx`

```typescript
// React 19 Actions
<form action={async (formData) => {
  'use server'; // If using Server Components

  const result = await createEvent(formData);
  return result;
}}>
  <input name="summary" />
  <button type="submit">Create Event</button>
</form>
```

### 3. Remove Unnecessary `useCallback`/`useMemo`

React 19 has better automatic memoization. Review and remove unnecessary memoization:

```typescript
// Before (React 18) - Needed for performance
const handleClick = useCallback(() => {
  doSomething();
}, [dependency]);

// After (React 19) - May not need memoization
const handleClick = () => {
  doSomething();
};
```

**Note:** Keep memoization for expensive computations!

---

## Testing Checklist

### Automated Tests

- [ ] Run existing tests: `npm test`
- [ ] Check for deprecation warnings
- [ ] Verify no console errors

### Manual Testing

- [ ] **Landing page** - Loads correctly
- [ ] **Login** - OAuth flow works
- [ ] **Contact page** - Chat interface works
- [ ] **Availability page** - Calendar displays
- [ ] **Drag to create** - Event creation works
- [ ] **Drag to reschedule** - Event rescheduling works
- [ ] **Event form** - Create/edit/delete works
- [ ] **Events page** - List displays correctly
- [ ] **Profile page** - Settings work
- [ ] **Mobile view** - Touch events work
- [ ] **Navigation** - All routes accessible

### Performance Testing

- [ ] Check render counts (should be lower)
- [ ] Test drag performance (should be smoother)
- [ ] Measure time to interactive
- [ ] Check memory usage

---

## Rollback Plan

If issues arise:

```bash
# Rollback to React 18
npm install react@18.3.1 react-dom@18.3.1
npm install -D @types/react@18.3.0 @types/react-dom@18.3.0

# Clear cache
rm -rf node_modules package-lock.json
npm install
```

---

## Expected Benefits

### Performance Improvements

- ✅ **Fewer re-renders** - Better automatic batching
- ✅ **Smoother drag** - Improved concurrent rendering
- ✅ **Faster mutations** - Optimistic updates with `useOptimistic`
- ✅ **Better UX** - Instant feedback on user actions

### Developer Experience

- ✅ **Simpler code** - No more `forwardRef` boilerplate
- ✅ **Better forms** - Actions and `useFormStatus`
- ✅ **Cleaner async** - `use()` hook for promises
- ✅ **Less memoization** - Automatic optimization

---

## Known Issues & Workarounds

### Issue 1: Third-party Library Compatibility

**Problem:** Some libraries may not support React 19 yet.

**Solution:**

```bash
# Use legacy peer deps flag
npm install --legacy-peer-deps
```

### Issue 2: TypeScript Errors

**Problem:** Type definitions may be incomplete.

**Solution:**

```typescript
// Add to tsconfig.json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

### Issue 3: Framer Motion Compatibility

**Problem:** `motion/react` may need update.

**Solution:**

```bash
# Update to latest version
npm install framer-motion@latest
```

---

## Migration Timeline

1. **Day 1: Preparation** (30 min)

   - Read React 19 changelog
   - Audit current code
   - Backup current state

2. **Day 1: Update Dependencies** (15 min)

   - Update React packages
   - Update TypeScript types
   - Fix peer dependency issues

3. **Day 1: Test & Fix** (1-2 hours)

   - Run tests
   - Manual testing
   - Fix any issues

4. **Day 2: Optimize** (Optional)
   - Add `useOptimistic` for calendar
   - Implement Actions for forms
   - Remove unnecessary memoization

---

## Resources

- [React 19 Release Notes](https://react.dev/blog/2024/04/25/react-19)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [New Hooks Documentation](https://react.dev/reference/react)
- [Actions Documentation](https://react.dev/reference/react-dom/components/form)

---

## Status Tracking

- [ ] **Phase 1: Preparation** - Read docs, audit code
- [ ] **Phase 2: Update** - Install React 19
- [ ] **Phase 3: Fix** - Address breaking changes
- [ ] **Phase 4: Test** - Verify functionality
- [ ] **Phase 5: Optimize** - Use new features
- [ ] **Phase 6: Deploy** - Ship to production

---

## Notes

- React 19 is production-ready and stable
- Most React 18 code works without changes
- New features are opt-in, not required
- Performance improvements are automatic
- StrictMode has additional checks (good for catching bugs)

---

## Decision: Proceed with Migration?

**Recommendation:** ✅ **YES**

**Reasons:**

1. Automatic performance improvements (fewer re-renders)
2. Better drag performance (our current issue!)
3. Stable release (not experimental)
4. Minimal breaking changes
5. Future-proof codebase

**Risk Level:** 🟢 **LOW**

- Most code compatible
- Easy rollback if needed
- Well-documented migration path
