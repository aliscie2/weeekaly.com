use ic_cdk_macros::{query, update, init};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;

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
// State
// ============================================================================

thread_local! {
    static PROVIDERS: RefCell<HashMap<String, OAuthProvider>> = RefCell::new(HashMap::new());
    static SESSIONS: RefCell<HashMap<Vec<u8>, SessionData>> = RefCell::new(HashMap::new());
    // Store encrypted tokens per user (user_id -> TokenResponse)
    static USER_TOKENS: RefCell<HashMap<String, TokenResponse>> = RefCell::new(HashMap::new());
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
    
    // 3. Calculate expiration
    let now = ic_cdk::api::time();
    let expire_at = now + req.max_time_to_live;
    
    // 4. Store session
    SESSIONS.with(|s| {
        s.borrow_mut().insert(req.session_public_key.clone(), SessionData {
            user_id,
            email,
            name,
            origin: req.origin,
            expires_at: expire_at,
            targets: req.targets,
        });
    });
    
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
            
            // Store tokens for this user (associated with their session)
            // In production, encrypt tokens before storing
            let caller = ic_cdk::caller().to_text();
            USER_TOKENS.with(|t| {
                t.borrow_mut().insert(caller, token_response.clone());
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
            
            // Update stored tokens
            let caller = ic_cdk::caller().to_text();
            USER_TOKENS.with(|t| {
                t.borrow_mut().insert(caller, token_response.clone());
            });
            
            Ok(token_response)
        }
        Err((code, msg)) => {
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

ic_cdk_macros::export_candid!();
