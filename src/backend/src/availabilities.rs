use candid::{CandidType, Principal, Decode, Encode};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;
use ic_cdk::api::time;
use ic_stable_structures::{
    memory_manager::MemoryId,
    storable::Bound,
    StableBTreeMap, Storable,
};
use std::borrow::Cow;
use crate::memory::{Memory, MEMORY_MANAGER};

// ============================================================================
// Types
// ============================================================================

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct TimeSlot {
    pub day_of_week: u8,    // 0=Sunday, 1=Monday, ..., 6=Saturday
    pub start_time: u16,    // Minutes from midnight (0-1439)
    pub end_time: u16,      // Minutes from midnight (0-1439)
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Availability {
    pub id: String,
    pub owner: Principal,
    pub owner_email: Option<String>,
    pub owner_name: Option<String>,
    pub title: String,
    pub description: String,
    pub slots: Vec<TimeSlot>,
    pub timezone: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub busy_times: Option<Vec<BusyTimeBlock>>,
    pub is_favorite: bool,
    pub display_order: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct BusyTimeBlock {
    pub start_time: u64,
    pub end_time: u64,
}

#[derive(CandidType, Deserialize)]
pub struct CreateAvailabilityRequest {
    pub title: String,
    pub description: String,
    pub slots: Vec<TimeSlot>,
    pub timezone: String,
    pub owner_email: Option<String>,
    pub owner_name: Option<String>,
    pub busy_times: Option<Vec<BusyTimeBlock>>,
}

#[derive(CandidType, Deserialize)]
pub struct UpdateAvailabilityRequest {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub slots: Option<Vec<TimeSlot>>,
    pub timezone: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AvailabilityStatus {
    pub start: u64,
    pub end: u64,
    pub free: bool,
}

// ============================================================================
// Storable Implementations
// ============================================================================

impl Storable for Availability {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

// Wrapper for Vec<String> to make it Storable
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct StringVec(Vec<String>);

impl Storable for StringVec {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

// ============================================================================
// Storage
// ============================================================================

thread_local! {
    pub static AVAILABILITIES: RefCell<StableBTreeMap<String, Availability, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        )
    );

    pub static USER_AVAILABILITIES: RefCell<StableBTreeMap<Principal, StringVec, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1)))
        )
    );

    // These can remain as regular HashMaps since they're just indices (rebuilt on upgrade)
    pub static EMAIL_TO_PRINCIPAL: RefCell<HashMap<String, Principal>> = RefCell::new(HashMap::new());
    pub static USERNAME_TO_PRINCIPAL: RefCell<HashMap<String, Principal>> = RefCell::new(HashMap::new());
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Generate a random 6-character alphanumeric ID
pub fn generate_availability_id() -> String {
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";
    let mut id = String::with_capacity(6);
    
    for _ in 0..6 {
        let random_byte = (time() % CHARSET.len() as u64) as usize;
        id.push(CHARSET[random_byte] as char);
    }
    
    // Ensure uniqueness
    AVAILABILITIES.with(|a| {
        let avails = a.borrow();
        if avails.contains_key(&id) {
            // If collision, add timestamp suffix
            format!("{}{}", id, (time() % 100))
        } else {
            id
        }
    })
}

/// Validate time slot
fn validate_time_slot(slot: &TimeSlot) -> Result<(), String> {
    if slot.day_of_week > 6 {
        return Err("day_of_week must be 0-6 (Sunday-Saturday)".to_string());
    }
    
    if slot.start_time >= 1440 {
        return Err("start_time must be 0-1439 (minutes in a day)".to_string());
    }
    
    if slot.end_time >= 1440 {
        return Err("end_time must be 0-1439 (minutes in a day)".to_string());
    }
    
    if slot.start_time >= slot.end_time {
        return Err("start_time must be less than end_time".to_string());
    }
    
    Ok(())
}

/// Check for overlapping slots on the same day
fn check_slot_overlaps(slots: &[TimeSlot]) -> Result<(), String> {
    for i in 0..slots.len() {
        for j in (i + 1)..slots.len() {
            let slot1 = &slots[i];
            let slot2 = &slots[j];
            
            // Only check slots on the same day
            if slot1.day_of_week == slot2.day_of_week {
                // Check for overlap
                if slot1.start_time < slot2.end_time && slot2.start_time < slot1.end_time {
                    return Err(format!(
                        "Overlapping slots on day {}: {:02}:{:02}-{:02}:{:02} and {:02}:{:02}-{:02}:{:02}",
                        slot1.day_of_week,
                        slot1.start_time / 60, slot1.start_time % 60,
                        slot1.end_time / 60, slot1.end_time % 60,
                        slot2.start_time / 60, slot2.start_time % 60,
                        slot2.end_time / 60, slot2.end_time % 60
                    ));
                }
            }
        }
    }
    Ok(())
}

/// Validate availability request
fn validate_availability(title: &str, description: &str, slots: &[TimeSlot]) -> Result<(), String> {
    // Validate title
    if title.is_empty() || title.len() > 100 {
        return Err("title must be 1-100 characters".to_string());
    }
    
    // Validate description
    if description.len() > 500 {
        return Err("description must be 0-500 characters".to_string());
    }
    
    // Validate slots
    if slots.is_empty() {
        return Err("at least 1 slot is required".to_string());
    }
    
    // Validate each slot
    for slot in slots {
        validate_time_slot(slot)?;
    }
    
    // Check for overlaps
    check_slot_overlaps(slots)?;
    
    Ok(())
}



// ============================================================================
// CRUD Operations
// ============================================================================

/// Create a new availability
pub fn create_availability(caller: Principal, req: CreateAvailabilityRequest) -> Result<Availability, String> {
    // Validate input
    validate_availability(&req.title, &req.description, &req.slots)?;
    
    let now = time();
    
    // Get current user's availability count to set display_order
    let display_order = USER_AVAILABILITIES.with(|ua| {
        ua.borrow()
            .get(&caller)
            .map(|v| v.0.len() as u32)
            .unwrap_or(0)
    });
    
    let availability = Availability {
        id: generate_availability_id(),
        owner: caller,
        owner_email: req.owner_email.clone(),
        owner_name: req.owner_name.clone(),
        title: req.title,
        description: req.description,
        slots: req.slots,
        timezone: req.timezone,
        created_at: now,
        updated_at: now,
        busy_times: req.busy_times,
        is_favorite: display_order == 0, // First availability is favorite by default
        display_order,
    };
    
    // Store availability
    AVAILABILITIES.with(|a| {
        a.borrow_mut().insert(availability.id.clone(), availability.clone())
    });
    
    // Update user index
    USER_AVAILABILITIES.with(|ua| {
        let mut map = ua.borrow_mut();
        let mut ids = map.get(&caller).map(|v| v.0.clone()).unwrap_or_default();
        ids.push(availability.id.clone());
        map.insert(caller, StringVec(ids));
    });
    
    // Update search indices
    if let Some(ref email) = availability.owner_email {
        EMAIL_TO_PRINCIPAL.with(|e| e.borrow_mut().insert(email.clone(), caller));
    }
    if let Some(ref name) = availability.owner_name {
        USERNAME_TO_PRINCIPAL.with(|u| u.borrow_mut().insert(name.clone(), caller));
    }
    
    Ok(availability)
}

/// Get availability by ID
pub fn get_availability(id: String) -> Result<Availability, String> {
    AVAILABILITIES.with(|a| {
        a.borrow()
            .get(&id)
            .ok_or_else(|| "Availability not found".to_string())
    })
}

/// Update an existing availability
pub fn update_availability(caller: Principal, req: UpdateAvailabilityRequest) -> Result<Availability, String> {
    AVAILABILITIES.with(|a| {
        let mut map = a.borrow_mut();
        let mut availability = map
            .get(&req.id)
            .ok_or_else(|| "Availability not found".to_string())?;
        
        // Verify ownership
        if availability.owner != caller {
            return Err("Only the owner can update this availability".to_string());
        }
        
        // Update fields
        if let Some(title) = req.title {
            if title.is_empty() || title.len() > 100 {
                return Err("title must be 1-100 characters".to_string());
            }
            availability.title = title;
        }
        
        if let Some(description) = req.description {
            if description.len() > 500 {
                return Err("description must be 0-500 characters".to_string());
            }
            availability.description = description;
        }
        
        if let Some(slots) = req.slots {
            // Validate new slots
            if slots.is_empty() {
                return Err("at least 1 slot is required".to_string());
            }
            for slot in &slots {
                validate_time_slot(slot)?;
            }
            check_slot_overlaps(&slots)?;
            
            availability.slots = slots;
        }
        
        if let Some(timezone) = req.timezone {
            availability.timezone = timezone;
        }
        
        availability.updated_at = time();
        
        // Re-insert the updated availability
        map.insert(req.id.clone(), availability.clone());
        
        ic_cdk::println!("✅ Updated availability: {}", req.id);
        Ok(availability)
    })
}

/// Delete an availability
pub fn delete_availability(caller: Principal, id: String) -> Result<(), String> {
    // Verify ownership
    let owner = AVAILABILITIES.with(|a| {
        a.borrow()
            .get(&id)
            .map(|avail| avail.owner)
            .ok_or_else(|| "Availability not found".to_string())
    })?;
    
    if owner != caller {
        return Err("Only the owner can delete this availability".to_string());
    }
    
    // Remove from storage
    AVAILABILITIES.with(|a| {
        a.borrow_mut().remove(&id);
    });
    
    // Remove from user index
    USER_AVAILABILITIES.with(|ua| {
        let mut map = ua.borrow_mut();
        if let Some(string_vec) = map.get(&caller) {
            let mut ids = string_vec.0.clone();
            ids.retain(|avail_id| avail_id != &id);
            map.insert(caller, StringVec(ids));
        }
    });
    
    ic_cdk::println!("🗑️ Deleted availability: {}", id);
    Ok(())
}

/// List all availabilities for the caller
/// Automatically populates owner_email and owner_name if they're missing
pub fn list_user_availabilities(caller: Principal) -> Vec<Availability> {
    USER_AVAILABILITIES.with(|ua| {
        let user_avails = ua.borrow();
        match user_avails.get(&caller) {
            Some(string_vec) => {
                AVAILABILITIES.with(|a| {
                    let avails = a.borrow();
                    string_vec.0.iter()
                        .filter_map(|id| avails.get(id))
                        .collect()
                })
            }
            None => vec![],
        }
    })
}

// ============================================================================
// Sharing & Regeneration
// ============================================================================

/// Regenerate availability ID (for privacy/security)
pub fn regenerate_availability_id(caller: Principal, old_id: String) -> Result<String, String> {
    // Verify ownership
    let availability = AVAILABILITIES.with(|a| {
        a.borrow()
            .get(&old_id)
            .ok_or_else(|| "Availability not found".to_string())
    })?;
    
    if availability.owner != caller {
        return Err("Only the owner can regenerate this availability ID".to_string());
    }
    
    // Generate new ID
    let new_id = generate_availability_id();
    
    // Create new availability with new ID
    let mut new_availability = availability.clone();
    new_availability.id = new_id.clone();
    new_availability.updated_at = time();
    
    // Remove old, add new
    AVAILABILITIES.with(|a| {
        let mut avails = a.borrow_mut();
        avails.remove(&old_id);
        avails.insert(new_id.clone(), new_availability);
    });
    
    // Update user index
    USER_AVAILABILITIES.with(|ua| {
        let mut map = ua.borrow_mut();
        if let Some(string_vec) = map.get(&caller) {
            let mut ids = string_vec.0.clone();
            if let Some(pos) = ids.iter().position(|id| id == &old_id) {
                ids[pos] = new_id.clone();
            }
            map.insert(caller, StringVec(ids));
        }
    });
    
    ic_cdk::println!("🔄 Regenerated availability ID: {} -> {}", old_id, new_id);
    Ok(new_id)
}

// ============================================================================
// Search Functions
// ============================================================================

/// Search availabilities by email
pub fn search_availabilities_by_email(email: String) -> Vec<Availability> {
    let principal = EMAIL_TO_PRINCIPAL.with(|e| {
        e.borrow().get(&email).cloned()
    });
    
    match principal {
        Some(p) => list_user_availabilities(p),
        None => vec![],
    }
}

/// Search availabilities by username
pub fn search_availabilities_by_username(username: String) -> Vec<Availability> {
    let principal = USERNAME_TO_PRINCIPAL.with(|u| {
        u.borrow().get(&username).cloned()
    });
    
    match principal {
        Some(p) => list_user_availabilities(p),
        None => vec![],
    }
}

/// Search availabilities by principal
pub fn search_availabilities_by_principal(principal: Principal) -> Vec<Availability> {
    list_user_availabilities(principal)
}

/// Update busy times for an availability
pub fn update_availability_busy_times(caller: Principal, id: String, busy_times: Vec<BusyTimeBlock>) -> Result<(), String> {
    AVAILABILITIES.with(|a| {
        let mut map = a.borrow_mut();
        let mut availability = map
            .get(&id)
            .ok_or_else(|| "Availability not found".to_string())?;
        
        // Verify ownership
        if availability.owner != caller {
            return Err("Only the owner can update busy times".to_string());
        }
        
        availability.busy_times = Some(busy_times.clone());
        availability.updated_at = time();
        
        // Re-insert the updated availability
        map.insert(id.clone(), availability);
        
        ic_cdk::println!("✅ Updated busy times for availability: {} ({} blocks)", id, busy_times.len());
        Ok(())
    })
}

// ============================================================================
// Batch Search Functions (Optimized for Multiple Users)
// ============================================================================

/// Batch search availabilities by multiple emails
/// Uses O(1) HashMap lookups - scalable to millions of users
pub fn search_by_emails(emails: Vec<String>) -> Vec<Vec<Availability>> {
    emails.iter()
        .map(|email| {
            // O(1) lookup in EMAIL_TO_PRINCIPAL HashMap
            let principal_opt = EMAIL_TO_PRINCIPAL.with(|e| {
                e.borrow().get(email).cloned()
            });
            
            match principal_opt {
                Some(principal) => list_user_availabilities(principal),
                None => vec![],
            }
        })
        .collect()
}

/// Batch search availabilities by multiple usernames
/// Uses O(1) HashMap lookups - scalable to millions of users
pub fn search_by_usernames(usernames: Vec<String>) -> Vec<Vec<Availability>> {
    usernames.iter()
        .map(|username| {
            // O(1) lookup in USERNAME_TO_PRINCIPAL HashMap
            let principal_opt = USERNAME_TO_PRINCIPAL.with(|u| {
                u.borrow().get(username).cloned()
            });
            
            match principal_opt {
                Some(principal) => list_user_availabilities(principal),
                None => vec![],
            }
        })
        .collect()
}

/// Set an availability as favorite and reorder all availabilities
/// Only one availability can be favorite at a time
pub fn set_favorite_availability(caller: Principal, id: String) -> Result<(), String> {
    // Verify the availability exists and is owned by caller
    let target_availability = AVAILABILITIES.with(|a| {
        a.borrow()
            .get(&id)
            .ok_or_else(|| "Availability not found".to_string())
    })?;
    
    if target_availability.owner != caller {
        return Err("Only the owner can set favorite".to_string());
    }
    
    // Get all user's availabilities
    let user_availability_ids = USER_AVAILABILITIES.with(|ua| {
        ua.borrow()
            .get(&caller)
            .map(|v| v.0.clone())
            .unwrap_or_default()
    });
    
    if user_availability_ids.is_empty() {
        return Err("No availabilities found".to_string());
    }
    
    // Update all availabilities
    AVAILABILITIES.with(|a| {
        let mut map = a.borrow_mut();
        
        // First pass: set all is_favorite to false
        for avail_id in &user_availability_ids {
            if let Some(mut avail) = map.get(avail_id) {
                avail.is_favorite = false;
                avail.updated_at = time();
                map.insert(avail_id.clone(), avail);
            }
        }
        
        // Second pass: set target as favorite and reorder
        if let Some(mut target) = map.get(&id) {
            target.is_favorite = true;
            target.display_order = 0;
            target.updated_at = time();
            map.insert(id.clone(), target);
        }
        
        // Third pass: update display_order for all others
        let mut order = 1u32;
        for avail_id in &user_availability_ids {
            if avail_id != &id {
                if let Some(mut avail) = map.get(avail_id) {
                    avail.display_order = order;
                    avail.updated_at = time();
                    map.insert(avail_id.clone(), avail);
                    order += 1;
                }
            }
        }
    });
    
    ic_cdk::println!("⭐ Set favorite availability: {}", id);
    Ok(())
}
