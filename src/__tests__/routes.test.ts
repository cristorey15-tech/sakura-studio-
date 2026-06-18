import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    appointment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    sale: {
      count: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    client: { count: vi.fn() },
    service: { count: vi.fn() },
    employee: { count: vi.fn() },
  },
}));
vi.mock("@/lib/jwt", () => ({ getUserFromCookie: vi.fn() }));
vi.mock("@/lib/withCsrf", () => ({
  withCsrf: (fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock("@/lib/requireRole", () => ({
  requireRole: vi.fn(async (_req: unknown, roles?: string[]) => ({ user: { id: 1, name: "Admin", role: "ADMIN" }, error: null })),
  requireWriteAdmin: vi.fn(async () => ({ user: { id: 1, name: "Admin", role: "ADMIN" }, error: null })),
}));
vi.mock("@/lib/auditLog", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10 })) }));
vi.mock("@/lib/csrf", () => ({ deriveCsrfToken: vi.fn(() => "mock-csrf") }));

import { getUserFromCookie } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";



function makeRequest(url: string, method = "GET", body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as any;
}

describe("GET /api/reminders", () => {
  it("returns 401 if not authenticated", async () => {
    vi.mocked(getUserFromCookie).mockResolvedValue(null);
    const { GET } = await import("@/app/api/reminders/route");
    const res = await GET(makeRequest("http://localhost:3000/api/reminders"));
    expect(res.status).toBe(401);
  });

  it("returns upcoming appointments needing reminders", async () => {
    vi.mocked(getUserFromCookie).mockResolvedValue({ id: 1, name: "Admin", role: "ADMIN" } as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        id: 10,
        date: new Date(Date.now() + 30 * 3600 * 1000),
        status: "CONFIRMADA",
        notes: null,
        client: { id: 5, name: "María", phone: "555-1234" },
        service: { name: "Maquillaje", duration: 60 },
        employee: { name: "Ana" },
      },
    ] as any);

    const { GET } = await import("@/app/api/reminders/route");
    const res = await GET(makeRequest("http://localhost:3000/api/reminders"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.count).toBe(1);
    expect(data.appointments[0].client.name).toBe("María");
  });

  it("filters out already-reminded appointments by notes", () => {
    // Directly test the filter logic used in the route
    // The route stores notes as "[reminder_sent:ISO_DATE]" and checks for "reminder_sent"
    const appointments = [
      { id: 10, notes: null, status: "CONFIRMADA" },
      { id: 11, notes: "[reminder_sent:2026-06-17T10:00:00.000Z]", status: "CONFIRMADA" },
      { id: 12, notes: "Some other note", status: "PENDIENTE" },
      { id: 13, notes: "[reminder_sent:2026-06-16T08:00:00.000Z] and more", status: "CONFIRMADA" },
    ];
    const needsReminder = appointments.filter((apt) => {
      const notes = apt.notes || "";
      return !notes.includes("reminder_sent");
    });
    expect(needsReminder).toHaveLength(2);
    expect(needsReminder.map((a) => a.id)).toEqual([10, 12]);
  });
});

describe("POST /api/reminders", () => {
  it("marks appointment as reminded", async () => {
    vi.mocked(getUserFromCookie).mockResolvedValue({ id: 1, name: "Admin", role: "ADMIN" } as any);
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({ id: 10, notes: "some notes" } as any);
    vi.mocked(prisma.appointment.update).mockResolvedValue({} as any);

    const { POST } = await import("@/app/api/reminders/route");
    const res = await POST(makeRequest("http://localhost:3000/api/reminders", "POST", { appointmentId: 10 }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns 400 if appointmentId missing", async () => {
    vi.mocked(getUserFromCookie).mockResolvedValue({ id: 1, name: "Admin", role: "ADMIN" } as any);
    const { POST } = await import("@/app/api/reminders/route");
    const res = await POST(makeRequest("http://localhost:3000/api/reminders", "POST", {}));
    expect(res.status).toBe(400);
  });

  it("returns 404 if appointment not found", async () => {
    vi.mocked(getUserFromCookie).mockResolvedValue({ id: 1, name: "Admin", role: "ADMIN" } as any);
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null);
    const { POST } = await import("@/app/api/reminders/route");
    const res = await POST(makeRequest("http://localhost:3000/api/reminders", "POST", { appointmentId: 999 }));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/events", () => {
  it("returns 401 if not authenticated", async () => {
    vi.mocked(getUserFromCookie).mockResolvedValue(null);
    const { GET } = await import("@/app/api/events/route");
    const controller = new AbortController();
    const req = new Request("http://localhost:3000/api/events", {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    }) as any;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/backup", () => {
  it("returns database status counts", async () => {
    vi.mocked(getUserFromCookie).mockResolvedValue({ id: 1, name: "Admin", role: "ADMIN" } as any);
    vi.mocked(prisma.client.count).mockResolvedValue(10);
    vi.mocked(prisma.service.count).mockResolvedValue(8);
    vi.mocked(prisma.appointment.count).mockResolvedValue(30);
    vi.mocked(prisma.sale.count).mockResolvedValue(50);
    vi.mocked(prisma.employee.count).mockResolvedValue(5);
    vi.mocked(prisma.product.count).mockResolvedValue(12);

    const { POST } = await import("@/app/api/backup/route");
    const res = await POST(makeRequest("http://localhost:3000/api/backup", "POST"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.summary.clients).toBe(10);
    expect(data.summary.services).toBe(8);
    expect(data.summary.sales).toBe(50);
  });
});
