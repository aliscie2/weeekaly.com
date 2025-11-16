import { describe, test, expect } from "vitest";

describe("Basic Backend Tests", () => {
  test("should have test environment setup", () => {
    expect(globalThis.testPic).toBeDefined();
    expect(globalThis.testActor).toBeDefined();
  });

  test("should call hello_world", async () => {
    const result = await globalThis.testActor.hello_world();
    expect(result).toBe("Hello, World from oDoc backend!");
  });

  test("should check authentication", async () => {
    const result = await globalThis.testActor.is_authenticated();
    expect(typeof result).toBe("boolean");
  });
});
