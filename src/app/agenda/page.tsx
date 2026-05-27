"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import WAChatPopover from "@/components/WAChatPopover";
import WATemplateManager from "@/components/WATemplateManager";
import { useAuth } from "@/hooks/useAuth";
import { SkeletonPageHeader, SkeletonBlock } from "@/components/LoadingSkeleton";
import { useToast } from "@/hooks/useToast";
import { apiFetch } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Service {
  id: number;
  name: string;
  category: string;
  price: number;
  duration: number;
  active: boolean;
}

interface Client {
  id: number;
  name: string;
  phone: string | null;
}

interface Employee {
  id: number;
  name: string;
  active: boolean;
}

interface Appointment {
  id: number;
  date: string;
  status: string;
  notes: string | null;
  clientId: number;
  serviceId: number;
  employeeId: number | null;
  client: Client;
  service: Service;
  employee: Employee | null;
}

const statusColors: Record<string, string> = {
  PENDIENTE: "bg-warning-bg text-warning border-warning/30",
  CONFIRMADA: "bg-primary-bg text-primary border-primary/30",
  COMPLETADA: "bg-success-bg text-success border-success/30",
  CANCELADA: "bg-danger-bg text-danger border-danger/30",
};

const categoryColors: Record<string, string> = {
  MAQUILLAJE: "border-l-primary",
  CEJAS: "border-l-warning",
  PESTAÑAS: "border-l-violet-500",
  MANICURE: "border-l-rose-500",
};

const categoryBgColors: Record<string, string> = {
  MAQUILLAJE: "bg-primary-bg text-primary",
  CEJAS: "bg-warning-bg text-warning",
  PESTAÑAS: "bg-violet-50 text-violet-700",
  MANICURE: "bg-rose-50 text-rose-700",
};

const daysOfWeek = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

export default function AgendaPage() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"mes" | "dia">("mes");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filterServiceId, setFilterServiceId] = useState<number | null>(null);
  const [filterEmployeeId, setFilterEmployeeId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const [form, setForm] = useState({
    clientId: "",
    serviceId: "",
    employeeId: "",
    date: "",
    time: "",
    notes: "",
  });
  const [chatTarget, setChatTarget] = useState<{ id: number; name: string; phone: string } | null>(null);
  const [showManager, setShowManager] = useState(false);

  const loadData = useCallback(() => {
    Promise.all([
      apiFetch<Appointment[]>("/api/citas").then(({ data }) => Array.isArray(data) ? data : []),
      apiFetch<Service[]>("/api/servicios").then(({ data }) => Array.isArray(data) ? data : []),
      apiFetch<Client[]>("/api/clientes").then(({ data }) => Array.isArray(data) ? data : []),
      apiFetch<Employee[]>("/api/empleadas").then(({ data }) => Array.isArray(data) ? data : []),
    ]).then(([appts, svcs, clts, emps]) => {
      setAppointments(appts);
      setServices(svcs);
      setClients(clts);
      setEmployees(emps);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Silent polling cada 15s con detección de nuevas citas
  useEffect(() => {
    const interval = setInterval(() => {
      Promise.all([
        apiFetch<Appointment[]>("/api/citas").then(({ data }) => Array.isArray(data) ? data : []),
        apiFetch<Service[]>("/api/servicios").then(({ data }) => Array.isArray(data) ? data : []),
        apiFetch<Client[]>("/api/clientes").then(({ data }) => Array.isArray(data) ? data : []),
        apiFetch<Employee[]>("/api/empleadas").then(({ data }) => Array.isArray(data) ? data : []),
      ]).then(([appts, svcs, clts, emps]) => {
        setAppointments((prev) => {
          // Detectar nuevas citas no canceladas
          if (prev.length > 0 && appts.length > prev.length) {
            const newAppts = appts.filter(
              (a) => !prev.find((p) => p.id === a.id) && a.status !== "CANCELADA"
            );
            if (newAppts.length > 0) {
              newAppts.forEach((apt) => {
                const time = new Date(apt.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
                showToast("info", `📅 Nueva cita: ${apt.client.name} — ${apt.service.name} a las ${time}`);
              });
            }
          }
          return appts;
        });
        setServices(svcs);
        setClients(clts);
        setEmployees(emps);
      }).catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Calendar navigation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const getAppointmentsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return appointments.filter((apt) => {
      if (apt.status === "CANCELADA") return false;
      const aptDate = new Date(apt.date);
      const aptDateStr = `${aptDate.getFullYear()}-${String(aptDate.getMonth() + 1).padStart(2, "0")}-${String(aptDate.getDate()).padStart(2, "0")}`;
      if (aptDateStr !== dateStr) return false;
      if (filterServiceId !== null && apt.serviceId !== filterServiceId) return false;
      if (filterEmployeeId !== null && apt.employeeId !== filterEmployeeId) return false;
      return true;
    });
  };

  const selectedDayAppointments = getAppointmentsForDay(selectedDate.getDate());

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dateTime = `${form.date}T${form.time}:00`;
    const url = editingId ? `/api/citas/${editingId}` : "/api/citas";
    const method = editingId ? "PUT" : "POST";

    const { data, error: apiError } = await apiFetch(url, {
      method,
      body: JSON.stringify({
        ...form,
        date: dateTime,
        clientId: Number(form.clientId),
        serviceId: Number(form.serviceId),
        employeeId: form.employeeId ? Number(form.employeeId) : null,
      }),
    });

    if (data) {
      showToast("success", editingId ? "Cita actualizada exitosamente" : "Cita creada exitosamente");
      setShowForm(false);
      setEditingId(null);
      setForm({ clientId: "", serviceId: "", employeeId: "", date: "", time: "", notes: "" });
      loadData();
    } else {
      showToast("error", apiError || "Error al guardar la cita");
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    const { data: statusData, error: statusError } = await apiFetch<Appointment>(`/api/citas/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    if (!statusData) {
      showToast("error", statusError || "Error al cambiar estado de la cita");
      return;
    }
    const statusLabels: Record<string, string> = {
      CONFIRMADA: "Cita confirmada",
      COMPLETADA: "Cita completada",
      CANCELADA: "Cita cancelada",
    };
    showToast("success", statusLabels[status] || `Estado cambiado a ${status}`);      if (status === "COMPLETADA") {
        // Obtener la cita actualizada con todos los datos
        const updated = statusData;
        // Guardar en sessionStorage para prellenar venta
        sessionStorage.setItem("pendingSale", JSON.stringify({
          clientId: updated.clientId,
          clientName: updated.client.name,
          serviceId: updated.serviceId,
          serviceName: updated.service.name,
          servicePrice: updated.service.price,
          appointmentDate: updated.date,
        }));
        // Solo ADMIN puede ir a ventas después
        if (isAdmin) {
          router.push("/ventas");
        }
      }
    loadData();
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget === null) return;
    const { data } = await apiFetch(`/api/citas/${deleteTarget}`, { method: "DELETE" });
    if (data) {
      showToast("success", "Cita eliminada");
      loadData();
    } else {
      showToast("error", "Error al eliminar la cita");
    }
    setDeleteTarget(null);
  };

  const openNewAppointmentAt = (timeDate: Date) => {
    const dateStr = `${timeDate.getFullYear()}-${String(timeDate.getMonth() + 1).padStart(2, "0")}-${String(timeDate.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(timeDate.getHours()).padStart(2, "0")}:${String(timeDate.getMinutes()).padStart(2, "0")}`;
    setForm({ clientId: "", serviceId: "", employeeId: "", date: dateStr, time: timeStr, notes: "" });
    setEditingId(null);
    setShowForm(true);
  };

  const openNewAppointment = (day?: number) => {
    const d = day || selectedDate.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    setForm({ clientId: "", serviceId: "", employeeId: "", date: dateStr, time: "10:00", notes: "" });
    setEditingId(null);
    setShowForm(true);
  };

  const openEditAppointment = (apt: Appointment) => {
    const aptDate = new Date(apt.date);
    const dateStr = `${aptDate.getFullYear()}-${String(aptDate.getMonth() + 1).padStart(2, "0")}-${String(aptDate.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(aptDate.getHours()).padStart(2, "0")}:${String(aptDate.getMinutes()).padStart(2, "0")}`;
    setForm({
      clientId: String(apt.clientId),
      serviceId: String(apt.serviceId),
      employeeId: apt.employeeId ? String(apt.employeeId) : "",
      date: dateStr,
      time: timeStr,
      notes: apt.notes || "",
    });
    setEditingId(apt.id);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonPageHeader />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonBlock className="lg:col-span-2 h-96" />
          <SkeletonBlock className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark">Agenda</h1>
          <p className="text-sm text-muted mt-1">Gestión de citas y calendario</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex p-0.5 bg-surface rounded-lg border border-border">
            <button
              onClick={() => setViewMode("mes")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                viewMode === "mes"
                  ? "bg-white text-dark shadow-sm border border-border"
                  : "text-muted hover:text-dark"
              }`}
            >
              <svg className="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4v16m18-16v16M3 8h18M3 12h18M3 16h18" />
              </svg>
              Mes
            </button>
            <button
              onClick={() => setViewMode("dia")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                viewMode === "dia"
                  ? "bg-white text-dark shadow-sm border border-border"
                  : "text-muted hover:text-dark"
              }`}
            >
              <svg className="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Día
            </button>
          </div>
          {isAdmin && (
            <button
              onClick={() => openNewAppointment()}
              className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all duration-200 shadow-sm"
            >
              + Nueva Cita
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
          <div className="relative flex-1 sm:flex-none">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <select
              value={filterServiceId ?? ""}
              onChange={(e) => setFilterServiceId(e.target.value ? Number(e.target.value) : null)}
              className="select text-xs py-2 pl-9 pr-3 w-full sm:w-auto sm:min-w-[160px]"
            >
              <option value="">Todos los servicios</option>
              {services.filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 sm:flex-none">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <select
              value={filterEmployeeId ?? ""}
              onChange={(e) => setFilterEmployeeId(e.target.value ? Number(e.target.value) : null)}
              className="select text-xs py-2 pl-9 pr-3 w-full sm:w-auto sm:min-w-[160px]"
            >
              <option value="">Todas las empleadas</option>
              {employees.filter((e) => e.active).map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>
        {(filterServiceId !== null || filterEmployeeId !== null) && (
          <button
            onClick={() => { setFilterServiceId(null); setFilterEmployeeId(null); }}
            className="text-xs text-danger hover:text-danger-dark px-3 py-2 rounded-lg hover:bg-danger-bg transition-colors font-medium sm:self-center"
          >
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {viewMode === "mes" ? (
          /* Vista Mes */
          <div className="lg:col-span-2 card p-5 animate-fadeIn">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1))}
                className="p-2 hover:bg-surface rounded-lg transition-colors text-muted hover:text-primary"
                aria-label="Mes anterior"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-semibold text-dark capitalize">
                {currentDate.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
              </h2>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1))}
                className="p-2 hover:bg-surface rounded-lg transition-colors text-muted hover:text-primary"
                aria-label="Mes siguiente"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {daysOfWeek.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-muted py-2 uppercase tracking-wider">
                  {d}
                </div>
              ))}
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} />;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isToday = dateStr === todayStr;
                const isSelected = day === selectedDate.getDate();
                const dayAppts = getAppointmentsForDay(day);

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(new Date(year, month, day))}
                    className={`relative p-2 rounded-lg text-sm transition-all duration-200 ${
                      isSelected
                        ? "bg-primary-bg ring-2 ring-primary/30 shadow-sm"
                        : "hover:bg-surface"
                    }`}
                  >
                    <span className={`block text-center text-sm font-medium ${
                      isToday ? "text-primary" : isSelected ? "text-primary-dark" : "text-dark"
                    }`}>
                      {day}
                    </span>
                    {dayAppts.length > 0 && (
                      <div className="flex justify-center gap-0.5 mt-1">
                        {dayAppts.slice(0, 3).map((_, i) => (
                          <span
                            key={i}
                            className={`inline-block w-1.5 h-1.5 rounded-full ${
                              i === 0 ? "bg-primary" : i === 1 ? "bg-warning" : "bg-violet-400"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected day appointments */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-dark text-sm capitalize">
                  {selectedDate.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
                </h3>
                {isAdmin && (
                  <button
                    onClick={() => openNewAppointment()}
                    className="text-xs text-primary hover:text-primary-dark transition-colors font-medium"
                  >
                    + Agregar cita
                  </button>
                )}
              </div>
              <AppointmentList
                isAdmin={isAdmin}
                appointments={selectedDayAppointments}
                onEdit={openEditAppointment}
                onStatusChange={handleStatusChange}
                onDelete={(id) => setDeleteTarget(id)}
                onChat={setChatTarget}
              />
            </div>
          </div>
        ) : (
          /* Vista Día — Timeline */
          <DayTimeline
            isAdmin={isAdmin}
            date={selectedDate}
            appointments={appointments}
            filterServiceId={filterServiceId}
            filterEmployeeId={filterEmployeeId}
            onDateChange={(d) => setSelectedDate(d)}
            onSlotClick={(time) => openNewAppointmentAt(time)}
            onEdit={openEditAppointment}
            onStatusChange={handleStatusChange}
            onDelete={(id) => setDeleteTarget(id)}
            onChat={setChatTarget}
          />
        )}

        {/* Sidebar: Form / Resumen */}
        <div className="card p-5">
          <div className="section-header">
            <span className="section-accent" />
            <h2 className="section-title">{showForm ? (editingId ? "Editar Cita" : "Nueva Cita") : "Resumen Rápido"}</h2>
          </div>

          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-sm font-medium text-dark mb-1.5">Cliente</label>
                <select required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="select">
                  <option value="">Seleccionar cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-1.5">Servicio</label>
                <select required value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })} className="select">
                  <option value="">Seleccionar servicio...</option>
                  {services.filter((s) => s.active).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — ${s.price.toFixed(2)} ({s.duration}min)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-1.5">Empleada</label>
                <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="select">
                  <option value="">Sin asignar...</option>
                  {employees.filter((e) => e.active).map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-1.5">Fecha</label>
                <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-1.5">Hora</label>
                <input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-1.5">Notas</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="input resize-none" placeholder="Notas adicionales..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1">{editingId ? "Guardar" : "Crear Cita"}</button>
              </div>
            </form>
          ) : (
            <div className="space-y-2.5">
              <div className="p-4 bg-primary-bg rounded-xl border border-primary/10">
                <p className="text-xs text-muted font-medium">Citas hoy</p>
                <p className="text-2xl font-bold text-primary mt-1">{getAppointmentsForDay(today.getDate()).length}</p>
              </div>
              <div className="p-4 bg-warning-bg rounded-xl border border-warning/10">
                <p className="text-xs text-muted font-medium">Pendientes</p>
                <p className="text-2xl font-bold text-warning mt-1">{appointments.filter((a) => a.status === "PENDIENTE").length}</p>
              </div>
              {isAdmin && (
                <button onClick={() => openNewAppointment()} className="btn-primary w-full mt-1">
                  + Agendar Cita
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <WAChatPopover
        isOpen={chatTarget !== null}
        clientName={chatTarget?.name ?? ""}
        clientPhone={chatTarget?.phone ?? ""}
        onClose={() => setChatTarget(null)}
        onEditTemplates={() => setShowManager(true)}
      />

      <WATemplateManager
        isOpen={showManager}
        onClose={() => setShowManager(false)}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar cita"
        message="¿Estás seguro de eliminar esta cita? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
      />
    </div>
  );
}

// ─── AppointmentList component ───

function AppointmentList({
  isAdmin,
  appointments,
  onEdit,
  onStatusChange,
  onDelete,
  onChat,
}: {
  isAdmin: boolean;
  appointments: Appointment[];
  onEdit: (apt: Appointment) => void;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
  onChat: (target: { id: number; name: string; phone: string } | null) => void;
}) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        entity="agenda"
        title="Sin citas para este día"
        description="Selecciona otro día o agrega una nueva cita."
        compact
      />
    );
  }

  return (
    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
      {appointments
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((apt) => (
          <div
            key={apt.id}
            className={`p-4 bg-surface rounded-lg border border-border border-l-4 ${
              categoryColors[apt.service.category] || "border-l-gray-300"
            } hover:shadow-md hover:border-primary/20 transition-all duration-200`}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-dark text-sm flex items-center gap-1.5">{apt.client.name}
                    {apt.client.phone && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChat({ id: apt.client.id, name: apt.client.name, phone: apt.client.phone ?? "" });
                        }}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-all duration-200"
                        title="Enviar WhatsApp"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </button>
                    )}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                    statusColors[apt.status] || "bg-gray-50 text-gray-700 border-gray-200"
                  }`}>
                    {apt.status}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    categoryBgColors[apt.service.category] || "bg-gray-100 text-gray-600"
                  }`}>
                    {apt.service.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {new Date(apt.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-border">|</span>
                  <span>{apt.service.name}</span>
                </div>
                {apt.notes && <p className="text-xs text-muted mt-1 italic">{apt.notes}</p>}
                {apt.employee && (
                  <p className="text-xs text-muted/60 mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {apt.employee.name}
                  </p>
                )}
              </div>
              {isAdmin ? (
                <div className="flex gap-1 flex-shrink-0 ml-3">
                  {apt.status === "PENDIENTE" && (
                    <button
                      onClick={() => onStatusChange(apt.id, "CONFIRMADA")}
                      className="text-xs text-primary hover:text-primary-dark px-2 py-1 rounded-lg hover:bg-primary-bg transition-colors font-medium"
                      aria-label="Confirmar cita"
                    >
                      ✓
                    </button>
                  )}
                  {apt.status === "CONFIRMADA" && (
                    <button
                      onClick={() => onStatusChange(apt.id, "COMPLETADA")}
                      className="text-xs text-success hover:text-success px-2 py-1 rounded-lg hover:bg-success-bg transition-colors font-medium"
                      aria-label="Completar cita"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(apt)}
                    className="text-xs text-muted hover:text-primary px-2 py-1 rounded-lg hover:bg-primary-bg transition-colors font-medium"
                    aria-label="Editar cita"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onStatusChange(apt.id, "CANCELADA")}
                    className="text-xs text-muted hover:text-danger px-2 py-1 rounded-lg hover:bg-danger-bg transition-colors"
                    aria-label="Cancelar cita"
                  >
                    ✕
                  </button>
                  <button
                    onClick={() => onDelete(apt.id)}
                    className="text-xs text-muted hover:text-danger px-2 py-1 rounded-lg hover:bg-danger-bg transition-colors"
                    aria-label="Eliminar cita"
                  >
                    🗑
                  </button>
                </div>
              ) : (
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border flex-shrink-0 ml-3 ${
                  statusColors[apt.status] || "bg-gray-50 text-gray-700 border-gray-200"
                }`}>
                  {apt.status}
                </span>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

// ─── DayTimeline component ───

const timelineCategoryColors: Record<string, string> = {
  MAQUILLAJE: "bg-primary/85 border-primary",
  CEJAS: "bg-warning/85 border-warning",
  PESTAÑAS: "bg-violet-500/85 border-violet-500",
  MANICURE: "bg-rose-500/85 border-rose-500",
};

function DayTimeline({
  isAdmin,
  date,
  appointments,
  filterServiceId,
  filterEmployeeId,
  onDateChange,
  onSlotClick,
  onEdit,
  onStatusChange,
  onDelete,
  onChat,
}: {
  isAdmin: boolean;
  date: Date;
  appointments: Appointment[];
  filterServiceId: number | null;
  filterEmployeeId: number | null;
  onDateChange: (d: Date) => void;
  onSlotClick: (d: Date) => void;
  onEdit: (apt: Appointment) => void;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
  onChat: (target: { id: number; name: string; phone: string } | null) => void;
}) {
  const HOUR_HEIGHT = 60;
  const START_HOUR = 7;
  const END_HOUR = 21;
  const totalHours = END_HOUR - START_HOUR;

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const isToday = new Date().toISOString().slice(0, 10) === dateStr;

  // Filter and sort appointments for this day
  const dayAppointments = appointments
    .filter((apt) => {
      if (apt.status === "CANCELADA") return false;
      const aptDate = new Date(apt.date);
      const aptDateStr = aptDate.toISOString().slice(0, 10);
      if (aptDateStr !== dateStr) return false;
      if (filterServiceId !== null && apt.serviceId !== filterServiceId) return false;
      if (filterEmployeeId !== null && apt.employeeId !== filterEmployeeId) return false;
      return true;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Check if appointments overlap (for width calculation)
  const getAppointmentStyle = (apt: Appointment) => {
    const aptDate = new Date(apt.date);
    const minutesFromStart = (aptDate.getHours() - START_HOUR) * 60 + aptDate.getMinutes();
    const duration = apt.service.duration;
    const top = (minutesFromStart / 60) * HOUR_HEIGHT;
    const height = Math.max((duration / 60) * HOUR_HEIGHT, 24);
    return { top, height };
  };

  const goToToday = () => onDateChange(new Date());
  const goPrev = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    onDateChange(d);
  };
  const goNext = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    onDateChange(d);
  };

  return (
    <div className="lg:col-span-2 card p-5 animate-fadeIn">
      {/* Day navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goPrev}
          className="p-2 hover:bg-surface rounded-lg transition-colors text-muted hover:text-primary"
          aria-label="Día anterior"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-dark capitalize">
            {date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          {!isToday && (
            <button
              onClick={goToToday}
              className="text-xs px-2.5 py-1 rounded-full bg-primary-bg text-primary border border-primary/20 hover:bg-primary/10 transition-colors font-medium"
            >
              Hoy
            </button>
          )}
        </div>
        <button
          onClick={goNext}
          className="p-2 hover:bg-surface rounded-lg transition-colors text-muted hover:text-primary"
          aria-label="Día siguiente"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Timeline */}
      <div className="relative flex">
        {/* Time labels column */}
        <div className="flex-shrink-0 w-14 pt-0">
          {Array.from({ length: totalHours + 1 }, (_, i) => {
            const hour = START_HOUR + i;
            if (i === totalHours) return null;
            return (
              <div
                key={hour}
                style={{ height: HOUR_HEIGHT }}
                className="flex items-start justify-end pr-2 -mt-2"
              >
                <span className="text-[11px] font-medium text-muted/70">
                  {`${String(hour).padStart(2, "0")}:00`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Timeline area */}
        <div className="flex-1 relative">
          {/* Hour grid lines */}
          {Array.from({ length: totalHours }, (_, i) => {
            const hour = START_HOUR + i;
            return (
              <div
                key={hour}
                style={{ height: HOUR_HEIGHT }}
                className="border-t border-border/60 hover:bg-surface/50 transition-colors cursor-pointer relative"
                onClick={() => {
                  if (!isAdmin) return;
                  const slotDate = new Date(date);
                  slotDate.setHours(hour, 0, 0, 0);
                  onSlotClick(slotDate);
                }}
              >
                {/* Half-hour marker */}
                <div className="absolute top-1/2 left-0 right-0 border-t border-border/30 pointer-events-none" />
              </div>
            );
          })}
          {/* Last half */}
          <div style={{ height: HOUR_HEIGHT / 2 }} className="border-t border-border/60" />

          {/* Appointment blocks */}
          {dayAppointments.map((apt) => {
            const { top, height } = getAppointmentStyle(apt);
            const aptDate = new Date(apt.date);
            const endDate = new Date(aptDate.getTime() + apt.service.duration * 60000);
            const timeLabel = `${aptDate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
            const catColor = timelineCategoryColors[apt.service.category] || "bg-gray-400/85 border-gray-400";

            return (
              <div
                key={apt.id}
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                }}
                className={`absolute left-0.5 right-0.5 rounded-lg px-2.5 py-1 border-l-[3px] ${catColor} text-white text-xs overflow-hidden cursor-pointer shadow-sm hover:brightness-110 hover:shadow-md hover:z-10 transition-all duration-200 z-[1]`}
                onClick={() => isAdmin && onEdit(apt)}
              >
                <div className="flex items-center gap-1.5 h-full">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[11px] leading-tight truncate">
                      {apt.client.name}
                    </div>
                    <div className="text-[10px] opacity-80 leading-tight truncate">
                      {apt.service.name}
                    </div>
                    <div className="text-[9px] opacity-70">
                      {timeLabel}
                    </div>
                  </div>
                  {apt.status === "PENDIENTE" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStatusChange(apt.id, "CONFIRMADA"); }}
                      className="shrink-0 w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
                      title="Confirmar"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                  {apt.status === "CONFIRMADA" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStatusChange(apt.id, "COMPLETADA"); }}
                      className="shrink-0 w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
                      title="Completar"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                  {height >= 48 && apt.status !== "PENDIENTE" && apt.status !== "CONFIRMADA" && (
                    <span className={`shrink-0 text-[9px] px-1 py-0.5 rounded-full bg-white/20 ${height < 48 ? "hidden" : ""}`}>
                      {apt.status === "COMPLETADA" ? "✓" : apt.status === "CANCELADA" ? "✕" : apt.status.slice(0, 3)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Current time indicator */}
          {isToday && (() => {
            const now = new Date();
            const minutesFromStart = (now.getHours() - START_HOUR) * 60 + now.getMinutes();
            if (minutesFromStart < 0 || minutesFromStart > totalHours * 60) return null;
            const top = (minutesFromStart / 60) * HOUR_HEIGHT;
            return (
              <div
                className="absolute left-0 right-0 z-[2] pointer-events-none"
                style={{ top: `${top}px` }}
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-danger shadow-sm" />
                  <div className="flex-1 h-[2px] bg-danger/60" />
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Summary bawah */}
      <div className="mt-4 pt-3 border-t border-border flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-primary/85" />
          Maquillaje
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-warning/85" />
          Cejas
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-500/85" />
          Pestañas
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/85" />
          Manicure
        </span>
        <span className="ml-auto font-medium">
          {dayAppointments.length} cita{dayAppointments.length !== 1 ? "s" : ""} — {dayAppointments.reduce((sum, a) => sum + a.service.duration, 0)} min
        </span>
      </div>
    </div>
  );
}
