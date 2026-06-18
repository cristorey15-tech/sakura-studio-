"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface Notification {
  id: string;
  type: "appointment" | "stock" | "info";
  message: string;
  time: string;
  read: boolean;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const [dashRes, invRes] = await Promise.all([
        apiFetch<{ todayAppointments: number; lowStockProducts: Array<{ id: number; name: string; quantity: number }> }>("/api/dashboard"),
        apiFetch<{ data: Array<{ id: number; name: string; quantity: number; minStock: number }> }>("/api/inventario?stock=BAJO&limit=50"),
      ]);

      const newNotifs: Notification[] = [];

      if (dashRes.data?.lowStockProducts && dashRes.data.lowStockProducts.length > 0) {
        dashRes.data.lowStockProducts.forEach((p) => {
          newNotifs.push({
            id: `stock-${p.id}`,
            type: "stock",
            message: `⚠️ ${p.name} — stock bajo (${p.quantity})`,
            time: new Date().toISOString(),
            read: false,
          });
        });
      }

      if (dashRes.data?.todayAppointments && dashRes.data.todayAppointments > 0) {
        newNotifs.push({
          id: "today-appts",
          type: "appointment",
          message: `📅 Tienes ${dashRes.data.todayAppointments} cita${dashRes.data.todayAppointments !== 1 ? "s" : ""} hoy`,
          time: new Date().toISOString(),
          read: false,
        });
      }

      setNotifications(newNotifs);
      setUnreadCount(newNotifs.filter((n) => !n.read).length);
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Check every 60s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-surface transition-colors text-muted hover:text-dark"
        title="Notificaciones"
        aria-label="Notificaciones"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl border border-border shadow-xl animate-scaleIn z-20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-dark">Notificaciones</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-primary hover:text-primary-dark font-medium transition-colors"
                >
                  Marcar todo leído
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted">Sin notificaciones</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 border-b border-border/50 hover:bg-surface/50 transition-colors ${
                      !notif.read ? "bg-primary-bg/20" : ""
                    }`}
                  >
                    <p className="text-sm text-dark">{notif.message}</p>
                    <p className="text-[10px] text-muted mt-0.5">
                      {new Date(notif.time).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
