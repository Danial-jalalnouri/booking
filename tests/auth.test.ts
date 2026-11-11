import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth";

describe("session tokens", () => {
  it("round-trips a user id", async () => {
    const token = await createSessionToken("user_123");
    const userId = await verifySessionToken(token);
    expect(userId).toBe("user_123");
  });

  it("rejects tampered tokens", async () => {
    const token = await createSessionToken("user_123");
    const tampered = token.slice(0, -3) + "AAA";
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("rejects garbage tokens", async () => {
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });
});
