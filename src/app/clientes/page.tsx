"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import WAChatPopover from "@/components/WAChatPopover";
import WATemplateManager from "@/components/WATemplateManager";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/hooks/useApiQuery";
import { apiFetch } from "@/lib/api";
import { SkeletonPageHeader, SkeletonList } from "@/components/LoadingSkeleton";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Client {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  _count: { appointments: number; sales: number };
}

interface ClientsResponse {
  data: Client[];
  page: number;
  totalPages: number;
  total: number;
}

const emptyForm = { name: "", phone: "", email: "", notes: "" };

export default function ClientesPage() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chatTarget, setChatTarget] = useState<{ id: number; name: string; phone: string } | null>(null);
  const [showManager, setShowManager] = useState(false);
  const [page, setPage] = useState(1);
  const [querySearch, setQuerySearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: "10" });
  if (querySearch) params.set("q", querySearch);

  const { data: pageData, isLoading } = useApiQuery<ClientsResponse>(
    ["clientes", page, querySearch],
    `/api/clientes?${params}`
  );

  const clients = pageData?.data ?? [];
  const totalPages = pageData?.totalPages ?? 1;
  const total = pageData?.total ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/clientes/${editingId}` : "/api/clientes";
    const method = editingId ? "PUT" : "POST";

    const { data, error: apiError } = await apiFetch(url, {
      method,
      body: JSON.stringify(form),
    });

    if (data) {
      showToast("success", editingId ? "Cliente actualizado exitosamente" : "Cliente creado exitosamente");
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } else {
      showToast("error", apiError || "Error al guardar el cliente");
    }
  };

  const handleEdit = (client: Client) => {
    setForm({
      name: client.name,
      phone: client.phone || "",
      email: client.email || "",
      notes: client.notes || "",
    });
    setEditingId(client.id);
    setShowForm(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget === null) return;
    const { data } = await apiFetch(`/api/clientes/${deleteTarget}`, { method: "DELETE" });
    if (data) {
      showToast("success", "Cliente eliminado");
      const newPage = clients.length <= 1 && page > 1 ? page - 1 : page;
      setPage(newPage);
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } else {
      showToast("error", "Error al eliminar el cliente");
    }
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonPageHeader />
        <SkeletonList count={5} height="h-20" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Clientes</h1>
          <p className="text-sm text-muted mt-1">Gestión de clientes del estudio</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setForm(emptyForm);
              setEditingId(null);
              setShowForm(!showForm);
            }}
            className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all duration-200 shadow-sm"
          >
            {showForm ? "Cancelar" : "+ Nuevo Cliente"}
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
            <h2 className="section-title">{editingId ? "Editar Cliente" : "Nuevo Cliente"}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Nombre *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Nombre completo" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Teléfono</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder="555-000-0000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" placeholder="cliente@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Notas</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" placeholder="Notas adicionales" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{editingId ? "Guardar Cambios" : "Crear Cliente"}</button>
          </div>
        </form>
      )}

      {/* Búsqueda */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            const value = e.target.value;
            setSearch(value);
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
            searchTimeout.current = setTimeout(() => {
              setQuerySearch(value);
              setPage(1);
            }, 250);
          }}
          placeholder="Buscar clientes..."
          className="input pl-10 py-3"
        />
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {clients.length === 0 ? (
          <EmptyState
            entity="clientes"
            title="No se encontraron clientes"
            description={querySearch ? "Prueba con otro término de búsqueda." : "Registra tu primer cliente para comenzar."}
            action={querySearch ? undefined : (isAdmin ? { label: "+ Nuevo Cliente", onClick: () => { setForm(emptyForm); setEditingId(null); setShowForm(true); } } : undefined)}
          />
        ) : (
          clients.map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-xl border border-border p-4 hover:shadow-md hover:border-primary/20 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-primary-bg flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
                    <span className="text-base font-bold text-primary">
                      {client.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/clientes/${client.id}`}
                      className="font-semibold text-dark hover:text-primary transition-colors block"
                    >
                      {client.name}
                    </Link>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted mt-0.5">
                      {client.phone && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {client.phone}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatTarget({ id: client.id, name: client.name, phone: client.phone ?? "" });
                            }}
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-all duration-200 ml-0.5"
                            title="Enviar WhatsApp"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                          </button>
                        </span>
                      )}
                      {client.email && <span>{client.email}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                  <div className="text-right text-xs text-muted hidden sm:block">
                    <div className="flex gap-3">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                        {client._count.appointments} citas
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-success/60" />
                        {client._count.sales} ventas
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(client)}
                        className="text-xs text-muted hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary-bg"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleteTarget(client.id)}
                        className="text-xs text-muted hover:text-danger transition-colors px-2 py-1 rounded-lg hover:bg-danger-bg"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageLoading={false}
        itemLabel="cliente"
        limit={10}
        onPageChange={(p) => setPage(p)}
      />

      <WAChatPopover
        isOpen={chatTarget !== null}
        clientName={chatTarget?.name ?? ""}
        clientPhone={chatTarget?.phone ?? ""}
        onClose={() => setChatTarget(null)}
        onEditTemplates={() => setShowManager(true)}
      />

      <WATemplateManager
        isOpen={showManager}
        onClose={() => setShowManager(false)}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar cliente"
        message="¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
      />
    </div>
  );
}
