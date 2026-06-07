"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/useApiQuery";
import { apiFetch } from "@/lib/api";
import { SkeletonPageHeader, SkeletonGrid } from "@/components/LoadingSkeleton";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Employee {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  active: boolean;
  startDate: string | null;
  notes: string | null;
  createdAt: string;
}

interface CommissionDetail {
  serviceName: string;
  price: number;
  commissionPercent: number;
  commissionAmount: number;
  date: string;
}

interface EmployeeCommission {
  employeeId: number;
  employeeName: string;
  monthlyCommission: number;
  weeklyCommission: number;
  totalServices: number;
  details: CommissionDetail[];
}

const roles = ["EMPLEADA", "ESTETICISTA", "ADMIN"];

const roleConfig: Record<string, { color: string; bg: string; icon: string }> = {
  ADMIN: { color: "text-danger", bg: "bg-danger-bg", icon: "⭐" },
  ESTETICISTA: { color: "text-primary", bg: "bg-primary-bg", icon: "💅" },
  EMPLEADA: { color: "text-warning", bg: "bg-warning-bg", icon: "👩‍💼" },
};

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  role: "EMPLEADA",
  startDate: "",
  notes: "",
  password: "",
  active: true,
};

export default function EmpleadasPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: employees = [], isLoading } = useApiQuery<Employee[]>(["empleadas"], "/api/empleadas", {
    refetchInterval: 15000,
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [commissions, setCommissions] = useState<EmployeeCommission[]>([]);
  const [commissionsLoading, setCommissionsLoading] = useState(true);
  const [showCommissions, setShowCommissions] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ─── Availability State ───
  const [availEmployee, setAvailEmployee] = useState<Employee | null>(null);
  const [availSchedule, setAvailSchedule] = useState<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>([]);
  const [availSaving, setAvailSaving] = useState(false);

  const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const loadAvailability = async (employeeId: number) => {
    const { data } = await apiFetch<Array<{ id: number; dayOfWeek: number; startTime: string; endTime: string }>>(
      `/api/empleadas/${employeeId}/availability`
    );
    if (data) {
      setAvailSchedule(data.map((a) => ({ dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime })));
    } else {
      // Default: L-V 09:00-18:00, S 09:00-14:00
      setAvailSchedule([
        { dayOfWeek: 1, startTime: "09:00", endTime: "18:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "18:00" },
        { dayOfWeek: 3, startTime: "09:00", endTime: "18:00" },
        { dayOfWeek: 4, startTime: "09:00", endTime: "18:00" },
        { dayOfWeek: 5, startTime: "09:00", endTime: "18:00" },
        { dayOfWeek: 6, startTime: "09:00", endTime: "14:00" },
      ]);
    }
  };

  const openAvailability = (employee: Employee) => {
    setAvailEmployee(employee);
    loadAvailability(employee.id);
  };

  const closeAvailability = () => {
    setAvailEmployee(null);
    setAvailSchedule([]);
  };

  const saveAvailability = async () => {
    if (!availEmployee) return;
    setAvailSaving(true);
    const { data, error: apiError } = await apiFetch(`/api/empleadas/${availEmployee.id}/availability`, {
      method: "PUT",
      body: JSON.stringify(availSchedule),
    });
    if (data) {
      showToast("success", "Horarios guardados exitosamente");
      closeAvailability();
    } else {
      showToast("error", apiError || "Error al guardar horarios");
    }
    setAvailSaving(false);
  };

  const updateDaySchedule = (dayOfWeek: number, field: "startTime" | "endTime", value: string) => {
    setAvailSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d))
    );
  };

  const toggleDayEnabled = (dayOfWeek: number, enabled: boolean) => {
    if (enabled) {
      setAvailSchedule((prev) => [...prev, { dayOfWeek, startTime: "09:00", endTime: "18:00" }]);
    } else {
      setAvailSchedule((prev) => prev.filter((d) => d.dayOfWeek !== dayOfWeek));
    }
  };

  useEffect(() => {
    apiFetch<EmployeeCommission[]>("/api/empleadas/commissions")
      .then(({ data }) => {
        if (data) setCommissions(data);
        setCommissionsLoading(false);
      })
      .catch(() => setCommissionsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar contraseña en el frontend antes de enviar
    if (form.password && form.password.length < 4) {
      showToast("error", "La contraseña debe tener al menos 4 caracteres");
      return;
    }

    setSubmitting(true);
    const url = editingId ? `/api/empleadas/${editingId}` : "/api/empleadas";
    const method = editingId ? "PUT" : "POST";

    const { data, error: apiError } = await apiFetch(url, {
      method,
      body: JSON.stringify(form),
    });

    if (data) {
      showToast("success", editingId ? "Empleada actualizada exitosamente" : "Empleada creada exitosamente");
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["empleadas"] });
    } else {
      showToast("error", apiError || "Error al guardar la empleada");
    }
    setSubmitting(false);
  };

  const handleEdit = (employee: Employee) => {
    setForm({
      name: employee.name,
      phone: employee.phone || "",
      email: employee.email || "",
      role: employee.role,
      startDate: employee.startDate ? employee.startDate.split("T")[0] : "",
      notes: employee.notes || "",
      password: "",
      active: employee.active,
    });
    setEditingId(employee.id);
    setShowForm(true);
  };

  const handleToggleActive = async (employee: Employee) => {
    const { data } = await apiFetch(`/api/empleadas/${employee.id}`, {
      method: "PUT",
      body: JSON.stringify({ active: !employee.active }),
    });
    if (data) {
      showToast("success", employee.active ? "Empleada desactivada" : "Empleada reactivada");
      queryClient.invalidateQueries({ queryKey: ["empleadas"] });
    } else {
      showToast("error", "Error al cambiar estado de la empleada");
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget === null) return;
    const { data } = await apiFetch(`/api/empleadas/${deleteTarget}`, { method: "DELETE" });
    if (data) {
      showToast("success", "Empleada eliminada");
      queryClient.invalidateQueries({ queryKey: ["empleadas"] });
    } else {
      showToast("error", "Error al eliminar la empleada");
    }
    setDeleteTarget(null);
  };

  const activeEmployees = employees.filter((e) => e.active);
  const inactiveEmployees = employees.filter((e) => !e.active);
  const totalCommissions = commissions.reduce((sum, c) => sum + c.monthlyCommission, 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonPageHeader />
        <SkeletonGrid count={6} height="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Empleadas</h1>
          <p className="text-sm text-muted mt-1">
            {activeEmployees.length} activas · {inactiveEmployees.length} inactivas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeEmployees.length > 0 && (
            <button
              onClick={() => setShowCommissions(!showCommissions)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                showCommissions
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface text-muted hover:text-dark border border-border"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Comisiones
              </span>
            </button>
          )}
          <button
            onClick={() => {
              setForm(emptyForm);
              setEditingId(null);
              setShowForm(!showForm);
            }}
            className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all duration-200 shadow-sm"
          >
            {showForm ? "Cancelar" : "+ Nueva Empleada"}
          </button>
        </div>
      </div>

      {/* Commission Report */}
      {showCommissions && (
        <div className="card p-5 animate-scaleIn">
          <div className="section-header mb-4">
            <span className="section-accent bg-emerald-500" />
            <h2 className="section-title">Comisiones del Mes</h2>
            <span className="text-xs text-muted ml-auto px-2 py-0.5 rounded-full bg-surface border border-border">
              Total: <strong className="text-emerald-600">${totalCommissions.toFixed(2)}</strong>
            </span>
          </div>

          {commissionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-surface rounded-xl animate-pulse" />
              ))}
            </div>
          ) : commissions.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-muted">Sin comisiones este mes</p>
              <p className="text-xs text-muted/60 mt-1">Las comisiones se calculan automáticamente al registrar ventas con empleada asignada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {commissions.map((comm) => {
                const maxCommission = commissions[0]?.monthlyCommission || 1;
                const barWidth = (comm.monthlyCommission / maxCommission) * 100;
                const employee = employees.find((e) => e.id === comm.employeeId);
                const cfg = roleConfig[employee?.role || "EMPLEADA"] || roleConfig.EMPLEADA;

                return (
                  <div key={comm.employeeId} className="p-4 rounded-xl bg-surface/70 hover:bg-surface transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-lg">{cfg.icon}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-dark">{comm.employeeName}</p>
                          <p className="text-xs text-muted">{comm.totalServices} servicio{comm.totalServices !== 1 ? "s" : ""} comisionados</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-emerald-600">${comm.monthlyCommission.toFixed(2)}</p>
                        <p className="text-[10px] text-muted">
                          Esta semana: <span className="font-medium text-dark">${comm.weeklyCommission.toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="h-2 bg-white rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    {comm.details.length > 0 && (
                      <details className="mt-3 group">
                        <summary className="text-xs text-muted cursor-pointer hover:text-dark transition-colors select-none">
                          Ver detalle ({comm.details.length} servicios)
                        </summary>
                        <div className="mt-2 space-y-1.5">
                          {comm.details.map((d, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-white/70">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-muted truncate">{d.serviceName}</span>
                                <span className="text-muted/60">${d.price.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-emerald-600 font-medium">
                                  +${d.commissionAmount.toFixed(2)}
                                </span>
                                <span className="text-muted/60">({d.commissionPercent}%)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-4 animate-scaleIn">
          <div className="section-header">
            <span className="section-accent" />
            <h2 className="section-title">{editingId ? "Editar Empleada" : "Nueva Empleada"}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="emp-name" className="block text-sm font-medium text-dark mb-1.5">Nombre</label>
              <input id="emp-name" name="emp-name" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Nombre completo" />
            </div>
            <div>
              <label htmlFor="emp-role" className="block text-sm font-medium text-dark mb-1.5">Rol</label>
              <select id="emp-role" name="emp-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="select">
                {roles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="emp-phone" className="block text-sm font-medium text-dark mb-1.5">Teléfono</label>
              <input id="emp-phone" name="emp-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder="555-0100" />
            </div>
            <div>
              <label htmlFor="emp-email" className="block text-sm font-medium text-dark mb-1.5">Email</label>
              <input id="emp-email" name="emp-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" placeholder="email@ejemplo.com" />
            </div>
            <div>
              <label htmlFor="emp-startDate" className="block text-sm font-medium text-dark mb-1.5">Fecha de inicio</label>
              <input id="emp-startDate" name="emp-startDate" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input" />
            </div>
            <div>
              <label htmlFor="emp-password" className="block text-sm font-medium text-dark mb-1.5">
                {editingId ? "Nueva Contraseña (dejar vacío para mantener)" : "Contraseña"}
              </label>
              <div className="relative">
                <input
                  id="emp-password"
                  name="emp-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input pr-10"
                  placeholder={editingId ? "••••••••" : "Contraseña para iniciar sesión"}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-dark transition-colors"
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted mt-1">Mínimo 4 caracteres. Necesaria para que la empleada pueda iniciar sesión.</p>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="emp-notes" className="block text-sm font-medium text-dark mb-1.5">Notas</label>
              <textarea id="emp-notes" name="emp-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="input resize-none" placeholder="Notas adicionales..." />
            </div>
            {editingId && (
              <div className="md:col-span-2">
                <label className="relative inline-flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success" />
                  <span className={`text-sm font-medium ${form.active ? 'text-dark' : 'text-muted'}`}>
                    {form.active ? 'Empleada activa' : 'Empleada inactiva'}
                  </span>
                </label>
                <p className="text-[11px] text-muted mt-1 ml-12">Si desactivas, la empleada no aparecerá en agenda, ventas ni podrá iniciar sesión.</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Guardando...
                </span>
              ) : (editingId ? "Guardar Cambios" : "Crear Empleada")}
            </button>
          </div>
        </form>
      )}

      {/* Empleadas Activas */}
      <div>
        <h2 className="text-lg font-semibold text-dark mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success" />
          Activas
          <span className="text-sm text-muted font-normal">({activeEmployees.length})</span>
        </h2>
        {activeEmployees.length === 0 ? (
          <EmptyState
            entity="empleadas"
            title="No hay empleadas activas"
            description="Registra tu primera empleada para comenzar a gestionar el equipo."
            action={{ label: "+ Agregar empleada", onClick: () => { setForm(emptyForm); setEditingId(null); setShowForm(true); } }}
            compact
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeEmployees.map((employee) => {
              const cfg = roleConfig[employee.role] || roleConfig.EMPLEADA;
              const empCommission = commissions.find((c) => c.employeeId === employee.id);
              return (
                <div key={employee.id} className="card p-5 hover:shadow-md hover:border-primary/20 transition-all duration-200 group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-lg">{cfg.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/empleadas/${employee.id}`}
                          className="font-semibold text-dark text-sm truncate hover:text-primary transition-colors block"
                        >
                          {employee.name}
                        </Link>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${cfg.color} ${cfg.bg}`}>
                          {employee.role}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => handleEdit(employee)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-primary-bg text-muted hover:text-primary transition-colors"
                        title="Editar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openAvailability(employee)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-primary-bg text-muted hover:text-primary transition-colors"
                        title="Horarios"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleToggleActive(employee)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-warning-bg text-muted hover:text-warning transition-colors"
                        title="Desactivar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(employee.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-danger-bg text-muted hover:text-danger transition-colors"
                        title="Eliminar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Commission badge */}
                  {empCommission && empCommission.monthlyCommission > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/50">
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-[11px] font-medium text-emerald-700">
                        ${empCommission.monthlyCommission.toFixed(2)} en comisiones este mes
                      </span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="mt-3 space-y-1.5">
                    {employee.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                        <span>{employee.phone}</span>
                      </div>
                    )}
                    {employee.email && (
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                        <span className="truncate">{employee.email}</span>
                      </div>
                    )}
                    {employee.startDate && (
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        <span>Desde {new Date(employee.startDate).toLocaleDateString("es-MX", { year: "numeric", month: "long" })}</span>
                      </div>
                    )}
                  </div>

                  {employee.notes && (
                    <p className="text-xs text-muted mt-3 pt-3 border-t border-border italic line-clamp-2">{employee.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Empleadas Inactivas */}
      {inactiveEmployees.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-muted" />
            <h2 className="text-lg font-semibold text-dark">Inactivas</h2>
            <span className="text-sm text-muted font-normal">({inactiveEmployees.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {inactiveEmployees.map((employee) => {
              const cfg = roleConfig[employee.role] || roleConfig.EMPLEADA;
              return (
                <div key={employee.id} className="card p-5 opacity-60 hover:opacity-100 transition-opacity group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-lg">{cfg.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-dark text-sm truncate">{employee.name}</h3>
                        <span className="text-[10px] text-muted">{employee.role}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(employee)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-success-bg text-muted hover:text-success transition-colors"
                        title="Reactivar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openAvailability(employee)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-primary-bg text-muted hover:text-primary transition-colors"
                        title="Horarios"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(employee.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-danger-bg text-muted hover:text-danger transition-colors"
                        title="Eliminar"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Availability Modal */}
      {availEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
          onClick={closeAvailability}
        >
          <div
            className="card max-w-lg w-full p-5 animate-scaleIn shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-bg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-dark">Horarios</h3>
                  <p className="text-xs text-muted">{availEmployee.name}</p>
                </div>
              </div>
              <button
                onClick={closeAvailability}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-dark transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {daysOfWeek.map((dayName, idx) => {
                const schedule = availSchedule.find((s) => s.dayOfWeek === idx);
                const isEnabled = !!schedule;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      isEnabled ? "bg-surface/70" : "bg-surface/30 opacity-60"
                    }`}
                  >
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => toggleDayEnabled(idx, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                    </label>
                    <span className={`text-sm font-medium w-20 flex-shrink-0 ${isEnabled ? "text-dark" : "text-muted"}`}>
                      {dayName}
                    </span>
                    {isEnabled && schedule && (
                      <div className="flex items-center gap-2 ml-auto">
                        <input
                          type="time"
                          value={schedule.startTime}
                          onChange={(e) => updateDaySchedule(idx, "startTime", e.target.value)}
                          className="input text-xs py-2 px-2.5 w-24"
                        />
                        <span className="text-xs text-muted">a</span>
                        <input
                          type="time"
                          value={schedule.endTime}
                          onChange={(e) => updateDaySchedule(idx, "endTime", e.target.value)}
                          className="input text-xs py-2 px-2.5 w-24"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 pt-4 mt-4 border-t border-border">
              <button onClick={closeAvailability} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={saveAvailability}
                disabled={availSaving}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {availSaving ? "Guardando..." : "Guardar Horarios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar empleada"
        message="¿Estás seguro de eliminar esta empleada? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
      />
    </div>
  );
}
