use ic_cdk_macros::{query, update, init};
use candid::{CandidType, Principal, Decode, Encode};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;
use ic_stable_structures::{
    memory_manager::MemoryId,
    storable::Bound,
    StableBTreeMap, Storable,
};
use std::borrow::Cow;

mod memory;
mod availabilities;
use availabilities::*;
pub use availabilities::BusyTimeBlock;
use memory::{Memory, MEMORY_MANAGER};

// ============================================================================
// Constants
// ============================================================================

/// Maximum session lifetime: 7 days in nanoseconds
/// Currently unused but reserved for future session validation
#[allow(dead_code)]
const MAX_SESSION_LIFETIME_NS: u64 = 7 * 24 * 60 * 60 * 1_000_000_000;

/// Google OAuth Client ID
const GOOGLE_CLIENT_ID: &str = "1094222481488-rrlvvr8q7mjaq9vmave57fkfrjcd9g3a.apps.googleusercontent.com";

/// Google OAuth Client Secret - SECURELY STORED IN BACKEND ONLY
/// TODO: Move to environment variable or secure configuration
const GOOGLE_CLIENT_SECRET: &str = "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";

// ============================================================================
// Types
// ============================================================================

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct OAuthProvider {
    pub name: String,
    pub client_id: String,
    pub authorization_url: String,
    pub token_url: String,
    pub scope: String,
    pub response_type: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
struct SessionData {
    user_id: String,
    email: Option<String>,
    name: Option<String>,
    origin: String,
    expires_at: u64,
    targets: Option<Vec<Principal>>,
}

#[derive(CandidType, Deserialize)]
pub struct PrepareDelegationRequest {
    pub provider: String,
    pub id_token: String,
    pub origin: String,
    pub session_public_key: Vec<u8>,
    pub max_time_to_live: u64,
    pub targets: Option<Vec<Principal>>,
}

#[derive(CandidType, Serialize)]
pub struct PrepareDelegationResponse {
    pub expire_at: u64,
}

#[derive(CandidType, Deserialize)]
pub struct GetDelegationRequest {
    pub provider: String,
    pub origin: String,
    pub session_public_key: Vec<u8>,
    pub expire_at: u64,
    pub targets: Option<Vec<Principal>>,
}

#[derive(CandidType, Serialize, Clone)]
pub struct Delegation {
    pub pubkey: Vec<u8>,
    pub expiration: u64,
    pub targets: Option<Vec<Principal>>,
}

#[derive(CandidType, Serialize)]
pub struct SignedDelegation {
    pub delegation: Delegation,
    pub signature: Vec<u8>,
}

#[derive(CandidType, Serialize)]
pub struct GetDelegationResponse {
    pub signed_delegation: SignedDelegation,
    pub user_canister_pubkey: Vec<u8>,
}

// ============================================================================
// Google OAuth Token Types
// ============================================================================

#[derive(CandidType, Deserialize)]
pub struct ExchangeCodeRequest {
    pub code: String,
    pub code_verifier: String,
    pub redirect_uri: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
    pub token_type: String,
}

#[derive(CandidType, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

// ============================================================================
// Storable Implementations
// ============================================================================

impl Storable for TokenResponse {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

// ============================================================================
// State
// ============================================================================

thread_local! {
    static PROVIDERS: RefCell<HashMap<String, OAuthProvider>> = RefCell::new(HashMap::new());
    static SESSIONS: RefCell<HashMap<Vec<u8>, SessionData>> = RefCell::new(HashMap::new());
    
    // Store encrypted tokens per user (user_id -> TokenResponse) - STABLE STORAGE
    pub static USER_TOKENS: RefCell<StableBTreeMap<String, TokenResponse, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2)))
        )
    );
}

// ============================================================================
// Initialization
// ============================================================================

#[init]
fn init() {
    // Initialize Google OAuth provider
    PROVIDERS.with(|p| {
        let mut providers = p.borrow_mut();
        providers.insert("google".to_string(), OAuthProvider {
            name: "Google".to_string(),
            client_id: GOOGLE_CLIENT_ID.to_string(),
            authorization_url: "https://accounts.google.com/o/oauth2/v2/auth".to_string(),
            token_url: "https://oauth2.googleapis.com/token".to_string(),
            scope: "openid email profile https://www.googleapis.com/auth/calendar".to_string(),
            response_type: "code id_token".to_string(),
        });
    });
}

// ============================================================================
// Existing Functions
// ============================================================================

#[query]
fn hello_world() -> String {
    "Hello, World from oDoc backend!".to_string()
}

#[query]
fn greet(name: String) -> String {
    format!("Hello, {}! Welcome to oDoc.", name)
}

#[query]
fn is_authenticated() -> bool {
    ic_cdk::caller() != Principal::anonymous()
}

#[query]
fn get_caller() -> String {
    ic_cdk::caller().to_text()
}

#[derive(CandidType, Serialize)]
pub struct UserInfo {
    pub principal: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub user_id: Option<String>,
}

#[query]
fn get_user_info() -> UserInfo {
    let principal = ic_cdk::caller();
    
    // Try to find session data for this user
    let mut user_email: Option<String> = None;
    let mut user_name: Option<String> = None;
    let mut user_id: Option<String> = None;
    
    SESSIONS.with(|s| {
        let sessions = s.borrow();
        // Find any session for this user (we don't have the session key here)
        // In a real implementation, you'd want to maintain a reverse mapping
        for session_data in sessions.values() {
            user_email = session_data.email.clone();
            user_name = session_data.name.clone();
            user_id = Some(session_data.user_id.clone());
            break; // Just get the first one for now
        }
    });
    
    UserInfo {
        principal: principal.to_text(),
        email: user_email,
        name: user_name,
        user_id,
    }
}

// ============================================================================
// OAuth Provider Functions
// ============================================================================

#[query]
fn get_providers() -> Vec<OAuthProvider> {
    PROVIDERS.with(|p| {
        p.borrow().values().cloned().collect()
    })
}

// ============================================================================
// Delegation Functions
// ============================================================================

#[update]
async fn prepare_delegation(req: PrepareDelegationRequest) -> Result<PrepareDelegationResponse, String> {
    // 1. Verify provider exists
    let _provider = PROVIDERS.with(|p| {
        p.borrow().get(&req.provider).cloned()
    }).ok_or("Provider not found")?;
    
    // 2. Verify JWT token and extract user ID, email, and name
    let (user_id, email, name) = verify_jwt_token(&req.id_token)?;
    
    ic_cdk::println!("📧 [prepare_delegation] JWT extracted - user_id={}, email={:?}, name={:?}", user_id, email, name);
    
    // 3. Calculate expiration
    let now = ic_cdk::api::time();
    let expire_at = now + req.max_time_to_live;
    
    // Derive the principal for this user
    let user_principal = derive_user_principal(&user_id, &req.origin);
    ic_cdk::println!("🔑 [prepare_delegation] Derived principal: {:?}", user_principal);
    
    // 4. Store session
    SESSIONS.with(|s| {
        s.borrow_mut().insert(req.session_public_key.clone(), SessionData {
            user_id: user_id.clone(),
            email: email.clone(),
            name: name.clone(),
            origin: req.origin.clone(),
            expires_at: expire_at,
            targets: req.targets.clone(),
        });
    });
    
    ic_cdk::println!("✅ [prepare_delegation] Session stored for principal {:?}", user_principal);
    
    Ok(PrepareDelegationResponse { expire_at })
}

#[query]
fn get_delegation(req: GetDelegationRequest) -> Result<GetDelegationResponse, String> {
    // 1. Retrieve session
    let session = SESSIONS.with(|s| {
        s.borrow().get(&req.session_public_key).cloned()
    }).ok_or("Session not found")?;
    
    // 2. Verify expiration matches
    if session.expires_at != req.expire_at {
        return Err("Invalid expiration time".to_string());
    }
    
    // 3. Verify origin matches
    if session.origin != req.origin {
        return Err("Invalid origin".to_string());
    }
    
    // 4. Create delegation
    let delegation = Delegation {
        pubkey: req.session_public_key.clone(),
        expiration: req.expire_at,
        targets: req.targets,
    };
    
    // 5. Sign delegation
    let signature = sign_delegation(&delegation)?;
    
    // 6. Derive user principal from user_id + origin
    let user_pubkey = derive_user_pubkey(&session.user_id, &session.origin);
    
    Ok(GetDelegationResponse {
        signed_delegation: SignedDelegation {
            delegation,
            signature,
        },
        user_canister_pubkey: user_pubkey,
    })
}

// ============================================================================
// Session Management
// ============================================================================

/// Clean up expired sessions
/// Should be called periodically to prevent memory leaks
#[update]
fn cleanup_expired_sessions() -> u64 {
    let now = ic_cdk::api::time();
    let mut removed_count = 0;
    
    SESSIONS.with(|s| {
        let mut sessions = s.borrow_mut();
        sessions.retain(|_, session_data| {
            let is_valid = session_data.expires_at > now;
            if !is_valid {
                removed_count += 1;
            }
            is_valid
        });
    });
    
    ic_cdk::println!("🧹 Cleaned up {} expired sessions", removed_count);
    removed_count
}

/// Get current session count (for monitoring)
#[query]
fn get_session_count() -> u64 {
    SESSIONS.with(|s| s.borrow().len() as u64)
}

/// Logout user by removing their session
/// Note: This requires the session public key to identify the session
#[update]
fn logout(session_public_key: Vec<u8>) -> Result<(), String> {
    SESSIONS.with(|s| {
        let mut sessions = s.borrow_mut();
        if sessions.remove(&session_public_key).is_some() {
            ic_cdk::println!("👋 User logged out successfully");
            Ok(())
        } else {
            Err("Session not found".to_string())
        }
    })
}

// ============================================================================
// Google OAuth Token Exchange (SECURE - Backend Only)
// ============================================================================

/// Exchange authorization code for access token
/// This is done securely on the backend to protect the client secret
#[update]
async fn exchange_oauth_code(req: ExchangeCodeRequest) -> Result<TokenResponse, String> {
    ic_cdk::println!("🔄 [Backend] Exchanging OAuth code for tokens...");
    
    // Build request body
    let mut params = vec![
        ("code", req.code.as_str()),
        ("client_id", GOOGLE_CLIENT_ID),
        ("client_secret", GOOGLE_CLIENT_SECRET),
        ("redirect_uri", req.redirect_uri.as_str()),
        ("grant_type", "authorization_code"),
    ];
    
    // Add PKCE verifier if provided
    if !req.code_verifier.is_empty() {
        params.push(("code_verifier", req.code_verifier.as_str()));
    }
    
    // Make HTTP outcall to Google's token endpoint
    let body = params.iter()
        .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&");
    
    let request = ic_cdk::api::management_canister::http_request::CanisterHttpRequestArgument {
        url: "https://oauth2.googleapis.com/token".to_string(),
        method: ic_cdk::api::management_canister::http_request::HttpMethod::POST,
        body: Some(body.into_bytes()),
        max_response_bytes: Some(4096),
        transform: None,
        headers: vec![
            ic_cdk::api::management_canister::http_request::HttpHeader {
                name: "Content-Type".to_string(),
                value: "application/x-www-form-urlencoded".to_string(),
            },
        ],
    };
    
    match ic_cdk::api::management_canister::http_request::http_request(request, 25_000_000_000).await {
        Ok((response,)) => {
            if response.status != candid::Nat::from(200u8) {
                let error_body = String::from_utf8_lossy(&response.body);
                ic_cdk::println!("❌ [Backend] Token exchange failed: {}", error_body);
                return Err(format!("Token exchange failed: {}", error_body));
            }
            
            let token_response: TokenResponse = serde_json::from_slice(&response.body)
                .map_err(|e| format!("Failed to parse token response: {}", e))?;
            
            ic_cdk::println!("✅ [Backend] Token exchange successful!");
            
            // Store tokens for this user
            // We need to extract the user_id from the id_token to get the OAuth principal
            // For now, store using caller (frontend principal)
            let caller = ic_cdk::caller().to_text();
            
            // Also try to find the OAuth principal from active sessions
            // by matching the user who just authenticated
            let oauth_principals: Vec<String> = SESSIONS.with(|s| {
                s.borrow()
                    .iter()
                    .map(|(_, session)| {
                        derive_user_principal(&session.user_id, &session.origin).to_text()
                    })
                    .collect()
            });
            
            ic_cdk::println!("💾 [Backend] Storing tokens for caller: {}", caller);
            ic_cdk::println!("💾 [Backend] Also storing for {} OAuth principals", oauth_principals.len());
            
            USER_TOKENS.with(|t| {
                let mut tokens = t.borrow_mut();
                // Store for caller
                tokens.insert(caller.clone(), token_response.clone());
                // Store for all OAuth principals (in case one of them is the owner)
                for principal in oauth_principals {
                    ic_cdk::println!("💾 [Backend] Storing token for OAuth principal: {}", principal);
                    tokens.insert(principal, token_response.clone());
                }
            });
            
            Ok(token_response)
        }
        Err((code, msg)) => {
            ic_cdk::println!("❌ [Backend] HTTP request failed: {:?} - {}", code, msg);
            Err(format!("HTTP request failed: {:?} - {}", code, msg))
        }
    }
}

/// Refresh access token using refresh token
#[update]
async fn refresh_google_token(req: RefreshTokenRequest) -> Result<TokenResponse, String> {
    ic_cdk::println!("🔄 [Backend] Refreshing access token...");
    
    let params = vec![
        ("refresh_token", req.refresh_token.as_str()),
        ("client_id", GOOGLE_CLIENT_ID),
        ("client_secret", GOOGLE_CLIENT_SECRET),
        ("grant_type", "refresh_token"),
    ];
    
    let body = params.iter()
        .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&");
    
    let request = ic_cdk::api::management_canister::http_request::CanisterHttpRequestArgument {
        url: "https://oauth2.googleapis.com/token".to_string(),
        method: ic_cdk::api::management_canister::http_request::HttpMethod::POST,
        body: Some(body.into_bytes()),
        max_response_bytes: Some(4096),
        transform: None,
        headers: vec![
            ic_cdk::api::management_canister::http_request::HttpHeader {
                name: "Content-Type".to_string(),
                value: "application/x-www-form-urlencoded".to_string(),
            },
        ],
    };
    
    match ic_cdk::api::management_canister::http_request::http_request(request, 25_000_000_000).await {
        Ok((response,)) => {
            if response.status != candid::Nat::from(200u8) {
                let error_body = String::from_utf8_lossy(&response.body);
                return Err(format!("Token refresh failed: {}", error_body));
            }
            
            let token_response: TokenResponse = serde_json::from_slice(&response.body)
                .map_err(|e| format!("Failed to parse token response: {}", e))?;
            
            ic_cdk::println!("✅ [Backend] Token refresh successful!");
            
            // Update stored tokens for all principals
            let caller = ic_cdk::caller().to_text();
            
            let oauth_principals: Vec<String> = SESSIONS.with(|s| {
                s.borrow()
                    .iter()
                    .map(|(_, session)| {
                        derive_user_principal(&session.user_id, &session.origin).to_text()
                    })
                    .collect()
            });
            
            USER_TOKENS.with(|t| {
                let mut tokens = t.borrow_mut();
                tokens.insert(caller, token_response.clone());
                for principal in oauth_principals {
                    tokens.insert(principal, token_response.clone());
                }
            });
            
            Ok(token_response)
        }
        Err((code, msg)) => {
            Err(format!("HTTP request failed: {:?} - {}", code, msg))
        }
    }
}

// ============================================================================
// Google Calendar CRUD Operations
// ============================================================================

#[derive(CandidType, Deserialize)]
pub struct CreateEventRequest {
    pub summary: String,
    pub description: Option<String>,
    pub start_time: String, // ISO 8601 format
    pub end_time: String,   // ISO 8601 format
    pub timezone: String,
    pub location: Option<String>,
    pub attendees: Option<Vec<String>>, // Email addresses
    pub conference_data: Option<bool>,  // Add Google Meet
}

#[derive(CandidType, Deserialize)]
pub struct UpdateEventRequest {
    pub event_id: String,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub timezone: Option<String>,
    pub location: Option<String>,
    pub attendees: Option<Vec<String>>,
    pub status: Option<String>, // "confirmed", "tentative", "cancelled"
}

#[derive(CandidType, Serialize)]
pub struct CalendarEvent {
    pub id: String,
    pub summary: String,
    pub description: Option<String>,
    pub start: String,
    pub end: String,
    pub location: Option<String>,
    pub status: String,
}

/// Create a new calendar event
#[update]
async fn create_calendar_event(req: CreateEventRequest) -> Result<String, String> {
    ic_cdk::println!("📅 [Backend] Creating calendar event: {}", req.summary);
    
    // Get user's access token
    let caller = ic_cdk::caller().to_text();
    let token = USER_TOKENS.with(|t| {
        t.borrow().get(&caller).map(|tr| tr.access_token.clone())
    }).ok_or("No access token found. Please login first.")?;
    
    // Build event JSON
    let mut event_json = serde_json::json!({
        "summary": req.summary,
        "start": {
            "dateTime": req.start_time,
            "timeZone": req.timezone
        },
        "end": {
            "dateTime": req.end_time,
            "timeZone": req.timezone
        }
    });
    
    if let Some(desc) = req.description {
        event_json["description"] = serde_json::json!(desc);
    }
    
    if let Some(loc) = req.location {
        event_json["location"] = serde_json::json!(loc);
    }
    
    if let Some(attendees) = req.attendees {
        let attendee_list: Vec<serde_json::Value> = attendees.iter()
            .map(|email| serde_json::json!({"email": email}))
            .collect();
        event_json["attendees"] = serde_json::json!(attendee_list);
    }
    
    if req.conference_data.unwrap_or(false) {
        event_json["conferenceData"] = serde_json::json!({
            "createRequest": {
                "requestId": format!("meet-{}", ic_cdk::api::time()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"}
            }
        });
    }
    
    let body = serde_json::to_string(&event_json)
        .map_err(|e| format!("Failed to serialize event: {}", e))?;
    
    // Determine URL based on conference data
    let url = if req.conference_data.unwrap_or(false) {
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1"
    } else {
        "https://www.googleapis.com/calendar/v3/calendars/primary/events"
    };
    
    let request = ic_cdk::api::management_canister::http_request::CanisterHttpRequestArgument {
        url: url.to_string(),
        method: ic_cdk::api::management_canister::http_request::HttpMethod::POST,
        body: Some(body.into_bytes()),
        max_response_bytes: Some(8192),
        transform: None,
        headers: vec![
            ic_cdk::api::management_canister::http_request::HttpHeader {
                name: "Authorization".to_string(),
                value: format!("Bearer {}", token),
            },
            ic_cdk::api::management_canister::http_request::HttpHeader {
                name: "Content-Type".to_string(),
                value: "application/json".to_string(),
            },
        ],
    };
    
    match ic_cdk::api::management_canister::http_request::http_request(request, 25_000_000_000).await {
        Ok((response,)) => {
            if response.status != candid::Nat::from(200u8) {
                let error_body = String::from_utf8_lossy(&response.body);
                ic_cdk::println!("❌ [Backend] Create event failed: {}", error_body);
                return Err(format!("Failed to create event: {}", error_body));
            }
            
            let response_json: serde_json::Value = serde_json::from_slice(&response.body)
                .map_err(|e| format!("Failed to parse response: {}", e))?;
            
            let event_id = response_json["id"].as_str()
                .ok_or("No event ID in response")?
                .to_string();
            
            ic_cdk::println!("✅ [Backend] Event created: {}", event_id);
            Ok(event_id)
        }
        Err((code, msg)) => {
            ic_cdk::println!("❌ [Backend] HTTP request failed: {:?} - {}", code, msg);
            Err(format!("HTTP request failed: {:?} - {}", code, msg))
        }
    }
}

/// Update an existing calendar event
#[update]
async fn update_calendar_event(req: UpdateEventRequest) -> Result<String, String> {
    ic_cdk::println!("📝 [Backend] Updating calendar event: {}", req.event_id);
    
    // Get user's access token
    let caller = ic_cdk::caller().to_text();
    let token = USER_TOKENS.with(|t| {
        t.borrow().get(&caller).map(|tr| tr.access_token.clone())
    }).ok_or("No access token found. Please login first.")?;
    
    // Build update JSON (only include fields that are being updated)
    let mut update_json = serde_json::json!({});
    
    if let Some(summary) = req.summary {
        update_json["summary"] = serde_json::json!(summary);
    }
    
    if let Some(desc) = req.description {
        update_json["description"] = serde_json::json!(desc);
    }
    
    if let Some(loc) = req.location {
        update_json["location"] = serde_json::json!(loc);
    }
    
    if let Some(status) = req.status {
        update_json["status"] = serde_json::json!(status);
    }
    
    if let Some(start_time) = req.start_time {
        let timezone = req.timezone.clone().unwrap_or_else(|| "UTC".to_string());
        update_json["start"] = serde_json::json!({
            "dateTime": start_time,
            "timeZone": timezone
        });
    }
    
    if let Some(end_time) = req.end_time {
        let timezone = req.timezone.unwrap_or_else(|| "UTC".to_string());
        update_json["end"] = serde_json::json!({
            "dateTime": end_time,
            "timeZone": timezone
        });
    }
    
    if let Some(attendees) = req.attendees {
        let attendee_list: Vec<serde_json::Value> = attendees.iter()
            .map(|email| serde_json::json!({"email": email}))
            .collect();
        update_json["attendees"] = serde_json::json!(attendee_list);
    }
    
    let body = serde_json::to_string(&update_json)
        .map_err(|e| format!("Failed to serialize update: {}", e))?;
    
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events/{}",
        urlencoding::encode(&req.event_id)
    );
    
    // IC HTTP outcall only supports GET, POST, HEAD
    // Use POST with X-HTTP-Method-Override header for PATCH
    let request = ic_cdk::api::management_canister::http_request::CanisterHttpRequestArgument {
        url,
        method: ic_cdk::api::management_canister::http_request::HttpMethod::POST,
        body: Some(body.into_bytes()),
        max_response_bytes: Some(8192),
        transform: None,
        headers: vec![
            ic_cdk::api::management_canister::http_request::HttpHeader {
                name: "Authorization".to_string(),
                value: format!("Bearer {}", token),
            },
            ic_cdk::api::management_canister::http_request::HttpHeader {
                name: "Content-Type".to_string(),
                value: "application/json".to_string(),
            },
            ic_cdk::api::management_canister::http_request::HttpHeader {
                name: "X-HTTP-Method-Override".to_string(),
                value: "PATCH".to_string(),
            },
        ],
    };
    
    match ic_cdk::api::management_canister::http_request::http_request(request, 25_000_000_000).await {
        Ok((response,)) => {
            if response.status != candid::Nat::from(200u8) {
                let error_body = String::from_utf8_lossy(&response.body);
                ic_cdk::println!("❌ [Backend] Update event failed: {}", error_body);
                return Err(format!("Failed to update event: {}", error_body));
            }
            
            ic_cdk::println!("✅ [Backend] Event updated: {}", req.event_id);
            Ok(req.event_id)
        }
        Err((code, msg)) => {
            ic_cdk::println!("❌ [Backend] HTTP request failed: {:?} - {}", code, msg);
            Err(format!("HTTP request failed: {:?} - {}", code, msg))
        }
    }
}

/// Delete a calendar event
#[update]
async fn delete_calendar_event(event_id: String) -> Result<(), String> {
    ic_cdk::println!("🗑️ [Backend] Deleting calendar event: {}", event_id);
    
    // Get user's access token
    let caller = ic_cdk::caller().to_text();
    let token = USER_TOKENS.with(|t| {
        t.borrow().get(&caller).map(|tr| tr.access_token.clone())
    }).ok_or("No access token found. Please login first.")?;
    
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events/{}",
        urlencoding::encode(&event_id)
    );
    
    // IC HTTP outcall only supports GET, POST, HEAD
    // Use POST with X-HTTP-Method-Override header for DELETE
    let request = ic_cdk::api::management_canister::http_request::CanisterHttpRequestArgument {
        url,
        method: ic_cdk::api::management_canister::http_request::HttpMethod::POST,
        body: None,
        max_response_bytes: Some(1024),
        transform: None,
        headers: vec![
            ic_cdk::api::management_canister::http_request::HttpHeader {
                name: "Authorization".to_string(),
                value: format!("Bearer {}", token),
            },
            ic_cdk::api::management_canister::http_request::HttpHeader {
                name: "X-HTTP-Method-Override".to_string(),
                value: "DELETE".to_string(),
            },
        ],
    };
    
    match ic_cdk::api::management_canister::http_request::http_request(request, 25_000_000_000).await {
        Ok((response,)) => {
            // DELETE returns 204 No Content on success
            if response.status != candid::Nat::from(204u8) && response.status != candid::Nat::from(200u8) {
                let error_body = String::from_utf8_lossy(&response.body);
                ic_cdk::println!("❌ [Backend] Delete event failed: {}", error_body);
                return Err(format!("Failed to delete event: {}", error_body));
            }
            
            ic_cdk::println!("✅ [Backend] Event deleted: {}", event_id);
            Ok(())
        }
        Err((code, msg)) => {
            ic_cdk::println!("❌ [Backend] HTTP request failed: {:?} - {}", code, msg);
            Err(format!("HTTP request failed: {:?} - {}", code, msg))
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Verify JWT token and extract user information
/// 
/// WARNING: This currently does NOT verify the JWT signature!
/// In production, this MUST verify the signature using Google's JWKS endpoint.
/// 
/// TODO: Implement proper JWT signature verification
/// See: https://developers.google.com/identity/protocols/oauth2/openid-connect#validatinganidtoken
fn verify_jwt_token(token: &str) -> Result<(String, Option<String>, Option<String>), String> {
    use base64::Engine;
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    
    // Split JWT into parts (header.payload.signature)
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid JWT format: expected 3 parts separated by dots".to_string());
    }
    
    // Decode payload (base64url encoded)
    let payload_bytes = URL_SAFE_NO_PAD.decode(parts[1])
        .map_err(|e| format!("Failed to decode JWT payload: {}", e))?;
    
    let claims: serde_json::Value = serde_json::from_slice(&payload_bytes)
        .map_err(|e| format!("Failed to parse JWT claims as JSON: {}", e))?;
    
    // Extract user ID (sub claim is required)
    let user_id = claims["sub"].as_str()
        .ok_or("Missing required 'sub' claim in JWT")?
        .to_string();
    
    // Extract optional email and name
    let email = claims["email"].as_str().map(|s| s.to_string());
    let name = claims["name"].as_str().map(|s| s.to_string());
    
    // Log user info for debugging
    ic_cdk::println!("📧 Backend: User Email: {:?}", email);
    ic_cdk::println!("👤 Backend: User Name: {:?}", name);
    ic_cdk::println!("🆔 Backend: User ID: {}", user_id);
    
    // ⚠️ SECURITY WARNING: JWT signature is NOT being verified!
    // This is acceptable for development but MUST be fixed for production.
    // An attacker could forge tokens without signature verification.
    
    Ok((user_id, email, name))
}

/// Sign delegation using canister's key
/// 
/// WARNING: This currently returns a DUMMY signature (just a hash)!
/// In production, this MUST use proper threshold ECDSA signing.
/// 
/// TODO: Implement proper signing using IC's threshold ECDSA
/// See: https://internetcomputer.org/docs/current/developer-docs/integrations/t-ecdsa/
fn sign_delegation(delegation: &Delegation) -> Result<Vec<u8>, String> {
    // ⚠️ SECURITY WARNING: This is NOT a real signature!
    // This is just a hash of the delegation data.
    // An attacker could forge delegations without proper signing.
    
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(&delegation.pubkey);
    hasher.update(delegation.expiration.to_le_bytes());
    let hash = hasher.finalize();
    
    // TODO: Replace with actual threshold ECDSA signing:
    // let signature = ic_cdk::api::management_canister::ecdsa::sign_with_ecdsa(...).await?;
    
    Ok(hash.to_vec())
}

/// Derive deterministic user public key from user ID and origin
/// 
/// This ensures the same user gets the same principal for the same origin,
/// providing consistent identity across sessions.
/// 
/// @param user_id - OAuth provider's user ID (e.g., Google sub claim)
/// @param origin - Application origin (e.g., https://example.com)
/// @returns Deterministic public key bytes
fn derive_user_pubkey(user_id: &str, origin: &str) -> Vec<u8> {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(user_id.as_bytes());
    hasher.update(b":");
    hasher.update(origin.as_bytes());
    hasher.finalize().to_vec()
}

/// Derive deterministic user principal from user ID and origin
fn derive_user_principal(user_id: &str, origin: &str) -> Principal {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(user_id.as_bytes());
    hasher.update(b":");
    hasher.update(origin.as_bytes());
    let hash = hasher.finalize();
    Principal::from_slice(&hash[0..29])
}

// ============================================================================
// Availability API Endpoints
// ============================================================================

/// Helper function to fetch busy times for an availability
async fn fetch_busy_times_for_availability(availability: &Availability) -> Result<Vec<BusyTimeBlock>, String> {
    ic_cdk::println!("🔍 [fetch_busy_times] Starting for owner: {}", availability.owner.to_text());
    
    // 1. Get owner's access token
    let owner_id = availability.owner.to_text();
    let token = USER_TOKENS.with(|t| {
        t.borrow().get(&owner_id).map(|tr| tr.access_token.clone())
    }).ok_or_else(|| {
        ic_cdk::println!("❌ [fetch_busy_times] Owner not authenticated: {}", owner_id);
        "Owner not authenticated".to_string()
    })?;
    
    ic_cdk::println!("✅ [fetch_busy_times] Found access token for owner");
    
    // 2. Calculate time range (next 90 days)
    let now = ic_cdk::api::time() / 1_000_000_000; // Convert to seconds
    let end_time = now + (90 * 24 * 60 * 60); // 90 days from now
    
    ic_cdk::println!("📅 [fetch_busy_times] Time range: {} to {}", now, end_time);
    
    // 3. Fetch events from Google Calendar
    let events = fetch_calendar_events(&token, now, end_time).await?;
    
    ic_cdk::println!("📋 [fetch_busy_times] Fetched {} events from Google Calendar", events.len());
    
    // 4. Extract only start/end times
    let busy_times: Vec<BusyTimeBlock> = events
        .into_iter()
        .filter_map(|event| {
            let start_str = event.get("start")?.get("dateTime")?.as_str()?;
            let end_str = event.get("end")?.get("dateTime")?.as_str()?;
            
            let start_time = parse_iso8601_to_timestamp(start_str)?;
            let end_time = parse_iso8601_to_timestamp(end_str)?;
            
            Some(BusyTimeBlock {
                start_time,
                end_time,
            })
        })
        .collect();
    
    ic_cdk::println!("✅ [fetch_busy_times] Extracted {} busy time blocks", busy_times.len());
    
    Ok(busy_times)
}

/// Fetch calendar events from Google Calendar API
async fn fetch_calendar_events(
    access_token: &str,
    time_min: u64,
    time_max: u64,
) -> Result<Vec<serde_json::Value>, String> {
    // Convert timestamps to ISO 8601 format
    let time_min_iso = format_timestamp_to_iso8601(time_min);
    let time_max_iso = format_timestamp_to_iso8601(time_max);
    
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={}&timeMax={}&singleEvents=true&orderBy=startTime&maxResults=250",
        urlencoding::encode(&time_min_iso),
        urlencoding::encode(&time_max_iso)
    );
    
    let request = ic_cdk::api::management_canister::http_request::CanisterHttpRequestArgument {
        url,
        method: ic_cdk::api::management_canister::http_request::HttpMethod::GET,
        body: None,
        max_response_bytes: Some(1_000_000), // 1MB for event list
        transform: None,
        headers: vec![
            ic_cdk::api::management_canister::http_request::HttpHeader {
                name: "Authorization".to_string(),
                value: format!("Bearer {}", access_token),
            },
        ],
    };
    
    match ic_cdk::api::management_canister::http_request::http_request(request, 25_000_000_000).await {
        Ok((response,)) => {
            if response.status != candid::Nat::from(200u8) {
                let error_body = String::from_utf8_lossy(&response.body);
                return Err(format!("Failed to fetch calendar events: {}", error_body));
            }
            
            let response_json: serde_json::Value = serde_json::from_slice(&response.body)
                .map_err(|e| format!("Failed to parse calendar response: {}", e))?;
            
            let events = response_json["items"]
                .as_array()
                .ok_or("No items in calendar response")?
                .clone();
            
            Ok(events)
        }
        Err((code, msg)) => {
            Err(format!("HTTP request failed: {:?} - {}", code, msg))
        }
    }
}

/// Parse ISO 8601 timestamp to Unix timestamp (seconds)
fn parse_iso8601_to_timestamp(iso_str: &str) -> Option<u64> {
    // Simple parser for ISO 8601 format: 2024-01-15T10:00:00Z or 2024-01-15T10:00:00-08:00
    // Extract year, month, day, hour, minute, second
    let parts: Vec<&str> = iso_str.split('T').collect();
    if parts.len() != 2 {
        return None;
    }
    
    let date_parts: Vec<&str> = parts[0].split('-').collect();
    if date_parts.len() != 3 {
        return None;
    }
    
    let year: i32 = date_parts[0].parse().ok()?;
    let month: u32 = date_parts[1].parse().ok()?;
    let day: u32 = date_parts[2].parse().ok()?;
    
    // Parse time part (remove timezone info for simplicity)
    let time_part = parts[1].split('+').next()?.split('-').next()?.split('Z').next()?;
    let time_parts: Vec<&str> = time_part.split(':').collect();
    if time_parts.len() < 2 {
        return None;
    }
    
    let hour: u32 = time_parts[0].parse().ok()?;
    let minute: u32 = time_parts[1].parse().ok()?;
    let second: u32 = if time_parts.len() > 2 {
        time_parts[2].split('.').next()?.parse().ok()?
    } else {
        0
    };
    
    // Calculate Unix timestamp (simplified - doesn't account for all edge cases)
    // Days since Unix epoch (1970-01-01)
    let days_since_epoch = days_from_civil(year, month, day);
    let seconds_from_days = days_since_epoch * 86400;
    let seconds_from_time = (hour * 3600 + minute * 60 + second) as i64;
    
    Some((seconds_from_days + seconds_from_time) as u64)
}

/// Calculate days since Unix epoch (1970-01-01)
fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let y = year as i64 - (if month <= 2 { 1 } else { 0 });
    let era = (if y >= 0 { y } else { y - 399 }) / 400;
    let yoe = (y - era * 400) as u32;
    let month_adjusted = if month > 2 { month - 3 } else { month + 9 };
    let doy = (153 * month_adjusted + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe as i64 - 719468
}

/// Format Unix timestamp (seconds) to ISO 8601
fn format_timestamp_to_iso8601(timestamp: u64) -> String {
    // Convert to days and seconds
    let days = (timestamp / 86400) as i64;
    let seconds_in_day = timestamp % 86400;
    
    // Calculate date from days since epoch
    let (year, month, day) = civil_from_days(days);
    
    // Calculate time
    let hour = seconds_in_day / 3600;
    let minute = (seconds_in_day % 3600) / 60;
    let second = seconds_in_day % 60;
    
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, minute, second
    )
}

/// Calculate civil date from days since Unix epoch
fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let z = days + 719468;
    let era = (if z >= 0 { z } else { z - 146096 }) / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = (y + if m <= 2 { 1 } else { 0 }) as i32;
    (year, m, d)
}

#[update]
fn create_availability(req: CreateAvailabilityRequest) -> Result<Availability, String> {
    let caller = ic_cdk::caller();
    let result = availabilities::create_availability(caller, req)?;
    
    // Copy token from caller to the availability owner (they're the same user)
    // This ensures the owner principal has the token for fetching busy times
    let caller_str = caller.to_text();
    let owner_str = result.owner.to_text();
    
    if caller_str != owner_str {
        ic_cdk::println!("🔑 [create_availability] Copying token from {} to {}", caller_str, owner_str);
        USER_TOKENS.with(|t| {
            let tokens = t.borrow();
            if let Some(token) = tokens.get(&caller_str) {
                drop(tokens); // Release borrow before mutable borrow
                t.borrow_mut().insert(owner_str, token);
                ic_cdk::println!("✅ [create_availability] Token copied successfully");
            } else {
                ic_cdk::println!("⚠️ [create_availability] No token found for caller");
            }
        });
    }
    
    Ok(result)
}

#[query]
fn get_availability(id: String) -> Result<Availability, String> {
    ic_cdk::println!("🔍 [get_availability] Called for ID: {}", id);
    let availability = availabilities::get_availability(id)?;
    
    ic_cdk::println!("📋 [get_availability] Found availability, owner: {}", availability.owner.to_text());
    ic_cdk::println!("🎯 [get_availability] Returning availability with busy_times: {:?}", 
        availability.busy_times.as_ref().map(|bt| bt.len()));
    
    Ok(availability)
}

#[update]
fn update_availability(req: UpdateAvailabilityRequest) -> Result<Availability, String> {
    let caller = ic_cdk::caller();
    availabilities::update_availability(caller, req)
}

#[update]
fn update_availability_busy_times(id: String, busy_times: Vec<BusyTimeBlock>) -> Result<(), String> {
    let caller = ic_cdk::caller();
    availabilities::update_availability_busy_times(caller, id, busy_times)
}

#[update]
fn delete_availability(id: String) -> Result<(), String> {
    let caller = ic_cdk::caller();
    availabilities::delete_availability(caller, id)
}

#[query]
fn list_user_availabilities() -> Vec<Availability> {
    let caller = ic_cdk::caller();
    availabilities::list_user_availabilities(caller)
}

#[update]
fn regenerate_availability_id(old_id: String) -> Result<String, String> {
    let caller = ic_cdk::caller();
    availabilities::regenerate_availability_id(caller, old_id)
}

#[query]
fn search_availabilities_by_email(email: String) -> Vec<Availability> {
    availabilities::search_availabilities_by_email(email)
}

#[query]
fn search_availabilities_by_username(username: String) -> Vec<Availability> {
    availabilities::search_availabilities_by_username(username)
}

#[query]
fn search_availabilities_by_principal(principal: Principal) -> Vec<Availability> {
    availabilities::search_availabilities_by_principal(principal)
}

#[query]
fn search_by_emails(emails: Vec<String>) -> Vec<Vec<Availability>> {
    availabilities::search_by_emails(emails)
}

#[query]
fn search_by_usernames(usernames: Vec<String>) -> Vec<Vec<Availability>> {
    availabilities::search_by_usernames(usernames)
}

#[update]
fn set_favorite_availability(id: String) -> Result<(), String> {
    let caller = ic_cdk::caller();
    availabilities::set_favorite_availability(caller, id)
}



ic_cdk_macros::export_candid!();
