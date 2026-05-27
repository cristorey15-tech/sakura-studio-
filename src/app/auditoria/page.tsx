"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { SkeletonPageHeader } from "@/components/LoadingSkeleton";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";

interface AuditEntry {
  id: number;
  action: string;
  entity: string;
  entityId: number | null;
  description: string;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

const actionColors: Record<string, string> = {
  CREATE: "bg-success-bg text-success border-success/30",
  UPDATE: "bg-primary-bg text-primary border-primary/30",
  DELETE: "bg-danger-bg text-danger border-danger/30",
};

const actionLabels: Record<string, string> = {
  CREATE: "Creación",
  UPDATE: "Edición",
  DELETE: "Eliminación",
};

const entityLabels: Record<string, string> = {
  Service: "Servicios",
  Client: "Clientes",
  Employee: "Empleadas",
  Sale: "Ventas",
  Appointment: "Citas",
  Product: "Inventario",
  StudioSettings: "Configuración",
  WATemplate: "Plantillas WhatsApp",
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterEntity, setFilterEntity] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [limit] = useState(30);

  const loadLogs = (p: number) => {
    setLoading(true);
    setPageLoading(true);
    const sp = new URLSearchParams();
    sp.set("page", String(p));
    sp.set("limit", String(limit));
    if (filterEntity) sp.set("entity", filterEntity);
    if (filterAction) sp.set("action", filterAction);

    apiFetch<{ data: AuditEntry[]; total: number; totalPages: number }>(
      `/api/audit-logs?${sp.toString()}`
    ).then(({ data }) => {
      if (data) {
        setLogs(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
      setLoading(false);
      setPageLoading(false);
    });
  };

  useEffect(() => {
    loadLogs(page);
  }, [page, filterEntity, filterAction]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Registro de Actividades</h1>
          <p className="text-sm text-muted mt-1">
            Historial de todas las acciones realizadas en el sistema
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-muted mb-1.5">Entidad</label>
            <select
              value={filterEntity}
              onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }}
              className="select"
            >
              <option value="">Todas</option>
              {Object.entries(entityLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-muted mb-1.5">Acción</label>
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
              className="select"
            >
              <option value="">Todas</option>
              <option value="CREATE">Creación</option>
              <option value="UPDATE">Edición</option>
              <option value="DELETE">Eliminación</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs list */}
      <div className="card">
        {loading ? (
          <div className="p-6">
            <SkeletonPageHeader />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-12 h-12 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="Sin actividad registrada"
            description="Las acciones que realices en el sistema se registrarán aquí automáticamente."
          />
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-surface/50 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Action icon */}
                  <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${
                    actionColors[log.action] || "bg-surface text-muted border-border"
                  }`}>
                    {log.action === "CREATE" ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    ) : log.action === "UPDATE" ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                        actionColors[log.action] || "bg-surface text-muted border-border"
                      }`}>
                        {actionLabels[log.action] || log.action}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-muted border border-border">
                        {entityLabels[log.entity] || log.entity}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-dark mt-1.5">{log.description}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted">
                      <span>{new Date(log.createdAt).toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}</span>
                      {log.userName && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span>{log.userName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageLoading={pageLoading}
          itemLabel="registro"
          limit={limit}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
