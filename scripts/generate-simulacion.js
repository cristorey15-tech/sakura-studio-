/**
 * Generador de datos simulados para Sakura Studio
 * Crea un archivo Excel con datos de Enero a Mayo 2026
 * Uso: node scripts/generate-simulacion.js
 *
 * Lee las empleadas reales de la base de datos actual (no las modifica).
 */
const XLSX = require("xlsx");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ============================================================
// 1. SERVICIOS
// ============================================================
const servicios = [
  { id: 1, name: "Maquillaje Social",    description: "Maquillaje social completo",        category: "MAQUILLAJE", price: 35, duration: 60,  commissionPercent: 30, active: true },
  { id: 2, name: "Maquillaje Novia",     description: "Maquillaje para novias",            category: "MAQUILLAJE", price: 80, duration: 120, commissionPercent: 35, active: true },
  { id: 3, name: "Maquillaje Ojos",      description: "Solo maquillaje de ojos",            category: "MAQUILLAJE", price: 20, duration: 30,  commissionPercent: 25, active: true },
  { id: 4, name: "Depilación de Cejas",  description: "Depilación con pinza y diseño",     category: "CEJAS",      price: 12, duration: 15,  commissionPercent: 40, active: true },
  { id: 5, name: "Laminado de Cejas",    description: "Laminado + depilación profesional", category: "CEJAS",      price: 30, duration: 30,  commissionPercent: 35, active: true },
  { id: 6, name: "Tinte de Cejas",       description: "Tinte profesional para cejas",      category: "CEJAS",      price: 15, duration: 20,  commissionPercent: 30, active: true },
  { id: 7, name: "Extensiones Pestañas", description: "Extensiones clásicas volumen natural", category: "PESTAÑAS", price: 55, duration: 90,  commissionPercent: 40, active: true },
  { id: 8, name: "Lift de Pestañas",     description: "Lifting + tinte de pestañas",       category: "PESTAÑAS",  price: 40, duration: 45,  commissionPercent: 35, active: true },
  { id: 9, name: "Relleno Pestañas",     description: "Relleno de extensiones (2 semanas)", category: "PESTAÑAS",  price: 30, duration: 60,  commissionPercent: 35, active: true },
  { id: 10, name: "Manicure Clásico",    description: "Manicure tradicional con esmalte",  category: "MANICURE",  price: 22, duration: 45,  commissionPercent: 30, active: true },
  { id: 11, name: "Manicure Gel",        description: "Manicure con esmalte semipermanente", category: "MANICURE", price: 35, duration: 60,  commissionPercent: 30, active: true },
  { id: 12, name: "Pedicure Clásico",    description: "Pedicure tradicional completo",     category: "MANICURE",  price: 28, duration: 50,  commissionPercent: 30, active: true },
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
];
const telefonos = [
  "555-0101", "555-0102", "555-0103", "555-0104", "555-0105",
  "555-0106", "555-0107", "555-0108", "555-0109", "555-0110",
  "555-0111", "555-0112", "555-0113", "555-0114", "555-0115",
  "555-0116", "555-0117", "555-0118", "555-0119", "555-0120",
  "555-0121", "555-0122", "555-0123", "555-0124",
];

const clientes = nombresClientes.map((name, i) => ({
  id: i + 1,
  name,
  phone: telefonos[i],
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@email.com`,
  birthDate: new Date(1970 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
  notes: Math.random() > 0.7 ? "Cliente recurrente" : null,
  visitCount: 0, // will be updated after generating appointments
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
// 4. WHATSAPP TEMPLATES
// ============================================================
const waTemplates = [
  { id: 1, label: "Recordatorio de Cita",     message: "¡Hola {{nombre}}! Te recordamos tu cita en Sakura Studio el día {{fecha}} a las {{hora}}. Te esperamos 🎀" },
  { id: 2, label: "Confirmación de Cita",     message: "¡Hola {{nombre}}! Confirmamos tu cita de {{servicio}} para el {{fecha}} a las {{hora}}. ¡Gracias por preferirnos! 💄" },
  { id: 3, label: "Post Servicio",            message: "¡Gracias {{nombre}} por visitarnos! Esperamos que hayas disfrutado tu {{servicio}}. Te esperamos pronto en Sakura Studio ✨" },
  { id: 4, label: "Cumpleaños",               message: "¡Feliz cumpleaños {{nombre}}! 🎂🎉 En Sakura Studio queremos consentirte. ¡Ven y recibe un descuento especial del 15% en tu servicio favorito! 💖" },
  { id: 5, label: "Promoción General",        message: "¡Hola {{nombre}}! Este mes tenemos promociones especiales en Sakura Studio. Pregunta por nuestros paquetes y descuentos. ¡Te esperamos! 🌸" },
];

// ============================================================
// 5. STUDIO SETTINGS
// ============================================================
const studioSettings = [
  { id: 1, name: "Sakura Studio", subtitle: "Estudio de Belleza", address: "Av. Las Flores #456, Col. Bella Vista", phone: "555-9876", email: "info@sakurastudio.com" },
];

// ============================================================
// HELPERS
// ============================================================
const startDate = new Date("2026-01-01T00:00:00.000Z");
const endDate = new Date("2026-05-25T23:59:59.000Z");

function isWorkingDay(date) {
  const day = date.getDay();
  return day >= 1 && day <= 6;
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

// Status distribution: 80% completed, 10% cancelled, 10% pending/confirmed
const statuses = ["COMPLETADA", "COMPLETADA", "COMPLETADA", "COMPLETADA", "COMPLETADA", "COMPLETADA", "COMPLETADA", "COMPLETADA", "CANCELADA", "CONFIRMADA", "PENDIENTE"];
const paymentMethods = ["EFECTIVO", "EFECTIVO", "EFECTIVO", "TARJETA", "TRANSFERENCIA", "PAGO MOVIL"];

function buildServiceEmployeeMap(servicios, emps) {
  const admin = emps.find(e => e.role === "ADMIN");
  const esteticistas = emps.filter(e => e.role !== "ADMIN");

  const map = {};
  for (const svc of servicios) {
    const cat = svc.category;
    let eligible = [];

    // Admin can do everything
    if (admin) eligible.push(admin.id);

    // Assign esteticistas to categories by index (rotating)
    if (cat === "MAQUILLAJE") {
      if (esteticistas[0]) eligible.push(esteticistas[0].id);
    } else if (cat === "CEJAS" || cat === "PESTAÑAS") {
      if (esteticistas[1]) eligible.push(esteticistas[1].id);
      else if (esteticistas[0]) eligible.push(esteticistas[0].id);
    } else if (cat === "MANICURE") {
      if (esteticistas[2]) eligible.push(esteticistas[2].id);
      else if (esteticistas[0]) eligible.push(esteticistas[0].id);
    }

    map[svc.id] = [...new Set(eligible)];
  }
  return map;
}

function serializeForExcel(data) {
  return data.map(row => {
    const obj = {};
    for (const [key, val] of Object.entries(row)) {
      if (val instanceof Date) {
        obj[key] = val.toISOString();
      } else {
        obj[key] = val;
      }
    }
    return obj;
  });
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  // ── Fetch real employees from DB ──
  const dbEmps = await prisma.employee.findMany({
    where: { active: true },
    select: { id: true, name: true, phone: true, email: true, role: true, active: true, startDate: true, notes: true },
  });

  if (dbEmps.length === 0) {
    console.error("❌ No hay empleadas activas en la base de datos. Aborta.");
    await prisma.$disconnect();
    process.exit(1);
  }

  // Use the real DB employees in the Excel output (unchanged data)
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

  // Build employee → service map based on real employees
  const serviceEmployeeMap = buildServiceEmployeeMap(servicios, dbEmps);

  console.log(`👥 Empleadas reales cargadas (${empleadas.length}):`);
  empleadas.forEach(e => console.log(`   • ${e.name} (${e.role}) — ID ${e.id}`));

  // ── Generate appointments and sales ──
  const appointments = [];
  const sales = [];
  const saleItems = [];

  const visitCounts = {};
  clientes.forEach(c => visitCounts[c.id] = 0);

  let appointmentId = 0;
  let saleId = 0;
  let saleItemId = 0;

  const dayAppointmentCount = (date) => {
    const month = date.getMonth();
    const dayOfWeek = date.getDay();
    const baseByMonth = [3, 4, 4, 5, 5]; // Jan=3, Feb=4, Mar=4, Apr=5, May=5
    const base = baseByMonth[month] || 3;
    const dayFactor = dayOfWeek === 6 ? 1.5 : dayOfWeek === 1 ? 0.6 : 1.0;
    const rand = Math.random() * 0.4 + 0.8;
    return Math.max(1, Math.round(base * dayFactor * rand));
  };

  const timeSlots = [];
  for (let h = 9; h <= 17; h++) {
    timeSlots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < 17) timeSlots.push(`${h.toString().padStart(2, "0")}:30`);
  }

  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    if (isWorkingDay(currentDate)) {
      const count = dayAppointmentCount(currentDate);
      const availableSlots = [...timeSlots];

      for (let a = 0; a < count && availableSlots.length > 0; a++) {
        const timeIdx = Math.floor(Math.random() * availableSlots.length);
        const timeSlot = availableSlots.splice(timeIdx, 1)[0];
        const dateStr = currentDate.toISOString().split("T")[0];
        const appointmentDate = new Date(`${dateStr}T${timeSlot}:00.000Z`);

        const service = randomPick(servicios);
        const possibleEmployees = serviceEmployeeMap[service.id] || [dbEmps[0].id];
        const employee = randomPick(possibleEmployees);
        const status = randomWeightedPick(statuses, [8, 8, 8, 8, 8, 8, 8, 8, 1, 0.5, 0.5]);

        appointmentId++;
        appointments.push({
          id: appointmentId,
          date: appointmentDate.toISOString(),
          status,
          notes: Math.random() > 0.85 ? "Cliente pidió hora específica" : "",
          clientId: service.id === 1 ? clienteDePaso.id : randomPick(clientes.filter(c => c.id !== clienteDePaso.id)).id,
          serviceId: service.id,
          employeeId: employee,
        });

        const clientId = appointments[appointments.length - 1].clientId;

        if (status === "COMPLETADA") {
          visitCounts[clientId] = (visitCounts[clientId] || 0) + 1;

          const payment = randomPick(paymentMethods);
          const exchangeRate = payment === "EFECTIVO" ? (Math.random() > 0.6 ? randomFloat(60, 65, 0) : null) : null;
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

  // Walk-in sales (without appointments)
  for (let w = 0; w < 30; w++) {
    const randomDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
    if (!isWorkingDay(randomDate)) continue;

    const service = randomPick(servicios.filter(s => s.id <= 6));
    const employee = randomPick(serviceEmployeeMap[service.id] || [dbEmps[0].id]);
    const client = randomPick(clientes);
    const payment = randomPick(paymentMethods);
    const exchangeRate = payment === "EFECTIVO" ? (Math.random() > 0.6 ? randomFloat(60, 65, 0) : null) : null;
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

  // ── Create workbook ──
  const wb = XLSX.utils.book_new();

  const addSheet = (name, data) => {
    const serialized = serializeForExcel(data);
    const ws = XLSX.utils.json_to_sheet(serialized);
    if (data.length > 0) {
      const cols = Object.keys(data[0]).map(key => ({
        wch: Math.min(Math.max(key.length, 12), 30),
      }));
      ws["!cols"] = cols;
    }
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  addSheet("Servicios", servicios);
  addSheet("Clientes", clientes);
  addSheet("Empleadas", empleadas);
  addSheet("Productos", productos);
  addSheet("WATemplates", waTemplates);
  addSheet("StudioSettings", studioSettings);
  addSheet("Citas", appointments);
  addSheet("Ventas", sales);
  addSheet("SaleItems", saleItems);

  // ── Save ──
  const outputPath = path.join(__dirname, "..", "sakura-simulacion-ene-may-2026.xlsx");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  require("fs").writeFileSync(outputPath, buf);

  console.log("=".repeat(60));
  console.log("✅ Archivo generado exitosamente!");
  console.log("=".repeat(60));
  console.log(`📁 Ruta: ${outputPath}`);
  console.log(`📊 Datos generados:`);
  console.log(`   • Servicios:     ${servicios.length}`);
  console.log(`   • Clientes:      ${clientes.length}`);
  console.log(`   • Empleadas:     ${empleadas.length} (desde BD real)`);
  console.log(`   • Productos:     ${productos.length}`);
  console.log(`   • WATemplates:   ${waTemplates.length}`);
  console.log(`   • Citas:         ${appointments.length}`);
  console.log(`   • Ventas:        ${sales.length}`);
  console.log(`   • SaleItems:     ${saleItems.length}`);
  console.log(`   • StudioSettings: ${studioSettings.length}`);
  console.log(`📅 Rango: ${startDate.toISOString().split("T")[0]} → ${endDate.toISOString().split("T")[0]}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("❌ Error:", err);
  prisma.$disconnect();
  process.exit(1);
});
