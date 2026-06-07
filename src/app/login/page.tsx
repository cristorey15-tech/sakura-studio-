"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

interface EmployeeOption {
  id: number;
  name: string;
  role: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Cargar lista de empleadas con contraseña
  useEffect(() => {
    apiFetch<{ employees: EmployeeOption[] }>("/api/auth/login").then(({ data }) => {
      if (data?.employees) {
        setEmployees(data.employees);
        // Si solo hay una, seleccionarla automáticamente
        if (data.employees.length === 1) {
          setSelectedId(data.employees[0].id);
        }
      }
      setFetching(false);
    });
  }, []);

  // Si ya está logueado, redirigir al dashboard
  useEffect(() => {
    if (!authLoading && user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Auto-focus en password cuando se selecciona empleada
  useEffect(() => {
    if (!authLoading && !user && selectedId) {
      setTimeout(() => passwordRef.current?.focus(), 100);
    }
  }, [selectedId, authLoading, user]);

  const selectedEmployee = employees.find((e) => e.id === selectedId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !password.trim()) return;
    setError("");
    setLoading(true);

    const { data, error: apiError } = await apiFetch<{ user: { id: number; name: string; role: string } }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ name: selectedEmployee?.name, password }) }
    );

    if (data) {
      await refreshUser();
      router.push("/");
    } else {
      setError(apiError || "Credenciales inválidas");
      setPassword("");
      passwordRef.current?.focus();
    }

    setLoading(false);
  };

  // Mientras verifica si hay sesión activa
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-amber-50">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Si ya está logueado, no mostrar nada
  if (user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-amber-50 p-4">
      <div className="w-full max-w-sm animate-fadeIn">
        {/* ── Logo Hero ── */}
        <div className="text-center mb-10">
          <div className="relative inline-flex mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-warning/20 rounded-full blur-3xl scale-150" />
            <img
              src="/logo.png"
              alt="Sakura Studio"
              className="h-24 w-auto mx-auto relative drop-shadow-sm"
            />
          </div>
          <h1 className="text-3xl font-bold text-dark tracking-tight">
            Sakura Studio
          </h1>
          <p className="text-sm text-muted/70 mt-1.5 font-medium">
            Estudio de Belleza
          </p>
        </div>

        {/* ── Card ── */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-border/60 shadow-lg shadow-rose-200/30 p-7">
          <div className="text-center mb-7">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-dark mx-auto mb-4 flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-dark">Iniciar Sesión</h2>
            <p className="text-sm text-muted/80 mt-1">
              Selecciona tu usuario e ingresa tu contraseña
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Selector de empleada */}
            <div>
              <label htmlFor="login-user" className="block text-sm font-semibold text-dark/80 mb-2">
                Usuario
              </label>
              {fetching ? (
                <div className="h-11 rounded-xl bg-surface/50 border border-border flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : employees.length === 0 ? (
                <div className="h-11 rounded-xl bg-warning-bg/50 border border-warning/20 flex items-center justify-center text-sm text-warning font-medium">
                  No hay usuarios con contraseña
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="login-user"
                    name="login-user"
                    value={selectedId ?? ""}
                    onChange={(e) => {
                      setSelectedId(e.target.value ? Number(e.target.value) : null);
                      setError("");
                      setPassword("");
                    }}
                    className="input appearance-none pr-10"
                    disabled={loading}
                  >
                    <option value="">Seleccionar usuario...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} — {emp.role === "ADMIN" ? "⭐ Admin" : emp.role === "ESTETICISTA" ? "💄 Esteticista" : "👩‍💼 Empleada"}
                      </option>
                    ))}
                  </select>
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-dark/80 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="login-password"
                  name="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input text-center text-xl tracking-[0.4em] py-3 px-4 rounded-xl border-2 focus:border-primary transition-all"
                  placeholder="····"
                  autoComplete="current-password"
                  disabled={loading || !selectedId}
                  maxLength={20}
                />
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-danger-bg/80 border border-danger/20 text-sm text-danger font-medium flex items-center gap-2.5 animate-scaleIn">
                <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !selectedId || !password.trim()}
              className="btn-primary w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Iniciando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Entrar
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              )}
            </button>
          </form>
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-xs text-muted/50 mt-8">
          © {new Date().getFullYear()} Sakura Studio — Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}
