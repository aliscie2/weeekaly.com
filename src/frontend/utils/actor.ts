import { HttpAgent, Actor } from "@dfinity/agent";
import { idlFactory } from "../../declarations/backend/backend.did.js";

const canisterId = process.env.CANISTER_ID_BACKEND || "bkyz2-fmaaa-aaaaa-qaaaq-cai";

const agent = new HttpAgent({
  host: process.env.DFX_NETWORK === "ic" ? "https://icp-api.io" : "http://localhost:4943",
});

// Fetch root key for local development
if (process.env.DFX_NETWORK !== "ic") {
  agent.fetchRootKey().catch((err) => {
    console.warn("Unable to fetch root key. Check to ensure that your local replica is running");
    console.error(err);
  });
}

export const backendActor = Actor.createActor(idlFactory, {
  agent,
  canisterId,
});
