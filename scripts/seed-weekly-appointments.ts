import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);

  // Delete existing completed appointments from this week to avoid duplicates
  const saturday = new Date(sunday.getTime() + 7 * 86400000);
  await prisma.appointment.deleteMany({
    where: {
      date: { gte: sunday, lt: saturday },
      status: "COMPLETADA",
    },
  });

  // Create appointments for each employee with different services
  const appointments = [
    // Carol (id: 6) - Maquillaje
    { day: 1, serviceId: 1, employeeId: 6, clientId: 2 }, // Mon - Maquillaje Social
    { day: 1, serviceId: 2, employeeId: 6, clientId: 3 }, // Mon - Maquillaje Novia
    { day: 2, serviceId: 1, employeeId: 6, clientId: 4 }, // Tue - Maquillaje Social
    { day: 2, serviceId: 3, employeeId: 6, clientId: 5 }, // Tue - Maquillaje Ojos
    { day: 2, serviceId: 1, employeeId: 6, clientId: 6 }, // Tue - Maquillaje Social
    { day: 3, serviceId: 2, employeeId: 6, clientId: 7 }, // Wed - Maquillaje Novia

    // Andreina (id: 7) - Cejas & Pestañas
    { day: 1, serviceId: 4, employeeId: 7, clientId: 2 }, // Mon - Depilación Cejas
    { day: 1, serviceId: 5, employeeId: 7, clientId: 3 }, // Mon - Laminado Cejas
    { day: 1, serviceId: 7, employeeId: 7, clientId: 8 }, // Mon - Extensiones Pestañas
    { day: 2, serviceId: 4, employeeId: 7, clientId: 4 }, // Tue - Depilación Cejas
    { day: 2, serviceId: 8, employeeId: 7, clientId: 5 }, // Tue - Lift Pestañas
    { day: 2, serviceId: 7, employeeId: 7, clientId: 9 }, // Tue - Extensiones Pestañas
    { day: 3, serviceId: 4, employeeId: 7, clientId: 6 }, // Wed - Depilación Cejas
    { day: 3, serviceId: 6, employeeId: 7, clientId: 7 }, // Wed - Tinte Cejas
    { day: 3, serviceId: 9, employeeId: 7, clientId: 10 }, // Wed - Relleno Pestañas

    // Stefany (id: 5) - Manicure & Maquillaje
    { day: 1, serviceId: 10, employeeId: 5, clientId: 2 }, // Mon - Manicure Clásico
    { day: 2, serviceId: 11, employeeId: 5, clientId: 3 }, // Tue - Manicure Gel
    { day: 2, serviceId: 12, employeeId: 5, clientId: 4 }, // Tue - Pedicure Clásico
    { day: 3, serviceId: 10, employeeId: 5, clientId: 5 }, // Wed - Manicure Clásico
    { day: 3, serviceId: 1, employeeId: 5, clientId: 6 },  // Wed - Maquillaje Social
    { day: 4, serviceId: 11, employeeId: 5, clientId: 7 }, // Thu - Manicure Gel
    { day: 5, serviceId: 10, employeeId: 5, clientId: 8 }, // Fri - Manicure Clásico
  ];

  for (const apt of appointments) {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + apt.day);
    date.setHours(9 + Math.floor(Math.random() * 8), Math.random() > 0.5 ? 0 : 30, 0, 0);

    await prisma.appointment.create({
      data: {
        date,
        status: "COMPLETADA",
        clientId: apt.clientId,
        serviceId: apt.serviceId,
        employeeId: apt.employeeId,
      },
    });
  }

  console.log(`✅ Created ${appointments.length} completed appointments for this week`);
  console.log("   Employees: Stefany (Maquillaje+Manicure), Carol (Maquillaje), Andreina (Cejas+Pestañas)");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
