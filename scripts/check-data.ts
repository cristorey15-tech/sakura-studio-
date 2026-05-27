import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany({ select: { id: true, name: true, role: true } });
  console.log("EMPLOYEES:", JSON.stringify(employees, null, 2));

  const clients = await prisma.client.findMany({ select: { id: true, name: true }, take: 10 });
  console.log("CLIENTS:", JSON.stringify(clients, null, 2));

  const services = await prisma.service.findMany({ select: { id: true, name: true, category: true }, take: 20 });
  console.log("SERVICES:", JSON.stringify(services, null, 2));

  const existingAppts = await prisma.appointment.count({ where: { status: "COMPLETADA" } });
  console.log("COMPLETED APPOINTMENTS:", existingAppts);

  await prisma.$disconnect();
}

main();
