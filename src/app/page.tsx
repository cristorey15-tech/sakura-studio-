"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { useSSE } from "@/hooks/useSSE";
import { SkeletonPageHeader, SkeletonBlock, SkeletonStatsRow } from "@/components/LoadingSkeleton";
import ErrorBoundary from "@/components/ErrorBoundary";
import DashboardWAReminder from "@/components/DashboardWAReminder";
import DashboardMonthlyChart from "@/components/DashboardMonthlyChart";
import DashboardTopServicesChart from "@/components/DashboardTopServicesChart";
import DashboardWeeklyServicesChart from "@/components/DashboardWeeklyServicesChart";
import DashboardServicesByEmployeeChart from "@/components/DashboardServicesByEmployeeChart";

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
  lastWeekSales: number;
  lastWeekSalesCount: number;
  yesterdayAppointments: number;
  newClientsThisMonth: number;
  lastMonthSales: number;
  inactiveClientsCount: number;
  inactiveClients: Array<{ id: number; name: string; phone: string | null; lastVisit: string | null }>;
  newClients: Array<{ id: number; name: string; phone: string | null; createdAt: string }>;
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
  const [dashboardEmployeeFilter, setDashboardEmployeeFilter] = useState("");
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);
  const [waExpandKey, setWaExpandKey] = useState(0);

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

  const loadDashboard = useCallback((empId?: string) => {
    let url = "/api/dashboard";
    if (empId) url += `?employeeId=${encodeURIComponent(empId)}`;
    apiFetch<DashboardData>(url)
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
  }, [showToast]);

  useEffect(() => {
    loadDashboard(dashboardEmployeeFilter || undefined);
    checkAttendanceStatus();
    // Load employees for filter dropdown
    apiFetch<{ id: number; name: string; active: boolean }[]>("/api/empleadas")
      .then(({ data }) => {
        if (data) setEmployees(data.filter((e) => e.active));
      })
      .catch(() => {});
  }, [dashboardEmployeeFilter, loadDashboard, checkAttendanceStatus]);

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
      let url = "/api/dashboard";
      if (dashboardEmployeeFilter) url += `?employeeId=${encodeURIComponent(dashboardEmployeeFilter)}`;
      apiFetch<DashboardData>(url)
        .then(({ data }) => {
          if (data && typeof data === "object" && "totalClients" in data) {
            setData(data);
          }
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [dashboardEmployeeFilter]);

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

  // ─── Helper: format % change ───
  const formatPct = (current: number, previous: number): { text: string; isUp: boolean; isDown: boolean } => {
    if (previous === 0 && current === 0) return { text: "Sin datos", isUp: false, isDown: false };
    if (previous === 0) return { text: "+100%", isUp: true, isDown: false };
    const change = ((current - previous) / previous) * 100;
    const absChange = Math.abs(change);
    if (change > 0) return { text: `+${absChange.toFixed(1)}%`, isUp: true, isDown: false };
    if (change < 0) return { text: `-${absChange.toFixed(1)}%`, isUp: false, isDown: true };
    return { text: "0%", isUp: false, isDown: false };
  };

  const salesPct = formatPct(data.monthlySales, data.lastMonthSales);
  const weekSalesPct = formatPct(data.monthlySales, data.lastWeekSales * 4.33);
  const apptsPct = formatPct(data.todayAppointments, data.yesterdayAppointments);

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
      tooltip: (
        <div className="space-y-1">
          <p className="flex items-center justify-between gap-3">
            <span className="text-muted">Nuevos este mes</span>
            <span className="font-semibold text-dark">{data.newClientsThisMonth}</span>
          </p>
          <p className="flex items-center justify-between gap-3">
            <span className="text-muted">Total citas</span>
            <span className="font-semibold text-dark">{data.totalAppointments}</span>
          </p>
        </div>
      ),
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
      tooltip: (
        <p className="flex items-center justify-between gap-3">
          <span className="text-muted">Total citas agendadas</span>
          <span className="font-semibold text-dark">{data.totalAppointments}</span>
        </p>
      ),
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
      tooltip: (
        <div className="space-y-1.5">
          <p className="flex items-center justify-between gap-3">
            <span className="text-muted">Vs mes pasado</span>
            <span className={`font-semibold ${salesPct.isUp ? "text-emerald-600" : salesPct.isDown ? "text-red-500" : "text-muted"}`}>
              {salesPct.text}
            </span>
          </p>
          <p className="flex items-center justify-between gap-3">
            <span className="text-muted">Semana pasada</span>
            <span className="font-semibold text-dark">${data.lastWeekSales.toFixed(2)}</span>
          </p>
          <p className="flex items-center justify-between gap-3">
            <span className="text-muted">Proyección mensual</span>
            <span className={`font-semibold ${weekSalesPct.isUp ? "text-emerald-600" : weekSalesPct.isDown ? "text-red-500" : "text-muted"}`}>
              {weekSalesPct.text}
            </span>
          </p>
        </div>
      ),
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
      tooltip: (
        <div className="space-y-1">
          <p className="flex items-center justify-between gap-3">
            <span className="text-muted">Ayer</span>
            <span className="font-semibold text-dark">{data.yesterdayAppointments}</span>
          </p>
          <p className="flex items-center justify-between gap-3">
            <span className="text-muted">Cambio</span>
            <span className={`font-semibold ${apptsPct.isUp ? "text-emerald-600" : apptsPct.isDown ? "text-red-500" : "text-muted"}`}>
              {apptsPct.text}
            </span>
          </p>
        </div>
      ),
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
    tooltip: (
      <p className="flex items-center justify-between gap-3">
        <span className="text-muted">Servicios esta semana</span>
        <span className="font-semibold text-dark">{data.myWeeklyServices}</span>
      </p>
    ),
  };
  const stats = isAdmin 
    ? allStats 
    : [...allStats.filter(s => s.label !== "Ventas del Mes"), employeeStat];

  const totalWeeklyCompleted = data.weeklyCompletedByCategory.reduce((acc, s) => acc + s._count, 0);

  return (
    <div className="animate-fadeIn flex flex-col gap-4 flex-1 min-h-0">

      {/* ═══════════ Page Header ═══════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark">Dashboard</h1>
          <p className="text-sm text-muted mt-1">Resumen general de tu estudio</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          {/* Employee filter */}
          {isAdmin && (
            <select
              value={dashboardEmployeeFilter}
              onChange={(e) => {
                const val = e.target.value;
                setDashboardEmployeeFilter(val);
                setLoading(true);
              }}
              className="select text-xs py-1.5 pr-7 appearance-none bg-white"
            >
              <option value="">Todas las empleadas</option>
              <option value="_unassigned">— Sin asignar —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          )}
          {/* Compact attendance check-in */}
          {!attendanceState.loading && (
            attendanceState.checkedIn ? (
              <div className="relative group/tooltip">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-success/30 bg-success-bg/50 text-xs font-medium text-success shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Presente
                </div>
                {/* Tooltip */}
                <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-white rounded-xl border border-border shadow-lg z-50 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 pointer-events-none">
                  <div className="text-xs space-y-1.5">
                    <p className="font-semibold text-success flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Asistencia registrada
                    </p>
                    <div className="h-px bg-border" />
                    {attendanceState.schedule && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Horario hoy</span>
                        <span className="font-medium text-dark">{attendanceState.schedule.startTime} - {attendanceState.schedule.endTime}</span>
                      </div>
                    )}
                    {attendanceState.workLocation?.name && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Ubicación</span>
                        <span className="font-medium text-dark truncate max-w-[140px]">{attendanceState.workLocation.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-full right-4 w-3 h-3 bg-white border-l border-t border-border rotate-45 -mb-1.5" />
                </div>
              </div>
            ) : (
              <div className="relative group/tooltip">
                <button
                  onClick={handleCheckIn}
                  disabled={attendanceState.checking || !attendanceState.schedule}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {attendanceState.checking ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  )}
                  Entrada
                </button>
                {/* Tooltip */}
                <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-white rounded-xl border border-border shadow-lg z-50 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 pointer-events-none">
                  <div className="text-xs space-y-1.5">
                    <p className="font-semibold text-amber-700 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      Marcar entrada
                    </p>
                    <div className="h-px bg-border" />
                    {attendanceState.schedule ? (
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Horario hoy</span>
                        <span className="font-medium text-dark">{attendanceState.schedule.startTime} - {attendanceState.schedule.endTime}</span>
                      </div>
                    ) : (
                      <p className="text-muted">No tienes horario asignado para hoy</p>
                    )}
                    {attendanceState.workLocation?.name && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Ubicación</span>
                        <span className="font-medium text-dark truncate max-w-[140px]">{attendanceState.workLocation.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-full right-4 w-3 h-3 bg-white border-l border-t border-border rotate-45 -mb-1.5" />
                </div>
              </div>
            )
          )}
          {/* New clients this month badge (admin only) */}
          {isAdmin && data && data.newClients.length > 0 && (
            <div className="relative group/tooltip">
              <Link
                href="/clientes"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-all duration-200 shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                +{data.newClients.length} nuevos
              </Link>
              {/* Tooltip */}
              <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-white rounded-xl border border-border shadow-lg z-50 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 pointer-events-none">
                <div className="text-xs space-y-1.5">
                  <p className="font-semibold text-blue-700 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    {data.newClients.length} {data.newClients.length === 1 ? "nuevo cliente" : "nuevos clientes"} este mes
                  </p>
                  <div className="h-px bg-border" />
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {data.newClients.slice(0, 20).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-dark truncate">{c.name}</p>
                          <p className="text-[10px] text-muted/70">{c.phone || "Sin teléfono"}</p>
                        </div>
                        <span className="text-[10px] text-muted flex-shrink-0">
                          {new Date(c.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    ))}
                    {data.newClients.length > 20 && (
                      <p className="text-[10px] text-muted text-center pt-1">...y {data.newClients.length - 20} más</p>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-full right-4 w-3 h-3 bg-white border-l border-t border-border rotate-45 -mb-1.5" />
              </div>
            </div>
          )}
          {/* Low stock badge (admin only) */}
          {isAdmin && data.lowStockProducts.length > 0 && (
            <div className="relative group/tooltip">
              <Link
                href="/inventario"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 shadow-sm ${
                  data.lowStockProducts.some((p) => p.quantity <= p.minStock * 0.3)
                    ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                    : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                {data.lowStockProducts.length} por reponer
              </Link>
              {/* Tooltip */}
              <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-white rounded-xl border border-border shadow-lg z-50 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 pointer-events-none">
                <div className="text-xs space-y-1.5">
                  <p className="font-semibold flex items-center gap-1.5 text-red-700">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                    Productos por reponer
                  </p>
                  <div className="h-px bg-border" />
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {data.lowStockProducts.map((p) => {
                      const isCritial = p.quantity <= p.minStock * 0.3;
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium text-dark truncate">{p.name}</p>
                          </div>
                          <span className={`text-[10px] font-semibold flex-shrink-0 px-1.5 py-0.5 rounded ${
                            isCritial ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {p.quantity}/{p.minStock}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="absolute bottom-full right-4 w-3 h-3 bg-white border-l border-t border-border rotate-45 -mb-1.5" />
              </div>
            </div>
          )}
          {/* Inactive clients badge (admin only) */}
          {isAdmin && data && data.inactiveClientsCount > 0 && (
            <div className="relative group/tooltip">
              <button
                onClick={() => {
                  setWaExpandKey((k) => k + 1);
                  document.getElementById("whatsapp-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-all duration-200 shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {data.inactiveClientsCount} inactivos
              </button>
              {/* Tooltip */}
              <div className="absolute top-full right-0 mt-2 w-72 p-3 bg-white rounded-xl border border-border shadow-lg z-50 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 pointer-events-none">
                <div className="text-xs space-y-2">
                  <p className="font-semibold text-amber-800 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    {data.inactiveClientsCount} {data.inactiveClientsCount === 1 ? "cliente sin servicio" : "clientes sin servicio"} en 30+ días
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {data.inactiveClients.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-dark truncate">{c.name}</p>
                          <p className="text-[10px] text-muted/70">{c.phone || "Sin teléfono"}</p>
                        </div>
                        <span className="text-[10px] text-amber-700 font-medium flex-shrink-0">
                          {c.lastVisit
                            ? new Date(c.lastVisit).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
                            : "Sin visitas"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted pt-1 border-t border-border">
                    👆 Haz clic para ir a WhatsApp y enviar promociones
                  </p>
                </div>
                {/* Arrow */}
                <div className="absolute bottom-full right-4 w-3 h-3 bg-white border-l border-t border-border rotate-45 -mb-1.5" />
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-border shadow-sm text-xs text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            {new Date().toLocaleDateString("es-MX", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* ═══════════ Stats Cards ═══════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, idx) => (
          <Link key={stat.label} href={stat.href} className="relative group/tooltip">
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
              {/* Tooltip info icon */}
              <div className="absolute top-2 right-2 opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200">
                <div className="relative">
                  <svg className="w-4 h-4 text-muted/60 hover:text-primary cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  {/* Tooltip content */}
                  <div className="absolute bottom-full right-0 mb-2 w-56 p-3 bg-white rounded-xl border border-border shadow-lg z-50 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 pointer-events-none">
                    <div className="text-xs">
                      {stat.tooltip}
                    </div>
                    {/* Arrow */}
                    <div className="absolute top-full right-3 w-3 h-3 bg-white border-r border-b border-border rotate-45 -mt-1.5" />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ═══════════ Recordatorios WhatsApp (Admin) ═══════════ */}
      {isAdmin && <div id="whatsapp-panel"><DashboardWAReminder expandTrigger={waExpandKey} /></div>}

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
        <DashboardMonthlyChart
          monthlyTrend={data.monthlyTrend}
          showMonths={showMonths}
          onToggleMonths={setShowMonths}
          formatter={formatter}
        />
      )}

      {/* ═══════════ Servicios Populares + Servicios de la Semana ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <DashboardTopServicesChart topServices={data.topServices} />

        <DashboardWeeklyServicesChart weeklyServices={data.weeklyServices} />
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
        <DashboardServicesByEmployeeChart servicesByEmployee={data.servicesByEmployee} />
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
