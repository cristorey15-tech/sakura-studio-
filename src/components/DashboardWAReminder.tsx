"use client";

import { useEffect, useState, useCallback } from "react";
import { useWAHistory } from "@/hooks/useWAHistory";

interface TomorrowAppointment {
  id: number;
  time: string;
  clientName: string;
  clientPhone: string | null;
  serviceName: string;
  employeeName: string | null;
}

interface WATemplate {
  id: number;
  label: string;
  message: string;
}

interface PromoClient {
  id: number;
  name: string;
  phone: string | null;
  lastVisit: string | null;
  visitCount: number;
}

interface ReminderData {
  appointments: TomorrowAppointment[];
  templates: WATemplate[];
  dateLabel: string;
}

function sendWhatsApp(phone: string, msg: string) {
  if (!phone.trim() || !msg.trim()) return;
  const cleaned = phone.replace(/\D/g, "");
  const withoutZero = cleaned.startsWith("0") ? cleaned.slice(1) : cleaned;
  const full = withoutZero.startsWith("58") ? withoutZero : `58${withoutZero}`;
  const text = encodeURIComponent(msg);
  window.open(`https://wa.me/${full}?text=${text}`, "_blank", "noopener,noreferrer");
}

function todayDate(): string {
  return new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function replaceVars(msg: string, clientName: string, time: string): string {
  const fecha = todayDate();
  let result = msg
    .replace(/\{nombre\}/g, clientName)
    .replace(/\[nombre\]/g, clientName)
    .replace(/\{hora\}/g, time)
    .replace(/\[hora\]/g, time)
    .replace(/\{fecha\}/g, fecha)
    .replace(/\[fecha\]/g, fecha);
  // Limpiar cualquier placeholder que haya quedado sin reemplazar
  result = result.replace(/\{[^}]+\}/g, "").replace(/\[[^\]]+\]/g, "");
  return result;
}

export default function DashboardWAReminder({ expandTrigger }: { expandTrigger?: number }) {
  const [data, setData] = useState<ReminderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [promoClients, setPromoClients] = useState<PromoClient[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoSearch, setPromoSearch] = useState("");
  const [showPromos, setShowPromos] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { history, addEntry, clearHistory } = useWAHistory();

  const loadReminders = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders/today");
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      if (json.appointments) {
        setData(json);
        if (json.templates?.length > 0) {
          setSelectedTemplateId(json.templates[0].id);
        }
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadReminders(); }, [loadReminders]);

  // Auto-expand when triggered from the dashboard's inactive clients card
  useEffect(() => {
    if (expandTrigger && expandTrigger > 0) {
      setExpanded(true);
    }
  }, [expandTrigger]);

  if (loading) return null;

  const selectedTemplate = data?.templates?.find((t) => t.id === selectedTemplateId);
  const appointments = data?.appointments ?? [];
  const hasAppointments = appointments.length > 0;

  const getMessage = (appt: TomorrowAppointment) => {
    if (!selectedTemplate) return "";
    return replaceVars(selectedTemplate.message, appt.clientName, appt.time);
  };

  const filteredPromoClients = promoClients.filter((c) => {
    if (!promoSearch) return true;
    const s = promoSearch.toLowerCase();
    return c.name.toLowerCase().includes(s) || (c.phone && c.phone.includes(s));
  });

  const clientMsg = (client: PromoClient) =>
    selectedTemplate ? replaceVars(selectedTemplate.message, client.name, "—") : "";

  const handleSend = (phone: string, name: string, msg: string, type: "reminder" | "promo") => {
    if (!msg) return;
    sendWhatsApp(phone, msg);
    addEntry({
      clientName: name,
      clientPhone: phone,
      message: msg,
      templateLabel: selectedTemplate?.label || null,
      type,
    });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Ahora";
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="card overflow-hidden border-l-4 border-l-[#25D366]">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-surface/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-dark">WhatsApp</h3>
              {hasAppointments && (
                <span className="bg-[#25D366]/10 text-[#25D366] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {appointments.length} {appointments.length === 1 ? "pendiente" : "pendientes"}
                </span>
              )}
              {history.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {history.length} enviados
                </span>
              )}
            </div>
            {data?.dateLabel && (
              <p className="text-xs text-muted mt-0.5">
                {hasAppointments
                  ? `Citas para ${data.dateLabel}`
                  : promoClients.length > 0
                  ? `${promoClients.length} clientes con teléfono registrado`
                  : "Sin citas programadas para mañana"}
              </p>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-muted transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Tab: Recordatorios / Historial */}
          <div className="flex gap-1 p-0.5 bg-surface rounded-lg border border-border w-fit">
            <button
              onClick={() => { setShowHistory(false); setShowPromos(false); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                !showHistory ? "bg-white text-dark shadow-sm border border-border" : "text-muted hover:text-dark"
              }`}
            >
              Recordatorios
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                showHistory ? "bg-white text-dark shadow-sm border border-border" : "text-muted hover:text-dark"
              }`}
            >
              Historial {history.length > 0 && `(${history.length})`}
            </button>
          </div>

          {showHistory ? (
            /* ═══════ Historial ═══════ */
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-50 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-muted">Sin historial aún</p>
                  <p className="text-xs text-muted/60 mt-1">Los mensajes que envíes aparecerán aquí</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted font-medium">
                      Últimos {history.length} mensaje{history.length !== 1 ? "s" : ""}
                    </p>
                    <button
                      onClick={() => { if (confirm("¿Borrar todo el historial?")) clearHistory(); }}
                      className="text-[11px] text-danger hover:text-danger/80 transition-colors"
                    >
                      Borrar todo
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-2.5 p-2.5 rounded-xl bg-surface border border-border"
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          entry.type === "reminder"
                            ? "bg-[#25D366]/10 text-[#25D366]"
                            : "bg-amber-100 text-amber-600"
                        }`}>
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-dark truncate">{entry.clientName}</span>
                            <span className="text-[10px] text-muted flex-shrink-0">{formatTime(entry.sentAt)}</span>
                          </div>
                          <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{entry.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {entry.templateLabel && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#25D366]/10 text-[#128C7E] font-medium">
                                {entry.templateLabel}
                              </span>
                            )}
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              entry.type === "reminder"
                                ? "bg-primary-bg text-primary"
                                : "bg-amber-50 text-amber-600"
                            }`}>
                              {entry.type === "reminder" ? "Recordatorio" : "Promoción"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ═══════ Recordatorios / Promos ═══════ */
            <>
              {/* Template selector */}
              {data?.templates && data.templates.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Plantilla:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-all duration-200 font-medium ${
                          selectedTemplateId === tpl.id
                            ? "bg-[#25D366]/10 text-[#128C7E] border-[#25D366]/30 shadow-sm"
                            : "bg-surface text-muted border-border hover:border-[#25D366]/30 hover:text-[#128C7E]"
                        }`}
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {selectedTemplate && hasAppointments && (
                <div className="p-3 bg-surface rounded-xl border border-border">
                  <p className="text-[10px] text-muted font-semibold uppercase tracking-wider mb-1">Vista previa:</p>
                  <p className="text-xs text-dark italic">{getMessage(appointments[0])}</p>
                </div>
              )}

              {/* Appointment list */}
              {hasAppointments ? (
                <div className="space-y-2">
                  {appointments.map((appt) => {
                    const msg = getMessage(appt);
                    return (
                      <div key={appt.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border group hover:border-[#25D366]/20 transition-all">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#25D366]/20 to-[#128C7E]/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-[#128C7E]">{appt.clientName.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-dark truncate">{appt.clientName}</span>
                              <span className="text-[10px] font-semibold bg-primary-bg text-primary px-1.5 py-0.5 rounded-full flex-shrink-0">{appt.time}</span>
                            </div>
                            <p className="text-[11px] text-muted truncate mt-0.5">{appt.serviceName}{appt.employeeName && ` · ${appt.employeeName}`}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (appt.clientPhone) handleSend(appt.clientPhone, appt.clientName, msg, "reminder");
                            else alert(`⚠️ ${appt.clientName} no tiene teléfono registrado.`);
                          }}
                          disabled={!msg}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#25D366] text-white hover:bg-[#1da851] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex-shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                          </svg>
                          {appt.clientPhone ? "Enviar" : "Sin 📱"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Empty state */
                <div className="text-center">
                  {!showPromos ? (
                    <div className="py-6">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#25D366]/5 flex items-center justify-center">
                        <svg className="w-7 h-7 text-[#25D366]/40" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-muted">¡Todo al día!</p>
                      <p className="text-xs text-muted/60 mt-1 max-w-xs mx-auto mb-4">No hay citas pendientes para mañana. ¿Quieres enviar promociones?</p>
                      <button
                        onClick={() => {
                          setShowPromos(true);
                          setPromoLoading(true);
                          fetch("/api/clientes/dropdown?limit=500")
                            .then((r) => r.json())
                            .then((clients: PromoClient[]) => {
                              setPromoClients(clients.filter((c) => c.phone));
                              setPromoLoading(false);
                            })
                            .catch(() => setPromoLoading(false));
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#25D366] text-white hover:bg-[#1da851] transition-all duration-200 shadow-sm mx-auto"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                        </svg>
                        Elegir clientes para promociones
                      </button>
                    </div>
                  ) : promoLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <svg className="w-5 h-5 animate-spin text-[#25D366]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-xs text-muted ml-2">Cargando clientes...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Top bar */}
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setShowPromos(false); setPromoSearch(""); }} className="flex items-center gap-1 text-xs text-muted hover:text-dark transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                          </svg>
                          Volver
                        </button>
                        <div className="relative flex-1">
                          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                          </svg>
                          <input type="text" value={promoSearch} onChange={(e) => setPromoSearch(e.target.value)} placeholder="Buscar cliente..." className="input pl-8 py-1.5 text-xs" />
                        </div>
                      </div>

                      {/* Client list */}
                      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                        {filteredPromoClients.length === 0 ? (
                          <p className="text-xs text-muted text-center py-4">{promoSearch ? "Sin resultados" : "No hay clientes con teléfono registrado"}</p>
                        ) : (
                          filteredPromoClients.map((client) => {
                            const msg = clientMsg(client);
                            return (
                              <div key={client.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-surface border border-border hover:border-[#25D366]/20 transition-all">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#25D366]/20 to-[#128C7E]/20 flex items-center justify-center flex-shrink-0 text-[#128C7E]">
                                    <span className="text-xs font-bold">{client.name.charAt(0).toUpperCase()}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-dark truncate">{client.name}</p>
                                    <p className="text-[10px] text-muted truncate">{client.phone}{client.lastVisit ? ` · ${new Date(client.lastVisit).toLocaleDateString("es-MX")}` : " · Sin visitas"}</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => { if (client.phone) handleSend(client.phone, client.name, msg, "promo"); }}
                                  disabled={!msg || !client.phone}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[#25D366] text-white hover:bg-[#1da851] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                                >
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                                  </svg>
                                  Enviar
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Send all button */}
              {hasAppointments && appointments.some((a) => a.clientPhone) && (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <p className="text-[11px] text-muted">{appointments.filter((a) => a.clientPhone).length} con teléfono · {appointments.filter((a) => !a.clientPhone).length} sin teléfono</p>
                  <button
                    onClick={() => {
                      const withPhone = appointments.filter((a) => a.clientPhone);
                      if (withPhone.length === 0) return;
                      withPhone.forEach((appt, i) => {
                        setTimeout(() => {
                          const msg = getMessage(appt);
                          handleSend(appt.clientPhone!, appt.clientName, msg, "reminder");
                        }, i * 800);
                      });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#25D366] text-white hover:bg-[#1da851] transition-all duration-200 shadow-sm"
                    title="Los navegadores pueden bloquear múltiples ventanas."
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                    </svg>
                    Abrir todos ({appointments.filter((a) => a.clientPhone).length})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
