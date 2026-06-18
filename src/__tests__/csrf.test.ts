import { describe, it, expect } from "vitest";
import { deriveCsrfToken } from "@/lib/csrf";

describe("deriveCsrfToken", () => {
  it("returns a 64-character hex string (SHA-256)", () => {
    const token = deriveCsrfToken("test-session-token");
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it("produces deterministic output for the same input", () => {
    const token1 = deriveCsrfToken("session-abc-123");
    const token2 = deriveCsrfToken("session-abc-123");
    expect(token1).toBe(token2);
  });

  it("produces different output for different inputs", () => {
    const token1 = deriveCsrfToken("session-1");
    const token2 = deriveCsrfToken("session-2");
    expect(token1).not.toBe(token2);
  });

  it("handles empty string input", () => {
    const token = deriveCsrfToken("");
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it("handles long session tokens", () => {
    const longToken = "a".repeat(10000);
    const token = deriveCsrfToken(longToken);
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it("handles special characters in session token", () => {
    const specialToken = "abc!@#$%^&*()_+-=[]{}|;':\",./<>?";
    const token = deriveCsrfToken(specialToken);
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it("produces the expected SHA-256 hash for known input", () => {
    // SHA-256 of "hello" is 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    const token = deriveCsrfToken("hello");
    expect(token).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});
