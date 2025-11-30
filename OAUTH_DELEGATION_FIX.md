# OAuth Delegation Principal Fix

## The Problem

When using OAuth (Google) with IC delegations, users were getting different principals on each login because:

1. **Frontend creates a random session key** each time: `Ed25519KeyIdentity.generate()`
2. **Frontend was returning the session key directly** as identity instead of building `DelegationIdentity`
3. **Backend's `sign_delegation` is not cryptographically valid** - it's just a hash, not a real signature that IC can verify

## How IC Delegations Work

```
┌─────────────────────────────────────────────────────────────────┐
│                     Delegation Chain                            │
├─────────────────────────────────────────────────────────────────┤
│  Root Public Key (determines Principal)                         │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Delegation 1: "Root key delegates to Session Key"       │   │
│  │   - pubkey: session_public_key                          │   │
│  │   - expiration: timestamp                               │   │
│  │   - signature: SIGNED BY ROOT KEY                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                         │
│       ▼                                                         │
│  Session Key (signs actual requests)                           │
└─────────────────────────────────────────────────────────────────┘

identity.getPrincipal() → derived from ROOT KEY (deterministic!)
Requests signed by → SESSION KEY (random, but delegated)
```

## ✅ Fix Applied

### Frontend (`src/frontend/utils/oauthDelegation.ts`)

**Before:**
```typescript
const identity = sessionKey;  // ❌ Random principal each time
```

**After:**
```typescript
// Convert backend response to proper types
const pubkeyBuffer = new Uint8Array(signed_delegation.delegation.pubkey).buffer;
const signatureBuffer = new Uint8Array(signed_delegation.signature).buffer;
const userPubkeyBuffer = new Uint8Array(user_canister_pubkey).buffer;

// Create Delegation object
const delegation = new Delegation(
  pubkeyBuffer,
  signed_delegation.delegation.expiration,
  targets,
);

// Build delegation chain with deterministic root key
const delegationChain = DelegationChain.fromDelegations(
  [{ delegation, signature: signatureBuffer as Signature }],
  userPubkeyBuffer as DerEncodedPublicKey,  // This controls the principal!
);

// Create identity - principal derived from user_canister_pubkey (deterministic!)
const identity = DelegationIdentity.fromDelegation(sessionKey, delegationChain);
```

### How the Backend Creates Deterministic Keys

The backend derives the same public key for the same user every time:

```rust
/// Derive deterministic user public key from user ID and origin
fn derive_user_pubkey(user_id: &str, origin: &str) -> Vec<u8> {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(user_id.as_bytes());  // Google's stable 'sub' claim
    hasher.update(b":");
    hasher.update(origin.as_bytes());   // Your app's origin
    hasher.finalize().to_vec()
}
```

This ensures:
- Same Google user (`sub`) + Same origin = Same `user_canister_pubkey` = **Same Principal**

## ⚠️ Backend Signature Limitation

The backend's `sign_delegation` function currently returns a placeholder signature:

```rust
// ⚠️ NOT A REAL SIGNATURE - Just a hash!
fn sign_delegation(delegation: &Delegation) -> Result<Vec<u8>, String> {
    let mut hasher = Sha256::new();
    hasher.update(&delegation.pubkey);
    hasher.update(delegation.expiration.to_le_bytes());
    Ok(hasher.finalize().to_vec())  // IC cannot verify this!
}
```

**Impact:**
- ✅ `identity.getPrincipal()` returns deterministic principal (frontend works!)
- ⚠️ IC protocol cannot verify the delegation signature
- ⚠️ Canister calls that require signature verification may fail

## Solutions for Production

### Option 1: Threshold ECDSA (Recommended)

Use IC's t-ECDSA to sign delegations with a real key:

```rust
use ic_cdk::api::management_canister::ecdsa::{
    sign_with_ecdsa, EcdsaKeyId, EcdsaCurve, SignWithEcdsaArgument
};

async fn sign_delegation_with_ecdsa(delegation: &Delegation) -> Result<Vec<u8>, String> {
    let message_hash = create_delegation_hash(delegation);
    
    let request = SignWithEcdsaArgument {
        message_hash: message_hash.to_vec(),
        derivation_path: vec![b"oauth_delegation".to_vec()],
        key_id: EcdsaKeyId {
            curve: EcdsaCurve::Secp256k1,
            name: "key_1".to_string(), // or "dfx_test_key" for local
        },
    };
    
    let (response,) = sign_with_ecdsa(request)
        .await
        .map_err(|e| format!("ECDSA signing failed: {:?}", e))?;
    
    Ok(response.signature)
}
```

### Option 2: Canister Signatures (How Internet Identity Works)

Use IC's certified variables for canister signatures:

```rust
use ic_cdk::api::{set_certified_data, data_certificate};

// Store delegation hash in certified data
fn certify_delegation(delegation: &Delegation) {
    let hash = create_delegation_hash(delegation);
    set_certified_data(&hash);
}

// Return certificate as "signature"
fn get_delegation_certificate() -> Vec<u8> {
    data_certificate().unwrap_or_default()
}
```

### Option 3: Use Email/Sub as Primary Key (Simple Workaround)

Since the OAuth JWT contains stable identifiers, use them directly:

```rust
// Backend already stores user_id (Google 'sub') in SessionData
// Use this as the primary key for user data instead of principal
```

## Testing the Fix

1. Run `make deploy-all`
2. Login with Google
3. Check browser console logs:
   ```
   🔑 [OAuth] Session key principal: xxxxx-xxxxx-xxxxx  // Random each time
   🔑 [OAuth] Delegation identity principal: yyyyy-yyyyy-yyyyy  // SAME for same user!
   🔑 [OAuth] User canister pubkey (hex): abc123...  // Deterministic hash
   ```
4. Logout and login again with same Google account
5. Verify `Delegation identity principal` is the same

## Files Changed

- `src/frontend/utils/oauthDelegation.ts` - Fixed to use `DelegationIdentity` with proper delegation chain

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| `identity.getPrincipal()` | Random (from session key) | Deterministic (from user_canister_pubkey) |
| Same user, multiple logins | Different principals | **Same principal** |
| IC signature verification | N/A | Still needs t-ECDSA for production |

The frontend fix is applied. The backend signing still needs to be upgraded to t-ECDSA for production use.
