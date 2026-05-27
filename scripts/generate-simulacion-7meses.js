/**
 * Generador de datos simulados — 7 Meses (Oct 2025 → May 2026)
 * Crea un archivo Excel con datos históricos simulados para Sakura Studio.
 * Uso: DATABASE_URL="<neon-url>" node scripts/generate-simulacion-7meses.js
 *
 * Empleadas reales desde la BD:
 *   • Stefany → Maquillajes, Cejas, Pestañas
 *   • Carol   → Manicure
 *   • Andreina → Manicure
 */
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ============================================================
// 1. SERVICIOS (coinciden con los de la app)
// ============================================================
const servicios = [
  { id: 1,  name: "Maquillaje Social",       category: "MAQUILLAJE", price: 35, duration: 60,  commissionPercent: 30 },
  { id: 2,  name: "Maquillaje Novia",        category: "MAQUILLAJE", price: 80, duration: 120, commissionPercent: 35 },
  { id: 3,  name: "Maquillaje Ojos",         category: "MAQUILLAJE", price: 20, duration: 30,  commissionPercent: 25 },
  { id: 4,  name: "Depilación de Cejas",     category: "CEJAS",      price: 12, duration: 15,  commissionPercent: 40 },
  { id: 5,  name: "Laminado de Cejas",       category: "CEJAS",      price: 30, duration: 30,  commissionPercent: 35 },
  { id: 6,  name: "Tinte de Cejas",          category: "CEJAS",      price: 15, duration: 20,  commissionPercent: 30 },
  { id: 7,  name: "Extensiones Pestañas",    category: "PESTAÑAS",   price: 55, duration: 90,  commissionPercent: 40 },
  { id: 8,  name: "Lift de Pestañas",        category: "PESTAÑAS",   price: 40, duration: 45,  commissionPercent: 35 },
  { id: 9,  name: "Relleno Pestañas",        category: "PESTAÑAS",   price: 30, duration: 60,  commissionPercent: 35 },
  { id: 10, name: "Manicure Clásico",        category: "MANICURE",   price: 22, duration: 45,  commissionPercent: 30 },
  { id: 11, name: "Manicure Gel",            category: "MANICURE",   price: 35, duration: 60,  commissionPercent: 30 },
  { id: 12, name: "Pedicure Clásico",        category: "MANICURE",   price: 28, duration: 50,  commissionPercent: 30 },
];

// ============================================================
// 2. CLIENTES
// ============================================================
const nombresClientes = [
  "Cliente de Paso", "María López", "Carmen Rodríguez", "Laura García",
  "Sofía Martínez", "Ana Hernández", "Valentina Torres", "Isabel Ramírez",
  "Gabriela Flores", "Fernanda Díaz", "Paula Castro", "Daniela Vargas",
  "Andrea Mendoza", "Carolina Ortiz", "Ximena Ríos", "Alejandra Silva",
  "Renata Morales", "Camila Navarro", "Mariana Guerrero", "Lucía Herrera",
  "Jimena Peña", "Rosa Medina", "Elena Campos", "Patricia Vega",
  "Diana Rivas", "Mónica Paredes", "Verónica Salazar", "Tatiana Cárdenas",
  "Natalia Delgado", "Brenda Suárez",
];
const telefonos = [
  "555-0101","555-0102","555-0103","555-0104","555-0105",
  "555-0106","555-0107","555-0108","555-0109","555-0110",
  "555-0111","555-0112","555-0113","555-0114","555-0115",
  "555-0116","555-0117","555-0118","555-0119","555-0120",
  "555-0121","555-0122","555-0123","555-0124","555-0125",
  "555-0126","555-0127","555-0128","555-0129","555-0130",
];
const clientes = nombresClientes.map((name, i) => ({
  id: i + 1,
  name,
  phone: telefonos[i],
  email: `${name.toLowerCase().replace(/[\s.]+/g, ".")}@email.com`,
  birthDate: new Date(1970 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
  notes: Math.random() > 0.7 ? "Cliente recurrente" : null,
  visitCount: 0,
  freeServiceAvailable: false,
}));
const clienteDePaso = clientes[0];

// ============================================================
// 3. PRODUCTOS
// ============================================================
const productos = [
  { id: 1,  name: "Esmalte Semipermanente",    description: "Esmalte gel 15ml",              quantity: 25, minStock: 5,  price: 12,   category: "MANICURE" },
  { id: 2,  name: "Removedor de Esmalte",      description: "Removedor sin acetona 250ml",   quantity: 10, minStock: 3,  price: 8,    category: "MANICURE" },
  { id: 3,  name: "Aceite para Cutículas",     description: "Aceite hidratante 30ml",        quantity: 15, minStock: 5,  price: 6,    category: "MANICURE" },
  { id: 4,  name: "Pestañas Postizas (pack)",  description: "Pack 10 pares pestañas postizas", quantity: 8, minStock: 3,  price: 15,   category: "PESTAÑAS" },
  { id: 5,  name: "Pegamento para Pestañas",   description: "Pegamento profesional 5ml",     quantity: 12, minStock: 4,  price: 10,   category: "PESTAÑAS" },
  { id: 6,  name: "Kit Lifting Pestañas",      description: "Kit profesional lifting",       quantity: 5,  minStock: 2,  price: 35,   category: "PESTAÑAS" },
  { id: 7,  name: "Pinza para Cejas",          description: "Pinza profesional acero inox", quantity: 20, minStock: 5,  price: 5,    category: "CEJAS" },
  { id: 8,  name: "Tinte para Cejas",          description: "Tinte profesional 30ml",        quantity: 7,  minStock: 2,  price: 9,    category: "CEJAS" },
  { id: 9,  name: "Brocha Base",               description: "Brocha profesional kabuki",     quantity: 10, minStock: 3,  price: 14,   category: "MAQUILLAJE" },
  { id: 10, name: "Esponja Maquillaje",        description: "Esponja beauty blender",        quantity: 30, minStock: 10, price: 4,    category: "MAQUILLAJE" },
  { id: 11, name: "Base Maquillaje",           description: "Base líquida 30ml tono medio",  quantity: 6,  minStock: 2,  price: 20,   category: "MAQUILLAJE" },
  { id: 12, name: "Crema Hidratante Facial",   description: "Crema hidratante 50ml",         quantity: 8,  minStock: 3,  price: 16,   category: "GENERAL" },
];

// ============================================================
// 4. HELPERS
// ============================================================
const startDate = new Date("2025-10-26T00:00:00.000Z");
const endDate   = new Date("2026-05-26T23:59:59.000Z");

function isWorkingDay(date) {
  const day = date.getDay();
  return day >= 1 && day <= 6; // Lunes a Sábado
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min, max, decimals) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals || 2));
}

function randomWeightedPick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Status distribution: ~75% completed, 12% cancelled, 13% other
const statuses      = ["COMPLETADA","COMPLETADA","COMPLETADA","COMPLETADA","COMPLETADA","COMPLETADA","COMPLETADA","COMPLETADA","CANCELADA","CONFIRMADA","PENDIENTE"];
const paymentMethods = ["EFECTIVO","EFECTIVO","EFECTIVO","TARJETA","TRANSFERENCIA","PAGO MOVIL"];

function serializeForExcel(data) {
  return data.map(row => {
    const obj = {};
    for (const [key, val] of Object.entries(row)) {
      if (val instanceof Date) obj[key] = val.toISOString();
      else obj[key] = val;
    }
    return obj;
  });
}

// ============================================================
// 5. EMPLOYEE → SERVICE MAPPING (customizado)
// ============================================================
function buildServiceEmployeeMap(servicios, emps) {
  const stefany  = emps.find(e => e.name.toLowerCase().includes("stefany"));
  const carol    = emps.find(e => e.name.toLowerCase().includes("carol"));
  const andreina = emps.find(e => e.name.toLowerCase().includes("andreina"));

  const map = {};

  for (const svc of servicios) {
    const cat = svc.category;
    const eligible = [];

    // Stefany → MAQUILLAJE, CEJAS, PESTAÑAS
    if ((cat === "MAQUILLAJE" || cat === "CEJAS" || cat === "PESTAÑAS") && stefany) {
      eligible.push(stefany.id);
    }

    // Carol + Andreina → MANICURE
    if (cat === "MANICURE") {
      if (carol)    eligible.push(carol.id);
      if (andreina) eligible.push(andreina.id);
    }

    // Fallback: si no hay nadie asignado, cualquiera disponible
    if (eligible.length === 0) {
      emps.forEach(e => eligible.push(e.id));
    }

    map[svc.id] = [...new Set(eligible)];
  }
  return map;
}

// ============================================================
// 6. GENERAR CITAS Y VENTAS
// ============================================================
let appointmentId = 0;
let saleId = 0;
let saleItemId = 0;

// Factor de actividad por mes (Oct 2025 = 0, Nov = 1, ..., May 2026 = 7)
// Los meses más cercanos tienen más actividad (crecimiento del negocio)
const monthlyActivityFactor = (date) => {
  const month = date.getMonth();
  const year  = date.getFullYear();

  // Mes 0 = Oct 2025 (month 9), Mes 7 = May 2026 (month 4)
  let monthsFromStart;
  if (year === 2025) {
    monthsFromStart = month - 9; // Oct = 0, Nov = 1, Dec = 2
  } else {
    monthsFromStart = month + 3; // Jan = 4, Feb = 5, Mar = 6, Apr = 7, May = 8
  }

  const baseByMonth = [
    2.5, // Oct 2025 — inicio, poco movimiento
    3.0, // Nov 2025
    2.0, // Dec 2025 — diciembre baja un poco
    3.5, // Jan 2026 — sube después de año nuevo
    4.0, // Feb 2026
    4.0, // Mar 2026
    4.5, // Apr 2026
    5.0, // May 2026 — máximo (mes actual)
  ];

  const idx = Math.min(monthsFromStart, baseByMonth.length - 1);
  return baseByMonth[idx] || 3.0;
};

// Horarios disponibles (9am - 5:30pm)
const timeSlots = [];
for (let h = 9; h <= 17; h++) {
  timeSlots.push(`${h.toString().padStart(2, "0")}:00`);
  if (h < 17) timeSlots.push(`${h.toString().padStart(2, "0")}:30`);
}

async function main() {
  // ── Fetch real employees from DB ──
  const dbEmps = await prisma.employee.findMany({
    where: { active: true },
    select: { id: true, name: true, phone: true, email: true, role: true, active: true, startDate: true, notes: true },
  });

  if (dbEmps.length === 0) {
    console.error("❌ No hay empleadas activas en la base de datos.");
    await prisma.$disconnect();
    process.exit(1);
  }

  const empleadas = dbEmps.map(e => ({
    id: e.id,
    name: e.name,
    phone: e.phone || "",
    email: e.email || "",
    role: e.role,
    active: e.active,
    startDate: e.startDate || new Date("2024-01-01"),
    notes: e.notes || "",
  }));

  const serviceEmployeeMap = buildServiceEmployeeMap(servicios, dbEmps);

  console.log(`👥 Empleadas:`);
  empleadas.forEach(e => console.log(`   • ${e.name} (${e.role}) — ID ${e.id}`));
  console.log(`📅 Rango: ${startDate.toISOString().split("T")[0]} → ${endDate.toISOString().split("T")[0]} (${Math.round((endDate - startDate) / (1000*60*60*24))} días)`);

  // ── Generate data ──
  const appointments = [];
  const sales = [];
  const saleItems = [];
  const visitCounts = {};
  clientes.forEach(c => visitCounts[c.id] = 0);

  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    if (isWorkingDay(currentDate)) {
      const baseCount = monthlyActivityFactor(currentDate);
      const dayOfWeek = currentDate.getDay();
      // Sábados (6) más ocupados, Lunes (1) más tranquilos
      const dayFactor = dayOfWeek === 6 ? 1.4 : dayOfWeek === 1 ? 0.6 : 1.0;
      const rand = Math.random() * 0.5 + 0.75; // 0.75 - 1.25
      const count = Math.max(1, Math.round(baseCount * dayFactor * rand));

      const availableSlots = [...timeSlots];

      for (let a = 0; a < count && availableSlots.length > 0; a++) {
        const timeIdx = Math.floor(Math.random() * availableSlots.length);
        const timeSlot = availableSlots.splice(timeIdx, 1)[0];
        const dateStr = currentDate.toISOString().split("T")[0];
        const appointmentDate = new Date(`${dateStr}T${timeSlot}:00.000Z`);

        // Seleccionar servicio — más demanda de manicure y maquillaje social
        const serviceWeights = [8, 2, 5, 6, 3, 4, 3, 3, 4, 7, 8, 5]; // pesos por id
        const service = randomWeightedPick(servicios, serviceWeights);

        const possibleEmployees = serviceEmployeeMap[service.id] || [dbEmps[0].id];
        const employee = randomPick(possibleEmployees);
        const status = randomWeightedPick(statuses, [7, 7, 7, 7, 7, 7, 7, 7, 2, 0.5, 0.5]);

        appointmentId++;
        appointments.push({
          id: appointmentId,
          date: appointmentDate.toISOString(),
          status,
          notes: Math.random() > 0.85 ? "Cliente solicitó hora específica" : "",
          clientId: service.id === 1 ? clienteDePaso.id : randomPick(clientes.filter(c => c.id !== clienteDePaso.id)).id,
          serviceId: service.id,
          employeeId: employee,
        });

        const clientId = appointments[appointments.length - 1].clientId;

        if (status === "COMPLETADA") {
          visitCounts[clientId] = (visitCounts[clientId] || 0) + 1;

          const payment = randomPick(paymentMethods);
          // Tasas de cambio variables según el mes (más realista)
          const monthIdx = currentDate.getMonth();
          const rateBase = monthIdx >= 9 && monthIdx <= 11 ? 58 : 63;
          const exchangeRate = payment === "EFECTIVO" ? (Math.random() > 0.5 ? randomFloat(rateBase, rateBase + 6, 0) : null) : null;

          const servicePrice = service.price;
          const hasProduct = Math.random() > 0.7;
          let extraProduct = null;
          if (hasProduct) extraProduct = randomPick(productos);

          const total = extraProduct ? servicePrice + (extraProduct.price || 0) : servicePrice;
          const totalBs = exchangeRate ? parseFloat((total * exchangeRate).toFixed(0)) : null;

          saleId++;
          sales.push({
            id: saleId,
            date: appointmentDate.toISOString(),
            total,
            totalBs,
            exchangeRate,
            paymentMethod: payment,
            notes: Math.random() > 0.9 ? "Cliente habitual" : "",
            clientId,
            employeeId: employee,
          });

          saleItemId++;
          saleItems.push({
            id: saleItemId,
            quantity: 1,
            price: servicePrice,
            saleId,
            serviceId: service.id,
            productId: null,
          });

          if (extraProduct) {
            saleItemId++;
            saleItems.push({
              id: saleItemId,
              quantity: 1,
              price: extraProduct.price || 0,
              saleId,
              serviceId: null,
              productId: extraProduct.id,
            });
          }
        }
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // ── Walk-in sales (ventas directas sin cita) ──
  // Proporcional a la cantidad de meses (unas 5-8 por mes)
  const totalWalkIns = Math.round(7 * 7); // ~49 walk-ins en 7 meses
  for (let w = 0; w < totalWalkIns; w++) {
    const randomDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
    if (!isWorkingDay(randomDate)) continue;

    // Walk-ins son principalmente manicure o cejas
    const walkInServices = servicios.filter(s => s.category === "MANICURE" || s.category === "CEJAS" || s.category === "MAQUILLAJE");
    const service = randomPick(walkInServices);
    const possibleEmployees = serviceEmployeeMap[service.id] || [dbEmps[0].id];
    const employee = randomPick(possibleEmployees);
    const client = randomPick(clientes.filter(c => c.id !== clienteDePaso.id));
    const payment = randomPick(paymentMethods);

    const monthIdx = randomDate.getMonth();
    const rateBase = monthIdx >= 9 && monthIdx <= 11 ? 58 : 63;
    const exchangeRate = payment === "EFECTIVO" ? (Math.random() > 0.5 ? randomFloat(rateBase, rateBase + 6, 0) : null) : null;

    const total = service.price;
    const totalBs = exchangeRate ? parseFloat((total * exchangeRate).toFixed(0)) : null;

    saleId++;
    sales.push({
      id: saleId,
      date: randomDate.toISOString(),
      total,
      totalBs,
      exchangeRate,
      paymentMethod: payment,
      notes: "Venta directa sin cita",
      clientId: client.id,
      employeeId: employee,
    });

    saleItemId++;
    saleItems.push({
      id: saleItemId,
      quantity: 1,
      price: service.price,
      saleId,
      serviceId: service.id,
      productId: null,
    });
  }

  // Update visit counts
  clientes.forEach(c => {
    c.visitCount = visitCounts[c.id] || 0;
    c.freeServiceAvailable = c.visitCount >= 5 && c.visitCount % 5 === 0;
  });

  // ── Agrupar ventas por empleada para mostrar estadísticas ──
  const salesByEmployee = {};
  for (const sale of sales) {
    const empId = sale.employeeId;
    if (!salesByEmployee[empId]) salesByEmployee[empId] = { count: 0, total: 0 };
    salesByEmployee[empId].count++;
    salesByEmployee[empId].total += sale.total;
  }

  // ── Create workbook ──
  const wb = XLSX.utils.book_new();

  const addSheet = (name, data) => {
    const serialized = serializeForExcel(data);
    const ws = XLSX.utils.json_to_sheet(serialized);
    if (data.length > 0) {
      ws["!cols"] = Object.keys(data[0]).map(key => ({
        wch: Math.min(Math.max(key.length, 12), 30),
      }));
    }
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  addSheet("Servicios", servicios);
  addSheet("Clientes", clientes);
  addSheet("Empleadas", empleadas);
  addSheet("Productos", productos);
  addSheet("Citas", appointments);
  addSheet("Ventas", sales);
  addSheet("SaleItems", saleItems);

  // ── Save ──
  const outputPath = path.join(__dirname, "..", "sakura-simulacion-oct2025-may2026.xlsx");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(outputPath, buf);

  console.log("=".repeat(60));
  console.log("✅ ¡Simulación de 7 meses generada exitosamente!");
  console.log("=".repeat(60));
  console.log(`📁 Ruta: ${outputPath}`);
  console.log(`📊 Datos generados:`);
  console.log(`   • Servicios:   ${servicios.length}`);
  console.log(`   • Clientes:    ${clientes.length}`);
  console.log(`   • Empleadas:   ${empleadas.length} (desde BD real)`);
  console.log(`   • Productos:   ${productos.length}`);
  console.log(`   • Citas:       ${appointments.length}`);
  console.log(`   • Ventas:      ${sales.length}`);
  console.log(`   • SaleItems:   ${saleItems.length}`);
  console.log(`📅 Rango: ${startDate.toISOString().split("T")[0]} → ${endDate.toISOString().split("T")[0]}`);

  // Estadísticas por empleada
  console.log(`\n📊 Ventas por empleada:`);
  for (const emp of empleadas) {
    const stats = salesByEmployee[emp.id];
    if (stats) {
      console.log(`   • ${emp.name}: ${stats.count} ventas = $${stats.total.toFixed(2)} USD`);
    }
  }

  // Totales
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalAppts = appointments.length;
  const completedAppts = appointments.filter(a => a.status === "COMPLETADA").length;
  console.log(`\n💰 Ingresos totales: $${totalRevenue.toFixed(2)} USD`);
  console.log(`📅 Citas totales: ${totalAppts} (${completedAppts} completadas)`);
  console.log(`📈 Promedio diario: ~${(totalAppts / 210).toFixed(1)} citas/día`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("❌ Error:", err);
  prisma.$disconnect();
  process.exit(1);
});
