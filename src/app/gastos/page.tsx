"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/useToast";
import { apiFetch } from "@/lib/api";
import { SkeletonPageHeader } from "@/components/LoadingSkeleton";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Expense {
  id: number;
  concept: string;
  amount: number;
  amountBs: number | null;
  category: string;
  date: string;
  registeredBy: string | null;
  notes: string | null;
  createdAt: string;
}

const EXPENSE_CATEGORIES = [
  { value: "ALQUILER", label: "Alquiler", icon: "🏢" },
  { value: "SERVICIOS", label: "Servicios (agua, luz, internet)", icon: "💡" },
  { value: "PRODUCTOS", label: "Compra de Productos", icon: "📦" },
  { value: "MANTENIMIENTO", label: "Mantenimiento", icon: "🔧" },
  { value: "SUELDO", label: "Sueldos", icon: "💰" },
  { value: "MARKETING", label: "Marketing", icon: "📢" },
  { value: "OTRO", label: "Otro", icon: "📋" },
];

const categoryConfig: Record<string, { color: string; bg: string }> = {
  ALQUILER: { color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
  SERVICIOS: { color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  PRODUCTOS: { color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  MANTENIMIENTO: { color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  SUELDO: { color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  MARKETING: { color: "text-pink-600", bg: "bg-pink-50 border-pink-200" },
  OTRO: { color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
};

const formatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

const emptyForm = {
  concept: "",
  amount: "",
  amountBs: "",
  category: "OTRO",
  date: new Date().toISOString().split("T")[0],
  registeredBy: "",
  notes: "",
};

export default function ExpensesPage() {
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");
  const [stats, setStats] = useState({ totalMonthUSD: 0, totalMonthBs: 0, totalTodayUSD: 0, totalTodayBs: 0, countMonth: 0 });
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const loadExpenses = useCallback(async (p: number) => {
    setLoading(true);
    setPageLoading(true);
    const sp = new URLSearchParams();
    sp.set("page", String(p));
    if (filterCategory) sp.set("category", filterCategory);
    if (filterStart) sp.set("startDate", filterStart);
    if (filterEnd) sp.set("endDate", filterEnd);

    const { data } = await apiFetch<{ data: Expense[]; total: number; totalPages: number; stats: typeof stats }>(
      `/api/expenses?${sp.toString()}`
    );
    if (data) {
      setExpenses(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setStats(data.stats);
    }
    setLoading(false);
    setPageLoading(false);
  }, [filterCategory, filterStart, filterEnd]);

  useEffect(() => { loadExpenses(page); }, [page, loadExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.concept || !form.amount) {
      showToast("error", "Concepto y monto son obligatorios");
      return;
    }
    setSubmitting(true);
    const url = editingId ? `/api/expenses/${editingId}` : "/api/expenses";
    const method = editingId ? "PUT" : "POST";
    const { data, error } = await apiFetch(url, { method, body: JSON.stringify({ ...form, amount: parseFloat(form.amount), amountBs: form.amountBs ? parseFloat(form.amountBs) : null }) });
    if (data) {
      showToast("success", editingId ? "Gasto actualizado" : "Gasto registrado");
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      loadExpenses(page);
    } else {
      showToast("error", error || "Error al guardar");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    const { data, error } = await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (data) {
      showToast("success", "Gasto eliminado");
      setDeleteTarget(null);
      loadExpenses(page);
    } else {
      showToast("error", error || "Error al eliminar");
    }
  };

  const handleEdit = (expense: Expense) => {
    setForm({
      concept: expense.concept,
      amount: String(expense.amount),
      amountBs: expense.amountBs ? String(expense.amountBs) : "",
      category: expense.category,
      date: new Date(expense.date).toISOString().split("T")[0],
      registeredBy: expense.registeredBy || "",
      notes: expense.notes || "",
    });
    setEditingId(expense.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark">Gastos Operativos</h1>
          <p className="text-sm text-muted mt-1">Control de egresos y gastos del estudio</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(!showForm); }} className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all duration-200 shadow-sm">
          {showForm ? "Cancelar" : "+ Nuevo Gasto"}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-hover p-5">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-lg">💸</span>
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Gasto de Hoy</p>
              <p className="text-xl font-bold text-dark mt-0.5">{formatter.format(stats.totalTodayUSD)}</p>
            </div>
          </div>
        </div>
        <div className="card-hover p-5">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-lg">📊</span>
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Gastos del Mes</p>
              <p className="text-xl font-bold text-dark mt-0.5">{formatter.format(stats.totalMonthUSD)}</p>
              <p className="text-xs text-muted">{stats.countMonth} registros</p>
            </div>
          </div>
        </div>
        <div className="card-hover p-5">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-lg">Bs</span>
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Gastos del Mes (Bs)</p>
              <p className="text-xl font-bold text-dark mt-0.5">Bs {stats.totalMonthBs.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-muted mb-1.5">Categoría</label>
            <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }} className="select">
              <option value="">Todas</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-muted mb-1.5">Desde</label>
            <input type="date" value={filterStart} onChange={(e) => { setFilterStart(e.target.value); setPage(1); }} className="input" />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-muted mb-1.5">Hasta</label>
            <input type="date" value={filterEnd} onChange={(e) => { setFilterEnd(e.target.value); setPage(1); }} className="input" />
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-4 animate-scaleIn">
          <div className="section-header">
            <span className="section-accent" />
            <h2 className="section-title">{editingId ? "Editar Gasto" : "Nuevo Gasto"}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="expense-concept" className="block text-sm font-medium text-dark mb-1.5">Concepto *</label>
              <input id="expense-concept" name="expense-concept" type="text" required value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} className="input" placeholder="Ej: Pago de alquiler mensual" />
            </div>
            <div>
              <label htmlFor="expense-category" className="block text-sm font-medium text-dark mb-1.5">Categoría *</label>
              <select id="expense-category" name="expense-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="select">
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="expense-amount" className="block text-sm font-medium text-dark mb-1.5">Monto (USD) *</label>
              <input id="expense-amount" name="expense-amount" type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" placeholder="0.00" />
            </div>
            <div>
              <label htmlFor="expense-amountBs" className="block text-sm font-medium text-dark mb-1.5">Monto (Bs) — Opcional</label>
              <input id="expense-amountBs" name="expense-amountBs" type="number" step="0.01" value={form.amountBs} onChange={(e) => setForm({ ...form, amountBs: e.target.value })} className="input" placeholder="0.00" />
            </div>
            <div>
              <label htmlFor="expense-date" className="block text-sm font-medium text-dark mb-1.5">Fecha</label>
              <input id="expense-date" name="expense-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" />
            </div>
            <div>
              <label htmlFor="expense-registeredBy" className="block text-sm font-medium text-dark mb-1.5">Registrado por</label>
              <input id="expense-registeredBy" name="expense-registeredBy" type="text" value={form.registeredBy} onChange={(e) => setForm({ ...form, registeredBy: e.target.value })} className="input" placeholder="Nombre de quien registra" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="expense-notes" className="block text-sm font-medium text-dark mb-1.5">Notas</label>
              <textarea id="expense-notes" name="expense-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="input resize-none" placeholder="Detalles adicionales..." />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? "Guardando..." : editingId ? "Guardar Cambios" : "Registrar Gasto"}
            </button>
          </div>
        </form>
      )}

      {/* Expenses list */}
      <div className="card">
        {loading ? (
          <div className="p-6"><SkeletonPageHeader /></div>
        ) : expenses.length === 0 ? (
          <EmptyState entity="gastos" title="Sin gastos registrados" description="Registra tu primer gasto operativo para llevar el control financiero." action={{ label: "+ Nuevo Gasto", onClick: () => { setForm(emptyForm); setEditingId(null); setShowForm(true); } }} />
        ) : (
          <div className="divide-y divide-border">
            {expenses.map((expense) => {
              const cfg = categoryConfig[expense.category] || categoryConfig.OTRO;
              const catInfo = EXPENSE_CATEGORIES.find(c => c.value === expense.category);
              return (
                <div key={expense.id} className="p-4 hover:bg-surface/50 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${cfg.bg}`}>
                        <span className="text-lg">{catInfo?.icon || "📋"}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dark truncate">{expense.concept}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.color} ${cfg.bg} border`}>
                            {expense.category}
                          </span>
                          <span className="text-xs text-muted">
                            {new Date(expense.date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          {expense.registeredBy && <span className="text-xs text-muted/60">por {expense.registeredBy}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-danger">-{formatter.format(expense.amount)}</p>
                        {expense.amountBs != null && expense.amountBs > 0 && (
                          <p className="text-xs text-muted">Bs {expense.amountBs.toFixed(2)}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(expense)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-primary-bg text-muted hover:text-primary transition-colors" title="Editar">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setDeleteTarget(expense.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-danger-bg text-muted hover:text-danger transition-colors" title="Eliminar">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  {expense.notes && <p className="text-xs text-muted mt-2 ml-[3.25rem] italic">{expense.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} pageLoading={pageLoading} itemLabel="gasto" limit={20} onPageChange={(p) => { setPageLoading(true); setPage(p); }} />
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
        title="Eliminar Gasto"
        message="¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
      />
    </div>
  );
}
