/**
 * Backend Caster (Middleware)
 *
 * Generic middleware layer that handles serialization/deserialization of data
 * between frontend and backend. Currently supports availability-related calls.
 *
 * Uses JavaScript Proxy as middleware to intercept and transform backend actor calls.
 */

import { ActorSubclass } from "@dfinity/agent";
import { _SERVICE } from "$/declarations/backend/backend.did";

/**
 * Recursively convert all BigInt values to numbers in an object
 * This is needed because BigInt cannot be serialized to JSON
 */
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle BigInt
  if (typeof obj === "bigint") {
    return Number(obj);
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }

  // Handle objects
  if (typeof obj === "object") {
    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        converted[key] = convertBigIntToNumber(obj[key]);
      }
    }
    return converted;
  }

  // Return primitives as-is
  return obj;
}

// Types matching backend Candid interface (internal use only, not exported)
interface TimeSlot {
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: number; // Minutes from midnight (0-1439)
  end_time: number; // Minutes from midnight (0-1439)
}

// @ts-ignore - Type definition kept for reference
interface Availability {
  id: string;
  owner: string; // Principal as string
  title: string;
  description: string;
  slots: TimeSlot[];
  timezone: string;
  created_at: bigint;
  updated_at: bigint;
}

interface CreateAvailabilityRequest {
  title: string;
  description: string;
  slots: TimeSlot[];
  timezone: string;
}

interface UpdateAvailabilityRequest {
  id: string;
  title: string[] | []; // Optional in Candid
  description: string[] | [];
  slots: TimeSlot[][] | [];
  timezone: string[] | [];
}

// Helper functions (internal use only, not exported)

function getCurrentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function serializeTimeSlots(slots: TimeSlot[]): TimeSlot[] {
  // TimeSlots are already in "minutes from midnight" format
  // They're relative to the day, not absolute timestamps
  // So no conversion needed - just pass through
  return slots;
}

function deserializeTimeSlots(slots: TimeSlot[]): TimeSlot[] {
  // TimeSlots are already in "minutes from midnight" format
  // They're relative to the day, not absolute timestamps
  // So no conversion needed - just pass through
  return slots;
}

/**
 * Create a backend actor with middleware layer for automatic data transformation
 *
 * This middleware intercepts backend calls and applies serialization/deserialization
 * as needed. Currently handles availability-related calls, but can be extended
 * for other data types.
 *
 * @param actor - The raw backend actor from @dfinity/agent
 * @returns Proxied actor with middleware applied
 */
export function createBackendCaster(actor: any): ActorSubclass<_SERVICE> {
  return new Proxy(actor, {
    get(target, prop) {
      const targetAny = target as any;

      // create_availability - Serialize request, deserialize response
      if (prop === "create_availability") {
        return async (request: CreateAvailabilityRequest) => {
          // Get email and name from localStorage
          const email = localStorage.getItem("ic-user-email");
          const name = localStorage.getItem("ic-user-name");

          const serializedRequest = {
            ...request,
            timezone: request.timezone || getCurrentTimezone(),
            slots: serializeTimeSlots(request.slots),
            owner_email: email ? [email] : [],
            owner_name: name ? [name] : [],
          };

          const result = await targetAny.create_availability(serializedRequest);

          if ("Err" in result) {
            return result;
          }

          return {
            Ok: convertBigIntToNumber({
              ...result.Ok,
              slots: deserializeTimeSlots(result.Ok.slots),
            }),
          };
        };
      }

      // get_availability - Deserialize response
      if (prop === "get_availability") {
        return async (id: string) => {
          const result = await targetAny.get_availability(id);
          console.log({ result });

          if ("Err" in result) {
            return result;
          }

          return {
            Ok: convertBigIntToNumber({
              ...result.Ok,
              slots: deserializeTimeSlots(result.Ok.slots),
            }),
          };
        };
      }

      // update_availability - Serialize request, deserialize response
      if (prop === "update_availability") {
        return async (request: UpdateAvailabilityRequest) => {
          const serializedRequest = {
            ...request,
            slots:
              request.slots.length > 0
                ? [serializeTimeSlots(request.slots[0])]
                : [],
          };

          const result = await targetAny.update_availability(serializedRequest);

          if ("Err" in result) {
            return result;
          }

          return {
            Ok: convertBigIntToNumber({
              ...result.Ok,
              slots: deserializeTimeSlots(result.Ok.slots),
            }),
          };
        };
      }

      // list_user_availabilities - Deserialize array
      if (prop === "list_user_availabilities") {
        return async () => {
          const availabilities = await targetAny.list_user_availabilities();

          return availabilities.map((avail: any) => {
            const converted = convertBigIntToNumber(avail);
            if (converted.slots) {
              converted.slots = deserializeTimeSlots(converted.slots);
            }
            return converted;
          });
        };
      }

      // search_availabilities_by_email - Deserialize array
      if (prop === "search_availabilities_by_email") {
        return async (email: string) => {
          const availabilities =
            await targetAny.search_availabilities_by_email(email);

          return availabilities.map((avail: any) => {
            const converted = convertBigIntToNumber(avail);
            if (converted.slots) {
              converted.slots = deserializeTimeSlots(converted.slots);
            }
            return converted;
          });
        };
      }

      // search_availabilities_by_username - Deserialize array
      if (prop === "search_availabilities_by_username") {
        return async (username: string) => {
          const availabilities =
            await targetAny.search_availabilities_by_username(username);

          return availabilities.map((avail: any) => {
            const converted = convertBigIntToNumber(avail);
            if (converted.slots) {
              converted.slots = deserializeTimeSlots(converted.slots);
            }
            return converted;
          });
        };
      }

      // search_availabilities_by_principal - Deserialize array
      if (prop === "search_availabilities_by_principal") {
        return async (principal: any) => {
          const availabilities =
            await targetAny.search_availabilities_by_principal(principal);

          return availabilities.map((avail: any) => {
            const converted = convertBigIntToNumber(avail);
            if (converted.slots) {
              converted.slots = deserializeTimeSlots(converted.slots);
            }
            return converted;
          });
        };
      }

      // search_by_emails - Deserialize nested arrays
      if (prop === "search_by_emails") {
        return async (emails: string[]) => {
          const results = await targetAny.search_by_emails(emails);

          return results.map((availabilities: any[]) =>
            availabilities.map((avail: any) => {
              // Convert the entire availability object (includes busy_times)
              const converted = convertBigIntToNumber(avail);

              // Also deserialize slots
              if (converted.slots) {
                converted.slots = deserializeTimeSlots(converted.slots);
              }

              return converted;
            }),
          );
        };
      }

      // search_by_usernames - Deserialize nested arrays
      if (prop === "search_by_usernames") {
        return async (usernames: string[]) => {
          const results = await targetAny.search_by_usernames(usernames);

          return results.map((availabilities: any[]) =>
            availabilities.map((avail: any) => {
              const converted = convertBigIntToNumber(avail);
              if (converted.slots) {
                converted.slots = deserializeTimeSlots(converted.slots);
              }
              return converted;
            }),
          );
        };
      }

      // For all other methods, pass through unchanged
      return targetAny[prop];
    },
  }) as ActorSubclass<_SERVICE>;
}

// Helper: Parse natural language time to minutes from midnight
// Examples: "9 am" → 540, "6 pm" → 1080, "12:30 pm" → 750
// Currently unused - uncomment if needed for AI parsing features
// function parseTimeToMinutes(timeStr: string): number {
//   const time = timeStr.toLowerCase().trim();
//   const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
//   if (!match) throw new Error(`Invalid time format: ${timeStr}`);
//   let hours = parseInt(match[1]);
//   const minutes = match[2] ? parseInt(match[2]) : 0;
//   const meridiem = match[3];
//   if (meridiem === "pm" && hours !== 12) hours += 12;
//   else if (meridiem === "am" && hours === 12) hours = 0;
//   if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
//     throw new Error(`Invalid time: ${timeStr}`);
//   }
//   return hours * 60 + minutes;
// }

// Utility functions for potential future AI parsing features
// Currently unused - uncomment if needed

// function parseDayOfWeek(dayStr: string): number[] {
//   const day = dayStr.toLowerCase().trim();
//   if (day.includes("every") || day === "daily") {
//     return [0, 1, 2, 3, 4, 5, 6];
//   }
//   if (day.includes("weekday")) {
//     return [1, 2, 3, 4, 5];
//   }
//   if (day.includes("weekend")) {
//     return [0, 6];
//   }
//   const dayMap: Record<string, number> = {
//     sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
//     wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
//     friday: 5, fri: 5, saturday: 6, sat: 6,
//   };
//   const dayNum = dayMap[day];
//   if (dayNum !== undefined) return [dayNum];
//   throw new Error(`Invalid day: ${dayStr}`);
// }

// function parseAvailabilityStatement(statement: string): {
//   days: number[];
//   startTime: number;
//   endTime: number;
// } {
//   const lower = statement.toLowerCase();
//   const timeMatch = lower.match(
//     /(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(?:to|-)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/,
//   );
//   if (!timeMatch) {
//     throw new Error('Could not parse time range. Expected format: "from 9 am to 6 pm"');
//   }
//   const startTime = parseTimeToMinutes(timeMatch[1]);
//   const endTime = parseTimeToMinutes(timeMatch[2]);
//   if (startTime >= endTime) {
//     throw new Error("Start time must be before end time");
//   }
//   let days: number[];
//   if (lower.includes("every day") || lower.includes("daily")) {
//     days = [0, 1, 2, 3, 4, 5, 6];
//   } else if (lower.includes("weekday")) {
//     days = [1, 2, 3, 4, 5];
//   } else if (lower.includes("weekend")) {
//     days = [0, 6];
//   } else {
//     const dayNames = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
//     days = [];
//     for (let i = 0; i < dayNames.length; i++) {
//       if (lower.includes(dayNames[i])) {
//         days.push((i + 1) % 7);
//       }
//     }
//     if (days.length === 0) {
//       days = [0, 1, 2, 3, 4, 5, 6];
//     }
//   }
//   return { days, startTime, endTime };
// }

// function createTimeSlotsFromParsed(parsed: {
//   days: number[];
//   startTime: number;
//   endTime: number;
// }): TimeSlot[] {
//   return parsed.days.map((day) => ({
//     day_of_week: day,
//     start_time: parsed.startTime,
//     end_time: parsed.endTime,
//   }));
// }
