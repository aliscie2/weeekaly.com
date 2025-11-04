# Features Documentation

## Agency Discovery Chat Interface

### Design System
- **Monochromatic beige color scheme** in light mode
- Pure, sleek, and simple aesthetic
- Gradient background: `from-[#f5f3ef] via-[#ebe8e0] to-[#e8e4d9]`
- Glass morphism effects with backdrop blur

### Animations
- **Initial page load animations**: Beautiful appearing animations when opening the website
- **Message sending animations**: Smooth animations when sending messages
- **Focus effects**: Everything dims (opacity: 0.7) when user is typing to help concentration
- **Input dynamics**: Input grows when focused and shrinks when not focused
- **Hover effects**: Text in chat history scales up while reducing opacity of everything else
- **Staggered animations**: Calendar day boxes appear with sequential delays (0.1s each)

### Progress System
- Progress bar at top of interface
- Real-time progress tracking (0-100%)
- Displays percentage complete
- Updates after each question answered

### Chat System
- **AI-initiated conversation**: Starts with AI questions
- **Chat history**: Full conversation history display
- **Input bar**: Dynamic sizing based on focus state
- **Quick suggestions**: Yes/No options that send immediately when clicked
- **Auto-scroll**: Messages automatically scroll to bottom

### Responsive Design
- Fully responsive for mobile and desktop
- Dynamic sizing and spacing adjustments
- Touch-friendly interface elements
- Optimized layouts for different screen sizes

## Calendar System

### Calendar Dropdown (Header)
- **Location**: Appears in the Agency Discovery chat interface header
- **Design**: 7-column weekly availability view
- **Visual indicators**: 
  - Green boxes for available days with time slots
  - Gray boxes for unavailable days
  - Time display: Shows only availability times (e.g., 9 AM - 6 PM)
- **Navigation controls**: 
  - ← (Previous Week) button
  - Today button (returns to current week)
  - → (Next Week) button
  - Today button is disabled when viewing current week
- **Action buttons**:
  - "Expand" button: Opens full calendar page view
  - "Share" button: Copies calendar sharing link to clipboard

### Full Calendar Page View

#### Navigation
- **Back arrow**: Top-left corner arrow returns to Agency Discovery interface
- **Week navigation**: 
  - Large ← Today → controls at the top
  - Previous/Next week navigation
  - "Today" button to jump back to current week
  - Today button disabled when already viewing current week

#### Display Format
- **Day labels**: Shows full date format (e.g., "Mon 6 Nov", "Tue 7 Nov", "Wed 8 Nov")
- **Day boxes**: 
  - Larger boxes (h-64) with staggered appearance animations
  - No gaps between day columns (flex-1 with no gap)
  - Rounded corners (rounded-2xl)
- **Time slots**:
  - Only displays available time slots (not full day)
  - Default availability: Monday-Friday, 9 AM - 6 PM
  - Weekends shown as unavailable (no time slots)
  - Time format: 12-hour with AM/PM

#### Visual Design
- **Available days**: 
  - Green background (bg-green-500/70)
  - Green border (border-green-600/50)
  - Shadow effect for depth
  - Centered time display showing start time, "to", and end time
- **Unavailable days**:
  - Light beige background (bg-[#e8e4d9]/50)
  - Subtle border (border-[#d4cfbe]/40)
  - Empty box (no content)

### Data Structure
```typescript
interface TimeSlot {
  start: string;  // e.g., "9:00 AM"
  end: string;    // e.g., "6:00 PM"
}

interface DayAvailability {
  date: Date;           // Full date object
  dayName: string;      // Day abbreviation (Mon, Tue, etc.)
  available: boolean;   // Whether day has available slots
  timeSlots: TimeSlot[]; // Array of available time slots
}
```

### Week Calculation
- **Week starts**: Sunday (day 0)
- **Auto-calculation**: Week data calculated from start date
- **Default availability**: Weekdays (Mon-Fri) with 9 AM - 6 PM slots
- **Weekend handling**: Sat-Sun marked as unavailable with no time slots

## Clipboard Functionality
- **Fallback method**: Uses `document.execCommand('copy')` when Clipboard API is blocked
- **Toast notifications**: 
  - Success: "Calendar link copied!"
  - Error: "Failed to copy link"
- **Implementation**: Creates temporary textarea element for reliable copying

## User Experience Enhancements
- **Smooth transitions**: All state changes animated (0.3-0.6s duration)
- **Visual feedback**: Hover states on all interactive elements
- **Loading states**: Disabled states for buttons when not applicable
- **Accessibility**: Proper ARIA labels and semantic HTML

## Technical Implementation Notes
- React functional components with hooks
- Motion/React for smooth animations
- TypeScript for type safety
- Shadcn/ui components for consistent UI
- Lucide icons for iconography
- Date manipulation for calendar logic
- No gaps/padding between calendar day columns (using flex-1 without gap)
