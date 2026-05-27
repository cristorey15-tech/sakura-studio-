"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/lib/ThemeProvider";

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  showLabel?: boolean;
  adminOnly?: boolean;
}

const navigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    name: "Servicios",
    href: "/servicios",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
  },
  {
    name: "Clientes",
    href: "/clientes",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    name: "Empleadas",
    href: "/empleadas",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    adminOnly: true,
  },
  {
    name: "Agenda",
    href: "/agenda",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    name: "Ventas",
    href: "/ventas",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    adminOnly: true,
  },
  {
    name: "Reportes",
    href: "/reportes",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
    adminOnly: true,
  },
  {
    name: "Inventario",
    href: "/inventario",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    adminOnly: true,
  },
  {
    name: "Auditoría",
    href: "/auditoria",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    adminOnly: true,
  },
  {
    name: "Configuración",
    href: "/configuracion",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    showLabel: false,
    adminOnly: true,
  },
];

// Filtrar navegación según el rol del usuario
const getVisibleNav = (isAdmin: boolean) => {
  if (isAdmin) return navigation;
  return navigation.filter((item) => !item.adminOnly);
};

export default function TopNavbar() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const isActivePath = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden");
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError("La contraseña debe tener al menos 4 caracteres");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setPasswordSuccess("Contraseña actualizada exitosamente");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          setShowChangePassword(false);
          setPasswordSuccess("");
        }, 1500);
      } else {
        const data = await res.json();
        setPasswordError(data.error || "Error al cambiar contraseña");
      }
    } catch {
      setPasswordError("Error de conexión");
    } finally {
      setChangingPassword(false);
    }
  };

  if (pathname === "/login") {
    return null;
  }

  return (
    <>
      {/* ========== DESKTOP NAVBAR (md+) ========== */}
      <header className="hidden md:block bg-white border-b border-border shadow-sm">
        <div className="px-6 sm:px-10 lg:px-20 xl:px-28">
          <div className="flex items-center justify-between h-12 lg:h-14 xl:h-16">

            {/* ── Logo ── */}
            <Link href="/" className="flex items-center flex-shrink-0 mr-2 lg:mr-3">
              <img
                src="/logo.png"
                alt="Sakura Studio"
                className="h-8 lg:h-9 xl:h-10 w-auto"
              />
            </Link>

            {/* ── Nav pills ── */}
            <nav className="flex items-center gap-1 lg:gap-1.5 xl:gap-2 overflow-x-auto scrollbar-none flex-1 justify-center">
              {getVisibleNav(isAdmin).map((item) => {
                const isActive = isActivePath(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1 xl:gap-1.5 px-1.5 lg:px-2.5 xl:px-3 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:bg-surface hover:text-dark"
                    }`}
                    title={item.name}
                    aria-label={item.name}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {item.showLabel !== false && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </nav>

            {/* ── Right side: Dark mode + User menu ── */}
            <div className="flex items-center gap-1.5 lg:gap-2 flex-shrink-0 ml-2 lg:ml-3">
              {/* Search */}
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("open-global-search"))}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface/50 hover:bg-surface border border-border text-xs text-muted transition-colors"
                title="Buscar (Cmd+K)"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden sm:inline">Buscar...</span>
                <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-border text-[10px] font-medium text-muted">
                  <span className="text-[9px]">⌘</span>K
                </kbd>
              </button>
              {/* Dark mode toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-surface transition-colors text-muted hover:text-dark"
                title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
                aria-label="Cambiar tema"
              >
                {theme === "dark" ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                )}
              </button>
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-2.5 py-1.5 lg:py-2 rounded-lg hover:bg-surface transition-colors"
                  >
                    <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-full bg-primary-bg flex items-center justify-center">
                      <span className="text-[10px] lg:text-xs font-bold text-primary">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="hidden lg:inline text-xs text-muted font-medium">{user.name}</span>
                    <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl border border-border shadow-lg animate-scaleIn z-20 overflow-hidden">
                        <div className="p-3 border-b border-border">
                          <p className="text-sm font-semibold text-dark">{user.name}</p>
                          <p className="text-xs text-muted mt-0.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-bg text-primary">{user.role}</span>
                          </p>
                        </div>
                        <div className="p-1">
                          <button
                            onClick={() => { setShowUserMenu(false); setShowChangePassword(true); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted hover:text-dark hover:bg-surface rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                            Cambiar contraseña
                          </button>
                          <button
                            onClick={() => { setShowUserMenu(false); logout(); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-danger hover:bg-danger-bg rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                            </svg>
                            Cerrar sesión
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* ========== MOBILE HEADER (< md) ========== */}
      <div className="md:hidden bg-white border-b border-border shadow-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Sakura Studio"
              className="h-9 w-auto"
            />
          </Link>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-surface transition-colors text-muted"
              aria-label="Cambiar tema"
            >
              {theme === "dark" ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-surface transition-colors"
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            >
              <svg className="w-5 h-5 text-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ========== MOBILE OVERLAY ========== */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside
            className="absolute left-0 top-14 h-full w-64 sm:w-72 bg-white shadow-xl border-r border-border animate-slideIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User info in mobile menu */}
            {user && (
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-bg flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-dark truncate">{user.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-primary-bg text-primary">{user.role}</span>
                  </div>
                </div>
              </div>
            )}
            <nav className="p-3 space-y-1">
              {getVisibleNav(isAdmin).map((item) => {
                const isActive = isActivePath(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-muted hover:bg-surface hover:text-dark"
                    }`}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {item.showLabel !== false && <span>{item.name}</span>}
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </Link>
                );
              })}
            </nav>
            {/* Mobile logout */}
            {user && (
              <div className="p-3 border-t border-border">
                <button
                  onClick={() => { setMobileMenuOpen(false); setShowChangePassword(true); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-muted hover:bg-surface transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Cambiar contraseña
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-danger hover:bg-danger-bg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ═══════════ Modal de Cambiar Contraseña ═══════════ */}
      {showChangePassword && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
          onClick={() => { setShowChangePassword(false); setPasswordError(""); setPasswordSuccess(""); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
        >
          <div
            className="card max-w-md w-full p-5 animate-scaleIn shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-bg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-dark">Cambiar Contraseña</h3>
                  <p className="text-xs text-muted">{user?.name}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowChangePassword(false); setPasswordError(""); setPasswordSuccess(""); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-dark transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark mb-1.5">Contraseña actual</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input"
                  placeholder="Ingresa tu contraseña actual"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-1.5">Nueva contraseña</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input"
                  placeholder="Mínimo 4 caracteres"
                  minLength={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark mb-1.5">Confirmar nueva contraseña</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="Repite la nueva contraseña"
                  minLength={4}
                />
              </div>

              {passwordError && (
                <div className="p-3 rounded-lg bg-danger-bg border border-danger/20 text-sm text-danger font-medium">{passwordError}</div>
              )}
              {passwordSuccess && (
                <div className="p-3 rounded-lg bg-success-bg border border-success/20 text-sm text-success font-medium">{passwordSuccess}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowChangePassword(false); setPasswordError(""); setPasswordSuccess(""); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changingPassword ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
