import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCsrf } from "@/lib/withCsrf";
import { createAuditLog } from "@/lib/auditLog";
import { getUserFromCookie } from "@/lib/jwt";

export async function GET() {
  try {
    let settings = await prisma.studioSettings.findFirst();
    if (!settings) {
      settings = await prisma.studioSettings.create({
        data: {
          name: "Sakura Studio",
          subtitle: "Estudio de Belleza",
          address: "Av. Las Flores #456, Col. Bella Vista",
          phone: "Tel: 555-9876",
          email: "Email: info@sakurastudio.com",
        },
      });
    }
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener configuración" },
      { status: 500 }
    );
  }
}

export const PUT = withCsrf(async (request: Request) => {
  try {
    const data = await request.json();
    const { name, subtitle, address, phone, email, workLatitude, workLongitude, workLocationName, workRadius } = data;

    if (!name || !subtitle || !address || !phone || !email) {
      return NextResponse.json(
        { error: "Todos los campos son obligatorios" },
        { status: 400 }
      );
    }

    let settings = await prisma.studioSettings.findFirst();
    if (!settings) {
      settings = await prisma.studioSettings.create({
        data: {
          name,
          subtitle,
          address,
          phone,
          email,
          workLatitude: workLatitude != null ? parseFloat(workLatitude) : null,
          workLongitude: workLongitude != null ? parseFloat(workLongitude) : null,
          workLocationName: workLocationName || null,
          workRadius: workRadius != null ? parseFloat(workRadius) : 200,
        },
      });
    } else {
      settings = await prisma.studioSettings.update({
        where: { id: settings.id },
        data: {
          name,
          subtitle,
          address,
          phone,
          email,
          workLatitude: workLatitude != null ? parseFloat(workLatitude) : null,
          workLongitude: workLongitude != null ? parseFloat(workLongitude) : null,
          workLocationName: workLocationName || null,
          workRadius: workRadius != null ? parseFloat(workRadius) : 200,
        },
      });
    }
    const user = await getUserFromCookie(request);
    createAuditLog({
      action: "UPDATE",
      entity: "StudioSettings",
      entityId: settings.id,
      description: `Configuración del estudio actualizada: "${settings.name}"`,
      userId: user?.id,
      userName: user?.name,
    });
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    );
  }
});
