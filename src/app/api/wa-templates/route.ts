import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";

const DEFAULT_TEMPLATES = [
  { label: "Recordatorio", message: "Hola {nombre}, recordatorio de cita para mañana. ¡Te esperamos! 🌟" },
  { label: "Gracias", message: "Gracias por tu visita a Sakura Studio! 🌟 Fue un placer atenderte." },
  { label: "Promoción", message: "Hola {nombre}, tenemos promociones especiales esta semana. ¡Pregunta por los descuentos! 🎉" },
  { label: "Reagendar", message: "Hola {nombre}, ¿te gustaría reagendar tu cita? Estamos disponibles. Escríbeme y te ayudo. 😊" },
  { label: "Saludo", message: "Hola {nombre}, ¿cómo estás? Queríamos saber si todo ha estado bien. ¡Un saludo! 👋" },
];

async function ensureDefaults() {
  const count = await prisma.wATemplate.count();
  if (count === 0) {
    await prisma.wATemplate.createMany({ data: DEFAULT_TEMPLATES });
  }
}

export async function GET() {
  try {
    await ensureDefaults();
    const templates = await prisma.wATemplate.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json(templates);
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener plantillas" }, { status: 500 });
  }
}

export const POST = withCsrf(async (request: Request) => {
  try {
    const data = await request.json();
    const template = await prisma.wATemplate.create({
      data: { label: data.label, message: data.message },
    });
    const user = await getUserFromCookie(request);
    createAuditLog({
      action: "CREATE",
      entity: "WATemplate",
      entityId: template.id,
      description: `Plantilla WA "${template.label}" creada`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Error al crear plantilla" }, { status: 500 });
  }
});

export const PUT = withCsrf(async (request: Request) => {
  try {
    const data = await request.json();
    const { id, label, message } = data;
    const template = await prisma.wATemplate.update({
      where: { id },
      data: { label, message },
    });
    const user = await getUserFromCookie(request);
    createAuditLog({
      action: "UPDATE",
      entity: "WATemplate",
      entityId: template.id,
      description: `Plantilla WA "${template.label}" actualizada`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json(template);
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar plantilla" }, { status: 500 });
  }
});

export const DELETE = withCsrf(async (request: Request) => {
  try {
    const { id, resetAll } = await request.json();
    const user = await getUserFromCookie(request);

    if (resetAll) {
      await prisma.$transaction([
        prisma.wATemplate.deleteMany(),
        prisma.wATemplate.createMany({ data: DEFAULT_TEMPLATES }),
      ]);
      createAuditLog({
        action: "DELETE",
        entity: "WATemplate",
        description: "Todas las plantillas WA restablecidas a valores por defecto",
        userId: user?.id,
        userName: user?.name,
      });
      return NextResponse.json({ success: true, reset: true });
    }

    const template = await prisma.wATemplate.findUnique({ where: { id } });
    await prisma.wATemplate.delete({ where: { id } });
    createAuditLog({
      action: "DELETE",
      entity: "WATemplate",
      entityId: id,
      description: `Plantilla WA "${template?.label || id}" eliminada`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar plantilla" }, { status: 500 });
  }
});
