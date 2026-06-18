import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (hoisted by vitest) ───
vi.mock("@/lib/prisma", () => ({
  prisma: {
    sale: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    appointment: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    client: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    employee: { count: vi.fn() },
    expense: { create: vi.fn(), count: vi.fn() },
    $transaction: vi.fn((fn: any) => fn({
      sale: { create: vi.fn().mockResolvedValue({ id: 1, total: 50, totalBs: null, date: new Date(), paymentMethod: "EFECTIVO", notes: null, clientId: null, exchangeRate: null }),
        create: vi.fn().mockResolvedValue({ id: 1, total: 50, totalBs: null, date: new Date(), paymentMethod: "EFECTIVO", notes: null, clientId: null, exchangeRate: null }),
      },
      appointment: { create: vi.fn(), update: vi.fn() },
      $executeRaw: vi.fn().mockResolvedValue(1),
    })),
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/lib/jwt", () => ({ getUserFromCookie: vi.fn() }));
vi.mock("@/lib/withCsrf", () => ({
  withCsrf: (fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock("@/lib/requireRole", () => ({
  requireRole: vi.fn(async (_req: unknown, roles?: string[]) => ({
    user: { id: 1, name: "Admin", role: "ADMIN" },
    error: null,
  })),
  requireWriteAdmin: vi.fn(async () => ({
    user: { id: 1, name: "Admin", role: "ADMIN" },
    error: null,
  })),
}));
vi.mock("@/lib/auditLog", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 10 })),
}));
vi.mock("@/lib/csrf", () => ({
  deriveCsrfToken: vi.fn(() => "mock-csrf"),
}));

import { getUserFromCookie } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

// ─── Helper ───
function makeRequest(url: string, method = "GET", body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }) as any;
}

// ═══════════════════════════════════════════
// POST /api/ventas — Venta con cliente
// ═══════════════════════════════════════════
describe("POST /api/ventas — Business Logic", () => {
  beforeEach(() => {
    vi.mocked(getUserFromCookie).mockResolvedValue({
      id: 1,
      name: "Admin",
      role: "ADMIN",
    } as any);
  });

  it("creates sale with items and returns 201", async () => {
    const mockSale = {
      id: 42,
      total: 75,
      totalBs: null,
      exchangeRate: null,
      paymentMethod: "EFECTIVO",
      notes: null,
      clientId: 5,
      date: new Date(),
      client: { id: 5, name: "María" },
      items: [{ id: 1, quantity: 1, price: 75, serviceId: 10, productId: null }],
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      const tx = {
        sale: { create: vi.fn().mockResolvedValue(mockSale) },
        appointment: { create: vi.fn(), update: vi.fn() },
        $executeRaw: vi.fn(),
      };
      return fn(tx);
    });

    const { POST } = await import("@/app/api/ventas/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/ventas", "POST", {
        total: 75,
        clientId: 5,
        employeeId: 3,
        paymentMethod: "EFECTIVO",
        items: [{ quantity: 1, price: 75, serviceId: 10 }],
      })
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.total).toBe(75);
    expect(data.client.name).toBe("María");
  });

  it("auto-creates appointment when sale has clientId (no appointmentId)", async () => {
    const txAppointmentCreate = vi.fn().mockResolvedValue({ id: 100 });
    const txSaleCreate = vi.fn().mockResolvedValue({
      id: 43,
      total: 50,
      totalBs: null,
      date: new Date(),
    });

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      return fn({
        sale: { create: txSaleCreate },
        appointment: { create: txAppointmentCreate, update: vi.fn() },
        $executeRaw: vi.fn(),
      });
    });

    const { POST } = await import("@/app/api/ventas/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/ventas", "POST", {
        total: 50,
        clientId: 5,
        serviceDate: "2026-06-20",
        paymentMethod: "EFECTIVO",
        items: [{ quantity: 1, price: 50, serviceId: 10 }],
      })
    );
    expect(res.status).toBe(201);
    // Verify appointment was auto-created
    expect(txAppointmentCreate).toHaveBeenCalledTimes(1);
    expect(txAppointmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETADA",
          clientId: 5,
          serviceId: 10,
        })
      })
    );
  });

  it("updates existing appointment when appointmentId is provided", async () => {
    const txAppointmentUpdate = vi.fn().mockResolvedValue({ id: 200 });
    const txSaleCreate = vi.fn().mockResolvedValue({
      id: 44,
      total: 60,
      totalBs: null,
      date: new Date(),
    });

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      return fn({
        sale: { create: txSaleCreate },
        appointment: { create: vi.fn(), update: txAppointmentUpdate },
        $executeRaw: vi.fn(),
      });
    });

    const { POST } = await import("@/app/api/ventas/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/ventas", "POST", {
        total: 60,
        clientId: 5,
        appointmentId: 200,
        employeeId: 3,
        paymentMethod: "TARJETA",
        items: [{ quantity: 1, price: 60, serviceId: 10 }],
      })
    );
    expect(res.status).toBe(201);
    // Should update, not create
    expect(txAppointmentUpdate).toHaveBeenCalledTimes(1);
    expect(txAppointmentUpdate).toHaveBeenCalledWith({
      where: { id: 200 },
      data: { status: "COMPLETADA", employeeId: 3 },
    });
  });

  it("returns 400 when total is missing", async () => {
    const { POST } = await import("@/app/api/ventas/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/ventas", "POST", {
        items: [{ quantity: 1, price: 50, serviceId: 10 }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when items array is empty", async () => {
    const { POST } = await import("@/app/api/ventas/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/ventas", "POST", {
        total: 50,
        items: [],
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Datos inválidos");
  });

  it("handles Bolivares payment with exchange rate", async () => {
    const txSaleCreate = vi.fn().mockResolvedValue({
      id: 45,
      total: 100,
      totalBs: 365,
      exchangeRate: 3.65,
      date: new Date(),
    });

    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      return fn({
        sale: { create: txSaleCreate },
        appointment: { create: vi.fn(), update: vi.fn() },
        $executeRaw: vi.fn(),
      });
    });

    const { POST } = await import("@/app/api/ventas/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/ventas", "POST", {
        total: 100,
        totalBs: 365,
        exchangeRate: 3.65,
        paymentMethod: "TARJETA",
        items: [{ quantity: 1, price: 100, serviceId: 10 }],
      })
    );
    expect(res.status).toBe(201);
    expect(txSaleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 100,
          totalBs: 365,
          exchangeRate: 3.65,
        })
      })
    );
  });
});

// ═══════════════════════════════════════════
// POST /api/citas — Conflict Detection
// ═══════════════════════════════════════════
describe("POST /api/citas — Conflict Detection", () => {
  beforeEach(() => {
    vi.mocked(getUserFromCookie).mockResolvedValue({
      id: 1,
      name: "Admin",
      role: "ADMIN",
    } as any);
  });

  it("creates appointment when no conflict exists", async () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue({ duration: 60 } as any);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    const mockApt = {
      id: 50,
      date: new Date("2026-06-20T10:00:00"),
      status: "PENDIENTE",
      notes: null,
      clientId: 5,
      serviceId: 10,
      employeeId: 3,
      client: { id: 5, name: "María" },
      service: { id: 10, name: "Maquillaje" },
      employee: { id: 3, name: "Ana" },
    };
    vi.mocked(prisma.appointment.create).mockResolvedValue(mockApt as any);

    const { POST } = await import("@/app/api/citas/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/citas", "POST", {
        date: "2026-06-20T10:00:00",
        clientId: 5,
        serviceId: 10,
        employeeId: 3,
        status: "PENDIENTE",
      })
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.client.name).toBe("María");
    expect(data.service.name).toBe("Maquillaje");
  });

  it("returns 409 when scheduling conflict exists", async () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue({ duration: 60 } as any);
    // Simulate an overlapping appointment found
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 30 }]);
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      id: 30,
      client: { name: "Laura" },
      service: { name: "Cejas" },
    } as any);

    const { POST } = await import("@/app/api/citas/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/citas", "POST", {
        date: "2026-06-20T10:30:00",
        clientId: 5,
        serviceId: 10,
        employeeId: 3,
      })
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("Conflicto de horario");
    expect(data.error).toContain("Laura");
    expect(data.error).toContain("Cejas");
  });

  it("skips conflict check when no employee assigned", async () => {
    vi.mocked(prisma.service.findUnique).mockResolvedValue({ duration: 60 } as any);
    vi.mocked(prisma.$queryRaw).mockReset();
    vi.mocked(prisma.appointment.create).mockResolvedValue({
      id: 51,
      date: new Date(),
      status: "PENDIENTE",
      client: { name: "María" },
      service: { name: "Maquillaje" },
      employee: null,
    } as any);

    const { POST } = await import("@/app/api/citas/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/citas", "POST", {
        date: "2026-06-20T10:00:00",
        clientId: 5,
        serviceId: 10,
        // no employeeId
      })
    );
    expect(res.status).toBe(201);
    // Should not query for conflicts
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/citas/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/citas", "POST", {
        date: "2026-06-20T10:00:00",
        // missing clientId and serviceId
      })
    );
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════
// POST /api/ventas — Validation
// ═══════════════════════════════════════════
describe("POST /api/ventas — Input Validation", () => {
  beforeEach(() => {
    vi.mocked(getUserFromCookie).mockResolvedValue({
      id: 1,
      name: "Admin",
      role: "ADMIN",
    } as any);
  });

  it("rejects sale with total=0", async () => {
    const { POST } = await import("@/app/api/ventas/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/ventas", "POST", {
        total: -10,
        items: [{ quantity: 1, price: 10, serviceId: 1 }],
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Datos inválidos");
  });

  it("rejects sale with no items", async () => {
    const { POST } = await import("@/app/api/ventas/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/ventas", "POST", {
        total: 50,
        items: null,
      })
    );
    expect(res.status).toBe(400);
  });

  it("accepts sale with negative exchangeRate as optional", async () => {
    const txSaleCreate = vi.fn().mockResolvedValue({
      id: 46,
      total: 50,
      totalBs: null,
      date: new Date(),
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      return fn({
        sale: { create: txSaleCreate },
        appointment: { create: vi.fn(), update: vi.fn() },
        $executeRaw: vi.fn(),
      });
    });

    const { POST } = await import("@/app/api/ventas/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/ventas", "POST", {
        total: 50,
        exchangeRate: null,
        items: [{ quantity: 1, price: 50, serviceId: 10 }],
      })
    );
    expect(res.status).toBe(201);
  });
});

// ═══════════════════════════════════════════
// POST /api/expenses — Business Logic
// ═══════════════════════════════════════════
describe("POST /api/expenses — Business Logic", () => {
  beforeEach(() => {
    vi.mocked(getUserFromCookie).mockResolvedValue({
      id: 1,
      name: "Admin",
      role: "ADMIN",
    } as any);
  });

  it("creates expense with all fields", async () => {
    const mockExpense = {
      id: 10,
      concept: "Alquiler mensual",
      amount: 500,
      amountBs: 1825,
      category: "ALQUILER",
      date: new Date("2026-06-01"),
      registeredBy: "Admin",
      notes: "Junio 2026",
    };
    vi.mocked(prisma.expense.create).mockResolvedValue(mockExpense as any);

    const { POST } = await import("@/app/api/expenses/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/expenses", "POST", {
        concept: "Alquiler mensual",
        amount: 500,
        amountBs: 1825,
        category: "ALQUILER",
        date: "2026-06-01",
        registeredBy: "Admin",
        notes: "Junio 2026",
      })
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.concept).toBe("Alquiler mensual");
    expect(data.amount).toBe(500);
    expect(data.category).toBe("ALQUILER");
  });

  it("returns 400 when concept is missing", async () => {
    const { POST } = await import("@/app/api/expenses/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/expenses", "POST", {
        amount: 100,
        category: "OTRO",
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("obligatorios");
  });

  it("returns 400 when amount is missing", async () => {
    const { POST } = await import("@/app/api/expenses/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/expenses", "POST", {
        concept: "Servicios",
        category: "SERVICIOS",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when category is missing", async () => {
    const { POST } = await import("@/app/api/expenses/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/expenses", "POST", {
        concept: "Servicios",
        amount: 50,
      })
    );
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════
// Validation helpers
// ═══════════════════════════════════════════
describe("Input Validation Helpers", () => {
  it("validates required fields correctly", async () => {
    const { required, isNumber, isString, validate } = await import("@/lib/validate");

    // All present
    const result1 = validate(
      required({ name: "Test", price: 50 }, ["name", "price"])
    );
    expect(result1.valid).toBe(true);

    // Missing name
    const result2 = validate(
      required({ price: 50 }, ["name", "price"])
    );
    expect(result2.valid).toBe(false);
    expect(result2.errors).toHaveLength(1);
    expect(result2.errors[0].field).toBe("name");

    // Empty string
    const result3 = validate(
      required({ name: "" }, ["name"])
    );
    expect(result3.valid).toBe(false);
  });

  it("validates number ranges", async () => {
    const { isNumber } = await import("@/lib/validate");

    // Valid
    const r1 = isNumber({ price: 50 }, "price", { min: 0, max: 100 });
    expect(r1).toHaveLength(0);

    // Below min
    const r2 = isNumber({ price: -5 }, "price", { min: 0 });
    expect(r2.length).toBeGreaterThan(0);
    expect(r2[0].message).toContain("al menos");

    // Not a number
    const r3 = isNumber({ price: "abc" }, "price");
    expect(r3.length).toBeGreaterThan(0);
    expect(r3[0].message).toContain("número");
  });

  it("validates string lengths", async () => {
    const { isString } = await import("@/lib/validate");

    // Valid
    const r1 = isString({ name: "María" }, "name", { maxLength: 50 });
    expect(r1).toHaveLength(0);

    // Too long
    const r2 = isString({ name: "A".repeat(101) }, "name", { maxLength: 100 });
    expect(r2.length).toBeGreaterThan(0);

    // Not a string
    const r3 = isString({ name: 123 }, "name");
    expect(r3.length).toBeGreaterThan(0);
  });

  it("validates email format", async () => {
    const { isEmail } = await import("@/lib/validate");

    expect(isEmail({ email: "test@example.com" }, "email")).toHaveLength(0);
    expect(isEmail({ email: "invalid" }, "email").length).toBeGreaterThan(0);
    expect(isEmail({ email: "" }, "email")).toHaveLength(0); // optional
  });

  it("validates oneOf allowed values", async () => {
    const { oneOf } = await import("@/lib/validate");

    const r1 = oneOf({ status: "PENDIENTE" }, "status", ["PENDIENTE", "CONFIRMADA", "COMPLETADA"]);
    expect(r1).toHaveLength(0);

    const r2 = oneOf({ status: "INVALIDO" }, "status", ["PENDIENTE", "CONFIRMADA"]);
    expect(r2.length).toBeGreaterThan(0);
    expect(r2[0].message).toContain("debe ser uno de");
  });
});

// ═══════════════════════════════════════════
// Appointment Status Transitions
// ═══════════════════════════════════════════
describe("Appointment Status Transitions", () => {
  beforeEach(() => {
    vi.mocked(getUserFromCookie).mockResolvedValue({
      id: 1,
      name: "Admin",
      role: "ADMIN",
    } as any);
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.client.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.client.update).mockResolvedValue(null as any);
  });

  it("PUT /api/citas/[id] can update status to COMPLETADA", async () => {
    vi.mocked(prisma.appointment.update).mockResolvedValue({
      id: 10,
      status: "COMPLETADA",
      client: { id: 1, name: "María", visitCount: 4 },
      service: { id: 10, name: "Maquillaje" },
      employee: null,
    } as any);

    const { PUT } = await import("@/app/api/citas/[id]/route");
    const res = await PUT(
      makeRequest("http://localhost:3000/api/citas/10", "PUT", {
        status: "COMPLETADA",
      }),
      { params: Promise.resolve({ id: "10" }) }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("COMPLETADA");
  });

  it("PUT /api/citas/[id] increments visitCount when completing appointment", async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      id: 10,
      clientId: 5,
      status: "PENDIENTE",
    } as any);
    vi.mocked(prisma.client.findUnique).mockResolvedValue({
      id: 5,
      visitCount: 9,
    } as any);
    vi.mocked(prisma.client.update).mockResolvedValue({} as any);
    vi.mocked(prisma.appointment.update).mockResolvedValue({
      id: 10,
      status: "COMPLETADA",
      client: { id: 5, name: "María", visitCount: 10 },
      service: { id: 10, name: "Maquillaje" },
      employee: null,
    } as any);

    const { PUT } = await import("@/app/api/citas/[id]/route");
    const res = await PUT(
      makeRequest("http://localhost:3000/api/citas/10", "PUT", {
        status: "COMPLETADA",
      }),
      { params: Promise.resolve({ id: "10" }) }
    );
    expect(res.status).toBe(200);
    // 10 visits = divisible by 5 → freeServiceAvailable
    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { visitCount: 10, freeServiceAvailable: true },
    });
  });
});

// ═══════════════════════════════════════════
// Quick Sale (POS) Validation
// ═══════════════════════════════════════════
describe("POST /api/ventas/quick — Validation", () => {
  beforeEach(() => {
    vi.mocked(getUserFromCookie).mockResolvedValue({
      id: 1,
      name: "Admin",
      role: "ADMIN",
    } as any);
  });

  it("returns 400 when items array is empty", async () => {
    const { POST } = await import("@/app/api/ventas/quick/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/ventas/quick", "POST", {
        items: [],
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("al menos un servicio");
  });

  it("returns 400 when items is null", async () => {
    const { POST } = await import("@/app/api/ventas/quick/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/ventas/quick", "POST", {
        items: null,
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when serviceId not found", async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValue([]);
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);

    const { POST } = await import("@/app/api/ventas/quick/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/ventas/quick", "POST", {
        items: [{ serviceId: 999 }],
      })
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("no encontrados");
  });

  it("creates walk-in client when no clientId provided", async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValue([
      { id: 10, name: "Maquillaje", price: 50, duration: 60, active: true },
    ] as any);
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.client.findFirst).mockResolvedValue({
      id: 1,
      name: "Cliente de Paso",
    } as any);

    const txSaleCreate = vi.fn().mockResolvedValue({
      id: 47,
      total: 50,
      client: { name: "Cliente de Paso" },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
      return fn({
        sale: {
          create: txSaleCreate,
          create: vi.fn().mockResolvedValue({
            id: 47,
            total: 50,
            client: { name: "Cliente de Paso" },
          }),
        },
        appointment: { create: vi.fn(), update: vi.fn() },
        $executeRaw: vi.fn().mockResolvedValue(1),
      });
    });

    const { POST } = await import("@/app/api/ventas/quick/route");
    const res = await POST(
      makeRequest("http://localhost:3000/api/ventas/quick", "POST", {
        items: [{ serviceId: 10 }],
      })
    );
    expect(res.status).toBe(201);
    // Should have looked up walk-in client
    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { name: "Cliente de Paso" },
    });
  });
});
