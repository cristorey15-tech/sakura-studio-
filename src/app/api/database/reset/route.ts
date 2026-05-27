import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/requireRole";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";

export async function POST(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    // ── Delete all data in dependency order ──
    await prisma.$transaction(async (tx) => {
      await tx.saleItem.deleteMany();
      await tx.sale.deleteMany();
      await tx.appointment.deleteMany();
      await tx.attendance.deleteMany();
      await tx.employeeAvailability.deleteMany();
      await tx.employee.deleteMany();
      await tx.client.deleteMany();
      await tx.service.deleteMany();
      await tx.product.deleteMany();
      await tx.wATemplate.deleteMany();
      await tx.studioSettings.deleteMany();
      await tx.auditLog.deleteMany();
    }, { timeout: 30000 });

    // ── Re-create defaults ──
    // Cliente de Paso
    await prisma.client.create({
      data: { name: "Cliente de Paso" },
    });

    // Admin con contraseña 0000
    const hashedPassword = await bcrypt.hash("0000", 10);
    await prisma.employee.create({
      data: {
        name: "Admin",
        phone: "555-0000",
        email: "admin@sakurastudio.com",
        role: "ADMIN",
        password: hashedPassword,
        notes: "Administrador por defecto. Usuario: Admin · Contraseña: 0000",
        startDate: new Date("2024-01-15"),
      },
    });

    // Plantillas de WhatsApp
    const templates = [
      { label: "Recordatorio", message: "Hola {nombre}, recordatorio de cita para mañana. ¡Te esperamos! 🌟" },
      { label: "Gracias", message: "Gracias por tu visita a Sakura Studio! 🌟 Fue un placer atenderte." },
      { label: "Promoción", message: "Hola {nombre}, tenemos promociones especiales esta semana. ¡Pregunta por los descuentos! 🎉" },
      { label: "Reagendar", message: "Hola {nombre}, ¿te gustaría reagendar tu cita? Estamos disponibles. Escríbeme y te ayudo. 😊" },
      { label: "Saludo", message: "Hola {nombre}, ¿cómo estás? Queríamos saber si todo ha estado bien. ¡Un saludo! 👋" },
    ];
    for (const tpl of templates) {
      await prisma.wATemplate.create({ data: tpl });
    }

    // ── Audit log ──
    const user = await getUserFromCookie(request).catch(() => null);
    createAuditLog({
      action: "DELETE",
      entity: "Database",
      description: "App reseteada a valores de fábrica",
      userId: user?.id,
      userName: user?.name,
    });

    return NextResponse.json({
      success: true,
      message: "App reseteada exitosamente. Solo quedan: Admin, Cliente de Paso y plantillas WA.",
    });
  } catch (error) {
    console.error("Error resetting database:", error);
    return NextResponse.json(
      { error: "Error al resetear la base de datos" },
      { status: 500 }
    );
  }
}
