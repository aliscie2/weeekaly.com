import { HttpAgent, Actor, ActorSubclass } from "@dfinity/agent";
import { Identity } from "@dfinity/agent";
import { idlFactory } from "../../declarations/backend/backend.did.js";
import type { _SERVICE } from "../../declarations/backend/backend.did.d.ts";
import { createBackendCaster } from "./backendCaster";

const canisterId =
  process.env.CANISTER_ID_BACKEND || "bkyz2-fmaaa-aaaaa-qaaaq-cai";

// Create initial anonymous agent
let agent = HttpAgent.createSync({
  host:
    process.env.DFX_NETWORK === "ic"
      ? "https://icp-api.io"
      : "http://localhost:4943",
});

// Fetch root key for local development
if (process.env.DFX_NETWORK !== "ic") {
  agent.fetchRootKey().catch((err) => {
    console.warn(
      "Unable to fetch root key. Check to ensure that your local replica is running",
    );
    console.error(err);
  });
}

// Create initial actor with anonymous identity and apply backendCaster
let rawActor = Actor.createActor(idlFactory, {
  agent,
  canisterId,
});

// Use a mutable object to hold the actor so references stay valid
const actorHolder = {
  actor: createBackendCaster(rawActor) as ActorSubclass<_SERVICE>,
};

// Export a Proxy that always uses the current actor
export const backendActor = new Proxy({} as ActorSubclass<_SERVICE>, {
  get(_target, prop) {
    return (actorHolder.actor as any)[prop];
  },
});

/**
 * Update the backend actor with an authenticated identity
 *
 * Creates a new HttpAgent with the provided identity and recreates
 * the backend actor. This should be called after successful authentication
 * to enable authenticated canister calls.
 *
 * @param identity - The authenticated Identity to use for canister calls
 * @returns Promise that resolves when the actor is ready
 */
export async function setAuthenticatedActor(identity: Identity): Promise<void> {
  console.log("🔧 [actor] setAuthenticatedActor called");
  console.log(
    "🔑 [actor] Identity principal:",
    identity.getPrincipal().toText(),
  );

  // Create new agent with authenticated identity
  agent = HttpAgent.createSync({
    host:
      process.env.DFX_NETWORK === "ic"
        ? "https://icp-api.io"
        : "http://localhost:4943",
    identity,
  });

  // Fetch root key for local development - MUST WAIT for this to complete
  if (process.env.DFX_NETWORK !== "ic") {
    try {
      await agent.fetchRootKey();
      console.log("✅ [actor] Root key fetched successfully");
    } catch (err) {
      console.warn(
        "⚠️ [actor] Unable to fetch root key. Check to ensure that your local replica is running",
      );
      console.error(err);
    }
  }

  // Create new actor with authenticated agent and apply backendCaster
  rawActor = Actor.createActor(idlFactory, {
    agent,
    canisterId,
  });

  // Update the actor in the holder (this updates all references via the Proxy)
  actorHolder.actor = createBackendCaster(rawActor) as ActorSubclass<_SERVICE>;

  console.log("✅ [actor] Backend actor updated with authenticated identity");
}
