"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SkeletonDetailPage } from "@/components/LoadingSkeleton";
import { apiFetch } from "@/lib/api";
import WAChatPopover from "@/components/WAChatPopover";
import WATemplateManager from "@/components/WATemplateManager";
import Pagination from "@/components/Pagination";

interface ClientDetail {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  visitCount: number;
  freeServiceAvailable: boolean;
  createdAt: string;
  appointments: Array<{
    id: number;
    date: string;
    status: string;
    notes: string | null;
    service: { name: string; price: number };
  }>;
  appointmentsTotal: number;
  appointmentsPage: number;
  appointmentsTotalPages: number;
  sales: Array<{
    id: number;
    date: string;
    total: number;
    totalBs: number | null;
    exchangeRate: number | null;
    paymentMethod: string | null;
    notes: string | null;
    items: Array<{
      id: number;
      quantity: number;
      price: number;
      service: { name: string } | null;
      product: { name: string } | null;
    }>;
  }>;
  salesTotal: number;
  salesPage: number;
  salesTotalPages: number;
  totalSpent: number;
  totalSpentBs: number;
}

const statusColors: Record<string, string> = {
  PENDIENTE: "bg-warning-bg text-warning border-warning/30",
  CONFIRMADA: "bg-primary-bg text-primary border-primary/30",
  COMPLETADA: "bg-success-bg text-success border-success/30",
  CANCELADA: "bg-danger-bg text-danger border-danger/30",
};

export default function ClientDetailPage() {
  const params = useParams();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [appPageLoading, setAppPageLoading] = useState(false);
  const [salesPageLoading, setSalesPageLoading] = useState(false);

  const loadClient = (appPage?: number, salesPage?: number) => {
    const sp = new URLSearchParams();
    if (appPage) sp.set("appPage", String(appPage));
    if (salesPage) sp.set("salesPage", String(salesPage));
    const qs = sp.toString();
    apiFetch<ClientDetail>(`/api/clientes/${params.id}${qs ? `?${qs}` : ""}`)
      .then(({ data }) => {
        if (data) setClient(data);
        setLoading(false);
        setAppPageLoading(false);
        setSalesPageLoading(false);
      });
  };

  useEffect(() => {
    loadClient();
  }, [params.id]);

  if (loading) {
    return <SkeletonDetailPage />;
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-surface flex items-center justify-center">
          <svg className="w-8 h-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="text-muted font-medium">Cliente no encontrado</p>
        <Link href="/clientes" className="text-primary hover:text-primary-dark text-sm mt-3 inline-flex items-center gap-1">
          ← Volver a clientes
        </Link>
      </div>
    );
  }

  const totalVisits = client.visitCount || client.appointmentsTotal;
  const totalSpent = client.totalSpent;
  const totalSpentBs = client.totalSpentBs;
  const lastVisit = client.appointments.length > 0
    ? new Date(client.appointments[0].date).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Sin visitas";

  // Cliente desde
  const customerSince = client.createdAt
    ? new Date(client.createdAt).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  // Gasto promedio por visita
  const avgSpent = totalVisits > 0 ? totalSpent / totalVisits : 0;

  // Servicio favorito (más reservado)
  const serviceCounts: Record<string, { count: number; name: string }> = {};
  client.appointments.forEach((apt) => {
    const key = apt.service.name;
    if (!serviceCounts[key]) serviceCounts[key] = { count: 0, name: key };
    serviceCounts[key].count++;
  });
  const favoriteService = Object.values(serviceCounts).sort((a, b) => b.count - a.count)[0];

  // Timeline combinado (últimas 5 actividades)
  const timeline = [
    ...client.appointments.map((apt) => ({
      id: `apt-${apt.id}`,
      date: apt.date,
      type: "cita" as const,
      label: apt.service.name,
      detail: apt.status,
    })),
    ...client.sales.map((sale) => ({
      id: `sale-${sale.id}`,
      date: sale.date,
      type: "venta" as const,
      label: sale.items.map((i) => i.service?.name || i.product?.name).join(", "),
      detail: `$${sale.total.toFixed(2)}`,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Back link */}
      <Link href="/clientes" className="text-sm text-muted hover:text-dark transition-colors inline-flex items-center gap-1.5 group">
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Volver a clientes
      </Link>

      {/* Profile Card */}
      <div className="card p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-primary-bg flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
            <span className="text-2xl font-bold text-primary">
              {client.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-dark">{client.name}</h1>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {client.phone && (
                <span className="flex items-center gap-1.5 text-sm text-muted bg-surface px-3 py-1 rounded-lg border border-border">
                  <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {client.phone}
                  <button
                    onClick={() => {
                      setShowChat(true);
                    }}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-all duration-200 ml-1"
                    title="Enviar WhatsApp"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </button>
                </span>
              )}
              {client.email && (
                <span className="flex items-center gap-1.5 text-sm text-muted bg-surface px-3 py-1 rounded-lg border border-border">
                  <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {client.email}
                </span>
              )}
            </div>
            {client.notes && (
              <div className="mt-3 text-sm text-muted bg-warning-bg rounded-lg px-3.5 py-2.5 border border-warning/20 flex items-start gap-2">
                <span className="mt-0.5">📝</span>
                <span>{client.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Loyalty badge */}
      {client.freeServiceAvailable && (
        <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">🎁</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">¡Servicio gratis disponible!</p>
            <p className="text-xs text-amber-600/80">Canjea tu servicio de cortesía en tu próxima visita</p>
          </div>
        </div>
      )}

      {/* Visits progress */}
      <div className="mt-3 p-3 rounded-xl bg-surface/70 border border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted">Programa de Fidelidad</span>
          <span className="text-xs font-bold text-dark">{client.visitCount % 5}/5 visitas</span>
        </div>
        <div className="h-2 bg-white rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
            style={{ width: `${((client.visitCount % 5) / 5) * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-muted/60 mt-1.5">
          {client.freeServiceAvailable
            ? "🎉 ¡Ya puedes canjear tu servicio gratis!"
            : `Cada 5 visitas recibes un servicio de cortesía. ¡Te faltan ${5 - (client.visitCount % 5)}!`}
        </p>
      </div>

      {/* Stats - 4 columnas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
          <div className="text-center p-4 bg-primary-bg rounded-xl border border-primary/10">
            <p className="text-2xl font-bold text-primary">{totalVisits}</p>
            <p className="text-xs text-muted mt-1 font-medium">Visitas</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-200/50">
            <p className="text-2xl font-bold text-emerald-600">${totalSpent.toFixed(2)} USD</p>
            {totalSpentBs > 0 && (
              <p className="text-xs font-semibold text-amber-700 mt-0.5">Bs {totalSpentBs.toFixed(2)}</p>
            )}
            <p className="text-xs text-muted mt-1 font-medium">Gastado</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl border border-amber-200/50">
            <p className="text-sm font-bold text-amber-600">{lastVisit}</p>
            <p className="text-xs text-muted mt-1 font-medium">Última visita</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl border border-violet-200/50">
            <p className="text-sm font-bold text-violet-600">${avgSpent.toFixed(2)}</p>
            <p className="text-xs text-muted mt-1 font-medium">Promedio/visita</p>
          </div>
        </div>

        {/* Métricas adicionales */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Cliente desde <strong className="text-dark">{customerSince}</strong></span>
          </div>
          {favoriteService && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              <span>Favorito: <strong className="text-dark">{favoriteService.name}</strong> ({favoriteService.count}x)</span>
            </div>
          )}
        </div>
      </div>

      {/* Timeline de Actividad */}
      <div className="card p-5">
        <div className="section-header">
          <span className="section-accent" />
          <h2 className="section-title">Actividad Reciente</h2>
        </div>
        {timeline.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-surface flex items-center justify-center">
              <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm">Sin actividad registrada</p>
          </div>
        ) : (
          <div className="relative pl-8 space-y-4">
            {/* Línea vertical */}
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border/60" />
            {timeline.map((item) => (
              <div key={item.id} className="relative flex items-start gap-4">
                {/* Punto en la línea */}
                <div className={`absolute -left-[21px] top-1.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  item.type === "cita"
                    ? "bg-primary-bg border-primary"
                    : "bg-emerald-50 border-emerald-500"
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    item.type === "cita" ? "bg-primary" : "bg-emerald-500"
                  }`} />
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-dark truncate">{item.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-surface text-muted border border-border">
                          {item.type === "cita" ? "📅 Cita" : "🛒 Venta"}
                        </span>
                        <span className="text-xs text-muted">
                          {new Date(item.date).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-dark flex-shrink-0 ml-3">
                      {item.detail}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Historial de Citas */}
        <div className="card p-5">
          <div className="section-header">
            <span className="section-accent" />
            <h2 className="section-title">Historial de Citas</h2>
          </div>
          {client.appointments.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-surface flex items-center justify-center">
                <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <p className="text-sm">Sin citas registradas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {client.appointments.map((apt) => (
                <div key={apt.id} className="p-4 bg-surface rounded-lg border border-border hover:border-primary/20 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm text-dark">{apt.service.name}</p>
                      <p className="text-xs text-muted mt-1">
                        {new Date(apt.date).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {apt.notes && <p className="text-xs text-muted mt-1.5 italic">{apt.notes}</p>}
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border flex-shrink-0 ml-3 ${
                      statusColors[apt.status] || "bg-gray-50 text-gray-700 border-gray-200"
                    }`}>
                      {apt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination
            page={client.appointmentsPage}
            totalPages={client.appointmentsTotalPages}
            total={client.appointmentsTotal}
            pageLoading={appPageLoading}
            itemLabel="cita"
            limit={5}
            onPageChange={(p) => { setAppPageLoading(true); loadClient(p, client.salesPage); }}
          />
        </div>

        {/* Historial de Compras */}
        <div className="card p-5">
          <div className="section-header">
            <span className="w-1 h-5 rounded-full bg-success flex-shrink-0" />
            <h2 className="section-title">Historial de Compras</h2>
          </div>
          {client.sales.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-surface flex items-center justify-center">
                <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm">Sin compras registradas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {client.sales.map((sale) => (
                <div key={sale.id} className="p-4 bg-surface rounded-lg border border-border hover:border-primary/20 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-dark">
                        {sale.items.map((item) => item.service?.name || item.product?.name).join(", ")}
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {new Date(sale.date).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      {sale.paymentMethod && (
                        <span className="text-xs text-muted mt-1 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-success/60" />
                          {sale.paymentMethod}
                        </span>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="font-bold text-dark">${sale.total.toFixed(2)} USD</p>
                      {sale.totalBs && (
                        <div>
                          <p className="text-sm font-semibold text-amber-700">Bs {sale.totalBs.toFixed(2)}</p>
                          {sale.exchangeRate && (
                            <p className="text-[10px] text-muted">@ tasa {sale.exchangeRate}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination
            page={client.salesPage}
            totalPages={client.salesTotalPages}
            total={client.salesTotal}
            pageLoading={salesPageLoading}
            itemLabel="venta"
            limit={5}
            onPageChange={(p) => { setSalesPageLoading(true); loadClient(client.appointmentsPage, p); }}
          />
        </div>
      </div>

      <WAChatPopover
        isOpen={showChat}
        clientName={client.name}
        clientPhone={client.phone ?? ""}
        onClose={() => setShowChat(false)}
        onEditTemplates={() => setShowManager(true)}
      />

      <WATemplateManager
        isOpen={showManager}
        onClose={() => setShowManager(false)}
      />
    </div>
  );
}
