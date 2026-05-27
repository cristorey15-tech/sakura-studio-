import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check if there are employees
  const employees = await prisma.employee.findMany({ take: 5 });
  console.log(`Employees found: ${employees.length}`);

  if (employees.length === 0) {
    console.log("No hay empleadas. Creando una de prueba...");
    const emp = await prisma.employee.create({
      data: {
        name: "María García",
        phone: "555-1234",
        role: "EMPLEADA",
        active: true,
      },
    });
    employees.push(emp);
    console.log(`Empleada creada: ${emp.name} (ID: ${emp.id})`);
  }

  // Delete existing attendance records
  const deleted = await prisma.attendance.deleteMany({});
  console.log(`Registros de asistencia eliminados: ${deleted.count}`);

  // Create sample attendance records for the last 7 days with different times
  const records = [];
  const now = new Date();

  for (let day = 6; day >= 0; day--) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);

    // Create 2-3 check-ins per day at different hours
    const hours = [8, 9, 10, 11, 14, 15];
    const count = 2 + Math.floor(Math.random() * 2); // 2-3 records per day

    for (let i = 0; i < count && i < hours.length; i++) {
      const h = hours[i % hours.length];
      const m = Math.floor(Math.random() * 60);
      const checkInDate = new Date(date);
      checkInDate.setHours(h, m, Math.floor(Math.random() * 60), 0);

      records.push({
        employeeId: employees[0].id,
        date: checkInDate,
        latitude: 10.486 + (Math.random() - 0.5) * 0.01,
        longitude: -66.852 + (Math.random() - 0.5) * 0.01,
        accuracy: Math.round(10 + Math.random() * 40),
      });
    }
  }

  for (const rec of records) {
    await prisma.attendance.create({ data: rec });
  }

  console.log(`\n✅ Creados ${records.length} registros de asistencia de prueba`);
  console.log("\n📋 Ejemplos de fechas y horas creadas:");
  
  const samples = await prisma.attendance.findMany({
    take: 5,
    orderBy: { date: "desc" },
    include: { employee: { select: { name: true } } },
  });

  for (const s of samples) {
    console.log(`   ${s.employee.name} - ${s.date.toLocaleDateString("es-MX")} ${s.date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true })}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
