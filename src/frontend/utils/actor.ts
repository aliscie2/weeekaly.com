import { HttpAgent, Actor, ActorSubclass } from "@dfinity/agent";
import { Identity } from "@dfinity/agent";
import { idlFactory } from "../../declarations/backend/backend.did.js";
import type { _SERVICE } from "../../declarations/backend/backend.did.d.ts";

const canisterId = process.env.CANISTER_ID_BACKEND || "bkyz2-fmaaa-aaaaa-qaaaq-cai";

// Create initial anonymous agent
let agent = HttpAgent.createSync({
  host: process.env.DFX_NETWORK === "ic" ? "https://icp-api.io" : "http://localhost:4943",
});

// Fetch root key for local development
if (process.env.DFX_NETWORK !== "ic") {
  agent.fetchRootKey().catch((err) => {
    console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
    console.error(err);
  });
}

// Create initial actor with anonymous identity
export let backendActor: ActorSubclass<_SERVICE> = Actor.createActor(idlFactory, {
  agent,
  canisterId,
});

/**
 * Update the backend actor with an authenticated identity
 * 
 * Creates a new HttpAgent with the provided identity and recreates
 * the backend actor. This should be called after successful authentication
 * to enable authenticated canister calls.
 * 
 * @param identity - The authenticated Identity to use for canister calls
 */
export function setAuthenticatedActor(identity: Identity) {
  // Create new agent with authenticated identity
  agent = HttpAgent.createSync({
    host: process.env.DFX_NETWORK === "ic" ? "https://icp-api.io" : "http://localhost:4943",
    identity,
  });

  // Fetch root key for local development
  if (process.env.DFX_NETWORK !== "ic") {
    agent.fetchRootKey().catch((err) => {
      console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
      console.error(err);
    });
  }

  // Create new actor with authenticated agent
  backendActor = Actor.createActor(idlFactory, {
    agent,
    canisterId,
  });
}
