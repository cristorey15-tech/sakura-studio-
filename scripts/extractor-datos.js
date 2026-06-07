/**
 * Extractor: "salon.db" → "Sakura_Datos_Importables.xlsx"
 *
 * Lee la base de datos SQLite de la app vieja (salon.db),
 * extrae todas las tablas y genera un archivo Excel compatible
 * con el importador de la app nueva (9 hojas).
 *
 * Uso: node scripts/extractor-datos.js
 */

const initSqlJs = require("sql.js");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

// ============================================================
// MAPEOS
// ============================================================

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
  "Pestañas": "PESTAÑAS",
  "Laminado": "PESTAÑAS",
};

const PAYMENT_MAP = {
  "Pago Móvil (Bs)": "PAGO MOVIL",
  "Efectivo ($)": "EFECTIVO",
  "Efectivo": "EFECTIVO",
  "Tarjeta": "TARJETA",
  "Transferencia": "TRANSFERENCIA",
};

const STATUS_MAP = {
  "Programada": "PENDIENTE",
  "Completada": "COMPLETADA",
  "Cancelada": "CANCELADA",
  "Pendiente": "PENDIENTE",
  "Confirmada": "CONFIRMADA",
};

// ============================================================
// DESCRIPCIONES DE SERVICIOS
// ============================================================

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
    "Pies Tradicionales": "Pedicure tradicional con esmalte regular",
    "Sistema": "Sistema completo de uñas",
  };
  return descriptions[name] || `Servicio de ${name}`;
}

// ============================================================
// CONVERTIR FECHA DEL FORMATO SQLITE A ISO
// ============================================================

function toISO(dateStr, timeStr) {
  if (!dateStr) return new Date().toISOString();
  // dateStr format: "YYYY-MM-DD"
  // timeStr format: "HH:MM"
  if (timeStr && timeStr !== "00:00") {
    return `${dateStr}T${timeStr}:00.000Z`;
  }
  return `${dateStr}T12:00:00.000Z`;
}

function toISODateTime(dateTimeStr) {
  if (!dateTimeStr) return new Date().toISOString();
  // Format: "YYYY-MM-DD HH:MM:SS"
  const match = String(dateTimeStr).match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1] + "T12:00:00.000Z";
  }
  return new Date().toISOString();
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("=".repeat(60));
  console.log("🔄 EXTRACTOR: salon.db → Excel Importable");
  console.log("=".repeat(60));

  // ── 1. Leer base de datos SQLite ──
  console.log("\n📂 Leyendo base de datos...");
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, "..", "SAKURA PROGRAMA", "salon.db");
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ No se encontró: ${dbPath}`);
    process.exit(1);
  }
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  function query(sql) {
    const result = db.exec(sql);
    if (result.length === 0) return [];
    const cols = result[0].columns;
    return result[0].values.map((row) => {
      const obj = {};
      for (let i = 0; i < cols.length; i++) {
        obj[cols[i]] = row[i];
      }
      return obj;
    });
  }

  const rawClients = query("SELECT * FROM clients ORDER BY id");
  const rawServices = query("SELECT * FROM services ORDER BY id");
  const rawEmployees = query("SELECT * FROM employees ORDER BY id");
  const rawAppointments = query("SELECT * FROM appointments ORDER BY id");

  console.log(`   ✅ Clientes:     ${rawClients.length}`);
  console.log(`   ✅ Servicios:    ${rawServices.length}`);
  console.log(`   ✅ Empleadas:    ${rawEmployees.length}`);
  console.log(`   ✅ Citas:        ${rawAppointments.length}`);

  db.close();

  const now = new Date();
  const nowISO = now.toISOString();

  // ============================================================
  // 2. TRANSFORMAR SERVICIOS
  // ============================================================
  console.log("\n🔄 Transformando Servicios...");

  const servicios = rawServices.map((s) => {
    const name = (s.name || "").trim();
    return {
      id: s.id,
      name: name,
      description: getServiceDescription(name),
      category: CATEGORY_MAP[name] || "MAQUILLAJE",
      price: s.price,
      duration: s.duration,
      commissionPercent: 50, // 50% según la app vieja
      active: true,
      createdAt: nowISO,
      updatedAt: nowISO,
    };
  });

  console.log(`   ✅ ${servicios.length} servicios transformados`);

  // ============================================================
  // 3. TRANSFORMAR CLIENTES
  // ============================================================
  console.log("\n🔄 Transformando Clientes...");

  const clientes = rawClients.map((c) => ({
    id: c.id,
    name: c.name || "",
    phone: c.phone && c.phone !== "N/A" && c.phone !== "" ? c.phone : null,
    email: c.email && c.email !== "N/A" && c.email !== "" ? c.email : null,
    birthDate: null,
    notes: c.notes && c.notes !== "" ? c.notes : null,
    visitCount: 0, // se actualizará después con las citas completadas
    freeServiceAvailable: false,
    createdAt: toISODateTime(c.created_at),
    updatedAt: nowISO,
  }));

  console.log(`   ✅ ${clientes.length} clientes transformados`);

  // ============================================================
  // 4. TRANSFORMAR EMPLEADAS
  // ============================================================
  console.log("\n🔄 Transformando Empleadas...");

  const adminPasswordHash = bcrypt.hashSync("0000", 10);

  const empleadas = rawEmployees.map((e) => {
    const name = (e.name || "").trim();
    // Stefany Ruscio (ID 1) es la Admin
    const isAdmin = e.id === 1;
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

  // Agregar Andreina Palacios (ID 5) — manicurista que reemplazó a Roselyn
  // Las citas y ventas de Roselyn desde mediados de abril 2026 se reasignarán a ella
  empleadas.push({
    id: 5,
    name: "Andreina Palacios",
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

  console.log(`   ✅ ${empleadas.length} empleadas transformadas`);
  console.log("   🔑 Stefany Ruscio (ID 1) configurada como ADMIN con contraseña: 0000");
  console.log("   ➕ Andreina Palacios (ID 5) agregada como EMPLEADA — recibirá las citas de Roselyn desde mediados de abril");

  // ============================================================
  // 5. TRANSFORMAR CITAS → Citas + Ventas + SaleItems
  // ============================================================
  console.log("\n🔄 Transformando Citas → Citas + Ventas + SaleItems...");

  let nextSaleId = 1;
  let nextSaleItemId = 1;

  const citas = [];
  const ventas = [];
  const saleItems = [];
  const visitCounts = {};

  for (const c of rawAppointments) {
    const status = STATUS_MAP[c.status] || "COMPLETADA";
    const dateISO = toISO(c.appointment_date, c.appointment_time);

    // Reasignar citas de Roselyn (ID 2) desde mediados de abril 2026 → Andreina (ID 5)
    // Ya que Andreina Palacios reemplazó a Roselyn a partir de mediados de abril
    let employeeId = c.employee_id;
    if (employeeId === 2 && c.appointment_date >= "2026-04-15") {
      employeeId = 5; // Andreina Palacios
    }

    citas.push({
      id: c.id,
      date: dateISO,
      status: status,
      notes: null,
      clientId: c.client_id,
      serviceId: c.service_id,
      employeeId: employeeId,
      createdAt: dateISO,
      updatedAt: dateISO,
    });

    // Generar VENTA solo si es completada y tiene precio
    if (status === "COMPLETADA" && (c.final_price != null || c.price != null)) {
      const total = c.final_price != null ? Number(c.final_price) : Number(c.price);
      const totalBs = c.final_price_ves != null && c.final_price_ves !== "" ? Number(c.final_price_ves) : null;

      let exchangeRate = null;
      if (totalBs != null && total > 0) {
        exchangeRate = Math.round((totalBs / total) * 100) / 100;
      }

      const paymentMethod = PAYMENT_MAP[c.payment_method] || null;

      ventas.push({
        id: nextSaleId,
        date: dateISO,
        total: total,
        totalBs: totalBs,
        exchangeRate: exchangeRate,
        paymentMethod: paymentMethod,
        notes: null,
        clientId: c.client_id,
        employeeId: employeeId, // Misma lógica de reasignación
        createdAt: dateISO,
      });

      // SALEITEM del servicio
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

      // SALEITEM por propina (si existe)
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
      visitCounts[c.client_id] = (visitCounts[c.client_id] || 0) + 1;
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
  // 6. GENERAR PRODUCTOS POR DEFECTO
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
  // 7. GENERAR PLANTILLAS WHATSAPP
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
  // 8. GENERAR CONFIGURACIÓN DEL ESTUDIO
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
  // 9. CREAR ARCHIVO EXCEL DE SALIDA
  // ============================================================
  console.log("\n📝 Escribiendo archivo Excel...");

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
  const outBuf = XLSX.write(outWb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(outputPath, outBuf);

  // ============================================================
  // 10. RESUMEN
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("✅ EXTRACCIÓN COMPLETADA");
  console.log("=".repeat(60));
  console.log(`📁 Archivo generado: ${outputPath}`);
  console.log("");
  console.log("📊 Resumen de datos:");
  console.log(`   • Servicios:      ${servicios.length}`);
  console.log(`   • Clientes:       ${clientes.length}`);
  console.log(`   • Empleadas:      ${empleadas.length}`);
  console.log(`   • Productos:      ${productos.length}`);
  console.log(`   • WATemplates:    ${waTemplates.length}`);
  console.log(`   • StudioSettings: ${studioSettings.length}`);
  console.log(`   • Citas:          ${citas.length}`);
  console.log(`   • Ventas:         ${ventas.length}`);
  console.log(`   • SaleItems:      ${saleItems.length}`);
  console.log("");
  // Contar reasignaciones
  const reassignedCitas = citas.filter(c => c.employeeId === 5).length;

  console.log("📌 Notas importantes:");
  console.log("   • Stefany Ruscio (ID 1) es ADMIN con contraseña '0000'");
  console.log("   • Todas las empleadas tienen commission_rate 50%");
  console.log("   • Rango de fechas: 2025-12-11 → 2026-05-23");
  console.log("   • Los clientes 'Cliente Eliminado' (ID 1) y 'Cliente de Paso' (ID 2)");
  console.log("     fueron incluidos tal cual estaban en la BD original.");
  console.log(`   • ${reassignedCitas} citas reasignadas de Roselyn → Andreina Palacios (desde 15-abr-2026)`);
  console.log("   • Productos, plantillas WA y config. son valores por defecto.");
  console.log("   • Las citas sin hora específica se asignaron a las 12:00.");
  console.log("");
  console.log("👉 Ahora ve a Configuración → Base de Datos → Importar");
  console.log("   y selecciona 'Sakura_Datos_Importables.xlsx'");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
