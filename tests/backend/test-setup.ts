import { PocketIc, PocketIcServer, Actor, createIdentity } from "@dfinity/pic";
import { _SERVICE } from "$/declarations/backend/backend.did";
import { resolve } from "path";
import { readFileSync } from "fs";
import { beforeAll, afterAll } from "vitest";

// Declare global test utilities
declare global {
  var testPic: PocketIc;
  var testActor: Actor<_SERVICE>;
  var backendCanisterId: string;
  var oneHourLater: () => Promise<Date>;
  var timeLater: (milliseconds: number) => Promise<Date>;
  var __picServer: PocketIcServer;
  var __setupComplete: boolean;
}

// Setup runs once for all tests (using singleFork pool)
beforeAll(async () => {
  // Skip if already setup
  if (globalThis.__setupComplete) {
    console.log("♻️  Reusing existing test environment");
    return;
  }

  console.log("🚀 Setting up test environment...");

  // Start PocketIC server
  const picServer = await PocketIcServer.start({
    showCanisterLogs: true,
    showRuntimeLogs: false,
  });

  const testPic = await PocketIc.create(picServer.getUrl());
  await testPic.resetTime();

  // Load backend WASM
  const backendWasmPath = resolve(__dirname, "./backend.wasm.gz");
  const backendWasm = readFileSync(backendWasmPath);

  // Create test identity
  const testIdentity = createIdentity("test-user");

  // Deploy backend canister
  const backendDidPath = resolve(
    __dirname,
    "../../src/declarations/backend/backend.did.js",
  );
  const { idlFactory } = require(backendDidPath);

  const fixture = await testPic.setupCanister<_SERVICE>({
    idlFactory,
    wasm: backendWasm.buffer as ArrayBufferLike,
    sender: testIdentity.getPrincipal(),
  });

  // Store in global
  globalThis.testPic = testPic;
  globalThis.testActor = fixture.actor;
  globalThis.backendCanisterId = fixture.canisterId.toString();
  globalThis.__picServer = picServer;
  globalThis.__setupComplete = true;

  // Time manipulation helpers
  globalThis.oneHourLater = async () => {
    const currentTime = await globalThis.testPic.getTime();
    const newTime = new Date(currentTime + 60 * 60 * 1000);
    await globalThis.testPic.setTime(newTime.getTime());
    return newTime;
  };

  globalThis.timeLater = async (milliseconds: number) => {
    const currentTime = await globalThis.testPic.getTime();
    const newTime = new Date(currentTime + milliseconds);
    await globalThis.testPic.setTime(newTime.getTime());
    return newTime;
  };

  console.log("✅ Test environment ready");
}, 120000);

// Cleanup after all tests
afterAll(async () => {
  if (globalThis.__setupComplete) {
    console.log("🧹 Cleaning up test environment...");

    if (globalThis.testPic) {
      await globalThis.testPic.tearDown();
    }

    if (globalThis.__picServer) {
      await globalThis.__picServer.stop();
    }

    console.log("✅ Cleanup complete");
  }
});
