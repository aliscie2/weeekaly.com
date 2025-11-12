# Diagnosis System

After removing debug `console.log` statements, we've implemented a comprehensive diagnosis system to help track and debug issues in production and development.

## Features

### 1. Error Boundary
- **Location**: `src/frontend/components/ErrorBoundary.tsx`
- **Purpose**: Catches React component errors and prevents app crashes
- **Features**:
  - Displays user-friendly error UI
  - Shows detailed error info in development mode
  - Provides recovery options (Try Again, Reload, Go Home)
  - Logs errors to console with full stack traces

### 2. Error Logger
- **Location**: `src/frontend/utils/errorLogger.ts`
- **Purpose**: Centralized error logging and tracking
- **Features**:
  - Logs errors, warnings, and info messages
  - Stores last 50 logs in memory
  - Persists logs to localStorage (development only)
  - Captures global errors and unhandled promise rejections
  - Provides diagnostic reports
  - Ready for integration with error tracking services (Sentry, LogRocket, etc.)

### 3. Diagnostic Panel
- **Location**: `src/frontend/components/DiagnosticPanel.tsx`
- **Purpose**: Interactive UI for viewing logs and diagnostics
- **Features**:
  - Toggle with `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac)
  - Real-time log updates
  - Filter by error level (error, warning, info)
  - Expandable log details with stack traces
  - Export diagnostic reports as JSON
  - Clear logs
  - Only available in development mode

## Usage

### In Development

#### Access Diagnostic Panel
Press `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac) to open the diagnostic panel.

#### Console Commands
The error logger is exposed to the browser console in development:

```javascript
// Get all logs
__errorLogger.getLogs()

// Get diagnostic report
__errorLogger.getDiagnosticReport()

// Export logs as JSON
__errorLogger.exportLogs()

// Clear all logs
__errorLogger.clearLogs()

// Get only errors
__errorLogger.getLogsByLevel('error')

// Get only warnings
__errorLogger.getLogsByLevel('warn')
```

### In Your Code

#### Log Errors
```typescript
import { errorLogger } from '../utils/errorLogger';

try {
  // Your code
} catch (error) {
  errorLogger.logError(
    'Failed to process data',
    error,
    {
      component: 'MyComponent',
      action: 'processData',
      metadata: { userId: '123', dataSize: 100 }
    }
  );
}
```

#### Log Warnings
```typescript
errorLogger.logWarning(
  'API response took longer than expected',
  {
    component: 'useBackend',
    action: 'fetchData',
    metadata: { duration: 5000 }
  }
);
```

#### Log Info (Development Only)
```typescript
errorLogger.logInfo(
  'User completed onboarding',
  {
    component: 'OnboardingFlow',
    action: 'complete',
    metadata: { steps: 5 }
  }
);
```

## Error Handling Best Practices

### 1. Always Provide Context
```typescript
// ❌ Bad
console.error('Error:', error);

// ✅ Good
errorLogger.logError(
  'Failed to create event',
  error,
  {
    component: 'EventForm',
    action: 'handleSubmit',
    metadata: { eventTitle: 'Meeting', attendees: 3 }
  }
);
```

### 2. Use Appropriate Log Levels
- **Error**: Something went wrong and needs attention
- **Warning**: Something unexpected but not critical
- **Info**: Important events for tracking (development only)

### 3. Include Metadata
Add relevant context that helps debug the issue:
```typescript
errorLogger.logError(
  'API request failed',
  error,
  {
    component: 'useBackend',
    action: 'createEvent',
    metadata: {
      endpoint: '/api/events',
      method: 'POST',
      statusCode: 500,
      requestId: 'abc123'
    }
  }
);
```

## Diagnostic Report Structure

```json
{
  "totalErrors": 5,
  "totalWarnings": 2,
  "recentErrors": [
    {
      "level": "error",
      "message": "Failed to create event",
      "error": {
        "message": "Network error",
        "stack": "Error: Network error\n    at..."
      },
      "context": {
        "component": "EventForm",
        "action": "handleSubmit",
        "metadata": { "eventTitle": "Meeting" }
      },
      "timestamp": "2025-01-15T10:30:00.000Z",
      "userAgent": "Mozilla/5.0...",
      "url": "https://example.com/events"
    }
  ],
  "systemInfo": {
    "userAgent": "Mozilla/5.0...",
    "url": "https://example.com",
    "timestamp": "2025-01-15T10:35:00.000Z",
    "isDevelopment": true
  }
}
```

## Integration with Error Tracking Services

To integrate with services like Sentry or LogRocket, update the `errorLogger.ts`:

```typescript
// In errorLogger.ts, uncomment and implement:
private sendToErrorService(entry: LogEntry): void {
  // Example: Sentry
  if (entry.level === 'error' && entry.error) {
    Sentry.captureException(entry.error, {
      contexts: {
        custom: entry.context
      },
      tags: {
        component: entry.context?.component,
        action: entry.context?.action
      }
    });
  }
}
```

## Troubleshooting

### Diagnostic Panel Not Opening
1. Make sure you're in development mode (`npm run start`)
2. Check browser console for errors
3. Try refreshing the page

### Logs Not Persisting
- Logs are only persisted in development mode
- Check localStorage quota (may be full)
- Clear old logs with `__errorLogger.clearLogs()`

### Too Many Logs
- Adjust `maxLogs` in `errorLogger.ts` (default: 50)
- Use `clearLogs()` to reset
- Filter by level to focus on errors

## Performance Considerations

- Logs are kept in memory (max 50 entries)
- localStorage persistence only in development
- Diagnostic panel updates every 2 seconds when open
- No performance impact in production (panel disabled)

## Future Enhancements

- [ ] Integration with Sentry/LogRocket
- [ ] Remote log viewing
- [ ] Performance metrics tracking
- [ ] User session replay
- [ ] Automated error reporting
- [ ] Log search and filtering
- [ ] Export to CSV format
