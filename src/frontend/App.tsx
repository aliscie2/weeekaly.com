import { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Progress } from './components/ui/progress';
import { motion } from 'motion/react';
import { Calendar, User, CalendarDays, Share2, Expand, Trash2, Plus } from 'lucide-react';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { DemoSection } from './components/DemoSection';
import { ProfilePage } from './components/ProfilePage';
import { EventsPage, Event, EventAttendee } from './components/EventsPage';
import { EventDetailsPage } from './components/EventDetailsPage';
import { AvailabilityPage } from './components/AvailabilityPage';
import { AvatarEditPage } from './components/AvatarEditPage';
import { DeleteConfirmationPage } from './components/DeleteConfirmationPage';
import { QuickGatheringPage } from './components/QuickGatheringPage';
import logo from './public/logo.png';
import { backendActor, setAuthenticatedActor } from './utils/actor';
import { useHelloWorld, useCalendarEvents } from './hooks/useBackend';
import { useOAuthIdentity } from './hooks/useOAuthIdentity';
import { useQueryClient } from '@tanstack/react-query';

interface Message {
  id: string;
  text: string;
  isAi: boolean;
  timestamp: Date;
}

interface TimeSlot {
  start: string;
  end: string;
}

interface DayAvailability {
  date: Date;
  dayName: string;
  available: boolean;
  timeSlots: TimeSlot[];
}

interface GoogleAccount {
  id: string;
  email: string;
  name: string;
  avatar: string;
  isDefault: boolean;
}

interface Availability {
  id: string;
  name: string;
  currentStartDate: Date;
}

const QUESTIONS = [
  "Welcome! I'm here to help you build your dream software system. What type of project are you looking to create?",
  "What's the main problem you're trying to solve with this software?",
  "Who will be the primary users of your system?",
  "Do you have a specific timeline in mind for this project?",
  "What's your budget range for this project?",
];

// Helper function to get days data starting from a specific date
const getDaysData = (startDate: Date, count: number): DayAvailability[] => {
  const days: DayAvailability[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  for (let i = 0; i < count; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dayOfWeek = date.getDay();
    
    // Available Mon-Fri with 9 AM - 6 PM slots
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    // Tuesday (dayOfWeek === 2) has different time slot
    let timeSlots: TimeSlot[] = [];
    if (isWeekday) {
      if (dayOfWeek === 2) {
        timeSlots = [{ start: '9:00 AM', end: '3:00 PM' }];
      } else {
        timeSlots = [{ start: '9:00 AM', end: '6:00 PM' }];
      }
    }
    
    days.push({
      date: new Date(date),
      dayName: dayNames[dayOfWeek],
      available: isWeekday,
      timeSlots: timeSlots
    });
  }
  
  return days;
};

// Get the start of the current week (Sunday)
const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

// Helper function to parse time string to hours (e.g., "9:00 AM" -> 9, "3:00 PM" -> 15)
const parseTimeToHours = (timeString: string): number => {
  const [time, period] = timeString.split(' ');
  const [hours, minutes] = time.split(':').map(Number);
  
  let totalHours = hours;
  if (period === 'PM' && hours !== 12) {
    totalHours += 12;
  } else if (period === 'AM' && hours === 12) {
    totalHours = 0;
  }
  
  return totalHours + minutes / 60;
};

// Calculate duration in hours from time slot
const calculateDuration = (timeSlot: TimeSlot): number => {
  const startHours = parseTimeToHours(timeSlot.start);
  const endHours = parseTimeToHours(timeSlot.end);
  return endHours - startHours;
};

// Calculate proportional height based on duration (max 9 hours = 9 AM to 6 PM)
const getProportionalHeight = (timeSlot: TimeSlot, maxHeightPx: number): number => {
  const duration = calculateDuration(timeSlot);
  const maxDuration = 9; // 9 hours is the reference (9 AM - 6 PM)
  return Math.round((duration / maxDuration) * maxHeightPx);
};

// Current user ID - represents the logged-in user
const CURRENT_USER_ID = 'current-user';

export default function App() {
  // React Query client for cache management
  const queryClient = useQueryClient();
  
  // OAuth identity hook
  const { login: loginWithOAuth, logout: logoutOAuth, identity, isAuthenticated, isLoading: authLoading } = useOAuthIdentity();

  // Update backend actor when identity changes (login or restore from storage)
  useEffect(() => {
    if (isAuthenticated && identity) {
      console.log('✅ [App] User is authenticated');
      
      // Update the backend actor with the authenticated identity
      setAuthenticatedActor(identity);
      
      // Verify authentication and log user data
      backendActor.get_caller().then((callerPrincipal) => {
        // Get user info from backend
        return backendActor.get_user_info();
      }).then(async (userInfo) => {
        // Log stored user data from OAuth (localStorage)
        const userEmail = localStorage.getItem('ic-user-email');
        const userName = localStorage.getItem('ic-user-name');
        const userId = localStorage.getItem('ic-user-id');
        const userPicture = localStorage.getItem('ic-user-picture');
        
        console.log({
          event: '📋 USER INFORMATION (After Login/Restore)',
          email: {
            localStorage: userEmail || 'Not available',
            backend: userInfo.email || 'Not available'
          },
          name: {
            localStorage: userName || 'Not available',
            backend: userInfo.name || 'Not available'
          },
          userId: {
            localStorage: userId || 'Not available',
            backend: userInfo.user_id || 'Not available'
          },
          picture: userPicture || 'Not available',
          principal: userInfo.principal,
          calendar: {
            note: '📅 Calendar events will be loaded by React Query hook'
          }
        });
        
        // Trigger calendar events fetch via React Query (removes redundant fetch)
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      }).catch((error) => {
        console.error('❌ [App] Failed to get user info:', error);
      });
    } else if (!authLoading) {
      console.log('⚠️ [App] User is NOT authenticated');
    }
  }, [isAuthenticated, identity, authLoading]);
  
  // Use React Query to fetch backend data - only runs once and caches the result
  const { data: backendMessage } = useHelloWorld();
  
  // Auto-refresh calendar events every 5 minutes (optimized from 30 seconds)
  const { data: calendarEventsFromBackend, isLoading: isLoadingEvents } = useCalendarEvents(
    isAuthenticated // Only poll when user is authenticated
  );
  
  // Log the message when it's available
  useEffect(() => {
    if (backendMessage) {
      console.log(backendMessage);
    }
  }, [backendMessage]);
  
  // Log when calendar events are fetched
  useEffect(() => {
    if (calendarEventsFromBackend) {
      console.log('📅 [Calendar] Events updated:', {
        timestamp: new Date().toISOString(),
        events: calendarEventsFromBackend,
        count: calendarEventsFromBackend.length
      });
    }
  }, [calendarEventsFromBackend]);
  
  const [currentView, setCurrentView] = useState<'landing' | 'contact' | 'availability' | 'profile' | 'avatarEdit' | 'events' | 'eventDetails' | 'deleteConfirmation' | 'eventDeleteConfirmation' | 'quickGathering'>('landing');
  
  // Automatically switch to contact view when user is authenticated (on mount or after login)
  useEffect(() => {
    if (isAuthenticated && !authLoading && currentView === 'landing') {
      console.log('✅ [App] User authenticated - switching from landing to contact view');
      setCurrentView('contact');
    }
  }, [isAuthenticated, authLoading, currentView]);
  const [selectedAvailabilityId, setSelectedAvailabilityId] = useState<string | null>(null);
  const [availabilityToDelete, setAvailabilityToDelete] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [eventActionType, setEventActionType] = useState<'cancel' | 'delete' | null>(null);
  const [pendingEventDeletion, setPendingEventDeletion] = useState<Event | null>(null);
  const [eventDetailsBackView, setEventDetailsBackView] = useState<'events' | 'availability'>('events');
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Calendar state - for mobile start with today, for desktop start with week
  const [currentStartDate, setCurrentStartDate] = useState<Date>(() => {
    if (window.innerWidth < 768) {
      return new Date(); // Start with today on mobile
    } else {
      return getStartOfWeek(new Date()); // Start with week on desktop
    }
  });
  
  const [weekData, setWeekData] = useState<DayAvailability[]>(() => {
    const count = window.innerWidth < 768 ? 2 : 7;
    const startDate = window.innerWidth < 768 ? new Date() : getStartOfWeek(new Date());
    return getDaysData(startDate, count);
  });

  // Events state
  const [events, setEvents] = useState<Event[]>([
    {
      id: '1',
      title: 'Q4 Strategy Planning Meeting',
      startTime: new Date(2025, 10, 2, 14, 0), // Nov 2, 2025 2:00 PM
      endTime: new Date(2025, 10, 2, 15, 30),
      attendees: [
        {
          id: 'a1',
          name: 'Sarah Johnson',
          email: 'sarah.j@company.com',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400'
        },
        {
          id: 'a2',
          name: 'Mike Chen',
          email: 'mike.c@company.com',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'
        },
        {
          id: 'a3',
          name: 'Emily Davis',
          email: 'emily.d@company.com',
          avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400'
        }
      ],
      meetLink: 'https://meet.google.com/abc-defg-hij',
      aiSummary: 'Quarterly strategy review focusing on revenue targets, market expansion opportunities, and team restructuring for 2026.',
      thumbnail: 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG1lZXRpbmclMjByb29tfGVufDF8fHx8MTc2MjA1ODY0MHww&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'Conference Room A',
      createdBy: 'a1' // Created by Sarah Johnson
    },
    {
      id: '2',
      title: 'Coffee Chat with Product Team',
      startTime: new Date(2025, 10, 3, 10, 0), // Nov 3, 2025 10:00 AM
      endTime: new Date(2025, 10, 3, 11, 0),
      attendees: [
        {
          id: 'a4',
          name: 'Alex Rivera',
          email: 'alex.r@company.com',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400'
        },
        {
          id: 'a5',
          name: 'Jessica Wong',
          email: 'jessica.w@company.com',
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400'
        }
      ],
      meetLink: 'https://meet.google.com/xyz-abcd-efg',
      aiSummary: 'Informal discussion about upcoming product features, user feedback analysis, and brainstorming session for UI improvements.',
      thumbnail: 'https://images.unsplash.com/photo-1634663071594-d61168cbc8d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBzaG9wJTIwY2FzdWFsfGVufDF8fHx8MTc2MjA1ODY0MHww&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'The Local Cafe',
      createdBy: CURRENT_USER_ID // Created by current user
    },
    {
      id: '3',
      title: 'Client Presentation - TechCorp',
      startTime: new Date(2025, 10, 4, 15, 0), // Nov 4, 2025 3:00 PM
      endTime: new Date(2025, 10, 4, 16, 30),
      attendees: [
        {
          id: 'a6',
          name: 'David Miller',
          email: 'david.m@techcorp.com',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400'
        },
        {
          id: 'a7',
          name: 'Lisa Anderson',
          email: 'lisa.a@techcorp.com',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'
        },
        {
          id: 'a8',
          name: 'Tom Wilson',
          email: 'tom.w@company.com',
          avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400'
        },
        {
          id: 'a9',
          name: 'Rachel Green',
          email: 'rachel.g@company.com',
          avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400'
        }
      ],
      meetLink: 'https://meet.google.com/client-demo-123',
      aiSummary: 'Presenting our new software solution to TechCorp stakeholders. Demo of key features, pricing discussion, and Q&A session about implementation timeline.',
      thumbnail: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjBjb2xsYWJvcmF0aW9ufGVufDF8fHx8MTc2MjAxOTc2N3ww&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'Virtual',
      createdBy: CURRENT_USER_ID // Created by current user
    },
    {
      id: '4',
      title: 'Weekly Team Standup',
      startTime: new Date(2025, 10, 5, 9, 0), // Nov 5, 2025 9:00 AM
      endTime: new Date(2025, 10, 5, 9, 30),
      attendees: [
        {
          id: 'a10',
          name: 'Chris Lee',
          email: 'chris.l@company.com',
          avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400'
        },
        {
          id: 'a11',
          name: 'Maria Garcia',
          email: 'maria.g@company.com',
          avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400'
        },
        {
          id: 'a12',
          name: 'James Brown',
          email: 'james.b@company.com',
          avatar: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400'
        },
        {
          id: 'a13',
          name: 'Nina Patel',
          email: 'nina.p@company.com',
          avatar: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400'
        },
        {
          id: 'a14',
          name: 'Kevin Park',
          email: 'kevin.p@company.com',
          avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400'
        }
      ],
      meetLink: 'https://meet.google.com/team-standup',
      aiSummary: 'Regular team sync to discuss progress updates, blockers, and priorities for the week. Quick check-in format with each team member sharing their status.',
      thumbnail: 'https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWRlbyUyMGNvbmZlcmVuY2V8ZW58MXx8fHwxNzYyMDU4NjQxfDA&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'Virtual',
      createdBy: 'a10' // Created by Chris Lee
    },
    {
      id: '5',
      title: 'Budget Review Meeting',
      startTime: new Date(2025, 9, 28, 13, 0), // Oct 28, 2025 (Past)
      endTime: new Date(2025, 9, 28, 14, 30),
      attendees: [
        {
          id: 'a15',
          name: 'Robert Taylor',
          email: 'robert.t@company.com',
          avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400'
        },
        {
          id: 'a16',
          name: 'Amanda White',
          email: 'amanda.w@company.com',
          avatar: 'https://images.unsplash.com/photo-1598550874175-4d0ef436c909?w=400'
        }
      ],
      aiSummary: `Meeting Summary:
Reviewed Q3 budget allocation and planned Q4 initiatives with the finance team.

Key Discussion Points:
• Analyzed Q3 spending vs budget - came in 8% under budget
• Discussed cost optimization strategies for cloud infrastructure
• Reviewed department-wise budget allocation for Q4
• Evaluated ROI on recent marketing campaigns

Action Items:
• Approved $50K additional funding for digital marketing campaigns
• Decided to reallocate $30K from operations to product development
• Scheduled follow-up meeting to review cloud cost optimization proposals
• Amanda to prepare detailed Q4 budget breakdown by department`,
      thumbnail: 'https://images.unsplash.com/photo-1709715357520-5e1047a2b691?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWFtJTIwbWVldGluZ3xlbnwxfHx8fDE3NjIwMjg2NDV8MA&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'Conference Room B',
      createdBy: 'a15' // Created by Robert Taylor
    },
    {
      id: '6',
      title: 'Product Roadmap Planning',
      startTime: new Date(2025, 9, 25, 10, 0), // Oct 25, 2025 (Past)
      endTime: new Date(2025, 9, 25, 12, 0),
      attendees: [
        {
          id: 'a17',
          name: 'Sarah Johnson',
          email: 'sarah.j@company.com',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400'
        },
        {
          id: 'a18',
          name: 'Alex Rivera',
          email: 'alex.r@company.com',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400'
        },
        {
          id: 'a19',
          name: 'Jessica Wong',
          email: 'jessica.w@company.com',
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400'
        },
        {
          id: 'a20',
          name: 'Mike Chen',
          email: 'mike.c@company.com',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'
        }
      ],
      aiSummary: `Meeting Summary:
Strategic planning session for Q1 2026 product roadmap with product and engineering teams.

Key Discussion Points:
• Prioritized feature requests from top 5 enterprise clients
• Reviewed user feedback from recent survey (2,340 responses)
• Discussed technical debt items that need addressing
• Evaluated competitor feature comparisons and market positioning

Decisions Made:
• Advanced search functionality moved to top priority for Q1
• Mobile app redesign scheduled for Q2 2026
• API rate limiting improvements approved for December release
• AI-powered recommendations feature greenlit for Q1 development

Action Items:
• Sarah to draft detailed specs for advanced search by Nov 5
• Alex to create technical architecture proposal for AI features
• Jessica to conduct user interviews with 10 enterprise clients
• Mike to prepare resource allocation plan for Q1 features`,
      thumbnail: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvZmZpY2UlMjBjb2xsYWJvcmF0aW9ufGVufDF8fHx8MTc2MjAxOTc2N3ww&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'Conference Room A',
      createdBy: CURRENT_USER_ID // Created by current user
    },
    {
      id: '7',
      title: 'Client Onboarding - Acme Corp',
      startTime: new Date(2025, 9, 22, 14, 0), // Oct 22, 2025 (Past)
      endTime: new Date(2025, 9, 22, 15, 30),
      attendees: [
        {
          id: 'a21',
          name: 'Jennifer Blake',
          email: 'jennifer.b@acmecorp.com',
          avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400'
        },
        {
          id: 'a22',
          name: 'Marcus Thompson',
          email: 'marcus.t@acmecorp.com',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400'
        },
        {
          id: 'a23',
          name: 'Tom Wilson',
          email: 'tom.w@company.com',
          avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400'
        }
      ],
      aiSummary: `Meeting Summary:
Initial onboarding session with Acme Corp's new enterprise account team.

Key Discussion Points:
• Walked through platform setup and configuration options
• Discussed integration requirements with their existing CRM system
• Reviewed security protocols and compliance requirements
• Explained team structure and support escalation paths

Topics Covered:
• SSO integration timeline - estimated 2 weeks implementation
�� Custom branding options for their portal
• Data migration strategy from their legacy system
• Training schedule for their 50-person team

Outcomes:
• Signed off on implementation timeline with go-live date of Nov 15
• Agreed on weekly check-in meetings during onboarding phase
• Received their API credentials and sandbox environment access
• Scheduled technical workshop for their dev team on Nov 1

Next Steps:
• Tom to send onboarding checklist and documentation
• Client to provide CRM API specs by Oct 28
• Setup training sessions for Week of Nov 8`,
      thumbnail: 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG1lZXRpbmclMjByb29tfGVufDF8fHx8MTc2MjA1ODY0MHww&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'Virtual',
      createdBy: 'a23' // Created by Tom Wilson
    }
  ]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [newEventCount, setNewEventCount] = useState(2); // Number of new/unread events
  const [hasViewedEvents, setHasViewedEvents] = useState(false);

  // Mock contacts for quick gathering
  const mockContacts = [
    {
      id: 'c1',
      name: 'Sarah Johnson',
      email: 'sarah.j@company.com',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
      distance: 2.3,
      available: true
    },
    {
      id: 'c2',
      name: 'Mike Chen',
      email: 'mike.c@company.com',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      distance: 4.1,
      available: true
    },
    {
      id: 'c3',
      name: 'Emily Davis',
      email: 'emily.d@company.com',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
      distance: 1.8,
      available: false
    },
    {
      id: 'c4',
      name: 'Alex Rivera',
      email: 'alex.r@company.com',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
      distance: 7.2,
      available: true
    },
    {
      id: 'c5',
      name: 'Jessica Wong',
      email: 'jessica.w@company.com',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
      distance: 3.5,
      available: true
    }
  ];

  // Availabilities state
  const [availabilities, setAvailabilities] = useState<Availability[]>([
    {
      id: '1',
      name: 'Business Meetings',
      currentStartDate: isMobile ? new Date() : getStartOfWeek(new Date())
    },
    {
      id: '2',
      name: 'Family Meetings',
      currentStartDate: isMobile ? new Date() : getStartOfWeek(new Date())
    }
  ]);

  // Profile state
  const [username, setUsername] = useState('John Doe');
  const [userAvatar, setUserAvatar] = useState('https://images.unsplash.com/photo-1581065178047-8ee15951ede6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMHBvcnRyYWl0fGVufDF8fHx8MTc2MjAzMzEwMHww&ixlib=rb-4.1.0&q=80&w=400');
  const [description, setDescription] = useState('Building amazing software solutions for businesses.');
  const [avatarImageSrc, setAvatarImageSrc] = useState<string | null>(null);
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([
    {
      id: '1',
      email: 'john.doe@gmail.com',
      name: 'John Doe',
      avatar: 'https://images.unsplash.com/photo-1581065178047-8ee15951ede6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMHBvcnRyYWl0fGVufDF8fHx8MTc2MjAzMzEwMHww&ixlib=rb-4.1.0&q=80&w=400',
      isDefault: true,
    },
    {
      id: '2',
      email: 'john.work@gmail.com',
      name: 'John Work',
      avatar: 'https://images.unsplash.com/photo-1576558656222-ba66febe3dec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHByb2Zlc3Npb25hbCUyMGhlYWRzaG90fGVufDF8fHx8MTc2MjAyNDQ4MHww&ixlib=rb-4.1.0&q=80&w=400',
      isDefault: false,
    },
  ]);

  // Handle window resize to detect mobile/desktop switch
  useEffect(() => {
    const handleResize = () => {
      const wasMobile = isMobile;
      const nowMobile = window.innerWidth < 768;
      setIsMobile(nowMobile);
      
      // If switching between mobile and desktop, reset the view
      if (wasMobile !== nowMobile) {
        const count = nowMobile ? 2 : 7;
        const startDate = nowMobile ? new Date() : getStartOfWeek(new Date());
        setCurrentStartDate(startDate);
        setWeekData(getDaysData(startDate, count));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);

  // Update week data when currentStartDate changes
  useEffect(() => {
    const count = isMobile ? 2 : 7;
    setWeekData(getDaysData(currentStartDate, count));
  }, [currentStartDate, isMobile]);

  // Scroll to bottom whenever messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial AI message (only for contact view)
  useEffect(() => {
    if (currentView === 'contact' && messages.length === 0) {
      setTimeout(() => {
        addAiMessage(QUESTIONS[0]);
      }, 800);
    }
  }, [currentView]);

  // Cleanup timeout and interval on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  const addAiMessage = (text: string) => {
    setMessages(prev => [...prev, {
      id: `ai-${Date.now()}`,
      text,
      isAi: true,
      timestamp: new Date(),
    }]);
  };

  const addUserMessage = (text: string) => {
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      text,
      isAi: false,
      timestamp: new Date(),
    }]);

    // Update progress
    const newProgress = Math.min(100, ((currentQuestion + 1) / QUESTIONS.length) * 100);
    setProgress(newProgress);

    // Send next question
    setTimeout(() => {
      if (currentQuestion < QUESTIONS.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        addAiMessage(QUESTIONS[currentQuestion + 1]);
      } else if (currentQuestion === QUESTIONS.length - 1) {
        addAiMessage("Thank you for sharing! Based on your responses, I'd love to know more. Is there anything specific you'd like to add about your vision?");
        setCurrentQuestion(prev => prev + 1);
      }
    }, 800);
  };

  const handleSendMessage = (text: string) => {
    if (text.trim()) {
      addUserMessage(text);
    }
  };



  // Calendar navigation - navigates by 7 days on desktop, 2 days on mobile
  const goToPreviousWeek = () => {
    const newStart = new Date(currentStartDate);
    const daysToSubtract = isMobile ? 2 : 7;
    newStart.setDate(currentStartDate.getDate() - daysToSubtract);
    setCurrentStartDate(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentStartDate);
    const daysToAdd = isMobile ? 2 : 7;
    newStart.setDate(currentStartDate.getDate() + daysToAdd);
    setCurrentStartDate(newStart);
  };

  const goToToday = () => {
    if (isMobile) {
      setCurrentStartDate(new Date());
    } else {
      setCurrentStartDate(getStartOfWeek(new Date()));
    }
  };

  const isCurrentWeek = () => {
    if (isMobile) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const current = new Date(currentStartDate);
      current.setHours(0, 0, 0, 0);
      // Check if we're showing today or tomorrow
      const daysDiff = Math.floor((current.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff <= 1;
    } else {
      const todayWeekStart = getStartOfWeek(new Date());
      return currentStartDate.getTime() === todayWeekStart.getTime();
    }
  };

  const formatDate = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };



  // Profile handlers
  const handleSetDefaultAccount = (id: string) => {
    setGoogleAccounts(accounts =>
      accounts.map(account => ({
        ...account,
        isDefault: account.id === id,
      }))
    );
    toast.success('Default account updated!');
  };

  const handleDeleteAccount = (id: string) => {
    const accountToDelete = googleAccounts.find(acc => acc.id === id);
    if (accountToDelete?.isDefault) {
      toast.error('Cannot delete the default account. Set another account as default first.');
      return;
    }
    setGoogleAccounts(accounts => accounts.filter(account => account.id !== id));
    toast.success('Account removed successfully!');
  };

  const handleAddAccount = () => {
    const newAccount: GoogleAccount = {
      id: Date.now().toString(),
      email: `newaccount${googleAccounts.length}@gmail.com`,
      name: `New Account ${googleAccounts.length}`,
      avatar: `https://images.unsplash.com/photo-${1500000000000 + googleAccounts.length}?w=400&h=400&fit=crop`,
      isDefault: false,
    };
    setGoogleAccounts(accounts => [...accounts, newAccount]);
    toast.success('New account added!');
  };

  const handleLogout = () => {
    console.log('🚪 [App] Logging out user');
    
    // Clear all user data and session (handled by hook)
    logoutOAuth();
    
    // Invalidate all queries to clear cached data
    queryClient.clear();
    
    toast.success('Logged out successfully!');
    setCurrentView('landing');
  };

  const handleUpdateDescription = (desc: string) => {
    setDescription(desc);
  };

  const handleUpdateUsername = (name: string) => {
    setUsername(name);
  };

  const handleUpdateAvatar = (avatar: string) => {
    setUserAvatar(avatar);
  };

  // Avatar edit handlers
  const handleStartAvatarEdit = (imageSrc: string) => {
    setAvatarImageSrc(imageSrc);
    setCurrentView('avatarEdit');
  };

  // Helper function to create image from URL
  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  // Helper function to get cropped image
  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: { x: number; y: number; width: number; height: number }
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL('image/jpeg');
  };

  const handleSaveAvatar = async (croppedAreaPixels: any) => {
    try {
      if (avatarImageSrc && croppedAreaPixels) {
        const croppedImage = await getCroppedImg(avatarImageSrc, croppedAreaPixels);
        setUserAvatar(croppedImage);
        toast.success('Avatar updated!');
        setAvatarImageSrc(null);
        setCurrentView('profile');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to update avatar');
    }
  };

  const handleCancelAvatarEdit = () => {
    setAvatarImageSrc(null);
    setCurrentView('profile');
  };

  // Availability handlers
  const handleOpenAvailability = (availabilityId: string) => {
    setSelectedAvailabilityId(availabilityId);
    setCurrentView('availability');
  };

  const handleShareAvailability = (availabilityId: string) => {
    const availability = availabilities.find(a => a.id === availabilityId);
    if (availability) {
      const shareUrl = `${window.location.origin}/availability/${availabilityId}`;
      // Use fallback method for clipboard to avoid permissions policy issues
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      
      try {
        document.execCommand('copy');
      } catch (err) {
        toast.error('Failed to copy link');
        document.body.removeChild(textarea);
        return;
      }
      
      document.body.removeChild(textarea);
      toast.success(`Link for "${availability.name}" copied to clipboard!`);
    }
  };

  const handleDeleteAvailability = (availabilityId: string) => {
    setAvailabilityToDelete(availabilityId);
    setCurrentView('deleteConfirmation');
  };

  // Availability navigation handlers
  const handleAvailabilityPreviousWeek = (availabilityId: string) => {
    setAvailabilities(prev => prev.map(avail => {
      if (avail.id === availabilityId) {
        const newStart = new Date(avail.currentStartDate);
        const daysToSubtract = isMobile ? 2 : 7;
        newStart.setDate(avail.currentStartDate.getDate() - daysToSubtract);
        return { ...avail, currentStartDate: newStart };
      }
      return avail;
    }));
  };

  const handleAvailabilityNextWeek = (availabilityId: string) => {
    setAvailabilities(prev => prev.map(avail => {
      if (avail.id === availabilityId) {
        const newStart = new Date(avail.currentStartDate);
        const daysToAdd = isMobile ? 2 : 7;
        newStart.setDate(avail.currentStartDate.getDate() + daysToAdd);
        return { ...avail, currentStartDate: newStart };
      }
      return avail;
    }));
  };

  const handleAvailabilityToday = (availabilityId: string) => {
    setAvailabilities(prev => prev.map(avail => {
      if (avail.id === availabilityId) {
        const newStart = isMobile ? new Date() : getStartOfWeek(new Date());
        return { ...avail, currentStartDate: newStart };
      }
      return avail;
    }));
  };

  const isAvailabilityCurrentWeek = (availabilityId: string) => {
    const availability = availabilities.find(a => a.id === availabilityId);
    if (!availability) return false;

    if (isMobile) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const current = new Date(availability.currentStartDate);
      current.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((current.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff <= 1;
    } else {
      const todayWeekStart = getStartOfWeek(new Date());
      return availability.currentStartDate.getTime() === todayWeekStart.getTime();
    }
  };

  const handleConfirmDelete = () => {
    if (availabilityToDelete) {
      const availability = availabilities.find(a => a.id === availabilityToDelete);
      setAvailabilities(prev => prev.filter(a => a.id !== availabilityToDelete));
      toast.success(`"${availability?.name}" deleted successfully!`);
      setAvailabilityToDelete(null);
      setCurrentView('contact');
    }
  };

  const handleCancelDelete = () => {
    setAvailabilityToDelete(null);
    setCurrentView('contact');
  };

  const handleAddAvailability = () => {
    if (availabilities.length >= 5) {
      toast.error('Maximum 5 availabilities allowed');
      return;
    }
    const newAvailability: Availability = {
      id: Date.now().toString(),
      name: `New Availability ${availabilities.length + 1}`,
      currentStartDate: isMobile ? new Date() : getStartOfWeek(new Date())
    };
    setAvailabilities(prev => [...prev, newAvailability]);
    toast.success('New availability created!');
  };

  // Event handlers
  const handleEventClick = (eventId: string) => {
    setSelectedEventId(eventId);
    setEventDetailsBackView('events');
    setCurrentView('eventDetails');
  };

  const handleCancelEvent = (eventId: string) => {
    setEventToDelete(eventId);
    setEventActionType('cancel');
    setCurrentView('eventDeleteConfirmation');
  };

  const handleDeleteEvent = (eventId: string) => {
    setEventToDelete(eventId);
    setEventActionType('delete');
    setCurrentView('eventDeleteConfirmation');
  };

  const handleConfirmEventAction = () => {
    if (!eventToDelete) return;

    const event = events.find(e => e.id === eventToDelete);
    if (!event) return;

    // Store the event for potential undo
    setPendingEventDeletion(event);

    // Remove from list
    setEvents(prev => prev.filter(e => e.id !== eventToDelete));

    // Go back to events list
    setCurrentView('events');

    // Clear any existing timeouts/intervals
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    // Create countdown state for toast
    let countdown = 3;
    const toastMessage = eventActionType === 'cancel' 
      ? `You cancelled "${event.title}"`
      : `"${event.title}" deleted successfully`;

    // Show toast with undo button - use a wrapper div to show countdown
    const toastId = toast.success(toastMessage, {
      duration: 3000,
      action: {
        label: `Undo (${countdown}s)`,
        onClick: () => handleUndoEventAction(),
      },
    });

    // Update countdown in toast every second
    countdownIntervalRef.current = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        // Dismiss old toast and show new one with updated countdown
        toast.dismiss(toastId);
        toast.success(toastMessage, {
          id: toastId,
          duration: Infinity, // Prevent auto-dismiss since we're manually controlling it
          action: {
            label: `Undo (${countdown}s)`,
            onClick: () => handleUndoEventAction(),
          },
        });
      } else {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        toast.dismiss(toastId);
      }
    }, 1000);

    // Set timeout to permanently delete after 3 seconds
    undoTimeoutRef.current = setTimeout(() => {
      setPendingEventDeletion(null);
      setEventToDelete(null);
      setEventActionType(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      toast.dismiss(toastId);
    }, 3000);
  };

  const handleUndoEventAction = () => {
    // Clear the timeout and interval
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Restore the event
    if (pendingEventDeletion) {
      setEvents(prev => [...prev, pendingEventDeletion]);
      toast.success('Action undone');
      setPendingEventDeletion(null);
      setEventToDelete(null);
      setEventActionType(null);
    }
  };

  const handleCancelEventAction = () => {
    setEventToDelete(null);
    setEventActionType(null);
    setCurrentView('events');
  };

  const handleBackFromEventDetails = () => {
    setSelectedEventId(null);
    if (eventDetailsBackView === 'availability') {
      setCurrentView('availability');
    } else {
      setCurrentView('events');
    }
  };

  const handleOpenEvents = () => {
    setCurrentView('events');
    setHasViewedEvents(true);
    setNewEventCount(0); // Clear notification badge
  };

  // Create new event instantly
  const handleCreateNewEvent = () => {
    const newEvent: Event = {
      id: Date.now().toString(),
      title: 'New Event',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // Tomorrow + 1 hour
      attendees: [],
      aiSummary: 'Click to edit and add details to this event.',
      thumbnail: 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG1lZXRpbmclMjByb29tfGVufDF8fHx8MTc2MjA1ODY0MHww&ixlib=rb-4.1.0&q=80&w=1080',
      createdBy: CURRENT_USER_ID
    };
    setEvents(prev => [...prev, newEvent]);
    toast.success('New event created! Click to edit details.');
    // Open the event details immediately
    setSelectedEventId(newEvent.id);
    setCurrentView('eventDetails');
  };

  // Quick gathering handler
  const handleQuickGathering = () => {
    setCurrentView('quickGathering');
  };

  // Availability event expand handler
  const handleExpandAvailabilityEvent = (
    event: { id: string; dayIndex: number; startMinutes: number; durationMinutes: number; title: string; color: string },
    dayDate: Date,
    timeSlotStart: string
  ) => {
    // Calculate start time based on day date and minutes offset
    const startTime = new Date(dayDate);
    const startHours = Math.floor(event.startMinutes / 60);
    const startMinutesRemainder = event.startMinutes % 60;
    
    // Get base hour from time slot
    const baseStartHour = parseTimeToHours(timeSlotStart);
    startTime.setHours(Math.floor(baseStartHour) + startHours, startMinutesRemainder, 0, 0);
    
    // Calculate end time
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + event.durationMinutes);
    
    // Create a full event from the availability event
    const fullEvent: Event = {
      id: event.id,
      title: event.title,
      startTime,
      endTime,
      attendees: [],
      aiSummary: 'This is an availability event created from your calendar. Edit this event to add more details, attendees, and meeting information.',
      thumbnail: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYWxlbmRhciUyMGV2ZW50fGVufDF8fHx8MTc2MjA1ODY0MHww&ixlib=rb-4.1.0&q=80&w=1080',
      location: 'To be determined',
      createdBy: CURRENT_USER_ID
    };
    
    // Add to events list if not already there
    const existingEvent = events.find(e => e.id === event.id);
    if (!existingEvent) {
      setEvents(prev => [...prev, fullEvent]);
    }
    
    // Navigate to event details with back view set to availability
    setSelectedEventId(event.id);
    setEventDetailsBackView('availability');
    setCurrentView('eventDetails');
  };

  // Count today's events
  const getTodayEventCount = () => {
    return events.filter(event => {
      const eventDate = event.startTime;
      const today = new Date();
      return (
        eventDate.getDate() === today.getDate() &&
        eventDate.getMonth() === today.getMonth() &&
        eventDate.getFullYear() === today.getFullYear()
      );
    }).length;
  };

  return (
    <>
      <Toaster />
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#f5f3ef] via-[#ebe8e0] to-[#e8e4d9]">
        {/* Landing Page */}
        {currentView === 'landing' && (
          <div className="flex-1 overflow-y-auto">
            <div className="min-h-screen flex flex-col items-center px-4 py-8 md:py-16">
              <div className="w-full max-w-2xl mx-auto space-y-8 md:space-y-12">
                {/* Logo */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6 }}
                  className="flex justify-center pt-8"
                >
                  <img src={logo} alt="Logo" className="w-20 h-20 md:w-32 md:h-32 object-contain" />
                </motion.div>

                {/* Title */}
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-3xl md:text-5xl text-[#8b8475] leading-relaxed text-center"
                >
                  Not just a calendar,<br />it's your AI personal secretary
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-base md:text-xl text-[#a8a195] max-w-xl mx-auto leading-relaxed text-center px-4"
                >
                  No need to negotiate your time zone. Your friend lives in Alaska, you live in China? Totally fine, we can figure it out.
                </motion.p>

                {/* Login Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="flex justify-center"
                >
                  <Button
                    onClick={async () => {
                      const success = await loginWithOAuth('google');
                      if (success) {
                        toast.success('Successfully authenticated!');
                        setCurrentView('contact');
                      } else {
                        toast.error('Login failed. Please try again.');
                      }
                    }}
                    className="bg-[#8b8475] hover:bg-[#6b6558] text-[#f5f3ef] px-6 py-5 md:px-8 md:py-6 text-base md:text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <svg className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Login now
                  </Button>
                </motion.div>

                {/* Demo Section */}
                <DemoSection />

                {/* Footer */}
                <motion.footer
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="mt-12 md:mt-20 pb-8 text-center"
                >
                  <div className="space-y-4">
                    {/* Social Media Links */}
                    <div className="flex justify-center items-center gap-4 md:gap-6 flex-wrap">
                      <a
                        href="https://x.com/odoc_ic"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                      >
                        X (Twitter)
                      </a>
                      <a
                        href="https://t.me/odoc_ic"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                      >
                        Telegram
                      </a>
                      <a
                        href="https://discord.gg/HbaFQXDD"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                      >
                        Discord
                      </a>
                      <a
                        href="https://www.youtube.com/@odoc_ic"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                      >
                        YouTube
                      </a>
                      <a
                        href="https://www.instagram.com/odoc_ic"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                      >
                        Instagram
                      </a>
                      <a
                        href="https://www.tiktok.com/@odoc.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                      >
                        TikTok
                      </a>
                      <a
                        href="https://www.linkedin.com/company/odocic"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                      >
                        LinkedIn
                      </a>
                    </div>
                    
                    {/* Made by ODOC.APP */}
                    <p className="text-[#a8a195] text-sm">
                      Made with ❤️ by{' '}
                      <a
                        href="https://odoc.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#8b8475] hover:underline"
                      >
                        ODOC.APP
                      </a>{' '}
                      team
                    </p>
                  </div>
                </motion.footer>
              </div>
            </div>
          </div>
        )}

        {/* Header - Only show for contact and availability views */}
        {(currentView === 'contact' || currentView === 'availability') && (
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="shrink-0 bg-[#f5f3ef]/80 backdrop-blur-md border-b border-[#d4cfbe]/30 px-4 md:px-8 py-4"
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            {/* Action Buttons - Only show in contact view */}
            {currentView === 'contact' && (
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="bg-[#e8e4d9]/60 hover:bg-[#8b8475] text-[#8b8475] hover:text-[#f5f3ef] border-[#d4cfbe]/40 transition-all duration-300 h-8 md:h-10 px-2 md:px-4 text-xs md:text-sm"
                    >
                      <Calendar className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
                      <span className="hidden sm:inline">Availabilities</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80 bg-[#f5f3ef] border-[#d4cfbe]/40">
                    {availabilities.map((availability) => {
                      // Generate week data for this availability to show in chart
                      const startDate = isMobile ? availability.currentStartDate : getStartOfWeek(availability.currentStartDate);
                      const availabilityWeekData = getDaysData(startDate, 7);
                      
                      return (
                        <DropdownMenuItem
                          key={availability.id}
                          className="flex flex-col gap-2 p-3 cursor-pointer hover:bg-[#e8e4d9]/60 focus:bg-[#e8e4d9]/60"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="text-[#8b8475] flex-1 truncate">{availability.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[#a8a195] hover:text-[#8b8475] hover:bg-[#d4cfbe]/40"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareAvailability(availability.id);
                            }}
                            title="Share"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[#a8a195] hover:text-[#8b8475] hover:bg-[#d4cfbe]/40"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAvailability(availability.id);
                            }}
                            title="Expand"
                          >
                            <Expand className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[#a8a195] hover:text-red-500 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAvailability(availability.id);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                            </div>
                          </div>
                          
                          {/* Mini Column Chart */}
                          <motion.div 
                            className="flex items-end gap-0.5 h-12 w-full px-1 mt-3"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                          >
                            {availabilityWeekData.map((day, idx) => {
                              const maxHeight = 48; // h-12 in pixels
                              const height = day.available && day.timeSlots.length > 0
                                ? getProportionalHeight(day.timeSlots[0], maxHeight)
                                : 0;
                              
                              return (
                                <motion.div
                                  key={idx}
                                  className="flex-1 flex flex-col items-center justify-end gap-0.5"
                                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  transition={{ 
                                    duration: 0.5, 
                                    delay: idx * 0.08,
                                    ease: "easeOut",
                                    type: "spring",
                                    stiffness: 200,
                                    damping: 15
                                  }}
                                >
                                  {height > 0 ? (
                                    <motion.div
                                      className="w-full bg-green-500/70 rounded-sm"
                                      style={{ height: `${height}px` }}
                                      title={`${day.dayName}: ${day.timeSlots[0]?.start} - ${day.timeSlots[0]?.end}`}
                                      initial={{ scaleY: 0, originY: 1 }}
                                      animate={{ scaleY: 1 }}
                                      transition={{ 
                                        duration: 0.6,
                                        delay: idx * 0.08 + 0.2,
                                        ease: "easeOut",
                                        type: "spring",
                                        stiffness: 150,
                                        damping: 12
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-0" />
                                  )}
                                  <motion.span 
                                    className="text-[9px] text-[#a8a195]"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ 
                                      duration: 0.3,
                                      delay: idx * 0.08 + 0.4
                                    }}
                                  >
                                    {day.dayName[0]}
                                  </motion.span>
                                </motion.div>
                              );
                            })}
                          </motion.div>
                        </DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuSeparator className="bg-[#d4cfbe]/40" />
                    {/* TODO future feature <DropdownMenuItem
                      className="flex items-center gap-2 p-3 cursor-pointer hover:bg-[#e8e4d9]/60 focus:bg-[#e8e4d9]/60"
                      onClick={handleAddAvailability}
                      disabled={availabilities.length >= 5}
                    >
                      <Plus className="h-4 w-4 text-[#8b8475]" />
                      <span className="text-[#8b8475]">
                        {availabilities.length >= 5 ? 'Maximum reached (5)' : 'Add New Availability'}
                      </span>
                    </DropdownMenuItem> */}
                  </DropdownMenuContent>
                </DropdownMenu>
              
              <Button
                onClick={handleOpenEvents}
                variant="outline"
                className="bg-[#e8e4d9]/60 hover:bg-[#8b8475] text-[#8b8475] hover:text-[#f5f3ef] border-[#d4cfbe]/40 transition-all duration-300 relative h-8 md:h-10 px-2 md:px-4 text-xs md:text-sm"
              >
                <CalendarDays className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
                <span className="hidden sm:inline">Events</span>
                {getTodayEventCount() > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-1 md:ml-2 bg-[#8b8475] text-[#f5f3ef] hover:bg-[#8b8475] h-4 md:h-5 px-1 md:px-1.5 min-w-[16px] md:min-w-[20px] flex items-center justify-center text-[9px] md:text-[10px]"
                  >
                    {getTodayEventCount()}
                  </Badge>
                )}
                {newEventCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 h-4 w-4 md:h-5 md:w-5 bg-red-500 rounded-full flex items-center justify-center text-[9px] md:text-[10px] text-white shadow-lg">
                    {newEventCount}
                  </span>
                )}
              </Button>
              
              <Button
                onClick={() => setCurrentView('profile')}
                variant="outline"
                className="bg-[#e8e4d9]/60 hover:bg-[#8b8475] text-[#8b8475] hover:text-[#f5f3ef] border-[#d4cfbe]/40 transition-all duration-300 h-8 md:h-10 px-2 md:px-4 text-xs md:text-sm"
              >
                <User className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
                <span className="hidden sm:inline">Profile</span>
              </Button>
            </div>
            )}
          </div>
          
          {/* Progress bar - only show in contact view */}
          {currentView === 'contact' && (
            <>
              <div className="flex items-center justify-end mb-2" style={{ display: progress >= 100 ? 'none' : 'flex' }}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-sm text-[#a8a195]"
                >
                  {Math.round(progress)}% Complete
                </motion.div>
              </div>
              <Progress value={progress} className="h-1 bg-[#e0ddd1]" />
            </>
          )}
        </div>
      </motion.header>
        )}

      {/* Contact View */}
      {currentView === 'contact' && (
        <>
          {/* Messages */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isInputFocused ? 0.7 : 1 }}
            transition={{ duration: 0.3 }}
            className="flex-1 overflow-y-auto px-4 md:px-8 py-8"
          >
            <div className="max-w-4xl mx-auto space-y-6 pb-8">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isHovered={hoveredId === message.id}
                  onHover={setHoveredId}
                  isOtherHovered={hoveredId !== null && hoveredId !== message.id}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </motion.div>

          {/* Input */}
          <ChatInput
            onSendMessage={handleSendMessage}
            onFocusChange={setIsInputFocused}
            showSuggestions={currentQuestion < QUESTIONS.length}
          />
        </>
      )}

      {/* Availability View */}
      {currentView === 'availability' && selectedAvailabilityId && (
        <AvailabilityPage
          availabilityName={availabilities.find(a => a.id === selectedAvailabilityId)?.name || 'Availability'}
          currentStartDate={availabilities.find(a => a.id === selectedAvailabilityId)?.currentStartDate || new Date()}
          onBack={() => {
            setSelectedAvailabilityId(null);
            setCurrentView('contact');
          }}
          onPreviousWeek={() => handleAvailabilityPreviousWeek(selectedAvailabilityId)}
          onNextWeek={() => handleAvailabilityNextWeek(selectedAvailabilityId)}
          onToday={() => handleAvailabilityToday(selectedAvailabilityId)}
          isCurrentWeek={isAvailabilityCurrentWeek(selectedAvailabilityId)}
          isMobile={isMobile}
          onExpandEvent={handleExpandAvailabilityEvent}
        />
      )}

      {/* Profile View */}
      {currentView === 'profile' && (
        <ProfilePage
          username={username}
          userAvatar={userAvatar}
          description={description}
          googleAccounts={googleAccounts}
          onSetDefaultAccount={handleSetDefaultAccount}
          onDeleteAccount={handleDeleteAccount}
          onAddAccount={handleAddAccount}
          onLogout={handleLogout}
          onUpdateDescription={handleUpdateDescription}
          onUpdateUsername={handleUpdateUsername}
          onStartAvatarEdit={handleStartAvatarEdit}
          onBack={() => setCurrentView('contact')}
        />
      )}

      {/* Avatar Edit View */}
      {currentView === 'avatarEdit' && avatarImageSrc && (
        <AvatarEditPage
          imageSrc={avatarImageSrc}
          onSave={handleSaveAvatar}
          onBack={handleCancelAvatarEdit}
        />
      )}

      {/* Events List View */}
      {currentView === 'events' && (
        <EventsPage
          events={events}
          onEventClick={handleEventClick}
          onBack={() => setCurrentView('contact')}
          currentUserId={CURRENT_USER_ID}
          onCancelEvent={handleCancelEvent}
          onDeleteEvent={handleDeleteEvent}
          onCreateEvent={handleCreateNewEvent}
          onQuickGathering={handleQuickGathering}
        />
      )}

      {/* Quick Gathering View */}
      {currentView === 'quickGathering' && (
        <QuickGatheringPage
          onBack={() => setCurrentView('events')}
          contacts={mockContacts}
        />
      )}

      {/* Event Details View */}
      {currentView === 'eventDetails' && selectedEventId && (
        <EventDetailsPage
          event={events.find(e => e.id === selectedEventId)!}
          onBack={handleBackFromEventDetails}
          backButtonText={eventDetailsBackView === 'availability' 
            ? `Back to ${availabilities.find(a => a.id === selectedAvailabilityId)?.name || 'Availability'}` 
            : 'Back to Events'}
        />
      )}

      {/* Delete Confirmation View */}
      {currentView === 'deleteConfirmation' && availabilityToDelete && (
        <DeleteConfirmationPage
          itemName={availabilities.find(a => a.id === availabilityToDelete)?.name || 'Availability'}
          itemType="Availability"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

      {/* Event Delete/Cancel Confirmation View */}
      {currentView === 'eventDeleteConfirmation' && eventToDelete && (
        <DeleteConfirmationPage
          itemName={events.find(e => e.id === eventToDelete)?.title || 'Event'}
          itemType={eventActionType === 'cancel' ? 'Event Attendance' : 'Event'}
          onConfirm={handleConfirmEventAction}
          onCancel={handleCancelEventAction}
        />
      )}
      </div>
    </>
  );
}
