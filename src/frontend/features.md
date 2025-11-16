# Features Documentation

## Calendar System

### Calendar View

#### Navigation

- **Week navigation**: ← Today → controls
- Previous/Next week navigation
- "Today" button to jump to current week (disabled when already there)

#### Display Format

- **Day labels**: Full date format (e.g., "Mon 6 Nov")
- **Day columns**: No gaps between columns, unified appearance
- **Time slots**: 15-minute increments, 12-hour format with AM/PM
- **Default availability**: Monday-Friday, 9 AM - 6 PM

#### Visual Design

- **Events**: Color-coded blocks with drag/resize handles
- **Time grid**: Subtle horizontal lines for time slots
- **Current time indicator**: Red line showing current time
- **Hover states**: Visual feedback on interactive elements

### Event Interactions

#### Desktop

- **Drag to create**: Click and drag on empty space
- **Drag to move**: Click and drag event to new time/day
- **Resize**: Drag top/bottom handles to adjust duration
- **Click to edit**: Click event to open edit modal

#### Mobile

- **Long-press to create**: Hold on empty space to start creating
- **Touch drag**: Drag events with touch
- **Tap to edit**: Tap event to open edit modal

### Event Management

- **Create**: Drag-to-create with auto-generated names
- **Update**: Edit title, time, description, attendees
- **Delete**: Remove events with confirmation
- **Google Meet**: Auto-generate meeting links
- **Overlap prevention**: Validates no conflicting events
- **Past event protection**: Cannot create/edit past events

## AI Assistant

### Natural Language Processing

- **Event creation**: "create meeting tomorrow at 3pm"
- **Queries**: "what events do I have today?"
- **Batch operations**: "create 3 events this week"
- **Context awareness**: Remembers conversation history

### Response Types

- **Feedback**: Markdown-formatted confirmation messages
- **Suggestions**: Action buttons for common tasks
- **Event cards**: Visual confirmation of created/updated events

### Performance

- **Keyword fast path**: <1ms for common commands
- **AI categorization**: 200-500ms
- **Full parsing**: 500-2000ms
- **Total response**: 1-3 seconds end-to-end

## Google Calendar Integration

### Sync Behavior

- **Polling interval**: 5 minutes
- **Bidirectional**: Changes sync both ways
- **Real-time updates**: UI updates immediately after mutations
- **Cache management**: Smart invalidation on account switching

### OAuth Flow

- **Authentication**: Via Internet Identity
- **Token storage**: Secure localStorage with expiration
- **Token refresh**: Automatic refresh before expiration
- **Account switching**: Detects and clears old account data

## Technical Stack

- **React 19** with TypeScript
- **React Query** for server state
- **Motion** for animations
- **Radix UI** for accessible components
- **Tailwind CSS** for styling
- **date-fns** for date manipulation
