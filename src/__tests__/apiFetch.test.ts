import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch before importing apiFetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock document.cookie for CSRF tests
vi.stubGlobal("document", { cookie: "" });

import { apiFetch } from "@/lib/api";

describe("apiFetch", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    document.cookie = "";
  });

  it("makes a GET request with JSON Content-Type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ name: "test" }),
    });

    const result = await apiFetch<{ name: string }>("/api/test");

    expect(result.data).toEqual({ name: "test" });
    expect(result.error).toBeNull();
    expect(result.status).toBe(200);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBeUndefined(); // defaults to GET
    expect(options.credentials).toBe("include");
    expect(options.headers.get("Content-Type")).toBe("application/json");
  });

  it("adds CSRF token header on POST requests", async () => {
    document.cookie = "csrf-token=abc123def456";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: 1 }),
    });

    await apiFetch("/api/test", { method: "POST", body: JSON.stringify({}) });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.get("X-CSRF-Token")).toBe("abc123def456");
  });

  it("skips CSRF token when noCsrf is true", async () => {
    document.cookie = "csrf-token=abc123";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({}),
    });

    await apiFetch("/api/test", { method: "POST", body: "{}", noCsrf: true });

    const [, options] = mockFetch.mock.calls[0];
    // Should not have CSRF header
    expect(options.headers.get("X-CSRF-Token")).toBeNull();
  });

  it("does not add CSRF on GET requests", async () => {
    document.cookie = "csrf-token=abc123";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({}),
    });

    await apiFetch("/api/test");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.get("X-CSRF-Token")).toBeNull();
  });

  it("returns error for non-OK responses with error field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "Bad request" }),
    });

    const result = await apiFetch("/api/test");

    expect(result.data).toBeNull();
    expect(result.error).toBe("Bad request");
    expect(result.status).toBe(400);
  });

  it("returns generic error for non-OK responses without error field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ message: "Internal error" }),
    });

    const result = await apiFetch("/api/test");

    expect(result.data).toBeNull();
    expect(result.error).toBe("Error 500");
    expect(result.status).toBe(500);
  });

  it("handles network errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Failed to fetch"));

    const result = await apiFetch("/api/test");

    expect(result.data).toBeNull();
    expect(result.error).toBe("Failed to fetch");
    expect(result.status).toBe(0);
  });

  it("handles non-Error thrown values", async () => {
    mockFetch.mockRejectedValueOnce("string error");

    const result = await apiFetch("/api/test");

    expect(result.data).toBeNull();
    expect(result.error).toBe("Error de conexión");
    expect(result.status).toBe(0);
  });

  it("returns null data when response is not JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/plain" }),
      json: async () => "not json",
    });

    const result = await apiFetch("/api/test");

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
    expect(result.status).toBe(200);
  });

  it("sets Content-Type to application/json when body is string", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({}),
    });

    await apiFetch("/api/test", { method: "POST", body: '{"key":"value"}' });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.get("Content-Type")).toBe("application/json");
  });

  it("does not override explicit Content-Type", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({}),
    });

    await apiFetch("/api/test", {
      method: "POST",
      body: "data",
      headers: { "Content-Type": "text/plain" },
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.get("Content-Type")).toBe("text/plain");
  });

  it("adds CSRF on PATCH requests", async () => {
    document.cookie = "csrf-token=patch-token";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({}),
    });

    await apiFetch("/api/test", { method: "PATCH", body: "{}" });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.get("X-CSRF-Token")).toBe("patch-token");
  });

  it("adds CSRF on DELETE requests", async () => {
    document.cookie = "csrf-token=delete-token";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({}),
    });

    await apiFetch("/api/test", { method: "DELETE" });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.get("X-CSRF-Token")).toBe("delete-token");
  });
});
