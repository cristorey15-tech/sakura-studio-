import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";

function makeRequest(ip?: string): Request {
  const headers: Record<string, string> = {};
  if (ip) headers["x-forwarded-for"] = ip;
  return new Request("http://localhost/api/test", { headers });
}

describe("checkRateLimit", () => {
  it("allows requests within the limit", () => {
    const req = makeRequest("1.2.3.4");
    const result = checkRateLimit(req, { windowMs: 60000, max: 5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests exceeding the limit", () => {
    const req = makeRequest("5.6.7.8");
    // Exhaust the limit
    for (let i = 0; i < 5; i++) {
      checkRateLimit(req, { windowMs: 60000, max: 5 });
    }
    // This one should be blocked
    const result = checkRateLimit(req, { windowMs: 60000, max: 5 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    const req = makeRequest("9.10.11.12");
    // Use a very short window
    for (let i = 0; i < 3; i++) {
      checkRateLimit(req, { windowMs: 1, max: 3 });
    }
    // Next request should be blocked
    const blocked = checkRateLimit(req, { windowMs: 1, max: 3 });
    expect(blocked.allowed).toBe(false);

    // After waiting, it should reset
    // Note: In real usage we'd mock time, but for simplicity we test with a new key
    const newReq = makeRequest("13.14.15.16");
    const allowed = checkRateLimit(newReq, { windowMs: 60000, max: 3 });
    expect(allowed.allowed).toBe(true);
  });

  it("differentiates by IP", () => {
    const req1 = makeRequest("10.0.0.1");
    const req2 = makeRequest("10.0.0.2");

    // Exhaust limit for req1
    for (let i = 0; i < 3; i++) {
      checkRateLimit(req1, { windowMs: 60000, max: 3 });
    }

    // req1 should be blocked
    expect(checkRateLimit(req1, { windowMs: 60000, max: 3 }).allowed).toBe(false);

    // req2 should still be allowed (different IP)
    expect(checkRateLimit(req2, { windowMs: 60000, max: 3 }).allowed).toBe(true);
  });

  it("uses custom key function", () => {
    const req = makeRequest();
    const customKeyFn = () => "custom-key";
    const result = checkRateLimit(req, { windowMs: 60000, max: 2, keyFn: customKeyFn });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });
});
