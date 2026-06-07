"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { SkeletonPageHeader, SkeletonBlock, SkeletonStatsRow } from "@/components/LoadingSkeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx";

interface BillingPeriod {
  total: number;
  count: number;
}

interface CustomRangePeriod extends BillingPeriod {
  startDate: string;
  endDate: string;
}

interface BillingData {
  allTime: BillingPeriod;
  last3Months: BillingPeriod;
  lastMonth: BillingPeriod;
  lastWeek: BillingPeriod;
  customRange?: CustomRangePeriod;
}

interface MonthlyPoint {
  month: string;
  label: string;
  total: number;
  count: number;
}

interface EmployeePerformance {
  id: number;
  name: string;
  totalBilled: number;
  saleCount: number;
  monthlySales: number;
  averageTicket: number;
}

interface ReportData {
  billing: BillingData;
  employeePerformance: EmployeePerformance[];
  monthlyEvolution: MonthlyPoint[];
}

interface EmployeePayment {
  id: number;
  name: string;
  totalUsd: number;
  totalBs: number;
  saleCount: number;
  usdCount: number;
  bsCount: number;
}

interface PaymentsData {
  employees: EmployeePayment[];
  totals: {
    totalUsd: number;
    totalBs: number;
    totalEmployees: number;
  };
}

interface EmployeeSaleDetail {
  id: number;
  date: string;
  clientName: string | null;
  services: { name: string; quantity: number; price: number }[];
  paymentMethod: string | null;
  total: number;
  totalBs: number | null;
  exchangeRate: number | null;
}

interface EmployeeDetailResponse {
  employee: { id: number; name: string };
  sales: EmployeeSaleDetail[];
  totals: {
    totalUsd: number;
    totalBs: number;
    saleCount: number;
  };
}

type Tab = "facturacion" | "rendimiento" | "pagos" | "asistencia";

const formatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function monthStart() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split("T")[0];
}

function yearStart() {
  const d = new Date();
  d.setMonth(0, 1);
  return d.toISOString().split("T")[0];
}

const PERF_PAGE_SIZE = 15;

const PIE_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
  "#14b8a6", "#84cc16", "#a855f7", "#0ea5e9",
];

const QUICK_PRESETS = [
  { label: "Últimos 7 días", start: () => daysAgo(7), end: todayStr },
  { label: "Este mes", start: monthStart, end: todayStr },
  { label: "Últimos 3 meses", start: () => monthsAgo(3), end: todayStr },
  { label: "Este año", start: yearStart, end: todayStr },
];

const PAGOS_QUICK_PRESETS = [
  { label: "Últimos 7 días", start: () => daysAgo(7), end: todayStr },
  { label: "Este mes", start: monthStart, end: todayStr },
  { label: "Últimos 30 días", start: () => daysAgo(30), end: todayStr },
];

/* ─── Cargar logo del estudio como base64 ─── */
function getLogoDataUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context not available")); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load logo"));
    img.src = "/logo.png";
  });
}

/* ─── Dibujar encabezado del estudio en el PDF ─── */
function drawPDFHeader(
  doc: jsPDF,
  logoDataUrl: string,
  title: string,
  dateLabel: string,
  studio: { name: string; subtitle: string; address: string; phone: string; email: string },
  filterLabel?: string
): number {
  const pageW = doc.internal.pageSize.getWidth();

  // Logo
  try {
    doc.addImage(logoDataUrl, "PNG", 14, 10, 14, 14);
  } catch {
    // continuar sin logo
  }

  // Nombre del estudio
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(studio.name, 31, 17);

  // Subtítulo
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(studio.subtitle, 31, 22);

  // Información de contacto
  doc.setFontSize(7.5);
  doc.setTextColor(140);
  doc.text(`${studio.address}  |  ${studio.phone}  |  ${studio.email}`, 31, 27);

  // Línea separadora
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.5);
  doc.line(14, 35, pageW - 14, 35);

  // Título del reporte
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text(title, pageW / 2, 44, { align: "center" });

  // Fecha de generación
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(dateLabel, pageW / 2, 50, { align: "center" });

  // Filtro activo
  let startY = 55;
  if (filterLabel) {
    doc.setFontSize(9);
    doc.setTextColor(99, 102, 241);
    doc.text(`Periodo: ${filterLabel}`, pageW / 2, 55, { align: "center" });
    startY = 60;
  }

  doc.setTextColor(0);
  return startY;
}

/* ─── Helper: formato MXN sin símbolo para Excel/PDF ─── */
const currencyStr = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);

/* ─── Exportar Facturación a PDF (solo rango personalizado) ─── */
async function exportFacturacionRangoPDF(
  data: ReportData,
  studioInfo: { name: string; subtitle: string; address: string; phone: string; email: string },
  filterLabel?: string
) {
  if (!data.billing.customRange) return;
  const r = data.billing.customRange;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  const logoDataUrl = await getLogoDataUrl().catch(() => "");
  const dateLabel = `Generado el ${new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}`;
  const startY = drawPDFHeader(doc, logoDataUrl, "Reporte de Facturación — Rango Personalizado", dateLabel, studioInfo, filterLabel);

  const body = [
    ["Total Facturado", currencyStr(r.total)],
    ["Cantidad de Ventas", String(r.count)],
    ["Ticket Promedio", r.count > 0 ? currencyStr(r.total / r.count) : "$0.00"],
    ["Fecha Desde", new Date(r.startDate + "T00:00:00").toLocaleDateString("es-MX")],
    ["Fecha Hasta", new Date(r.endDate + "T00:00:00").toLocaleDateString("es-MX")],
  ];

  autoTable(doc, {
    startY,
    head: [["Métrica", "Valor"]],
    body,
    theme: "grid",
    headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 80, halign: "right" },
    },
  });

  // Evolución mensual del rango
  if (data.monthlyEvolution.length > 0) {
    const lastY = (doc as any).lastAutoTable?.finalY || startY;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Evolución Mensual en el Periodo", 14, lastY + 15);

    const evolBody = data.monthlyEvolution.map((m) => [
      m.label,
      currencyStr(m.total),
      String(m.count),
    ]);

    autoTable(doc, {
      startY: lastY + 20,
      head: [["Mes", "Facturado", "Ventas"]],
      body: evolBody,
      theme: "grid",
      headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 50, halign: "right" },
        2: { cellWidth: 30, halign: "center" },
      },
    });
  }

  doc.save(`facturacion-rango-${new Date().toISOString().split("T")[0]}.pdf`);
}

/* ─── Exportar Facturación a Excel (solo rango personalizado) ─── */
function exportFacturacionRangoExcel(data: ReportData, filterLabel?: string) {
  if (!data.billing.customRange) return;
  const r = data.billing.customRange;
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen del rango
  const summaryRows = [
    ["Métrica", "Valor"],
    ["Total Facturado", r.total],
    ["Ventas", r.count],
    ["Ticket Promedio", r.count > 0 ? r.total / r.count : 0],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1["!cols"] = [{ wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

  // Hoja 2: Evolución mensual
  if (data.monthlyEvolution.length > 0) {
    const evolRows = [
      ["Mes", "Facturado", "Ventas"],
      ...data.monthlyEvolution.map((m) => [m.label, m.total, m.count]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(evolRows);
    ws2["!cols"] = [{ wch: 15 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Evolución Mensual");
  }

  XLSX.writeFile(wb, `facturacion-rango-${new Date().toISOString().split("T")[0]}.xlsx`);
}

/* ─── Exportar Facturación a PDF ─── */
async function exportFacturacionPDF(
  data: ReportData,
  studioInfo: { name: string; subtitle: string; address: string; phone: string; email: string },
  filterLabel?: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  const logoDataUrl = await getLogoDataUrl().catch(() => "");
  const dateLabel = `Generado el ${new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}`;
  const startY = drawPDFHeader(doc, logoDataUrl, "Reporte de Facturación", dateLabel, studioInfo, filterLabel);

  // Tabla de periodos
  const body = [
    ...([
      { key: "allTime" as const, label: "Desde Siempre" },
      { key: "last3Months" as const, label: "Últimos 3 meses" },
      { key: "lastMonth" as const, label: "Último mes" },
      { key: "lastWeek" as const, label: "Última semana" },
    ] as const).map((p) => {
      const v = data.billing[p.key];
      return [p.label, currencyStr(v.total), String(v.count), v.count > 0 ? currencyStr(v.total / v.count) : "$0.00"];
    }),
    ...(data.billing.customRange
      ? [
          [
            "Rango personalizado",
            currencyStr(data.billing.customRange.total),
            String(data.billing.customRange.count),
            data.billing.customRange.count > 0
              ? currencyStr(data.billing.customRange.total / data.billing.customRange.count)
              : "$0.00",
          ],
        ]
      : []),
  ];

  autoTable(doc, {
    startY,
    head: [["Periodo", "Total Facturado", "Ventas", "Promedio"]],
    body,
    theme: "grid",
    headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 50, halign: "right" },
      2: { cellWidth: 30, halign: "center" },
      3: { cellWidth: 50, halign: "right" },
    },
  });

  // Evolución mensual
  if (data.monthlyEvolution.length > 0) {
    const lastY = (doc as any).lastAutoTable?.finalY || startY;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Evolución Mensual", 14, lastY + 15);

    const evolBody = data.monthlyEvolution.map((m) => [
      m.label,
      currencyStr(m.total),
      String(m.count),
    ]);

    autoTable(doc, {
      startY: lastY + 20,
      head: [["Mes", "Facturado", "Ventas"]],
      body: evolBody,
      theme: "grid",
      headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 50, halign: "right" },
        2: { cellWidth: 30, halign: "center" },
      },
    });
  }

  doc.save(`facturacion-${new Date().toISOString().split("T")[0]}.pdf`);
}

/* ─── Exportar Facturación a Excel ─── */
function exportFacturacionExcel(data: ReportData, filterLabel?: string) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen por periodos
  const periodRows = [
    ["Periodo", "Total Facturado", "Ventas", "Promedio"],
    ...([
      { key: "allTime" as const, label: "Desde Siempre" },
      { key: "last3Months" as const, label: "Últimos 3 meses" },
      { key: "lastMonth" as const, label: "Último mes" },
      { key: "lastWeek" as const, label: "Última semana" },
    ] as const).map((p) => {
      const v = data.billing[p.key];
      return [p.label, v.total, v.count, v.count > 0 ? v.total / v.count : 0];
    }),
    ...(data.billing.customRange
      ? [
          [
            "Rango personalizado",
            data.billing.customRange.total,
            data.billing.customRange.count,
            data.billing.customRange.count > 0
              ? data.billing.customRange.total / data.billing.customRange.count
              : 0,
          ],
        ]
      : []),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(periodRows);
  // Ajustar ancho de columnas
  ws1["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 10 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

  // Hoja 2: Evolución mensual
  if (data.monthlyEvolution.length > 0) {
    const evolRows = [
      ["Mes", "Facturado", "Ventas"],
      ...data.monthlyEvolution.map((m) => [m.label, m.total, m.count]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(evolRows);
    ws2["!cols"] = [{ wch: 15 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Evolución Mensual");
  }

  XLSX.writeFile(wb, `facturacion-${new Date().toISOString().split("T")[0]}.xlsx`);
}

/* ─── Exportar Rendimiento a PDF ─── */
async function exportRendimientoPDF(
  data: ReportData,
  studioInfo: { name: string; subtitle: string; address: string; phone: string; email: string },
  filterLabel?: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });

  const logoDataUrl = await getLogoDataUrl().catch(() => "");
  const dateLabel = `Generado el ${new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}`;
  const startY = drawPDFHeader(doc, logoDataUrl, "Rendimiento por Empleada", dateLabel, studioInfo, filterLabel);

  const body = data.employeePerformance.map((emp, i) => [
    String(i + 1),
    emp.name,
    String(emp.saleCount),
    currencyStr(emp.totalBilled),
    currencyStr(emp.monthlySales),
    currencyStr(emp.averageTicket),
  ]);

  autoTable(doc, {
    startY,
    head: [["#", "Empleada", "Ventas", "Total Facturado", "Mes Actual", "Ticket Promedio"]],
    body,
    theme: "grid",
    headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 60 },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: 45, halign: "right" },
      4: { cellWidth: 40, halign: "right" },
      5: { cellWidth: 40, halign: "right" },
    },
  });

  doc.save(`rendimiento-${new Date().toISOString().split("T")[0]}.pdf`);
}

/* ─── Exportar Rendimiento a Excel ─── */
function exportRendimientoExcel(data: ReportData, filterLabel?: string) {
  const wb = XLSX.utils.book_new();

  const rows = [
    ["#", "Empleada", "Ventas", "Total Facturado", "Mes Actual", "Ticket Promedio"],
    ...data.employeePerformance.map((emp, i) => [
      i + 1,
      emp.name,
      emp.saleCount,
      emp.totalBilled,
      emp.monthlySales,
      emp.averageTicket,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 18 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, "Rendimiento");

  XLSX.writeFile(wb, `rendimiento-${new Date().toISOString().split("T")[0]}.xlsx`);
}

/* ─── Exportar Rendimiento filtrado a PDF (solo empleadas visibles en tabla) ─── */
async function exportRendimientoFiltradoPDF(
  data: ReportData,
  studioInfo: { name: string; subtitle: string; address: string; phone: string; email: string },
  filterLabel?: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });

  const logoDataUrl = await getLogoDataUrl().catch(() => "");
  const dateLabel = `Generado el ${new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}`;
  const startY = drawPDFHeader(doc, logoDataUrl, "Rendimiento por Empleada — Vista Filtrada", dateLabel, studioInfo, filterLabel);

  // Resumen del conjunto filtrado
  const totalBilled = data.employeePerformance.reduce((s, e) => s + e.totalBilled, 0);
  const totalSales = data.employeePerformance.reduce((s, e) => s + e.saleCount, 0);
  const avgTicket = totalSales > 0 ? totalBilled / totalSales : 0;

  const summaryBody = [
    ["Empleadas en tabla", String(data.employeePerformance.length)],
    ["Total Facturado", currencyStr(totalBilled)],
    ["Total Ventas", String(totalSales)],
    ["Ticket Promedio General", currencyStr(avgTicket)],
  ];

  autoTable(doc, {
    startY,
    head: [["Resumen", "Valor"]],
    body: summaryBody,
    theme: "grid",
    headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 80, halign: "right" },
    },
  });

  // Tabla detallada de empleadas
  const lastY = (doc as any).lastAutoTable?.finalY || startY;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Detalle por Empleada", 14, lastY + 15);

  const body = data.employeePerformance.map((emp, i) => [
    String(i + 1),
    emp.name,
    String(emp.saleCount),
    currencyStr(emp.totalBilled),
    currencyStr(emp.monthlySales),
    currencyStr(emp.averageTicket),
  ]);

  autoTable(doc, {
    startY: lastY + 20,
    head: [["#", "Empleada", "Ventas", "Total Facturado", "Mes Actual", "Ticket Promedio"]],
    body,
    theme: "grid",
    headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 60 },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: 45, halign: "right" },
      4: { cellWidth: 40, halign: "right" },
      5: { cellWidth: 40, halign: "right" },
    },
  });

  doc.save(`rendimiento-filtrado-${new Date().toISOString().split("T")[0]}.pdf`);
}

/* ─── Exportar Rendimiento filtrado a Excel (solo empleadas visibles en tabla) ─── */
function exportRendimientoFiltradoExcel(data: ReportData, filterLabel?: string) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen
  const totalBilled = data.employeePerformance.reduce((s, e) => s + e.totalBilled, 0);
  const totalSales = data.employeePerformance.reduce((s, e) => s + e.saleCount, 0);
  const summaryRows = [
    ["Métrica", "Valor"],
    ["Empleadas en tabla", data.employeePerformance.length],
    ["Total Facturado", totalBilled],
    ["Total Ventas", totalSales],
    ["Ticket Promedio General", totalSales > 0 ? totalBilled / totalSales : 0],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1["!cols"] = [{ wch: 25 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

  // Hoja 2: Detalle
  const detailRows = [
    ["#", "Empleada", "Ventas", "Total Facturado", "Mes Actual", "Ticket Promedio"],
    ...data.employeePerformance.map((emp, i) => [
      i + 1,
      emp.name,
      emp.saleCount,
      emp.totalBilled,
      emp.monthlySales,
      emp.averageTicket,
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
  ws2["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 10 }, { wch: 18 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Detalle");

  XLSX.writeFile(wb, `rendimiento-filtrado-${new Date().toISOString().split("T")[0]}.xlsx`);
}

/* ─── Exportar Detalle de Pagos por Empleada a PDF ─── */
async function exportPagosDetailPDF(
  employee: { id: number; name: string },
  sales: EmployeeSaleDetail[],
  totals: { totalUsd: number; totalBs: number; saleCount: number },
  studioInfo: { name: string; subtitle: string; address: string; phone: string; email: string },
  filterLabel?: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });

  const logoDataUrl = await getLogoDataUrl().catch(() => "");
  const dateLabel = `Generado el ${new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}`;
  const startY = drawPDFHeader(doc, logoDataUrl, `Detalle de Pagos — ${employee.name}`, dateLabel, studioInfo, filterLabel);

  // Resumen
  const servicesCount = sales.reduce((s, sale) => s + sale.services.reduce((ss, sv) => ss + sv.quantity, 0), 0);
  const summaryBody = [
    ["Total USD", `$${totals.totalUsd.toFixed(2)}`],
    ["Total Bs", `Bs ${totals.totalBs.toFixed(2)}`],
    ["Ventas", String(totals.saleCount)],
    ["Servicios", String(servicesCount)],
  ];

  autoTable(doc, {
    startY,
    head: [["Resumen", "Valor"]],
    body: summaryBody,
    theme: "grid",
    headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 60, halign: "right" },
    },
  });

  // Tabla detallada de ventas
  const lastY = (doc as any).lastAutoTable?.finalY || startY;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text("Detalle de Ventas", 14, lastY + 15);

  const pmLabels: Record<string, string> = {
    EFECTIVO: "Efectivo",
    TARJETA: "Tarjeta",
    TRANSFERENCIA: "Transferencia",
    "PAGO MOVIL": "Pago Móvil",
    OTRO: "Otro",
  };

  const body = sales.map((sale, idx) => [
    String(idx + 1),
    new Date(sale.date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
    sale.clientName || "—",
    sale.services.map((sv) => `${sv.quantity}x ${sv.name}`).join(", "),
    pmLabels[sale.paymentMethod || ""] || sale.paymentMethod || "—",
    `$${sale.total.toFixed(2)}`,
    sale.totalBs != null ? `Bs ${sale.totalBs.toFixed(2)}` : "—",
  ]);

  // Fila de totales
  const foot = [["", "", "", "", "TOTALES", `$${totals.totalUsd.toFixed(2)}`, totals.totalBs > 0 ? `Bs ${totals.totalBs.toFixed(2)}` : "—"]];

  autoTable(doc, {
    startY: lastY + 20,
    head: [["#", "Fecha", "Cliente", "Servicios", "Método de Pago", "Monto USD", "Monto Bs"]],
    body,
    foot,
    theme: "grid",
    headStyles: { fillColor: [99, 102, 241], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    footStyles: { fontSize: 8, fontStyle: "bold", fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 30 },
      2: { cellWidth: 35 },
      3: { cellWidth: 60 },
      4: { cellWidth: 30 },
      5: { cellWidth: 28, halign: "right" },
      6: { cellWidth: 28, halign: "right" },
    },
  });

  doc.save(`pagos-${employee.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`);
}

/* ─── Exportar Detalle de Pagos por Empleada a Excel ─── */
function exportPagosDetailExcel(
  employee: { id: number; name: string },
  sales: EmployeeSaleDetail[],
  totals: { totalUsd: number; totalBs: number; saleCount: number }
) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen
  const servicesCount = sales.reduce((s, sale) => s + sale.services.reduce((ss, sv) => ss + sv.quantity, 0), 0);
  const summaryRows = [
    ["Métrica", "Valor"],
    ["Empleada", employee.name],
    ["Total USD", totals.totalUsd],
    ["Total Bs", totals.totalBs],
    ["Ventas", totals.saleCount],
    ["Servicios", servicesCount],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1["!cols"] = [{ wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

  // Hoja 2: Detalle de Ventas
  const pmLabels: Record<string, string> = {
    EFECTIVO: "Efectivo",
    TARJETA: "Tarjeta",
    TRANSFERENCIA: "Transferencia",
    "PAGO MOVIL": "Pago Móvil",
    OTRO: "Otro",
  };

  const detailRows = [
    ["#", "Fecha", "Cliente", "Servicios", "Método de Pago", "Monto USD", "Monto Bs"],
    ...sales.map((sale, idx) => [
      idx + 1,
      new Date(sale.date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
      sale.clientName || "—",
      sale.services.map((sv) => `${sv.quantity}x ${sv.name}`).join(", "),
      pmLabels[sale.paymentMethod || ""] || sale.paymentMethod || "—",
      sale.total,
      sale.totalBs ?? 0,
    ]),
    [],
    ["TOTALES", "", "", "", "", totals.totalUsd, totals.totalBs],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
  ws2["!cols"] = [{ wch: 5 }, { wch: 15 }, { wch: 20 }, { wch: 35 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Detalle");

  XLSX.writeFile(wb, `pagos-${employee.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.xlsx`);
}

/* ─── Exportar Tabla General de Pagos Empleadas a PDF ─── */
async function exportPagosEmployeeTablePDF(
  data: PaymentsData,
  commissionPct: number,
  studioInfo: { name: string; subtitle: string; address: string; phone: string; email: string },
  filterLabel?: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });

  const logoDataUrl = await getLogoDataUrl().catch(() => "");
  const dateLabel = `Generado el ${new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}`;
  const startY = drawPDFHeader(doc, logoDataUrl, "Pagos a Empleadas — Resumen General", dateLabel, studioInfo, filterLabel);

  // Tabla detallada de empleadas
  const body = data.employees.map((emp, i) => [
    String(i + 1),
    emp.name,
    String(emp.saleCount),
    String(emp.usdCount),
    `$${emp.totalUsd.toFixed(2)}`,
    String(emp.bsCount),
    emp.totalBs > 0 ? `Bs ${emp.totalBs.toFixed(2)}` : "—",
    `$${(emp.totalUsd * (commissionPct / 100)).toFixed(2)}`,
    emp.totalBs > 0 ? `Bs ${(emp.totalBs * (commissionPct / 100)).toFixed(2)}` : "—",
  ]);

  // Fila de totales
  const foot = [[
    "",
    "TOTALES",
    String(data.totals.totalEmployees),
    "",
    `$${data.totals.totalUsd.toFixed(2)}`,
    "",
    data.totals.totalBs > 0 ? `Bs ${data.totals.totalBs.toFixed(2)}` : "—",
    `$${(data.totals.totalUsd * (commissionPct / 100)).toFixed(2)}`,
    data.totals.totalBs > 0 ? `Bs ${(data.totals.totalBs * (commissionPct / 100)).toFixed(2)}` : "—",
  ]];

  autoTable(doc, {
    startY,
    head: [["#", "Empleada", "Ventas", "USD", "Total USD", "Bs", "Total Bs", "Comisión USD", "Comisión Bs"]],
    body,
    foot,
    theme: "grid",
    headStyles: { fillColor: [99, 102, 241], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    footStyles: { fontSize: 8, fontStyle: "bold", fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 45 },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 28, halign: "right" },
      7: { cellWidth: 28, halign: "right" },
      8: { cellWidth: 28, halign: "right" },
    },
  });

  doc.save(`pagos-empleadas-${new Date().toISOString().split("T")[0]}.pdf`);
}

/* ─── Exportar Tabla General de Pagos Empleadas a Excel ─── */
function exportPagosEmployeeTableExcel(
  data: PaymentsData,
  commissionPct: number
) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen
  const summaryRows = [
    ["Métrica", "Valor"],
    ["Empleadas", data.totals.totalEmployees],
    ["Total USD", data.totals.totalUsd],
    ["Total Bs", data.totals.totalBs],
    ["Comisión Total USD", data.totals.totalUsd * (commissionPct / 100)],
    ["Comisión Total Bs", data.totals.totalBs * (commissionPct / 100)],
    ["% Comisión", `${commissionPct}%`],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1["!cols"] = [{ wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

  // Hoja 2: Detalle por Empleada
  const detailRows = [
    ["#", "Empleada", "Ventas", "USD", "Total USD", "Bs", "Total Bs", "Comisión USD", "Comisión Bs"],
    ...data.employees.map((emp, i) => [
      i + 1,
      emp.name,
      emp.saleCount,
      emp.usdCount,
      emp.totalUsd,
      emp.bsCount,
      emp.totalBs,
      emp.totalUsd * (commissionPct / 100),
      emp.totalBs * (commissionPct / 100),
    ]),
    [],
    [
      "",
      "TOTALES",
      data.totals.totalEmployees,
      "",
      data.totals.totalUsd,
      "",
      data.totals.totalBs,
      data.totals.totalUsd * (commissionPct / 100),
      data.totals.totalBs * (commissionPct / 100),
    ],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
  ws2["!cols"] = [{ wch: 5 }, { wch: 25 }, { wch: 8 }, { wch: 6 }, { wch: 14 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Detalle");

  XLSX.writeFile(wb, `pagos-empleadas-${new Date().toISOString().split("T")[0]}.xlsx`);
}

export default function ReportesPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("facturacion");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [filterApplied, setFilterApplied] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);

  const [perfStart, setPerfStart] = useState("");
  const [perfEnd, setPerfEnd] = useState("");
  const [perfApplied, setPerfApplied] = useState(false);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfPage, setPerfPage] = useState(1);

  // ─── Asistencia state ───
  interface AttendanceRecord {
    id: number;
    date: string;
    employeeId: number;
    employeeName: string;
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
  }
  
  interface AttendanceData {
    records: AttendanceRecord[];
    stats: {
      totalRecords: number;
      uniqueEmployees: number;
      totalDays: number;
    };
    workLocation: {
      name: string;
      latitude: number | null;
      longitude: number | null;
      radius: number;
    } | null;
  }

  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceFilterLoading, setAttendanceFilterLoading] = useState(false);
  const [attendanceStart, setAttendanceStart] = useState("");
  const [attendanceEnd, setAttendanceEnd] = useState("");
  const [attendanceFilterApplied, setAttendanceFilterApplied] = useState(false);
  const [attendanceEmployeeFilter, setAttendanceEmployeeFilter] = useState("");
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);

  const fetchAttendanceData = useCallback((start?: string, end?: string, isFilter?: boolean) => {
    if (isFilter) setAttendanceFilterLoading(true);
    else setAttendanceLoading(true);

    let url = "/api/attendance/history";
    const params = new URLSearchParams();
    if (start) params.set("startDate", start);
    if (end) params.set("endDate", end);
    if (attendanceEmployeeFilter) params.set("employeeId", attendanceEmployeeFilter);
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    apiFetch<AttendanceData>(url)
      .then(({ data }) => {
        if (data) setAttendanceData(data);
        setAttendanceLoading(false);
        setAttendanceFilterLoading(false);
      })
      .catch(() => {
        setAttendanceLoading(false);
        setAttendanceFilterLoading(false);
      });
  }, [attendanceEmployeeFilter]);

  // Load employees for filter dropdown
  useEffect(() => {
    apiFetch<{ id: number; name: string; active: boolean }[]>("/api/empleadas")
      .then(({ data }) => {
        if (data) setEmployees(data.filter((e) => e.active));
      })
      .catch(() => {});
  }, []);

  // Load attendance data on mount
  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

  // Pagos state
  const [pagosData, setPagosData] = useState<PaymentsData | null>(null);
  const [pagosLoading, setPagosLoading] = useState(true);
  const [pagosFilterLoading, setPagosFilterLoading] = useState(false);
  const [pagosStart, setPagosStart] = useState("");
  const [pagosEnd, setPagosEnd] = useState("");
  const [pagosFilterApplied, setPagosFilterApplied] = useState(false);
  const [commissionPct, setCommissionPct] = useState(50);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: number; name: string } | null>(null);
  const [employeeSales, setEmployeeSales] = useState<EmployeeSaleDetail[] | null>(null);
  const [employeeTotals, setEmployeeTotals] = useState<{ totalUsd: number; totalBs: number; saleCount: number } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Pagos data fetching
  const fetchPagosData = useCallback((start?: string, end?: string, isFilter?: boolean) => {
    if (isFilter) setPagosFilterLoading(true);
    else setPagosLoading(true);

    let url = "/api/pagos";
    if (start) {
      url += `?startDate=${encodeURIComponent(start)}`;
      if (end) url += `&endDate=${encodeURIComponent(end)}`;
    }

    apiFetch<PaymentsData>(url)
      .then(({ data }) => {
        if (data) setPagosData(data);
        setPagosLoading(false);
        setPagosFilterLoading(false);
      })
      .catch(() => {
        setPagosLoading(false);
        setPagosFilterLoading(false);
      });
  }, []);

  const fetchEmployeeDetail = useCallback((employeeId: number, start?: string, end?: string) => {
    setDetailLoading(true);
    setSelectedEmployee(null);
    let url = `/api/pagos/${employeeId}/sales`;
    if (start) {
      url += `?startDate=${encodeURIComponent(start)}`;
      if (end) url += `&endDate=${encodeURIComponent(end)}`;
    }
    apiFetch<EmployeeDetailResponse>(url)
      .then(({ data }) => {
        if (data) {
          setSelectedEmployee(data.employee);
          setEmployeeSales(data.sales);
          setEmployeeTotals(data.totals);
        }
        setDetailLoading(false);
      })
      .catch(() => {
        setDetailLoading(false);
      });
  }, []);

  // Load pagos data on mount
  useEffect(() => {
    fetchPagosData();
  }, [fetchPagosData]);

  const [studioInfo, setStudioInfo] = useState<{
    name: string;
    subtitle: string;
    address: string;
    phone: string;
    email: string;
  }>({
    name: "Sakura Studio",
    subtitle: "Estudio de Belleza",
    address: "Av. Las Flores #456, Col. Bella Vista",
    phone: "Tel: 555-9876",
    email: "Email: info@sakurastudio.com",
  });

  // Cargar configuración del estudio
  useEffect(() => {
    apiFetch<{ name: string; subtitle: string; address: string; phone: string; email: string }>("/api/studio-settings")
      .then(({ data }) => {
        if (data && data.name) {
          setStudioInfo({
            name: data.name,
            subtitle: data.subtitle,
            address: data.address,
            phone: data.phone,
            email: data.email,
          });
        }
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback((startDate?: string, endDate?: string, isFilterReload?: boolean, isPerfReload?: boolean) => {
    if (isPerfReload) {
      setPerfLoading(true);
    } else if (isFilterReload) {
      setFilterLoading(true);
    } else {
      setLoading(true);
    }
    let url = "/api/reportes";
    if (startDate) {
      url += `?startDate=${encodeURIComponent(startDate)}`;
      if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
    }
    apiFetch<ReportData>(url)
      .then(({ data }) => {
        if (data) setData(data);
        setLoading(false);
        setFilterLoading(false);
        setPerfLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setFilterLoading(false);
        setPerfLoading(false);
      });
  }, []);

  // Carga inicial
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ─── Helper: etiqueta del filtro activo ─── */
  // NOTA: debe ir antes de los early returns para mantener orden consistente de hooks
  const activeFilterLabel = useCallback(() => {
    if (activeTab === "facturacion" && filterApplied && customStart) {
      const from = new Date(customStart + "T00:00:00").toLocaleDateString("es-MX");
      const to = customEnd
        ? new Date(customEnd + "T00:00:00").toLocaleDateString("es-MX")
        : "hoy";
      return `${from} - ${to}`;
    }
    if (activeTab === "rendimiento" && perfApplied && perfStart) {
      const from = new Date(perfStart + "T00:00:00").toLocaleDateString("es-MX");
      const to = perfEnd
        ? new Date(perfEnd + "T00:00:00").toLocaleDateString("es-MX")
        : "hoy";
      return `${from} - ${to}`;
    }
    return undefined;
  }, [activeTab, filterApplied, customStart, customEnd, perfApplied, perfStart, perfEnd]);

  const handleApplyFilter = () => {
    if (!customStart) return;
    setFilterApplied(true);
    fetchData(customStart, customEnd || undefined, true);
  };

  const handleClearFilter = () => {
    setCustomStart("");
    setCustomEnd("");
    setFilterApplied(false);
    fetchData();
  };

  const handleApplyPerfFilter = () => {
    if (!perfStart) return;
    setPerfApplied(true);
    setPerfPage(1);
    fetchData(perfStart, perfEnd || undefined, false, true);
  };

  const handleClearPerfFilter = () => {
    setPerfStart("");
    setPerfEnd("");
    setPerfApplied(false);
    setPerfPage(1);
    fetchData();
  };

  const handlePresetClick = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    setFilterApplied(true);
    fetchData(start, end, true);
  };

  const handlePerfPresetClick = (start: string, end: string) => {
    setPerfStart(start);
    setPerfEnd(end);
    setPerfApplied(true);
    setPerfPage(1);
    fetchData(start, end, false, true);
  };

  /* ─── Pagos handlers ─── */
  const handlePagosApplyFilter = () => {
    if (!pagosStart) return;
    setPagosFilterApplied(true);
    // Close detail view when filter changes
    setSelectedEmployee(null);
    setEmployeeSales(null);
    setEmployeeTotals(null);
    fetchPagosData(pagosStart, pagosEnd || undefined, true);
  };

  const handlePagosClearFilter = () => {
    setPagosStart("");
    setPagosEnd("");
    setPagosFilterApplied(false);
    setSelectedEmployee(null);
    setEmployeeSales(null);
    setEmployeeTotals(null);
    fetchPagosData();
  };

  const handlePagosPresetClick = (start: string, end: string) => {
    setPagosStart(start);
    setPagosEnd(end);
    setPagosFilterApplied(true);
    setSelectedEmployee(null);
    setEmployeeSales(null);
    setEmployeeTotals(null);
    fetchPagosData(start, end, true);
  };

  const handleEmployeeClick = (emp: EmployeePayment) => {
    fetchEmployeeDetail(emp.id, pagosFilterApplied ? pagosStart : undefined, pagosFilterApplied ? (pagosEnd || undefined) : undefined);
  };

  const handleBackToEmployees = () => {
    setSelectedEmployee(null);
    setEmployeeSales(null);
    setEmployeeTotals(null);
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fadeIn">
        <SkeletonPageHeader />
        <SkeletonBlock className="h-10 w-72" />
        <SkeletonStatsRow count={4} />
    </div>
  );
}

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-muted">Error al cargar los reportes</p>
    </div>
  );
}

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "facturacion",
      label: "Facturación",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "rendimiento",
      label: "Rendimiento",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
        </svg>
      ),
    },
    {          id: "pagos",
          label: "Pagos",
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125V9M17.25 6v9.75m0-9.78a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V6m0 0v.375c0 .621-.504 1.125-1.125 1.125H20.25M17.25 9h.375c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125H17.25m0 0h-.375c-.621 0-1.125-.504-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125H17.25m0 0V15M3.75 15v.75a.75.75 0 01-.75.75H2.25m0 0h.75" />
            </svg>
          ),
        },
        {
          id: "asistencia",
          label: "Asistencia",
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
      ];

  const billingPeriods: { key: keyof BillingData; label: string; desc: string }[] = [
    { key: "allTime", label: "Desde Siempre", desc: "Historial completo de ventas" },
    { key: "last3Months", label: "Últimos 3 Meses", desc: "Trimestre actual" },
    { key: "lastMonth", label: "Último Mes", desc: "Mes en curso" },
    { key: "lastWeek", label: "Última Semana", desc: "Esta semana" },
  ];

  const label = activeFilterLabel();
  const totalPerfPages = Math.ceil(data.employeePerformance.length / PERF_PAGE_SIZE);
  const paginatedEmployees = data.employeePerformance.slice(
    (perfPage - 1) * PERF_PAGE_SIZE,
    perfPage * PERF_PAGE_SIZE
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark">Reportes</h1>
          <p className="text-sm text-muted mt-1">Estadísticas y análisis del estudio</p>
        </div>
        {/* Botones de exportación */}
        <div className="flex items-center gap-2">
          {activeTab !== "pagos" && (
            <button
              onClick={async () => {
                if (activeTab === "facturacion") await exportFacturacionPDF(data, studioInfo, label);
                else await exportRendimientoPDF(data, studioInfo, label);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border border-border bg-white text-muted hover:bg-surface hover:text-dark hover:border-primary/40 transition-all duration-200"
              title="Exportar a PDF"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.04 48.04 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
              </svg>
              PDF
            </button>
          )}
          {activeTab !== "pagos" && (
            <button
              onClick={() => {
                if (activeTab === "facturacion") exportFacturacionExcel(data, label);
                else exportRendimientoExcel(data, label);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border border-border bg-white text-muted hover:bg-surface hover:text-dark hover:border-emerald-400/40 transition-all duration-200"
              title="Exportar a Excel"
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Excel
            </button>
          )}
          {/* Botones adicionales: Exportar solo el rango activo */}
          {activeTab !== "pagos" && ((activeTab === "facturacion" && filterApplied && data.billing.customRange) ||
            (activeTab === "rendimiento" && perfApplied)) ? (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              <button
                onClick={async () => {
                  if (activeTab === "facturacion") await exportFacturacionRangoPDF(data, studioInfo, label);
                  else await exportRendimientoFiltradoPDF(data, studioInfo, label);
                }}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border border-dashed border-primary/30 bg-primary-bg/40 text-primary hover:bg-primary-bg hover:border-primary/60 transition-all duration-200"
                title="Exportar solo el rango filtrado a PDF"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                </svg>
                Rango
              </button>
              <button
                onClick={() => {
                  if (activeTab === "facturacion") exportFacturacionRangoExcel(data, label);
                  else exportRendimientoFiltradoExcel(data, label);
                }}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border border-dashed border-emerald-300 bg-emerald-50/40 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 transition-all duration-200"
                title="Exportar solo el rango filtrado a Excel"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Rango
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white rounded-xl border border-border shadow-sm w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-dark hover:bg-surface"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════ TAB: FACTURACIÓN ═══════════════ */}
      {activeTab === "facturacion" && (
        <div className="space-y-4">
          {/* ─── Filtro de rango personalizado ─── */}
          <div className="card p-4">
            {/* Accesos rápidos */}
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-border">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetClick(preset.start(), preset.end())}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                    customStart === preset.start() && customEnd === preset.end() && filterApplied
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-muted border-border hover:border-primary/40 hover:text-dark hover:bg-surface"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-xs font-medium text-muted mb-1.5">Desde</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-xs font-medium text-muted mb-1.5">Hasta</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={handleApplyFilter}
                  disabled={!customStart || filterLoading}
                  className="btn-primary flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {filterLoading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                    </svg>
                  )}
                  {filterLoading ? "Cargando..." : "Filtrar"}
                </button>
                {filterApplied && (
                  <button
                    onClick={handleClearFilter}
                    className="btn-secondary flex-1 sm:flex-none"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
            {filterApplied && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-primary-bg border border-primary/20 rounded-lg text-sm text-primary font-medium">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mostrando datos del {new Date(customStart + "T00:00:00").toLocaleDateString("es-MX")}{" "}
                al {customEnd ? new Date(customEnd + "T00:00:00").toLocaleDateString("es-MX") : "hoy"}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {billingPeriods.map((period) => {
              const p = data.billing[period.key];
              if (!p) return null;
              return (
                <div key={period.key} className="card-hover p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-bg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-dark">{period.label}</p>
                        <p className="text-xs text-muted">{period.desc}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-dark">{formatter.format(p.total)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted bg-surface px-2 py-1 rounded-full border border-border">
                      {p.count} {p.count === 1 ? "venta" : "ventas"}
                    </span>
                    {p.count > 0 && (
                      <span className="text-xs text-muted bg-surface px-2 py-1 rounded-full border border-border">
                        Prom. {formatter.format(p.total / p.count)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Tarjeta de rango personalizado */}
            {data.billing.customRange && (
              <div className="card-hover p-5 ring-2 ring-primary/20 bg-primary-bg/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-dark">Rango Personalizado</p>
                      <p className="text-xs text-muted">
                        {new Date(data.billing.customRange.startDate + "T00:00:00").toLocaleDateString("es-MX")}{" "}
                        — {new Date(data.billing.customRange.endDate + "T00:00:00").toLocaleDateString("es-MX")}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-bold text-primary">{formatter.format(data.billing.customRange.total)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-white bg-primary px-2 py-1 rounded-full">
                    {data.billing.customRange.count} {data.billing.customRange.count === 1 ? "venta" : "ventas"}
                  </span>
                  {data.billing.customRange.count > 0 && (
                    <span className="text-xs text-muted bg-white/60 px-2 py-1 rounded-full border border-border">
                      Prom. {formatter.format(data.billing.customRange.total / data.billing.customRange.count)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Gráfica de barras simple */}
          <div className="card p-5">
            <div className="section-header">
              <span className="section-accent" />
              <h2 className="section-title">Comparativa de Facturación</h2>
            </div>
            <div className="space-y-4 mt-4">
              {(() => {
                // Armar lista de periodos incluyendo el personalizado si existe
                const periods = [
                  ...billingPeriods,
                  ...(data.billing.customRange
                    ? [{ key: "customRange" as const, label: "Rango Personalizado", desc: "" }]
                    : []),
                ];
                const maxTotal = Math.max(
                  ...periods.map((bp) => data.billing[bp.key as keyof BillingData]?.total ?? 0),
                  1
                );
                return periods.map((period) => {
                  const p = data.billing[period.key as keyof BillingData];
                  if (!p) return null;
                  const percentage = ((p as BillingPeriod).total / maxTotal) * 100;
                  const isCustom = period.key === "customRange";
                  return (
                    <div key={period.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-dark">{period.label}</span>
                        <span className={`text-sm font-semibold ${isCustom ? "text-primary" : "text-dark"}`}>
                          {formatter.format((p as BillingPeriod).total)}
                        </span>
                      </div>
                      <div className="h-3 bg-surface rounded-full overflow-hidden border border-border/50">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${
                            isCustom
                              ? "bg-gradient-to-r from-primary to-primary/70"
                              : "bg-gradient-to-r from-primary/40 to-primary/20"
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Gráfica de líneas: evolución mensual */}
          {data.monthlyEvolution.length > 0 && (
            <div className="card p-5">
              <div className="section-header">
                <span className="section-accent" />
                <h2 className="section-title">Evolución Mensual</h2>
              </div>
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={data.monthlyEvolution}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      tickLine={false}
                      axisLine={{ stroke: "#e5e7eb" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value: number) =>
                        value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`
                      }
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "#10b981" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === "Facturado") return [formatter.format(value), "Facturado"];
                        return [value, "Ventas"];
                      }}
                      labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                    />
                    <Line
                      yAxisId="left"
                      name="Facturado"
                      type="monotone"
                      dataKey="total"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                    />
                    <Line
                      yAxisId="right"
                      name="Ventas"
                      type="monotone"
                      dataKey="count"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                      activeDot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                      iconType="circle"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB: RENDIMIENTO ═══════════════ */}
      {activeTab === "rendimiento" && (
        <div className="space-y-4">
          {/* ─── Filtro de rango personalizado ─── */}
          <div className="card p-4">
            {/* Accesos rápidos */}
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-border">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePerfPresetClick(preset.start(), preset.end())}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                    perfStart === preset.start() && perfEnd === preset.end() && perfApplied
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-muted border-border hover:border-primary/40 hover:text-dark hover:bg-surface"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-xs font-medium text-muted mb-1.5">Desde</label>
                <input
                  type="date"
                  value={perfStart}
                  onChange={(e) => setPerfStart(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-xs font-medium text-muted mb-1.5">Hasta</label>
                <input
                  type="date"
                  value={perfEnd}
                  onChange={(e) => setPerfEnd(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={handleApplyPerfFilter}
                  disabled={!perfStart || perfLoading}
                  className="btn-primary flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {perfLoading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                    </svg>
                  )}
                  {perfLoading ? "Cargando..." : "Filtrar"}
                </button>
                {perfApplied && (
                  <button
                    onClick={handleClearPerfFilter}
                    className="btn-secondary flex-1 sm:flex-none"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
            {perfApplied && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-primary-bg border border-primary/20 rounded-lg text-sm text-primary font-medium">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mostrando rendimiento del {new Date(perfStart + "T00:00:00").toLocaleDateString("es-MX")}{" "}
                al {perfEnd ? new Date(perfEnd + "T00:00:00").toLocaleDateString("es-MX") : "hoy"}
              </div>
            )}
          </div>

          {/* Resumen cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card-hover p-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-muted font-medium">Empleadas Activas</p>
                  <p className="text-xl font-bold text-dark mt-0.5">{data.employeePerformance.length}</p>
                </div>
              </div>
            </div>
            <div className="card-hover p-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-muted font-medium">Total Facturado</p>
                  <p className="text-xl font-bold text-dark mt-0.5">
                    {formatter.format(data.employeePerformance.reduce((s, e) => s + e.totalBilled, 0))}
                  </p>
                </div>
              </div>
            </div>
            <div className="card-hover p-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-muted font-medium">Promedio por Empleada</p>
                  <p className="text-xl font-bold text-dark mt-0.5">
                    {data.employeePerformance.length > 0
                      ? formatter.format(
                          data.employeePerformance.reduce((s, e) => s + e.totalBilled, 0) /
                            data.employeePerformance.length
                        )
                      : "$0.00"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Gráfica de pastel: distribución por empleada */}
          {data.employeePerformance.length > 0 && (
            <div className="card p-5">
              <div className="section-header">
                <span className="section-accent" />
                <h2 className="section-title">Distribución de Facturación</h2>
              </div>
              <div className="flex flex-col lg:flex-row items-center gap-6 mt-4">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={data.employeePerformance}
                      dataKey="totalBilled"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {data.employeePerformance.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={PIE_COLORS[idx % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => [formatter.format(value), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Leyenda horizontal con porcentajes */}
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2.5 min-w-0">
                  {(() => {
                    const total = data.employeePerformance.reduce((s, e) => s + e.totalBilled, 0);
                    return data.employeePerformance.map((emp, idx) => {
                      const pct = total > 0 ? ((emp.totalBilled / total) * 100).toFixed(1) : "0";
                      return (
                        <div key={emp.id} className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                          />
                          <span className="text-sm text-dark font-medium">{emp.name}</span>
                          <span className="text-xs text-muted">{pct}%</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Tabla de rendimiento */}
          <div className="card overflow-hidden">
            <div className="p-5 pb-0">
              <div className="section-header">
                <span className="section-accent" />
                <h2 className="section-title">Rendimiento por Empleada</h2>
              </div>
            </div>

            {data.employeePerformance.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-bg flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-muted">Sin datos de rendimiento</p>
                <p className="text-xs text-muted/60 mt-1">Las ventas asociadas a empleadas aparecerán aquí</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3.5 px-5 text-left text-xs font-semibold text-muted uppercase tracking-wider">#</th>
                        <th className="pb-3.5 pr-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Empleada</th>
                        <th className="pb-3.5 pr-4 text-right text-xs font-semibold text-muted uppercase tracking-wider">Ventas</th>
                        <th className="pb-3.5 pr-4 text-right text-xs font-semibold text-muted uppercase tracking-wider">Total Facturado</th>
                        <th className="pb-3.5 pr-4 text-right text-xs font-semibold text-muted uppercase tracking-wider">Mes Actual</th>
                        <th className="pb-3.5 pr-5 text-right text-xs font-semibold text-muted uppercase tracking-wider">Ticket Promedio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {paginatedEmployees.map((emp, localIdx) => {
                        const maxBilled = Math.max(
                          ...data.employeePerformance.map((e) => e.totalBilled),
                          1
                        );
                        const barWidth = (emp.totalBilled / maxBilled) * 100;
                        // Número de fila global (no local de la página)
                        const globalIdx = (perfPage - 1) * PERF_PAGE_SIZE + localIdx;
                        return (
                          <tr key={emp.id} className="hover:bg-surface/80 transition-colors">
                            <td className="py-4 pl-5 pr-4">
                              <span className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-primary-bg text-primary">
                                {globalIdx + 1}
                              </span>
                            </td>
                            <td className="py-4 pr-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
                                  <span className="text-sm font-bold text-white">
                                    {emp.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-medium text-dark">{emp.name}</span>
                                  <div className="mt-1 h-2 bg-surface rounded-full overflow-hidden w-32 max-w-full">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
                                      style={{ width: `${barWidth}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 pr-4 text-right">
                              <span className="text-sm font-semibold text-dark">{emp.saleCount}</span>
                            </td>
                            <td className="py-4 pr-4 text-right">
                              <span className="text-sm font-bold text-dark">{formatter.format(emp.totalBilled)}</span>
                            </td>
                            <td className="py-4 pr-4 text-right">
                              <span className="text-sm font-semibold text-success">{formatter.format(emp.monthlySales)}</span>
                            </td>
                            <td className="py-4 pr-5 text-right">
                              <span className="text-sm text-muted">{formatter.format(emp.averageTicket)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {totalPerfPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                    <p className="text-xs text-muted">
                      {(perfPage - 1) * PERF_PAGE_SIZE + 1}&ndash;{Math.min(perfPage * PERF_PAGE_SIZE, data.employeePerformance.length)} de {data.employeePerformance.length} empleadas
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPerfPage((p) => Math.max(1, p - 1))}
                        disabled={perfPage === 1}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface text-muted hover:text-dark"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                        Anterior
                      </button>
                      <div className="flex items-center gap-0.5 px-1">
                        {Array.from({ length: totalPerfPages }, (_, i) => i + 1)
                          .filter((page) => {
                            if (page === 1 || page === totalPerfPages) return true;
                            if (Math.abs(page - perfPage) <= 1) return true;
                            return false;
                          })
                          .map((page, idx, arr) => {
                            const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                            return (
                              <span key={page} className="flex items-center">
                                {showEllipsis && (
                                  <span className="px-1.5 text-xs text-muted">···</span>
                                )}
                                <button
                                  onClick={() => setPerfPage(page)}
                                  className={`w-7 h-7 flex items-center justify-center text-xs font-medium rounded-lg transition-all duration-200 ${
                                    page === perfPage
                                      ? "bg-primary text-white shadow-sm"
                                      : "text-muted hover:bg-surface hover:text-dark"
                                  }`}
                                >
                                  {page}
                                </button>
                              </span>
                            );
                          })}
                      </div>
                      <button
                        onClick={() => setPerfPage((p) => Math.min(totalPerfPages, p + 1))}
                        disabled={perfPage === totalPerfPages}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface text-muted hover:text-dark"
                      >
                        Siguiente
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: PAGOS ═══════════════ */}
      {activeTab === "pagos" && (
        <div className="space-y-5">
          {/* ─── Filtro de rango ─── */}
          <div className="card p-4">
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-border">
              {PAGOS_QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePagosPresetClick(preset.start(), preset.end())}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                    pagosStart === preset.start() && pagosEnd === preset.end() && pagosFilterApplied
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-muted border-border hover:border-primary/40 hover:text-dark hover:bg-surface"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-xs font-medium text-muted mb-1.5">Desde</label>
                <input
                  type="date"
                  value={pagosStart}
                  onChange={(e) => setPagosStart(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-xs font-medium text-muted mb-1.5">Hasta</label>
                <input
                  type="date"
                  value={pagosEnd}
                  onChange={(e) => setPagosEnd(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={handlePagosApplyFilter}
                  disabled={!pagosStart || pagosFilterLoading}
                  className="btn-primary flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pagosFilterLoading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                    </svg>
                  )}
                  {pagosFilterLoading ? "Cargando..." : "Filtrar"}
                </button>
                {pagosFilterApplied && (
                  <button onClick={handlePagosClearFilter} className="btn-secondary flex-1 sm:flex-none">
                    Limpiar
                  </button>
                )}
              </div>
            </div>
            {pagosFilterApplied && pagosStart && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-primary-bg border border-primary/20 rounded-lg text-sm text-primary font-medium">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mostrando pagos del {new Date(pagosStart + "T00:00:00").toLocaleDateString("es-MX")} – {pagosEnd ? new Date(pagosEnd + "T00:00:00").toLocaleDateString("es-MX") : "hoy"}
              </div>
            )}
          </div>

          {/* Detail view — selected employee */}
          {selectedEmployee && employeeSales ? (
            <div className="card overflow-hidden">
              {/* Back button + header */}
              <div className="p-5 pb-0">
                <button
                  onClick={handleBackToEmployees}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-dark transition-colors mb-3"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Volver a todas las empleadas
                </button>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
                      <span className="text-lg font-bold text-white">{selectedEmployee.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-dark truncate">{selectedEmployee.name}</h2>
                      <p className="text-xs text-muted">Detalle de ventas — {employeeSales.length} {employeeSales.length === 1 ? "venta" : "ventas"}</p>
                    </div>
                  </div>
                  {/* Botones de exportación */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={async () => {
                        await exportPagosDetailPDF(
                          selectedEmployee,
                          employeeSales,
                          employeeTotals ?? { totalUsd: 0, totalBs: 0, saleCount: 0 },
                          studioInfo,
                          pagosFilterApplied && pagosStart
                            ? `${new Date(pagosStart + "T00:00:00").toLocaleDateString("es-MX")} – ${pagosEnd ? new Date(pagosEnd + "T00:00:00").toLocaleDateString("es-MX") : "hoy"}`
                            : undefined
                        );
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-border bg-white text-muted hover:bg-surface hover:text-dark hover:border-primary/40 transition-all duration-200"
                      title="Exportar a PDF"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.04 48.04 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                      </svg>
                      PDF
                    </button>
                    <button
                      onClick={() => {
                        exportPagosDetailExcel(
                          selectedEmployee,
                          employeeSales,
                          employeeTotals ?? { totalUsd: 0, totalBs: 0, saleCount: 0 }
                        );
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-border bg-white text-muted hover:bg-surface hover:text-dark hover:border-emerald-400/40 transition-all duration-200"
                      title="Exportar a Excel"
                    >
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      Excel
                    </button>
                  </div>
                </div>
                {/* Summary badges */}
                <div className="flex flex-wrap gap-3 mt-4 pb-4 border-b border-border">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-xs text-muted">Total USD:</span>
                    <span className="text-sm font-bold text-emerald-700">${(employeeTotals?.totalUsd ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-xs text-muted">Total Bs:</span>
                    <span className="text-sm font-bold text-amber-700">Bs {(employeeTotals?.totalBs ?? 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border">
                    <span className="text-xs text-muted">Servicios:</span>
                    <span className="text-sm font-bold text-dark">{employeeSales.reduce((s, sale) => s + sale.services.reduce((ss, sv) => ss + sv.quantity, 0), 0)}</span>
                  </div>
                </div>
              </div>

              {/* Sales table */}
              {employeeSales.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted">Sin ventas en este periodo</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3.5 px-5 text-left text-xs font-semibold text-muted uppercase tracking-wider">#</th>
                        <th className="pb-3.5 pr-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Fecha</th>
                      <th className="pb-3.5 pr-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Hora</th>
                        <th className="pb-3.5 pr-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Cliente</th>
                        <th className="pb-3.5 pr-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Servicios</th>
                        <th className="pb-3.5 pr-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Método de Pago</th>
                        <th className="pb-3.5 pr-4 text-right text-xs font-semibold text-muted uppercase tracking-wider">Monto USD</th>
                        <th className="pb-3.5 pr-5 text-right text-xs font-semibold text-muted uppercase tracking-wider">Monto Bs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {employeeSales.map((sale, idx) => {
                        const servicesStr = sale.services.map((sv) => `${sv.quantity}x ${sv.name}`).join(", ");
                        const pmLabels: Record<string, string> = {
                          EFECTIVO: "Efectivo",
                          TARJETA: "Tarjeta",
                          TRANSFERENCIA: "Transferencia",
                          "PAGO MOVIL": "Pago Móvil",
                          OTRO: "Otro",
                        };
                        return (
                          <tr key={sale.id} className="hover:bg-surface/80 transition-colors">
                            <td className="py-3.5 pl-5 pr-4">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-primary-bg text-primary">
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-3.5 pr-4 whitespace-nowrap">
                              <span className="text-sm text-dark font-medium">
                                {new Date(sale.date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </td>
                            <td className="py-3.5 pr-4 whitespace-nowrap">
                              <span className="text-sm text-muted">
                                {new Date(sale.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </td>
                            <td className="py-3.5 pr-4">
                              <span className="text-sm text-dark">{sale.clientName || "—"}</span>
                            </td>
                            <td className="py-3.5 pr-4">
                              <span className="text-xs text-muted">{servicesStr}</span>
                            </td>
                            <td className="py-3.5 pr-4">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-white border border-border text-muted">
                                {pmLabels[sale.paymentMethod || ""] || sale.paymentMethod || "—"}
                              </span>
                            </td>
                            <td className="py-3.5 pr-4 text-right">
                              <span className="text-sm font-bold text-emerald-600">${sale.total.toFixed(2)}</span>
                            </td>
                            <td className="py-3.5 pr-5 text-right">
                              {sale.totalBs != null ? (
                                <span className="text-sm font-bold text-amber-600">Bs {sale.totalBs.toFixed(2)}</span>
                              ) : (
                                <span className="text-xs text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {employeeSales.length > 1 && (
                      <tfoot>
                        <tr className="bg-surface/80 border-t-2 border-primary/20">
                          <td colSpan={5} className="py-3.5 pl-5 pr-4 text-right text-xs font-semibold text-muted uppercase tracking-wider">
                            Totales
                          </td>
                          <td className="py-3.5 pr-4 text-right">
                            <span className="text-sm font-bold text-emerald-600">
                              ${(employeeTotals?.totalUsd ?? 0).toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3.5 pr-5 text-right">
                            {(employeeTotals?.totalBs ?? 0) > 0 ? (
                              <span className="text-sm font-bold text-amber-600">
                                Bs {(employeeTotals?.totalBs ?? 0).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          ) : detailLoading ? (
            <div className="card p-12 text-center">
              <svg className="w-8 h-8 animate-spin mx-auto text-primary mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-muted">Cargando detalle de empleada...</p>
            </div>
          ) : null}

          {/* Main table — only when not in detail view */}
          {!selectedEmployee && !detailLoading && (
            <>
              {/* Stats cards */}
              {pagosData && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="card-hover p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-muted font-medium">Empleadas</p>
                        <p className="text-xl font-bold text-dark mt-0.5">{pagosData.totals.totalEmployees}</p>
                      </div>
                    </div>
                  </div>
                  <div className="card-hover p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-muted font-medium">Total USD</p>
                        <p className="text-xl font-bold text-dark mt-0.5">${pagosData.totals.totalUsd.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="card-hover p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-muted font-medium">Total Bs</p>
                        <p className="text-xl font-bold text-dark mt-0.5">Bs {pagosData.totals.totalBs.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="card-hover p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-muted font-medium">Total Combinado</p>
                        <p className="text-xl font-bold text-dark mt-0.5">
                          ${pagosData.totals.totalUsd.toFixed(2)} + Bs {pagosData.totals.totalBs.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Employee table */}
              <div className="card overflow-hidden">
                <div className="p-5 pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="section-header">
                      <span className="section-accent" />
                      <h2 className="section-title">Detalle por Empleada</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (!pagosData) return;
                          await exportPagosEmployeeTablePDF(
                            pagosData,
                            commissionPct,
                            studioInfo,
                            pagosFilterApplied && pagosStart
                              ? `${new Date(pagosStart + "T00:00:00").toLocaleDateString("es-MX")} – ${pagosEnd ? new Date(pagosEnd + "T00:00:00").toLocaleDateString("es-MX") : "hoy"}`
                              : undefined
                          );
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-border bg-white text-muted hover:bg-surface hover:text-dark hover:border-primary/40 transition-all duration-200"
                        title="Exportar a PDF"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.04 48.04 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                        </svg>
                        PDF
                      </button>
                      <button
                        onClick={() => {
                          if (!pagosData) return;
                          exportPagosEmployeeTableExcel(pagosData, commissionPct);
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-border bg-white text-muted hover:bg-surface hover:text-dark hover:border-emerald-400/40 transition-all duration-200"
                        title="Exportar a Excel"
                      >
                        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        Excel
                      </button>
                      {/* Comisión % */}
                      <div className="flex items-center gap-3 bg-surface px-4 py-2 rounded-xl border border-border">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
                        </svg>
                        Comisión:
                      </div>
                      <div className="relative w-20">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={commissionPct}
                          onChange={(e) => setCommissionPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                          className="input py-1.5 pr-7 text-sm font-semibold text-center"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">%</span>
                      </div>
                      <div className="flex gap-1">
                        {[30, 50, 70].map((pct) => (
                          <button
                            key={pct}
                            onClick={() => setCommissionPct(pct)}
                            className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                              commissionPct === pct
                                ? "bg-primary text-white"
                                : "bg-white text-muted border border-border hover:border-primary/40"
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                    </div>
                  </div>
                </div>

                {!pagosData || pagosData.employees.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
                      <svg className="w-8 h-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-muted">Sin datos de pagos</p>
                    <p className="text-xs text-muted/60 mt-1">Las ventas asociadas a empleadas aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="pb-3.5 px-5 text-left text-xs font-semibold text-muted uppercase tracking-wider">#</th>
                          <th className="pb-3.5 pr-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Empleada</th>
                          <th className="pb-3.5 pr-4 text-center text-xs font-semibold text-muted uppercase tracking-wider">Ventas</th>
                          <th className="pb-3.5 pr-4 text-center text-xs font-semibold text-muted uppercase tracking-wider">USD</th>
                          <th className="pb-3.5 pr-4 text-right text-xs font-semibold text-muted uppercase tracking-wider">Total USD</th>
                          <th className="pb-3.5 pr-4 text-center text-xs font-semibold text-muted uppercase tracking-wider">Bs</th>
                          <th className="pb-3.5 pr-4 text-right text-xs font-semibold text-muted uppercase tracking-wider">Total Bs</th>
                          <th className="pb-3.5 pr-4 text-right text-xs font-semibold text-muted uppercase tracking-wider">Comisión USD</th>
                          <th className="pb-3.5 pr-5 text-right text-xs font-semibold text-muted uppercase tracking-wider">Comisión Bs</th>
                        </tr>
                      </thead>
                      <tfoot>
                        <tr className="bg-surface/80 border-t-2 border-primary/20">
                          <td colSpan={7} className="py-3.5 pl-5 pr-4 text-right text-xs font-semibold text-muted uppercase tracking-wider">
                            Comisión Total ({commissionPct}%)
                          </td>
                          <td className="py-3.5 pr-4 text-right">
                            <span className="text-sm font-bold text-emerald-600">
                              ${(pagosData.totals.totalUsd * (commissionPct / 100)).toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3.5 pr-5 text-right">
                            {pagosData.totals.totalBs > 0 ? (
                              <span className="text-sm font-bold text-amber-600">
                                Bs {(pagosData.totals.totalBs * (commissionPct / 100)).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                      <tbody className="divide-y divide-border/50">
                        {pagosData.employees.map((emp, idx) => {
                          const maxCombined = Math.max(
                            ...pagosData.employees.map((e) => e.totalUsd + e.totalBs),
                            1
                          );
                          const barWidth = ((emp.totalUsd + emp.totalBs) / maxCombined) * 100;
                          return (
                            <tr
                              key={emp.id}
                              onClick={() => handleEmployeeClick(emp)}
                              className="hover:bg-surface/80 transition-colors cursor-pointer"
                            >
                              <td className="py-4 pl-5 pr-4">
                                <span className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-primary-bg text-primary">
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-4 pr-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
                                    <span className="text-sm font-bold text-white">
                                      {emp.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-sm font-medium text-dark">{emp.name}</span>
                                    <div className="mt-1 h-2 bg-surface rounded-full overflow-hidden w-32 max-w-full">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
                                        style={{ width: `${barWidth}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 pr-4 text-center">
                                <span className="text-sm font-semibold text-dark">{emp.saleCount}</span>
                              </td>
                              <td className="py-4 pr-4 text-center">
                                {emp.usdCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    {emp.usdCount}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted">—</span>
                                )}
                              </td>
                              <td className="py-4 pr-4 text-right">
                                <span className="text-sm font-bold text-dark">${emp.totalUsd.toFixed(2)}</span>
                              </td>
                              <td className="py-4 pr-4 text-center">
                                {emp.bsCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    {emp.bsCount}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted">—</span>
                                )}
                              </td>
                              <td className="py-4 pr-4 text-right">
                                {emp.totalBs > 0 ? (
                                  <span className="text-sm font-bold text-amber-700">Bs {emp.totalBs.toFixed(2)}</span>
                                ) : (
                                  <span className="text-xs text-muted">—</span>
                                )}
                              </td>
                              {/* Comisión */}
                              <td className="py-4 pr-4 text-right">
                                <span className="text-sm font-bold text-emerald-600">
                                  ${(emp.totalUsd * (commissionPct / 100)).toFixed(2)}
                                </span>
                              </td>
                              <td className="py-4 pr-5 text-right">
                                {emp.totalBs > 0 ? (
                                  <span className="text-sm font-bold text-amber-600">
                                    Bs {(emp.totalBs * (commissionPct / 100)).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}


      {/* =========== TAB: ASISTENCIA =========== */}
      {(activeTab as string) === "asistencia" && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="card p-4">
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-border">
              {[
                { label: "Ultimos 7 dias", start: () => { const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().split("T")[0]; }, end: () => new Date().toISOString().split("T")[0] },
                { label: "Este mes", start: () => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; }, end: () => new Date().toISOString().split("T")[0] },
                { label: "Ultimos 30 dias", start: () => { const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().split("T")[0]; }, end: () => new Date().toISOString().split("T")[0] },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => {
                    const s = preset.start();
                    const e = preset.end();
                    setAttendanceStart(s);
                    setAttendanceEnd(e);
                    setAttendanceFilterApplied(true);
                    fetchAttendanceData(s, e, true);
                  }}
                  className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border " + (
                    attendanceFilterApplied && attendanceStart === preset.start() && attendanceEnd === preset.end()
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white text-muted border-border hover:border-primary/40 hover:text-dark hover:bg-surface"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-xs font-medium text-muted mb-1.5">Desde</label>
                <input type="date" value={attendanceStart} onChange={(e) => setAttendanceStart(e.target.value)} className="input" />
              </div>
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-xs font-medium text-muted mb-1.5">Hasta</label>
                <input type="date" value={attendanceEnd} onChange={(e) => setAttendanceEnd(e.target.value)} className="input" />
              </div>
              <div className="flex-1 w-full sm:w-auto">
                <label className="block text-xs font-medium text-muted mb-1.5">Empleada</label>
                <select value={attendanceEmployeeFilter} onChange={(e) => setAttendanceEmployeeFilter(e.target.value)} className="input">
                  <option value="">Todas</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => { if (!attendanceStart) return; setAttendanceFilterApplied(true); fetchAttendanceData(attendanceStart, attendanceEnd || undefined, true); }}
                  disabled={!attendanceStart || attendanceFilterLoading}
                  className="btn-primary flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {attendanceFilterLoading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                    </svg>
                  )}
                  {attendanceFilterLoading ? "Cargando..." : "Filtrar"}
                </button>
                {attendanceFilterApplied && (
                  <button onClick={() => { setAttendanceStart(""); setAttendanceEnd(""); setAttendanceFilterApplied(false); fetchAttendanceData(); }}
                    className="btn-secondary flex-1 sm:flex-none"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
            {attendanceFilterApplied && attendanceStart && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-primary-bg border border-primary/20 rounded-lg text-sm text-primary font-medium">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mostrando asistencias del {new Date(attendanceStart + "T00:00:00").toLocaleDateString("es-MX")} al {attendanceEnd ? new Date(attendanceEnd + "T00:00:00").toLocaleDateString("es-MX") : "hoy"}
              </div>
            )}
          </div>

          {/* Stats cards */}
          {attendanceData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card-hover p-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-muted font-medium">Registros</p>
                    <p className="text-xl font-bold text-dark mt-0.5">{attendanceData.stats.totalRecords}</p>
                  </div>
                </div>
              </div>
              <div className="card-hover p-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-muted font-medium">Empleadas distintas</p>
                    <p className="text-xl font-bold text-dark mt-0.5">{attendanceData.stats.uniqueEmployees}</p>
                  </div>
                </div>
              </div>
              <div className="card-hover p-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-muted font-medium">Dias con registro</p>
                    <p className="text-xl font-bold text-dark mt-0.5">{attendanceData.stats.totalDays}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="p-5 pb-0">
              <div className="section-header">
                <span className="section-accent" />
                <h2 className="section-title">Historial de Asistencias</h2>
              </div>
            </div>

            {attendanceLoading ? (
              <div className="text-center py-12">
                <svg className="w-8 h-8 animate-spin mx-auto text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm text-muted mt-3">Cargando historial...</p>
              </div>
            ) : !attendanceData || attendanceData.records.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-bg flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-muted">Sin registros de asistencia</p>
                <p className="text-xs text-muted/60 mt-1">Las empleadas deben marcar entrada desde el Dashboard</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3.5 px-5 text-left text-xs font-semibold text-muted uppercase tracking-wider">#</th>
                      <th className="pb-3.5 pr-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Empleada</th>
                      <th className="pb-3.5 pr-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Fecha</th>
                      <th className="pb-3.5 pr-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Ubicacion</th>
                      <th className="pb-3.5 pr-4 text-right text-xs font-semibold text-muted uppercase tracking-wider">Precision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {attendanceData.records.map((rec, idx) => (
                      <tr key={rec.id} className="hover:bg-surface/80 transition-colors">
                        <td className="py-3.5 pl-5 pr-4">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-primary-bg text-primary">{idx + 1}</span>
                        </td>
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
                              <span className="text-xs font-bold text-white">{rec.employeeName.charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="text-sm font-medium text-dark">{rec.employeeName}</span>
                          </div>
                        </td>
                        <td className="py-3.5 pr-4 whitespace-nowrap">
                          <span className="text-sm text-dark">{new Date(rec.date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</span>
                        </td>
                        <td className="py-3.5 pr-4 whitespace-nowrap">
                          <span className="text-sm text-dark font-medium">{new Date(rec.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                        </td>
                        <td className="py-3.5 pr-4">
                          {rec.latitude && rec.longitude ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                              <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                              </svg>
                              {rec.latitude.toFixed(4)}, {rec.longitude.toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">&mdash;</span>
                          )}
                        </td>
                        <td className="py-3.5 pr-5 text-right">
                          {rec.accuracy != null ? (
                            <span className="text-xs text-muted">{Math.round(rec.accuracy)}m</span>
                          ) : (
                            <span className="text-xs text-muted">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

        </div>
      )}
    </div>
  );
}
