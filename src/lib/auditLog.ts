import { prisma } from "@/lib/prisma";

type AuditAction = "CREATE" | "UPDATE" | "DELETE";
type AuditEntity =
  | "Service"
  | "Client"
  | "Employee"
  | "Sale"
  | "Appointment"
  | "Product"
  | "StudioSettings"
  | "WATemplate"
  | "Database"
  | "Expense";

interface AuditLogInput {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: number;
  description: string;
  userId?: string | number;
  userName?: string;
}

export async function createAuditLog(input: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        description: input.description,
        userId: input.userId != null ? String(input.userId) : null,
        userName: input.userName ?? null,
      },
    });
  } catch (error) {
    // Silent fail — audit logs should never block the main operation
    console.error("Failed to create audit log:", error);
  }
}

export async function getAuditLogs(params: {
  page?: number;
  limit?: number;
  entity?: string;
  action?: string;
}) {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (params.entity) where.entity = params.entity;
  if (params.action) where.action = params.action;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
