/**
 * Server-side input validation helpers for API routes.
 * Lightweight validation without external dependencies.
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate required fields exist and are non-empty.
 */
export function required(data: Record<string, unknown>, fields: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const field of fields) {
    const value = data[field];
    if (value === undefined || value === null || value === "") {
      errors.push({ field, message: `${field} es obligatorio` });
    }
  }
  return errors;
}

/**
 * Validate a field is a number within optional bounds.
 */
export function isNumber(
  data: Record<string, unknown>,
  field: string,
  opts?: { min?: number; max?: number; required?: boolean }
): ValidationError[] {
  const errors: ValidationError[] = [];
  const value = data[field];

  if (value === undefined || value === null || value === "") {
    if (opts?.required !== false) {
      errors.push({ field, message: `${field} es obligatorio` });
    }
    return errors;
  }

  const num = Number(value);
  if (isNaN(num)) {
    errors.push({ field, message: `${field} debe ser un número` });
    return errors;
  }

  if (opts?.min !== undefined && num < opts.min) {
    errors.push({ field, message: `${field} debe ser al menos ${opts.min}` });
  }
  if (opts?.max !== undefined && num > opts.max) {
    errors.push({ field, message: `${field} no puede exceder ${opts.max}` });
  }

  return errors;
}

/**
 * Validate a string length.
 */
export function isString(
  data: Record<string, unknown>,
  field: string,
  opts?: { minLength?: number; maxLength?: number; required?: boolean; pattern?: RegExp }
): ValidationError[] {
  const errors: ValidationError[] = [];
  const value = data[field];

  if (value === undefined || value === null || value === "") {
    if (opts?.required !== false) {
      errors.push({ field, message: `${field} es obligatorio` });
    }
    return errors;
  }

  if (typeof value !== "string") {
    errors.push({ field, message: `${field} debe ser texto` });
    return errors;
  }

  if (opts?.minLength !== undefined && value.length < opts.minLength) {
    errors.push({ field, message: `${field} debe tener al menos ${opts.minLength} caracteres` });
  }
  if (opts?.maxLength !== undefined && value.length > opts.maxLength) {
    errors.push({ field, message: `${field} no puede exceder ${opts.maxLength} caracteres` });
  }
  if (opts?.pattern && !opts.pattern.test(value)) {
    errors.push({ field, message: `${field} tiene un formato inválido` });
  }

  return errors;
}

/**
 * Validate an email format.
 */
export function isEmail(data: Record<string, unknown>, field: string): ValidationError[] {
  const value = data[field];
  if (!value) return []; // optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(value))) {
    return [{ field, message: `${field} debe ser un email válido` }];
  }
  return [];
}

/**
 * Validate a value is one of allowed options.
 */
export function oneOf(
  data: Record<string, unknown>,
  field: string,
  allowed: readonly string[]
): ValidationError[] {
  const value = data[field];
  if (!value) return [];
  if (!allowed.includes(String(value))) {
    return [{ field, message: `${field} debe ser uno de: ${allowed.join(", ")}` }];
  }
  return [];
}

/**
 * Run multiple validation checks and return combined result.
 */
export function validate(...errorArrays: ValidationError[][]): ValidationResult {
  const errors = errorArrays.flat();
  return { valid: errors.length === 0, errors };
}

/**
 * Helper to return 400 with validation errors from a NextResponse.
 * Import this in route handlers.
 */
export function validationErrorResponse(errors: ValidationError[]) {
  const { NextResponse } = require("next/server");
  return NextResponse.json(
    { error: "Datos inválidos", details: errors },
    { status: 400 }
  );
}
