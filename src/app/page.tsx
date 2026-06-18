"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { useSSE } from "@/hooks/useSSE";
import { SkeletonPageHeader, SkeletonBlock, SkeletonStatsRow } from "@/components/LoadingSkeleton";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface DashboardData {
  totalClients: number;
  totalServices: number;
  totalAppointments: number;
  todayAppointments: number;
  monthlySales: number;
  todaySales: number;
  recentAppointments: Array<{
    id: number;
    date: string;
    status: string;
    client: { name: string };
    service: { name: string };
  }>;
  servicesByCategory: Array<{ category: string; _count: number }>;
  weeklyCompletedByCategory: Array<{ category: string; _count: number }>;
  lowStockProducts: Array<{ id: number; name: string; quantity: number; minStock: number }>;
  monthlyTrend: Array<{ month: string; label: string; total: number; count: number }>;
  topServices: Array<{ id: number; name: string; category: string; count: number }>;
  topClients: Array<{ id: number; name: string; phone: string | null; totalSpent: number; saleCount: number }>;
  myWeeklyServices: number;
  myName: string | null;
  servicesByEmployee: Array<{ employeeId: number | null; employeeName: string; count: number }>;
  weeklyServices: Array<{ serviceId: number; serviceName: string; category: string; count: number }>;
}

const statusColors: Record<string, string> = {
  PENDIENTE: "bg-warning-bg text-warning border-warning/30",
  CONFIRMADA: "bg-primary-bg text-primary border-primary/30",
  COMPLETADA: "bg-success-bg text-success border-success/30",
  CANCELADA: "bg-danger-bg text-danger border-danger/30",
};

const formatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function Dashboard() {
  const { showToast } = useToast();
  const { isAdmin } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMonths, setShowMonths] = useState<6 | 12>(12);

  // ─── Attendance state ───
  const [attendanceState, setAttendanceState] = useState<{
    loading: boolean;
    checkedIn: boolean;
    schedule: { startTime: string; endTime: string } | null;
    workLocation: { latitude: number | null; longitude: number | null; name: string; radius: number } | null;
    checking: boolean;
    error: string | null;
  }>({
    loading: true,
    checkedIn: false,
    schedule: null,
    workLocation: null,
    checking: false,
    error: null,
  });

  const checkAttendanceStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance/today");
      const data = await res.json();
      if (res.ok) {
        setAttendanceState((prev) => ({
          ...prev,
          loading: false,
          checkedIn: data.checkedIn,
          schedule: data.schedule,
          workLocation: data.workLocation,
        }));
      }
    } catch {
      setAttendanceState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const handleCheckIn = useCallback(async () => {
    if (!navigator.geolocation) {
      showToast("error", "Tu navegador no soporta geolocalización");
      return;
    }

    setAttendanceState((prev) => ({ ...prev, checking: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch("/api/attendance/checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showToast("success", "✅ Asistencia registrada exitosamente");
            setAttendanceState((prev) => ({ ...prev, checkedIn: true, checking: false }));
          } else {
            const errorMsg = data.error || "Error al registrar asistencia";
            showToast("error", errorMsg);
            setAttendanceState((prev) => ({ ...prev, checking: false, error: errorMsg }));
          }
        } catch {
          showToast("error", "Error de conexión al registrar asistencia");
          setAttendanceState((prev) => ({ ...prev, checking: false }));
        }
      },
      (err) => {
        let msg = "Error al obtener ubicación";
        if (err.code === 1) msg = "Permiso de ubicación denegado. Actívalo en la configuración del navegador.";
        else if (err.code === 2) msg = "No se pudo determinar la ubicación. Intenta de nuevo.";
        else if (err.code === 3) msg = "La solicitud de ubicación tardó demasiado. Intenta de nuevo.";
        showToast("error", msg);
        setAttendanceState((prev) => ({ ...prev, checking: false, error: msg }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [showToast]);

  useEffect(() => {
    apiFetch<DashboardData>("/api/dashboard")
      .then(({ data, error }) => {
        if (data && typeof data === "object" && "totalClients" in data) {
          setData(data);
        } else {
          setData(null);
          if (error) showToast("error", error);
          else showToast("error", "Error al cargar datos del dashboard");
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        showToast("error", "Error de conexión al cargar el dashboard");
      });

    checkAttendanceStatus();
  }, [checkAttendanceStatus]);

  // SSE: real-time updates for sales count / low stock (replaces 15s polling)
  useSSE({
    channel: "general",
    onSnapshot: useCallback((msg: { todaySalesTotal?: number; todayAppointments?: number }) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          todaySales: msg.todaySalesTotal ?? prev.todaySales,
          todayAppointments: msg.todayAppointments ?? prev.todayAppointments,
        };
      });
    }, []),
  });

  // Full refresh every 30s as fallback (SSE handles real-time)
  useEffect(() => {
    const interval = setInterval(() => {
      apiFetch<DashboardData>("/api/dashboard")
        .then(({ data }) => {
          if (data && typeof data === "object" && "totalClients" in data) {
            setData(data);
          }
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="animate-fadeIn flex flex-col gap-4 flex-1 min-h-0">
        <SkeletonPageHeader />
        <SkeletonStatsRow count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
          <SkeletonBlock className="h-80" />
          <SkeletonBlock className="h-80" />
        </div>
        <SkeletonBlock className="h-20" />
      </div>
    );
  }

  if (!data) return null;

  const allStats = [
    {
      label: "Clientes Registrados",
      value: data.totalClients,
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      href: "/clientes",
      color: "from-blue-500 to-blue-600",
    },
    {
      label: "Servicios Activos",
      value: data.totalServices,
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
        </svg>
      ),
      href: "/servicios",
      color: "from-violet-500 to-violet-600",
    },
    {
      label: "Ventas del Mes",
      value: `$${data.monthlySales.toFixed(2)}`,
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      href: "/ventas",
      color: "from-emerald-500 to-emerald-600",
    },
    {
      label: "Citas para Hoy",
      value: data.todayAppointments,
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
      href: "/agenda",
      color: "from-amber-500 to-amber-600",
    },
  ];

  // EMPLEADA no ve Ventas del Mes ni Top Clientes
  // Todas las empleadas ven su conteo personal de servicios semanales
  const employeeStat = {
    label: "Mis Servicios esta Semana",
    value: data.myWeeklyServices,
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
    href: "/agenda",
    color: "from-rose-400 to-rose-500",
  };
  const stats = isAdmin 
    ? allStats 
    : [...allStats.filter(s => s.label !== "Ventas del Mes"), employeeStat];

  const totalWeeklyCompleted = data.weeklyCompletedByCategory.reduce((acc, s) => acc + s._count, 0);
  const filteredTrend = showMonths === 6 ? data.monthlyTrend.slice(-6) : data.monthlyTrend;

  return (
    <div className="animate-fadeIn flex flex-col gap-4 flex-1 min-h-0">

      {/* ═══════════ Page Header ═══════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark">Dashboard</h1>
          <p className="text-sm text-muted mt-1">Resumen general de tu estudio</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-border shadow-sm text-sm text-muted self-start">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          {new Date().toLocaleDateString("es-MX", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      {/* ═══════════ Stats Cards ═══════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, idx) => (
          <Link key={stat.label} href={stat.href}>
            <div className="card-hover p-4 sm:p-5 group cursor-pointer">
              <div className="flex items-center gap-3 sm:gap-5">
                <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${stat.color} shadow-sm flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                  <div className="text-white">
                    <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      {stat.icon.props.children}
                    </svg>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs text-muted font-medium truncate">{stat.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-dark mt-0.5 sm:mt-1">{stat.value}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ═══════════ Check-in / Asistencia ═══════════ */}
      {!attendanceState.loading && (
        <div className={`rounded-xl border p-4 transition-all duration-300 ${
          attendanceState.checkedIn
            ? "bg-success-bg/40 border-success/30"
            : "bg-primary-bg/30 border-primary/20"
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                attendanceState.checkedIn
                  ? "bg-success-bg"
                  : "bg-primary-bg"
              }`}>
                {attendanceState.checkedIn ? (
                  <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${
                  attendanceState.checkedIn ? "text-success" : "text-primary"
                }`}>
                  {attendanceState.checkedIn
                    ? "Asistencia registrada hoy ✅"
                    : "Registrar asistencia"
                  }
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {attendanceState.schedule
                    ? `Horario hoy: ${attendanceState.schedule.startTime} - ${attendanceState.schedule.endTime}`
                    : attendanceState.checkedIn
                    ? "Ya registraste tu entrada"
                    : "No tienes horario asignado para hoy"}
                  {attendanceState.workLocation?.name && (
                    <> · {attendanceState.workLocation.name}</>
                  )}
                </p>
              </div>
            </div>
            {!attendanceState.checkedIn && (
              <button
                onClick={handleCheckIn}
                disabled={attendanceState.checking || !attendanceState.schedule}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex-shrink-0"
              >
                {attendanceState.checking ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verificando ubicación...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    Marcar Entrada
                  </>
                )}
              </button>
            )}
          </div>
          {attendanceState.error && (
            <p className="text-xs text-danger mt-2 ml-[3.25rem]">{attendanceState.error}</p>
          )}
        </div>
      )}

      {/* ═══════════ Tendencia Mes vs Mes Anterior (solo ADMIN) ═══════════ */}
      {isAdmin && data.monthlyTrend.length >= 2 && (() => {
        const current = data.monthlyTrend[data.monthlyTrend.length - 1];
        const previous = data.monthlyTrend[data.monthlyTrend.length - 2];
        const change = previous.total > 0
          ? ((current.total - previous.total) / previous.total * 100)
          : current.total > 0 ? 100 : 0;
        const isUp = change > 0;
        const isDown = change < 0;
        return (
          <div className="flex flex-wrap gap-3">
            <div className="card-hover p-4 flex-1 min-w-[200px]">
              <p className="text-xs text-muted font-medium">Ventas este mes</p>
              <p className="text-xl font-bold text-dark mt-1">${current.total.toFixed(2)}</p>
              <p className="text-xs text-muted mt-1">{current.count} {current.count === 1 ? "venta" : "ventas"}</p>
            </div>
            <div className="card-hover p-4 flex-1 min-w-[200px]">
              <p className="text-xs text-muted font-medium">Mes anterior</p>
              <p className="text-xl font-bold text-dark mt-1">${previous.total.toFixed(2)}</p>
              <p className="text-xs text-muted mt-1">{previous.count} {previous.count === 1 ? "venta" : "ventas"}</p>
            </div>
            <div className={`card-hover p-4 flex-1 min-w-[200px] ${isUp ? "ring-1 ring-emerald-200" : isDown ? "ring-1 ring-red-200" : ""}`}>
              <p className="text-xs text-muted font-medium">Cambio</p>
              <p className={`text-xl font-bold mt-1 ${isUp ? "text-emerald-600" : isDown ? "text-red-500" : "text-dark"}`}>
                {isUp ? "+" : ""}{change.toFixed(1)}%
              </p>
              <p className={`text-xs mt-1 ${isUp ? "text-emerald-600" : isDown ? "text-red-500" : "text-muted"}`}>
                {isUp ? "📈 En crecimiento" : isDown ? "📉 En descenso" : "➡️ Sin cambio"}
              </p>
            </div>
            {isDown && current.total < previous.total * 0.8 && (
              <div className="w-full">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                  </svg>
                  <span className="text-xs font-medium text-red-700">Las ventas bajaron más del 20% vs el mes anterior. Revisa las estrategias de marketing.</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ═══════════ Gráfica: Ingresos Mensuales (solo ADMIN) ═══════════ */}
      {isAdmin && (
      <div className="card p-5">
        <div className="section-header mb-4">
          <span className="section-accent" />
          <h2 className="section-title">Ingresos Mensuales</h2>
          <div className="ml-auto flex items-center gap-1 p-0.5 bg-surface rounded-lg border border-border">
            <button
              onClick={() => setShowMonths(6)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                showMonths === 6
                  ? "bg-white text-dark shadow-sm border border-border"
                  : "text-muted hover:text-dark"
              }`}
            >
              6 meses
            </button>
            <button
              onClick={() => setShowMonths(12)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                showMonths === 12
                  ? "bg-white text-dark shadow-sm border border-border"
                  : "text-muted hover:text-dark"
              }`}
            >
              12 meses
            </button>
          </div>
        </div>
        {data.monthlyTrend.length === 0 || data.monthlyTrend.every((m) => m.total === 0) ? (
          <div className="flex flex-col items-center justify-center text-center py-10">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary-bg flex items-center justify-center">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-muted">Sin datos de ingresos</p>
            <p className="text-xs text-muted/60 mt-1">Los ingresos mensuales aparecerán aquí cuando registres ventas</p>
          </div>
        ) : (
          <div className="mt-2">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={filteredTrend}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) =>
                    value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [formatter.format(value), "Ingresos"]}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                />
                <Line
                  name="total"
                  type="monotone"
                  dataKey="total"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      )}

      {/* ═══════════ Servicios Populares + Servicios de la Semana ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ─── Servicios Más Populares ─── */}
        <div className="card p-5">
          <div className="section-header mb-4">
            <span className="section-accent" />
            <h2 className="section-title">Servicios Más Populares</h2>
            <span className="text-[10px] text-muted font-medium ml-auto px-2 py-0.5 rounded-full bg-surface border border-border">
              Por reservas
            </span>
          </div>
          {data.topServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-violet-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                </svg>
              </div>
              <p className="text-sm font-medium text-muted">Sin reservas aún</p>
              <p className="text-xs text-muted/60 mt-1">Los servicios más reservados aparecerán aquí</p>
            </div>
          ) : (
            <div className="mt-2">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={data.topServices}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "#334155" }}
                    tickLine={false}
                    axisLine={false}
                    width={160}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, name: string) => [value, "Reservas"]}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
                    {data.topServices.map((s) => (
                      <Cell key={`ts-${s.id}`} fill={CHART_COLORS[s.id % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ─── Servicios de la Semana ─── */}
        <div className="card p-5">
          <div className="section-header mb-4">
            <span className="section-accent" />
            <h2 className="section-title">Servicios de la Semana</h2>
            <span className="text-[10px] text-muted font-medium ml-auto px-2 py-0.5 rounded-full bg-surface border border-border">
              Esta semana
            </span>
          </div>
          {!data.weeklyServices || data.weeklyServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-rose-50 flex items-center justify-center">
                <svg className="w-7 h-7 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                </svg>
              </div>
              <p className="text-sm font-medium text-muted">Sin servicios esta semana</p>
              <p className="text-xs text-muted/60 mt-1">Los servicios realizados esta semana aparecerán aquí al completar citas</p>
            </div>
          ) : (
            <div className="mt-2">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={data.weeklyServices}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="serviceName"
                    tick={{ fontSize: 9, fill: "#334155" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, name: string, props: any) => [value, props.payload.category ? `${props.payload.category}` : "Servicios"]}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={24}>
                    {data.weeklyServices.map((s) => (
                      <Cell key={`ws-${s.serviceId}`} fill={CHART_COLORS[s.serviceId % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap gap-2 justify-center">
                {data.weeklyServices.map((s, idx) => (
                  <span
                    key={`badge-${s.serviceId ?? idx}`}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: CHART_COLORS[(s.serviceId ?? 0) % CHART_COLORS.length] + "12",
                      color: CHART_COLORS[(s.serviceId ?? 0) % CHART_COLORS.length],
                    }}
                  >
                    <span className="font-bold">{s.count}</span>
                    {s.serviceName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Top Clientes (solo ADMIN) ─── */}
      {isAdmin && data.topClients.length > 0 && (
        <div className="card p-5">
          <div className="section-header mb-4">
            <span className="section-accent" />
            <h2 className="section-title">Top Clientes</h2>
            <span className="text-[10px] text-muted font-medium ml-auto px-2 py-0.5 rounded-full bg-surface border border-border">
              Por gasto
            </span>
          </div>
          <div className="space-y-3 mt-2">
            {data.topClients.map((client, idx) => {
              const maxSpent = data.topClients[0]?.totalSpent || 1;
              const barWidth = (client.totalSpent / maxSpent) * 100;
              return (
                <Link
                  key={client.id}
                  href={`/clientes/${client.id}`}
                  className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-surface transition-all duration-200 group"
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold flex-shrink-0"
                    style={{
                      backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] + "15",
                      color: CHART_COLORS[idx % CHART_COLORS.length],
                    }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-dark truncate group-hover:text-primary transition-colors">
                        {client.name}
                      </span>
                      <span className="text-sm font-bold text-dark flex-shrink-0">
                        {formatter.format(client.totalSpent)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-muted">
                        {client.saleCount} {client.saleCount === 1 ? "venta" : "ventas"}
                      </span>
                      {client.phone && (
                        <span className="text-xs text-muted/60">
                          {client.phone}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════ Two-column section ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">

        {/* ─── Servicios por Categoría (esta semana) ─── */}
        <div className="card p-5 flex flex-col">
          <div className="section-header mb-4">
            <span className="section-accent" />
            <h2 className="section-title">Servicios por Categoría</h2>
            <span className="text-[10px] text-muted font-medium ml-auto px-2 py-0.5 rounded-full bg-surface border border-border">
              {data.myName ? `Tus servicios: ${data.myWeeklyServices}` : "Esta semana"}
            </span>
          </div>
          <div className="flex-1 space-y-3">
            {totalWeeklyCompleted === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary-bg flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-muted">Sin servicios esta semana</p>
                <p className="text-xs text-muted/60 mt-1">Completa citas para ver los resultados aquí</p>
              </div>
            ) : (
              data.weeklyCompletedByCategory.map((cat) => {
                const percentage = totalWeeklyCompleted > 0 ? ((cat._count / totalWeeklyCompleted) * 100).toFixed(0) : 0;
                const colors: Record<string, { bar: string; bg: string; icon: string }> = {
                  GENERAL: { bar: "bg-teal-500", bg: "bg-teal-50", icon: "🔧" },
                  MAQUILLAJE: { bar: "bg-primary", bg: "bg-primary-bg", icon: "💄" },
                  CEJAS: { bar: "bg-warning", bg: "bg-warning-bg", icon: "👁️" },
                  PESTAÑAS: { bar: "bg-violet-500", bg: "bg-violet-50", icon: "✨" },
                  MANICURE: { bar: "bg-rose-500", bg: "bg-rose-50", icon: "💅" },
                };
                const cfg = colors[cat.category] || { bar: "bg-primary", bg: "bg-primary-bg", icon: "📋" };
                return (
                  <div key={cat.category} className={`${cfg.bg} rounded-xl p-5`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{cfg.icon}</span>
                        <span className="font-semibold text-dark">{cat.category}</span>
                      </div>
                      <span className="text-xs text-muted font-medium bg-white/60 px-3 py-1 rounded-full">
                        {cat._count} realizados
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 bg-white/70 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${cfg.bar} transition-all duration-1000 ease-out`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-muted flex-shrink-0 w-10 text-right">{percentage}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ─── Productos con Stock Bajo ─── */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="section-header mb-0">
              <span className="section-accent" />
              <h2 className="section-title">Productos por Reponer</h2>
            </div>
            <Link href="/inventario" className="text-xs text-primary hover:text-primary-dark transition-colors font-medium">
              Ver todo →
            </Link>
          </div>
          <div className="flex-1">
            {data.lowStockProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-bg flex items-center justify-center">
                  <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-muted">Todo en stock suficiente</p>
                <p className="text-xs text-muted/60 mt-1">No hay productos por reabastecer</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.lowStockProducts.map((product) => {
                  const ratio = product.minStock > 0 ? (product.quantity / product.minStock) * 100 : 0;
                  const isCritial = ratio <= 30;
                  return (
                    <div
                      key={product.id}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        isCritial ? "bg-danger-bg border-danger/20" : "bg-warning-bg border-warning/20"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-10 h-10 rounded-lg ${
                          isCritial ? "bg-danger/10" : "bg-warning/10"
                        } flex items-center justify-center flex-shrink-0`}>
                          <svg className={`w-5 h-5 ${isCritial ? "text-danger" : "text-warning"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-dark truncate">{product.name}</p>
                          <p className="text-xs text-muted mt-0.5">
                            Stock: <span className={`font-semibold ${isCritial ? "text-danger" : "text-warning"}`}>{product.quantity}</span> / {product.minStock} mínimo
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="hidden sm:block w-20 h-2 bg-white/80 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isCritial ? "bg-danger" : "bg-warning"}`}
                            style={{ width: `${Math.min(100, ratio)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                          isCritial ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
                        }`}>
                          {product.quantity}/{product.minStock}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ Servicios por Empleada (esta semana) ═══════════ */}
      {isAdmin && data.servicesByEmployee && data.servicesByEmployee.length > 0 && (
        <div className="card p-5">
          <div className="section-header mb-4">
            <span className="section-accent" />
            <h2 className="section-title">Servicios por Empleada</h2>
            <span className="text-[10px] text-muted font-medium ml-auto px-2 py-0.5 rounded-full bg-surface border border-border">
              Esta semana
            </span>
          </div>
          {data.servicesByEmployee.length === 0 || data.servicesByEmployee.every(s => s.count === 0) ? (
            <div className="flex flex-col items-center justify-center text-center py-10">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary-bg flex items-center justify-center">
                <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-muted">Sin servicios esta semana</p>
              <p className="text-xs text-muted/60 mt-1">Completa citas para ver los resultados aquí</p>
            </div>
          ) : (
            <div className="mt-2">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data.servicesByEmployee}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="employeeName"
                    tick={{ fontSize: 12, fill: "#334155" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [value, "Servicios"]}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={48}>
                    {data.servicesByEmployee.map((s) => (
                      <Cell key={`emp-${s.employeeId}`} fill={CHART_COLORS[(s.employeeId ?? 0) % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ Próximas Citas ═══════════ */}
      <ErrorBoundary fallback={<div className="card p-5 text-center text-muted text-sm">Error cargando citas. <button onClick={() => window.location.reload()} className="text-primary underline">Recargar</button></div>}>
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="section-header mb-0">
            <span className="section-accent" />
            <h2 className="section-title">Próximas Citas</h2>
          </div>
          <Link href="/agenda" className="text-xs text-primary hover:text-primary-dark transition-colors font-medium">
            Ver agenda completa →
          </Link>
        </div>
        {data.recentAppointments.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-bg flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-muted">No hay citas próximas</p>
            <p className="text-xs text-muted/60 mt-1">Las citas programadas aparecerán aquí</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3.5 pr-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Cliente</th>
                  <th className="pb-3.5 pr-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Servicio</th>
                  <th className="pb-3.5 pr-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">Fecha</th>
                  <th className="pb-3.5 text-left text-xs font-semibold text-muted uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.recentAppointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-surface/80 transition-colors">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-bg flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
                          <span className="text-sm font-bold text-primary">
                            {apt.client.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-dark">{apt.client.name}</span>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-sm text-muted">{apt.service.name}</td>
                    <td className="py-4 pr-4 text-sm text-muted whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        {new Date(apt.date).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={`badge text-xs ${
                        statusColors[apt.status] || "bg-gray-50 text-gray-700 border-gray-200"
                      }`}>
                        {apt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </ErrorBoundary>
    </div>
  );
}
