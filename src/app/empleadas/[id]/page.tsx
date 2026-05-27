"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { SkeletonPageHeader, SkeletonBlock } from "@/components/LoadingSkeleton";

interface EmployeeDetail {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  active: boolean;
  startDate: string | null;
  notes: string | null;
  createdAt: string;
  _count: { sales: number; appointments: number };
  appointments: Array<{
    id: number;
    date: string;
    status: string;
    service: { name: string; category: string; price: number };
    client: { name: string };
  }>;
  sales: Array<{
    id: number;
    date: string;
    total: number;
    client: { name: string } | null;
    items: Array<{
      service: { name: string; category: string } | null;
    }>;
  }>;    availabilities: Array<{
    id: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
}

const roleConfig: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  ADMIN: { color: "text-danger", bg: "bg-danger-bg", label: "Administradora", icon: "⭐" },
  ESTETICISTA: { color: "text-primary", bg: "bg-primary-bg", label: "Esteticista", icon: "💅" },
  EMPLEADA: { color: "text-warning", bg: "bg-warning-bg", label: "Empleada", icon: "👩‍💼" },
};

const statusColors: Record<string, string> = {
  PENDIENTE: "bg-warning-bg text-warning border-warning/30",
  CONFIRMADA: "bg-primary-bg text-primary border-primary/30",
  COMPLETADA: "bg-success-bg text-success border-success/30",
  CANCELADA: "bg-danger-bg text-danger border-danger/30",
};

const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;
    apiFetch<EmployeeDetail>(`/api/empleadas/${id}`)
      .then(({ data }) => {
        if (data) setEmployee(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-4 animate-fadeIn">
        <SkeletonPageHeader />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <SkeletonBlock className="lg:col-span-1 h-64" />
          <SkeletonBlock className="lg:col-span-2 h-96" />
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-5 animate-fadeIn">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-secondary">← Volver</button>
        </div>
        <div className="card p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
            <svg className="w-8 h-8 text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-dark">Empleada no encontrada</h2>
          <p className="text-sm text-muted mt-1">La empleada que buscas no existe o fue eliminada.</p>
          <Link href="/empleadas" className="btn-primary mt-4 inline-flex">Volver a empleadas</Link>
        </div>
      </div>
    );
  }

  const cfg = roleConfig[employee.role] || roleConfig.EMPLEADA;
  const monthlyCommissions = employee.sales
    .filter(s => {
      const saleDate = new Date(s.date);
      const now = new Date();
      return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, s) => sum + s.total, 0);

  const monthlySales = employee.sales.filter(s => {
    const saleDate = new Date(s.date);
    const now = new Date();
    return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
  });

  const monthlyAppointments = employee.appointments.filter(a => {
    const aptDate = new Date(a.date);
    const now = new Date();
    return aptDate.getMonth() === now.getMonth() && aptDate.getFullYear() === now.getFullYear();
  });

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Back button */}
      <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-dark transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Volver a empleadas
      </button>

      {/* Profile Header */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className={`w-16 h-16 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 ring-4 ring-primary/10`}>
            <span className="text-2xl">{cfg.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-dark">{employee.name}</h1>
              <span className={`px-3 py-0.5 rounded-full text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
                {cfg.label}
              </span>
              {!employee.active && (
                <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-surface text-muted border border-border">
                  Inactiva
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-muted">
              {employee.phone && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  {employee.phone}
                </span>
              )}
              {employee.email && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  {employee.email}
                </span>
              )}
              {employee.startDate && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  Desde {new Date(employee.startDate).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              )}
            </div>
          </div>
          <Link href="/empleadas" className="btn-secondary text-sm shrink-0">
            Editar
          </Link>
        </div>
        {employee.notes && (
          <p className="mt-4 pt-4 border-t border-border text-sm text-muted italic">{employee.notes}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-muted font-medium">Citas este mes</p>
          <p className="text-2xl font-bold text-primary mt-1">{monthlyAppointments.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted font-medium">Ventas este mes</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{monthlySales.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted font-medium">Total ventas mes</p>
          <p className="text-2xl font-bold text-dark mt-1">${monthlyCommissions.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted font-medium">Total histórico</p>
          <p className="text-2xl font-bold text-dark mt-1">${employee._count.sales > 0 ? employee.sales.reduce((sum, s) => sum + s.total, 0).toFixed(2) : "0.00"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Horario */}
        <div className="card p-5">
          <div className="section-header mb-4">
            <span className="section-accent bg-amber-500" />
            <h2 className="section-title">Horario de Trabajo</h2>
          </div>                  {employee.availabilities.length === 0 ? (
            <p className="text-sm text-muted text-center py-6 italic">Sin horario configurado</p>
          ) : (
            <div className="space-y-1.5">
              {daysOfWeek.map((dayName, idx) => {
                const schedule = employee.availabilities.find(a => a.dayOfWeek === idx);
                return (
                  <div key={idx} className={`flex items-center justify-between p-2.5 rounded-lg ${schedule ? "bg-surface/70" : "bg-surface/30 opacity-50"}`}>
                    <span className="text-sm font-medium text-dark">{dayName}</span>
                    {schedule ? (
                      <span className="text-sm text-muted">{schedule.startTime} — {schedule.endTime}</span>
                    ) : (
                      <span className="text-xs text-muted">Descanso</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Últimas Citas */}
        <div className="card p-5">
          <div className="section-header mb-4">
            <span className="section-accent bg-violet-500" />
            <h2 className="section-title">Últimas Citas</h2>
            <span className="text-xs text-muted ml-auto">{employee._count.appointments} total</span>
          </div>
          {employee.appointments.length === 0 ? (
            <p className="text-sm text-muted text-center py-6 italic">Sin citas registradas</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {employee.appointments.slice(0, 10).map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-surface/70">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-dark">{apt.client.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[apt.status] || ""}`}>
                        {apt.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">{apt.service.name}</p>
                  </div>
                  <span className="text-xs text-muted flex-shrink-0 ml-3">
                    {new Date(apt.date).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ventas Recientes */}
      <div className="card p-5">
        <div className="section-header mb-4">
          <span className="section-accent bg-emerald-500" />
          <h2 className="section-title">Ventas Recientes</h2>
          <span className="text-xs text-muted ml-auto">{employee._count.sales} total</span>
        </div>
        {employee.sales.length === 0 ? (
          <p className="text-sm text-muted text-center py-6 italic">Sin ventas registradas</p>
        ) : (
          <div className="space-y-2">
            {employee.sales.slice(0, 10).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg bg-surface/70 hover:bg-surface transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-dark">
                      {sale.client?.name || "Cliente de paso"}
                    </span>
                    <span className="text-[10px] text-muted">·</span>
                    <span className="text-xs text-muted truncate">
                      {sale.items.map(i => i.service?.name).filter(Boolean).join(", ") || "Productos"}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted mt-0.5">
                    {new Date(sale.date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className="text-sm font-bold text-emerald-600 flex-shrink-0 ml-3">
                  ${sale.total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
