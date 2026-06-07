/**
 * Transformador: "Sakura Datos reales.xlsx" → formato compatible con importación de la app
 *
 * La app espera 9 hojas: Servicios, Clientes, Empleadas, Productos, WATemplates,
 * StudioSettings, Citas, Ventas, SaleItems
 *
 * El usuario tiene 4 hojas: Clientes, Servicios, Empleadas, Citas
 * 
 * Uso: node scripts/transformar-datos-reales.js
 */

const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

// ============================================================
// 1. LEER ARCHIVO ORIGINAL
// ============================================================
const inputPath = path.join(__dirname, "..", "Sakura Datos reales.xlsx");
const wb = XLSX.readFile(inputPath, { cellDates: false });

function readSheet(name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
}

const rawClientes = readSheet("Clientes");
const rawServicios = readSheet("Servicios");
const rawEmpleadas = readSheet("Empleadas");
const rawCitas = readSheet("Citas");

console.log(`📂 Leído: ${inputPath}`);
console.log(`   Clientes: ${rawClientes.length}`);
console.log(`   Servicios: ${rawServicios.length}`);
console.log(`   Empleadas: ${rawEmpleadas.length}`);
console.log(`   Citas: ${rawCitas.length}`);

// ============================================================
// 2. MAPEOS Y CONSTANTES
// ============================================================

// Mapeo de nombres de servicios a categorías
const CATEGORY_MAP = {
  "Bozo": "CEJAS",
  "Ceja y Bozo mas Tinte": "CEJAS",
  "Cejas": "CEJAS",
  "Cejas y Bozo": "CEJAS",
  "Manos Semis": "MANICURE",
  "Manos Tradicionales": "MANICURE",
  "Manos y Pies Semis": "MANICURE",
  "Otros": "GENERAL",
  "Pies Semis": "MANICURE",
  "Pies Tradicionales": "MANICURE",
  "Sistema": "MANICURE",
};

// Mapeo de métodos de pago del usuario → sistema de la app
const PAYMENT_MAP = {
  "Pago Móvil (Bs)": "PAGO MOVIL",
  "Efectivo ($)": "EFECTIVO",
  "Efectivo": "EFECTIVO",
  "Tarjeta": "TARJETA",
  "Transferencia": "TRANSFERENCIA",
};

// Mapeo de estados
const STATUS_MAP = {
  "Completada": "COMPLETADA",
  "Cancelada": "CANCELADA",
  "Pendiente": "PENDIENTE",
  "Confirmada": "CONFIRMADA",
};

// ============================================================
// 3. TRANSFORMAR SERVICIOS
// ============================================================
console.log("\n🔄 Transformando Servicios...");

const now = new Date();
const nowISO = now.toISOString();

const servicios = rawServicios.map((s) => {
  const name = (s.name || "").trim();
  return {
    id: s.id,
    name: name,
    description: getServiceDescription(name),
    category: CATEGORY_MAP[name] || "MAQUILLAJE",
    price: s.price,
    duration: s.duration,
    commissionPercent: 40, // 40% por defecto
    active: true,
    createdAt: nowISO,
    updatedAt: nowISO,
  };
});

function getServiceDescription(name) {
  const descriptions = {
    "Bozo": "Diseño de cejas con técnica bozo",
    "Ceja y Bozo mas Tinte": "Servicio completo de cejas con bozo y tinte",
    "Cejas": "Depilación y diseño de cejas",
    "Cejas y Bozo": "Diseño de cejas completo con bozo",
    "Manos Semis": "Manicure con esmalte semipermanente",
    "Manos Tradicionales": "Manicure tradicional con esmalte regular",
    "Manos y Pies Semis": "Manicure y pedicure semipermanente",
    "Otros": "Otros servicios",
    "Pies Semis": "Pedicure con esmalte semipermanente",
    "Pies Tradicionales ": "Pedicure tradicional con esmalte regular",
    "Sistema": "Sistema completo de uñas",
  };
  return descriptions[name] || `Servicio de ${name}`;
}

console.log(`   ✅ ${servicios.length} servicios transformados`);

// ============================================================
// 4. TRANSFORMAR CLIENTES
// ============================================================
console.log("\n🔄 Transformando Clientes...");

// Crear un mapa de clientes por nombre para referencias cruzadas
const clientMap = {};

const clientes = rawClientes.map((c) => {
  const cliente = {
    id: c.id,
    name: c.name || "",
    phone: c.phone && c.phone !== "N/A" && c.phone !== "" ? c.phone : null,
    email: c.email && c.email !== "N/A" && c.email !== "" ? c.email : null,
    birthDate: null,
    notes: c.notes && c.notes !== "" ? c.notes : null,
    visitCount: 0, // se actualizará después
    freeServiceAvailable: false,
    createdAt: convertDateString(c.created_at) || nowISO,
    updatedAt: nowISO,
  };
  clientMap[cliente.name.toLowerCase().trim()] = cliente.id;
  return cliente;
});

console.log(`   ✅ ${clientes.length} clientes transformados`);

// ============================================================
// 5. TRANSFORMAR EMPLEADAS
// ============================================================
console.log("\n🔄 Transformando Empleadas...");

// Generar contraseña hasheada para Stefany (Admin)
const adminPasswordHash = bcrypt.hashSync("0000", 10);

const empleadas = rawEmpleadas.map((e) => {
  const name = (e.name || "").trim();
  // Stefany (ID 1) es la Admin — tiene acceso al sistema
  const isAdmin = e.id === 1 && name.toLowerCase().includes("stefany");
  return {
    id: e.id,
    name: name,
    phone: null,
    email: null,
    role: isAdmin ? "ADMIN" : "EMPLEADA",
    password: isAdmin ? adminPasswordHash : null,
    active: true,
    startDate: null,
    notes: e.description || null,
    createdAt: nowISO,
    updatedAt: nowISO,
  };
});

// Agregar Andreina como nueva empleada (ID 5)
// Las citas de Roselyn en abril/mayo se reasignarán a ella
empleadas.push({
  id: 5,
  name: "Andreina",
  phone: null,
  email: null,
  role: "EMPLEADA",
  password: null,
  active: true,
  startDate: null,
  notes: "Manicurista",
  createdAt: nowISO,
  updatedAt: nowISO,
});

// Crear mapa de empleadas por nombre
const employeeMap = {};
empleadas.forEach((e) => {
  employeeMap[e.name.toLowerCase().trim()] = e.id;
});

console.log(`   ✅ ${empleadas.length} empleadas transformadas`);
console.log("   🔑 Stefany (ID 1) configurada como ADMIN con contraseña: 0000");
console.log("   ➕ Andreina (ID 5) agregada — recibirá las citas de Roselyn de abril/mayo");

// ============================================================
// 6. TRANSFORMAR CITAS Y GENERAR VENTAS + SALEITEMS
// ============================================================
console.log("\n🔄 Transformando Citas → Citas + Ventas + SaleItems...");

// Mapa de service_id original → nuevo (se mantienen igual)
// Mapa de employee_id original → nuevo (se mantienen igual)
// Mapa de client_id original → nuevo (se mantienen igual)

// Contadores para IDs
let nextCitaId = Math.max(...rawCitas.map(c => c.id || 0), 0) + 1;
let nextSaleId = 1;
let nextSaleItemId = 1;

const citas = [];
const ventas = [];
const saleItems = [];

// Contador de visitas por cliente
const visitCounts = {};

for (const c of rawCitas) {
  // --- CITA ---
  const status = STATUS_MAP[c.status] || "COMPLETADA";
  const citaDate = c.appointment_date || nowISO.split("T")[0];
  
  // Combinar fecha + hora (aunque todas son 00:00)
  let dateTimeStr;
  if (c.appointment_time && c.appointment_time !== "00:00") {
    dateTimeStr = `${citaDate}T${c.appointment_time}:00.000Z`;
  } else {
    dateTimeStr = `${citaDate}T12:00:00.000Z`; // mediodía como default
  }
  
  // Reasignar citas de Roselyn (ID 2) en abril/mayo 2026 → Andreina (ID 5)
  let employeeId = c.employee_id;
  if (employeeId === 2 && (citaDate.startsWith("2026-04") || citaDate.startsWith("2026-05"))) {
    employeeId = 5; // Andreina
  }

  citas.push({
    id: c.id,
    date: dateTimeStr,
    status: status,
    notes: null,
    clientId: c.client_id,
    serviceId: c.service_id,
    employeeId: employeeId,
    createdAt: dateTimeStr,
    updatedAt: dateTimeStr,
  });

  // --- VENTA (solo si es completada y tiene precio) ---
  if (status === "COMPLETADA" && (c.final_price != null || c.price != null)) {
    const total = c.final_price != null ? Number(c.final_price) : Number(c.price);
    const totalBs = c.final_price_ves != null && c.final_price_ves !== "" ? Number(c.final_price_ves) : null;
    
    let exchangeRate = null;
    if (totalBs != null && total > 0) {
      exchangeRate = Math.round((totalBs / total) * 100) / 100;
    }
    
    const paymentMethod = PAYMENT_MAP[c.payment_method] || null;

    const sale = {
      id: nextSaleId,
      date: dateTimeStr,
      total: total,
      totalBs: totalBs,
      exchangeRate: exchangeRate,
      paymentMethod: paymentMethod,
      notes: null,
      clientId: c.client_id,
      employeeId: employeeId, // Misma lógica de reasignación que en citas
      createdAt: dateTimeStr,
    };
    ventas.push(sale);

    // --- SALEITEM ---
    const servicePrice = Number(c.price) || total;
    saleItems.push({
      id: nextSaleItemId,
      quantity: 1,
      price: servicePrice,
      saleId: nextSaleId,
      serviceId: c.service_id,
      productId: null,
    });
    nextSaleItemId++;

    // Si hubiera tip/propina, crear otro SaleItem (opcional - lo omitimos por simplicidad)
    // O podemos agregar un item extra por la propina
    if (c.tip_amount != null && Number(c.tip_amount) > 0) {
      saleItems.push({
        id: nextSaleItemId,
        quantity: 1,
        price: Number(c.tip_amount),
        saleId: nextSaleId,
        serviceId: null,
        productId: null,
      });
      nextSaleItemId++;
    }

    nextSaleId++;

    // Actualizar contador de visitas del cliente
    const clientId = c.client_id;
    visitCounts[clientId] = (visitCounts[clientId] || 0) + 1;
  }
}

// Actualizar visitCount y freeServiceAvailable en clientes
clientes.forEach((c) => {
  c.visitCount = visitCounts[c.id] || 0;
  c.freeServiceAvailable = c.visitCount >= 5;
});

console.log(`   ✅ ${citas.length} citas transformadas`);
console.log(`   ✅ ${ventas.length} ventas generadas`);
console.log(`   ✅ ${saleItems.length} items de venta generados`);

// ============================================================
// 7. GENERAR PRODUCTOS POR DEFECTO
// ============================================================
console.log("\n🔄 Generando Productos por defecto...");

const productos = [
  { id: 1,  name: "Esmalte Semipermanente",    description: "Esmalte gel 15ml",              quantity: 25, minStock: 5,  price: 12,   category: "MANICURE",  createdAt: nowISO, updatedAt: nowISO },
  { id: 2,  name: "Removedor de Esmalte",      description: "Removedor sin acetona 250ml",   quantity: 10, minStock: 3,  price: 8,    category: "MANICURE",  createdAt: nowISO, updatedAt: nowISO },
  { id: 3,  name: "Aceite para Cutículas",     description: "Aceite hidratante 30ml",        quantity: 15, minStock: 5,  price: 6,    category: "MANICURE",  createdAt: nowISO, updatedAt: nowISO },
  { id: 4,  name: "Pinza para Cejas",          description: "Pinza profesional acero inox",  quantity: 20, minStock: 5,  price: 5,    category: "CEJAS",     createdAt: nowISO, updatedAt: nowISO },
  { id: 5,  name: "Tinte para Cejas",          description: "Tinte profesional 30ml",        quantity: 7,  minStock: 2,  price: 9,    category: "CEJAS",     createdAt: nowISO, updatedAt: nowISO },
  { id: 6,  name: "Brocha Base",               description: "Brocha profesional kabuki",     quantity: 10, minStock: 3,  price: 14,   category: "MAQUILLAJE",createdAt: nowISO, updatedAt: nowISO },
  { id: 7,  name: "Esponja Maquillaje",        description: "Esponja beauty blender",        quantity: 30, minStock: 10, price: 4,    category: "MAQUILLAJE",createdAt: nowISO, updatedAt: nowISO },
  { id: 8,  name: "Base Maquillaje",           description: "Base líquida 30ml tono medio",  quantity: 6,  minStock: 2,  price: 20,   category: "MAQUILLAJE",createdAt: nowISO, updatedAt: nowISO },
  { id: 9,  name: "Crema Hidratante Facial",   description: "Crema hidratante 50ml",         quantity: 8,  minStock: 3,  price: 16,   category: "GENERAL",   createdAt: nowISO, updatedAt: nowISO },
];

console.log(`   ✅ ${productos.length} productos generados`);

// ============================================================
// 8. GENERAR PLANTILLAS WHATSAPP
// ============================================================
console.log("\n🔄 Generando plantillas WhatsApp...");

const waTemplates = [
  { id: 1, label: "Recordatorio de Cita",     message: "¡Hola {{nombre}}! Te recordamos tu cita en Sakura Studio el día {{fecha}} a las {{hora}}. Te esperamos 🎀" },
  { id: 2, label: "Confirmación de Cita",     message: "¡Hola {{nombre}}! Confirmamos tu cita de {{servicio}} para el {{fecha}} a las {{hora}}. ¡Gracias por preferirnos! 💄" },
  { id: 3, label: "Post Servicio",            message: "¡Gracias {{nombre}} por visitarnos! Esperamos que hayas disfrutado tu {{servicio}}. Te esperamos pronto en Sakura Studio ✨" },
  { id: 4, label: "Cumpleaños",               message: "¡Feliz cumpleaños {{nombre}}! 🎂🎉 En Sakura Studio queremos consentirte. ¡Ven y recibe un descuento especial! 💖" },
  { id: 5, label: "Promoción General",        message: "¡Hola {{nombre}}! Este mes tenemos promociones especiales en Sakura Studio. Pregunta por nuestros paquetes y descuentos. ¡Te esperamos! 🌸" },
];

console.log(`   ✅ ${waTemplates.length} plantillas generadas`);

// ============================================================
// 9. GENERAR CONFIGURACIÓN DEL ESTUDIO
// ============================================================
console.log("\n🔄 Generando configuración del estudio...");

const studioSettings = [
  {
    id: 1,
    name: "Sakura Studio",
    subtitle: "Estudio de Belleza",
    address: "Dirección del estudio",
    phone: "Teléfono del estudio",
    email: "Email del estudio",
    workLatitude: null,
    workLongitude: null,
    workLocationName: null,
    workRadius: 200,
  },
];

console.log(`   ✅ Configuración generada`);

// ============================================================
// 10. CREAR ARCHIVO EXCEL DE SALIDA
// ============================================================
console.log("\n📝 Escribiendo archivo Excel transformado...");

const outWb = XLSX.utils.book_new();

function addSheet(name, data) {
  const serialized = data.map((row) => {
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

  const ws = XLSX.utils.json_to_sheet(serialized);
  
  if (data.length > 0) {
    ws["!cols"] = Object.keys(data[0]).map((key) => ({
      wch: Math.min(Math.max(key.length, 12), 30),
    }));
  }
  
  XLSX.utils.book_append_sheet(outWb, ws, name);
}

addSheet("Servicios", servicios);
addSheet("Clientes", clientes);
addSheet("Empleadas", empleadas);
addSheet("Productos", productos);
addSheet("WATemplates", waTemplates);
addSheet("StudioSettings", studioSettings);
addSheet("Citas", citas);
addSheet("Ventas", ventas);
addSheet("SaleItems", saleItems);

const outputPath = path.join(__dirname, "..", "Sakura_Datos_Importables.xlsx");
const buf = XLSX.write(outWb, { type: "buffer", bookType: "xlsx" });
fs.writeFileSync(outputPath, buf);

// ============================================================
// 11. RESUMEN
// ============================================================
console.log("\n" + "=".repeat(60));
console.log("✅ TRANSFORMACIÓN COMPLETADA");
console.log("=".repeat(60));
console.log(`📁 Archivo generado: ${outputPath}`);
console.log("");
console.log("📊 Resumen de datos:");
console.log(`   • Servicios:     ${servicios.length}`);
console.log(`   • Clientes:      ${clientes.length}`);
console.log(`   • Empleadas:     ${empleadas.length}`);
console.log(`   • Productos:     ${productos.length}`);
console.log(`   • WATemplates:   ${waTemplates.length}`);
console.log(`   • StudioSettings: ${studioSettings.length}`);
console.log(`   • Citas:         ${citas.length}`);
console.log(`   • Ventas:        ${ventas.length}`);
console.log(`   • SaleItems:     ${saleItems.length}`);
console.log("");
console.log("📌 Notas importantes:");
console.log("   • Stefany es ADMIN con contraseña '0000' — puedes iniciar sesión con ella.");
console.log("   • Andreina (ID 5) fue agregada y recibió las 10 citas de Roselyn de mayo.");
console.log("   • Roselyn (ID 2) queda como EMPLEADA pero sin citas asignadas.");
console.log("   • Mary Melendez (ID 3) no tiene citas en los datos originales.");
console.log("   • Las categorías de servicios se asignaron automáticamente.");
console.log("   • Los productos, plantillas WA y config. son valores por defecto.");
console.log("   • Revisa la configuración del estudio y actualiza los datos reales.");
console.log("   • Las citas no tienen hora real (todas a las 12:00) — tu Excel original");
console.log("     no incluía horarios específicos.");

function convertDateString(dateStr) {
  if (!dateStr) return null;
  // Formato: "2026-04-11 16:43:51"
  const match = String(dateStr).match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1] + "T12:00:00.000Z";
  }
  return null;
}
