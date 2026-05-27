import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ─── Cliente por defecto ───
  const existingClients = await prisma.client.count();
  if (existingClients === 0) {
    await prisma.client.create({
      data: { name: "Cliente de Paso" },
    });
    console.log("✅ Cliente 'Cliente de Paso' creado");
  }

  // ─── Empleada Admin por defecto ───
  const existingEmployees = await prisma.employee.count();
  if (existingEmployees === 0) {
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
    console.log("✅ Admin creado (contraseña: 0000)");
  }

  // ─── Plantillas de WhatsApp por defecto ───
  const existingTemplates = await prisma.wATemplate.count();
  if (existingTemplates === 0) {
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
    console.log("✅ Plantillas de WhatsApp creadas");
  }

  console.log("✅ Seed completado exitosamente");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
