import { describe, it, expect, vi, beforeEach } from "vitest";
import { withCsrf } from "@/lib/withCsrf";

// Mock NextResponse.json
vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(data), {
        status: init?.status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
  },
}));

function makeRequest(method: string, cookies?: Record<string, string>, csrfHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (csrfHeader) headers["X-CSRF-Token"] = csrfHeader;
  if (cookies) {
    const cookieStr = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    headers["cookie"] = cookieStr;
  }
  return new Request("http://localhost/api/test", { method, headers });
}

describe("withCsrf", () => {
  const mockHandler = vi.fn(async (req: Request) => {
    return new Response("OK", { status: 200 });
  });

  beforeEach(() => {
    mockHandler.mockClear();
  });

  it("allows GET requests without CSRF token", async () => {
    const wrapped = withCsrf(mockHandler);
    const req = makeRequest("GET");
    await wrapped(req);
    expect(mockHandler).toHaveBeenCalled();
  });

  it("allows HEAD requests without CSRF token", async () => {
    const wrapped = withCsrf(mockHandler);
    const req = makeRequest("HEAD");
    await wrapped(req);
    expect(mockHandler).toHaveBeenCalled();
  });

  it("blocks POST requests without CSRF token", async () => {
    const wrapped = withCsrf(mockHandler);
    const req = makeRequest("POST");
    const response = await wrapped(req);
    expect(mockHandler).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error).toContain("CSRF");
    expect(response.status).toBe(403);
  });

  it("blocks PUT requests without CSRF token", async () => {
    const wrapped = withCsrf(mockHandler);
    const req = makeRequest("PUT");
    const response = await wrapped(req);
    expect(mockHandler).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it("blocks DELETE requests without CSRF token", async () => {
    const wrapped = withCsrf(mockHandler);
    const req = makeRequest("DELETE");
    const response = await wrapped(req);
    expect(mockHandler).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it("allows POST with matching CSRF cookie and header", async () => {
    const wrapped = withCsrf(mockHandler);
    const token = "abc123";
    const req = makeRequest("POST", { "csrf-token": token }, token);
    await wrapped(req);
    expect(mockHandler).toHaveBeenCalled();
  });

  it("blocks POST with mismatched CSRF token", async () => {
    const wrapped = withCsrf(mockHandler);
    const req = makeRequest("POST", { "csrf-token": "abc" }, "xyz");
    const response = await wrapped(req);
    expect(mockHandler).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it("blocks POST with header but no cookie", async () => {
    const wrapped = withCsrf(mockHandler);
    const req = makeRequest("POST", undefined, "token");
    const response = await wrapped(req);
    expect(mockHandler).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it("blocks POST with cookie but no header", async () => {
    const wrapped = withCsrf(mockHandler);
    const req = makeRequest("POST", { "csrf-token": "token" });
    const response = await wrapped(req);
    expect(mockHandler).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it("allows skipPaths to bypass CSRF for specific paths", async () => {
    const wrapped = withCsrf(mockHandler, { skipPaths: ["/api/auth/login"] });
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    await wrapped(req);
    expect(mockHandler).toHaveBeenCalled();
  });

  it("still enforces CSRF for non-skipPaths routes", async () => {
    const wrapped = withCsrf(mockHandler, { skipPaths: ["/api/auth/login"] });
    const req = makeRequest("POST", undefined, undefined);
    const response = await wrapped(req);
    expect(mockHandler).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it("passes request arguments to handler", async () => {
    const handler = vi.fn(async (req: Request) => new Response("OK"));
    const wrapped = withCsrf(handler);
    const req = makeRequest("GET");
    await wrapped(req);
    expect(handler).toHaveBeenCalledWith(req);
  });
});
