/**
 * Esquemas de validación compartidos con Zod.
 * Se usan junto a validate.ts (validación manual existente).
 * 
 * Estos esquemas permiten:
 * 1. Validar datos de entrada en API routes
 * 2. Inferir tipos TypeScript automáticamente
 * 3. Compartir tipos entre frontend y backend
 * 
 * Para usar en una API route:
 *   import { serviceSchema } from "@/lib/schemas";
 *   const result = serviceSchema.safeParse(body);
 *   if (!result.success) {
 *     return NextResponse.json({ error: "Datos inválidos", details: result.error.flatten() }, { status: 400 });
 *   }
 */

import { z } from "zod";

// ─── Helpers ──────────────────────────────────────────

/** Número positivo opcional */
const positiveOptional = z.coerce.number().min(0).optional();

/** String que no puede estar vacío */
const nonEmpty = z.string().min(1, "Este campo es obligatorio");

// ─── Enums compartidos ────────────────────────────────

export const SERVICE_CATEGORIES = [
  "MAQUILLAJE",
  "CEJAS",
  "PESTAÑAS",
  "MANICURE",
  "GENERAL",
] as const;

export const PAYMENT_METHODS = [
  "EFECTIVO",
  "TARJETA",
  "TRANSFERENCIA",
  "PAGO MOVIL",
  "OTRO",
] as const;

export const EXPENSE_CATEGORIES = [
  "ALQUILER",
  "SERVICIOS",
  "PRODUCTOS",
  "MANTENIMIENTO",
  "SUELDO",
  "MARKETING",
  "OTRO",
] as const;

export const APPOINTMENT_STATUSES = [
  "PENDIENTE",
  "CONFIRMADA",
  "COMPLETADA",
  "CANCELADA",
] as const;

export const EMPLOYEE_ROLES = [
  "ADMIN",
  "EMPLEADA",
  "ESTETICISTA",
] as const;

export const PRODUCT_CATEGORIES = [
  "MAQUILLAJE",
  "CEJAS",
  "PESTAÑAS",
  "MANICURE",
  "GENERAL",
] as const;

// ─── Schemas ──────────────────────────────────────────

export const serviceSchema = z.object({
  name: nonEmpty.max(100),
  description: z.string().max(500).optional().default(""),
  category: z.enum(SERVICE_CATEGORIES),
  price: z.coerce.number().min(0, "El precio debe ser mayor o igual a 0"),
  duration: z.coerce.number().int().min(5, "La duración mínima es 5 minutos"),
  commissionPercent: z.coerce.number().min(0).max(100).default(0),
});

export const clientSchema = z.object({
  name: nonEmpty.max(150),
  phone: z.string().max(20).optional().default(""),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().max(500).optional().default(""),
});

export const employeeSchema = z.object({
  name: nonEmpty.max(100),
  phone: z.string().max(20).optional().default(""),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  role: z.enum(EMPLOYEE_ROLES).default("EMPLEADA"),
  password: z.string().min(4, "La contraseña debe tener al menos 4 caracteres").optional().or(z.literal("")),
  startDate: z.string().optional().default(""),
  notes: z.string().max(500).optional().default(""),
  active: z.boolean().optional().default(true),
});

export const appointmentSchema = z.object({
  clientId: z.coerce.number().int().positive(),
  serviceId: z.coerce.number().int().positive(),
  employeeId: z.coerce.number().int().positive().optional().nullable(),
  date: z.string().min(1, "La fecha es obligatoria"),
  notes: z.string().max(500).optional().default(""),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});

export const saleItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).default(1),
  price: z.coerce.number().min(0),
  serviceId: z.coerce.number().int().positive().optional().nullable(),
  productId: z.coerce.number().int().positive().optional().nullable(),
});

export const paymentSplitSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  amount: z.coerce.number().min(0.01, "El monto debe ser mayor a 0"),
  amountBs: z.coerce.number().min(0).optional().nullable(),
});

export const saleSchema = z.object({
  total: z.coerce.number().min(0),
  totalBs: z.coerce.number().min(0).optional().nullable(),
  exchangeRate: z.coerce.number().min(0).optional().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  notes: z.string().max(500).optional().nullable(),
  clientId: z.coerce.number().int().positive().optional().nullable(),
  employeeId: z.coerce.number().int().positive().optional().nullable(),
  serviceDate: z.string().optional().nullable(),
  items: z.array(saleItemSchema).min(1, "Debe haber al menos un item"),
  paymentSplits: z.array(paymentSplitSchema).optional(),
  appointmentId: z.coerce.number().int().positive().optional(),
});

export const expenseSchema = z.object({
  concept: nonEmpty.max(200),
  amount: z.coerce.number().min(0.01, "El monto debe ser mayor a 0"),
  amountBs: z.coerce.number().min(0).optional().nullable(),
  category: z.enum(EXPENSE_CATEGORIES),
  date: z.string().min(1),
  registeredBy: z.string().max(100).optional().default(""),
  notes: z.string().max(500).optional().default(""),
});

export const productSchema = z.object({
  name: nonEmpty.max(100),
  description: z.string().max(500).optional().default(""),
  quantity: z.coerce.number().int().min(0),
  minStock: z.coerce.number().int().min(1),
  price: z.coerce.number().min(0).optional().nullable(),
  category: z.enum(PRODUCT_CATEGORIES).optional().default("GENERAL"),
});

export const studioSettingsSchema = z.object({
  name: nonEmpty.max(100),
  subtitle: z.string().max(200).optional().default(""),
  address: z.string().max(300).optional().default(""),
  phone: z.string().max(50).optional().default(""),
  email: z.string().max(100).optional().default(""),
  workLatitude: z.coerce.number().optional().nullable(),
  workLongitude: z.coerce.number().optional().nullable(),
  workLocationName: z.string().max(200).optional().nullable(),
  workRadius: z.coerce.number().min(10).max(10000).optional().nullable(),
});

export const waTemplateSchema = z.object({
  label: nonEmpty.max(50),
  message: nonEmpty.max(500),
});

export const loginSchema = z.object({
  name: nonEmpty,
  password: nonEmpty.min(4),
});

export const changePasswordSchema = z.object({
  currentPassword: nonEmpty,
  newPassword: z.string().min(4, "La nueva contraseña debe tener al menos 4 caracteres"),
});

// ─── Tipos inferidos ──────────────────────────────────

export type ServiceInput = z.infer<typeof serviceSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type AppointmentInput = z.infer<typeof appointmentSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type PaymentSplitInput = z.infer<typeof paymentSplitSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type StudioSettingsInput = z.infer<typeof studioSettingsSchema>;
export type WATemplateInput = z.infer<typeof waTemplateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
