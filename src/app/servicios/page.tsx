"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/useApiQuery";
import { apiFetch } from "@/lib/api";
import { SkeletonPageHeader, SkeletonGrid } from "@/components/LoadingSkeleton";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Service {
  id: number;
  name: string;
  description: string | null;
  category: string;
  price: number;
  duration: number;
  commissionPercent: number;
  active: boolean;
}

const categories = ["GENERAL", "MAQUILLAJE", "CEJAS", "PESTAÑAS", "MANICURE"];

const categoryConfig: Record<string, { color: string; bg: string; icon: string }> = {
  GENERAL: { color: "text-teal-600", bg: "bg-teal-50", icon: "🔧" },
  MAQUILLAJE: { color: "text-primary", bg: "bg-primary-bg", icon: "💄" },
  CEJAS: { color: "text-warning", bg: "bg-warning-bg", icon: "👁️" },
  PESTAÑAS: { color: "text-violet-600", bg: "bg-violet-50", icon: "✨" },
  MANICURE: { color: "text-rose-600", bg: "bg-rose-50", icon: "💅" },
};

const emptyForm = {
  name: "",
  description: "",
  category: "MAQUILLAJE",
  price: 0,
  duration: 30,
  commissionPercent: 10,
};

export default function ServiciosPage() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: services = [], isLoading } = useApiQuery<Service[]>(["servicios"], "/api/servicios", {
    refetchInterval: 15000,
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const url = editingId ? `/api/servicios/${editingId}` : "/api/servicios";
    const method = editingId ? "PUT" : "POST";

    const { data, error: apiError } = await apiFetch<Service>(url, {
      method,
      body: JSON.stringify({
        ...form,
        price: Number(form.price),
        duration: Number(form.duration),
        commissionPercent: Number(form.commissionPercent),
      }),
    });

    if (data) {
      showToast("success", editingId ? "Servicio actualizado exitosamente" : "Servicio creado exitosamente");
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["servicios"] });
    } else {
      showToast("error", apiError || "Error al guardar el servicio");
    }
    setSubmitting(false);
  };

  const handleEdit = (service: Service) => {
    setForm({
      name: service.name,
      description: service.description || "",
      category: service.category,
      price: service.price,
      duration: service.duration,
      commissionPercent: service.commissionPercent,
    });
    setEditingId(service.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { data } = await apiFetch(`/api/servicios/${deleteTarget.id}`, { method: "DELETE" });
    if (data) {
      showToast("success", "Servicio eliminado");
      queryClient.invalidateQueries({ queryKey: ["servicios"] });
    } else {
      showToast("error", "Error al eliminar el servicio");
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const groupedServices = categories.map((cat) => ({
    category: cat,
    services: services.filter((s) => s.category === cat && s.active),
  }));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonPageHeader />
        <SkeletonGrid count={4} height="h-40" />
      </div>
    );
  }

  const totalActive = services.filter((s) => s.active).length;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Servicios</h1>
          <p className="text-sm text-muted mt-1">{totalActive} servicios activos</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setForm(emptyForm);
              setEditingId(null);
              setShowForm(!showForm);
            }}
            className="btn-primary"
          >
            {showForm ? "Cancelar" : "+ Nuevo Servicio"}
          </button>
        )}
      </div>

      {/* Formulario */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card p-4 space-y-4 animate-scaleIn"
        >
          <div className="section-header">
            <span className="section-accent" />
            <h2 className="section-title">{editingId ? "Editar Servicio" : "Nuevo Servicio"}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Nombre</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Nombre del servicio" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Categoría</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="select">
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Precio ($)</label>
              <input type="number" required min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="input" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Duración (min)</label>
              <input type="number" required min="15" step="5" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Comisión empleada (%)</label>
              <div className="relative">
                <input type="number" min="0" max="100" step="1" value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: Number(e.target.value) })} className="input pr-8" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">%</span>
              </div>
              <p className="text-xs text-muted/70 mt-1">Porcentaje del precio que va a la empleada</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-dark mb-1.5">Descripción</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="input resize-none" placeholder="Descripción del servicio..." />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Guardando...
                </span>
              ) : (editingId ? "Guardar Cambios" : "Crear Servicio")}
            </button>
          </div>
        </form>
      )}

      {/* Empty State */}
      {totalActive === 0 && !showForm ? (
        <EmptyState
          icon={
            <svg className="w-12 h-12 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
          }
          title="Aún no tienes servicios registrados"
          description="Crea tu primer servicio para empezar a ofrecerlo a tus clientes."
          action={isAdmin ? { label: "Crear servicio", onClick: () => setShowForm(true) } : undefined}
        />
      ) : (
        /* Listado por categorías */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {groupedServices.map(({ category, services: catServices }) => {
            const cfg = categoryConfig[category];
            return (
              <div
                key={category}
                className="card overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className={`px-5 py-4 ${cfg.bg} flex items-center gap-3 border-b border-border`}>
                  <span className="text-lg">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-dark">{category}</h2>
                    <p className="text-xs text-muted mt-0.5">{catServices.length} servicios</p>
                  </div>
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${cfg.bg}`}>{catServices.length}</span>
                </div>
                <div className="divide-y divide-border/50">
                  {catServices.length === 0 ? (
                    <p className="p-5 text-sm text-muted text-center italic">Sin servicios en esta categoría</p>
                  ) : (
                    catServices.map((service) => (
                      <div key={service.id} className="px-5 py-4 hover:bg-surface/70 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-dark text-sm">{service.name}</h3>
                            {service.description && (
                              <p className="text-xs text-muted mt-0.5 line-clamp-1">{service.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-xs text-muted flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {service.duration} min
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-dark">${service.price.toFixed(2)}</p>
                            <div className="flex gap-2 mt-1.5 justify-end">
                              {isAdmin && (
                                <>
                                  <button onClick={() => handleEdit(service)} className="text-[11px] text-muted hover:text-primary font-medium transition-colors px-2 py-0.5 rounded hover:bg-primary/10">Editar</button>
                                  <button onClick={() => setDeleteTarget(service)} className="text-[11px] text-muted hover:text-danger font-medium transition-colors px-2 py-0.5 rounded hover:bg-danger/10">Eliminar</button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar servicio"
        message={
          deleteTarget ? (
            <span>
              ¿Estás seguro de eliminar <strong>{deleteTarget.name}</strong>? 
              Esta acción no se puede deshacer.
            </span>
          ) : ""
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
