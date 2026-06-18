"use client";

import { useEffect, useRef, useState } from "react";
import Pagination from "@/components/Pagination";
import { useToast } from "@/hooks/useToast";
import { apiFetch } from "@/lib/api";
import { SkeletonPageHeader, SkeletonStatsRow } from "@/components/LoadingSkeleton";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Product {
  id: number;
  name: string;
  description: string | null;
  quantity: number;
  minStock: number;
  price: number | null;
  category: string | null;
}

const categories = ["MAQUILLAJE", "CEJAS", "PESTAÑAS", "MANICURE", "GENERAL"];

const categoryConfig: Record<string, { color: string; bg: string; icon: string }> = {
  MAQUILLAJE: { color: "text-primary", bg: "bg-primary-bg", icon: "💄" },
  CEJAS: { color: "text-warning", bg: "bg-warning-bg", icon: "👁️" },
  PESTAÑAS: { color: "text-violet-600", bg: "bg-violet-50", icon: "✨" },
  MANICURE: { color: "text-rose-600", bg: "bg-rose-50", icon: "💅" },
  GENERAL: { color: "text-muted", bg: "bg-surface", icon: "📦" },
};

const emptyForm = {
  name: "",
  description: "",
  quantity: 0,
  minStock: 5,
  price: 0,
  category: "GENERAL",
};

export default function InventarioPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("TODAS");
  const [filterStock, setFilterStock] = useState("TODOS");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [inventoryStats, setInventoryStats] = useState({
    totalProducts: 0,
    lowStockCount: 0,
    categoryCount: 0,
  });

  const [form, setForm] = useState(emptyForm);

  const loadProducts = (p: number, q?: string, cat?: string, stock?: string) => {
    const params = new URLSearchParams({ page: String(p), limit: "10" });
    if (q) params.set("q", q);
    if (cat && cat !== "TODAS") params.set("category", cat);
    if (stock && stock !== "TODOS") params.set("stock", stock);
    apiFetch<{ data: Product[]; page: number; totalPages: number; total: number; stats: typeof inventoryStats }>(`/api/inventario?${params}`)
      .then(({ data }) => {
        if (data) {
          setProducts(data.data);
          setPage(data.page);
          setTotalPages(data.totalPages);
          setTotalProducts(data.total);
          if (data.stats) setInventoryStats(data.stats);
        }
        setLoading(false);
        setPageLoading(false);
      });
  };

  useEffect(() => {
    loadProducts(1);
  }, []);

  // Silent polling cada 15s
  useEffect(() => {
    const interval = setInterval(() => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.set("q", search);
      if (filterCategory !== "TODAS") params.set("category", filterCategory);
      if (filterStock !== "TODOS") params.set("stock", filterStock);
      apiFetch<{ data: Product[]; page: number; totalPages: number; total: number; stats: typeof inventoryStats }>(`/api/inventario?${params}`)
        .then(({ data }) => {
          if (data) {
            setProducts(data.data);
            setPage(data.page);
            setTotalPages(data.totalPages);
            setTotalProducts(data.total);
            if (data.stats) setInventoryStats(data.stats);
          }
        })
        .catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, [page, search, filterCategory, filterStock]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/inventario/${editingId}` : "/api/inventario";
    const method = editingId ? "PUT" : "POST";

    setSubmitting(true);
    const { data, error: apiError } = await apiFetch(url, {
      method,
      body: JSON.stringify({
        ...form,
        quantity: Number(form.quantity),
        minStock: Number(form.minStock),
        price: Number(form.price) || null,
      }),
    });

    if (data) {
      showToast("success", editingId ? "Producto actualizado exitosamente" : "Producto creado exitosamente");
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setLoading(true);
      loadProducts(1, search || undefined, filterCategory !== "TODAS" ? filterCategory : undefined, filterStock !== "TODOS" ? filterStock : undefined);
    } else {
      showToast("error", apiError || "Error al guardar el producto");
    }
    setSubmitting(false);
  };

  const handleEdit = (product: Product) => {
    setForm({
      name: product.name,
      description: product.description || "",
      quantity: product.quantity,
      minStock: product.minStock,
      price: product.price || 0,
      category: product.category || "GENERAL",
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget === null) return;
    const { data } = await apiFetch(`/api/inventario/${deleteTarget}`, { method: "DELETE" });
    if (data) {
      showToast("success", "Producto eliminado");
      const newPage = products.length <= 1 && page > 1 ? page - 1 : page;
      setLoading(true);
      loadProducts(newPage, search || undefined, filterCategory !== "TODAS" ? filterCategory : undefined, filterStock !== "TODOS" ? filterStock : undefined);
    } else {
      showToast("error", "Error al eliminar el producto");
    }
    setDeleteTarget(null);
  };

  const handleAdjustStock = async (id: number, delta: number) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const newQty = Math.max(0, product.quantity + delta);
    const { data: adjustData } = await apiFetch(`/api/inventario/${id}`, {
      method: "PUT",
      body: JSON.stringify({ quantity: newQty }),
    });
    if (adjustData) {
      showToast("info", `Stock ajustado a ${newQty}`);
    }
    loadProducts(page, search || undefined, filterCategory !== "TODAS" ? filterCategory : undefined, filterStock !== "TODOS" ? filterStock : undefined);
  };

  const {
    totalProducts: statsTotal,
    lowStockCount,
    categoryCount,
  } = inventoryStats;

  if (loading && products.length === 0) {
    return (
      <div className="space-y-4">
        <SkeletonPageHeader />
        <SkeletonStatsRow count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark">Inventario</h1>
          <p className="text-sm text-muted mt-1">Control de productos e insumos</p>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all duration-200 shadow-sm"
        >
          {showForm ? "Cancelar" : "+ Nuevo Producto"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M8.25 3v6m3.75-6v6m3.75-6v6M12 12.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Total Productos</p>
              <p className="text-xl font-bold text-dark mt-0.5">{statsTotal}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm flex-shrink-0 ${lowStockCount > 0 ? "from-rose-500 to-rose-600" : "from-emerald-500 to-emerald-600"}`}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Stock Bajo</p>
              <p className={`text-xl font-bold mt-0.5 ${lowStockCount > 0 ? "text-danger" : "text-success"}`}>{lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Categorías</p>
              <p className="text-xl font-bold text-dark mt-0.5">{categoryCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-4 animate-scaleIn">
          <div className="section-header">
            <span className="section-accent" />
            <h2 className="section-title">{editingId ? "Editar Producto" : "Nuevo Producto"}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Nombre *</label>
              <input type="text" required name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Nombre del producto" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Categoría</label>
              <select name="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="select">
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Cantidad</label>
              <input type="number" required name="quantity" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Stock Mínimo</label>
              <input type="number" required min="1" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Precio ($)</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="input" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Descripción</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" placeholder="Descripción del producto" />
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
              ) : (editingId ? "Guardar Cambios" : "Crear Producto")}
            </button>
          </div>
        </form>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted transition-opacity duration-150 ${search ? 'opacity-0' : 'opacity-100'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              setSearch(value);
              setLoading(true);
              if (searchTimeout.current) clearTimeout(searchTimeout.current);
              searchTimeout.current = setTimeout(() => {
                loadProducts(1, value || undefined, filterCategory !== "TODAS" ? filterCategory : undefined, filterStock !== "TODOS" ? filterStock : undefined);
              }, 250);
            }}
            placeholder="Buscar productos..."
            className="input pl-10 pr-10 py-3"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setLoading(true); loadProducts(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-dark transition-colors"
              title="Limpiar búsqueda"
              aria-label="Limpiar búsqueda"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <select
          value={filterCategory}
          onChange={(e) => {
            setFilterCategory(e.target.value);
            setLoading(true);
            loadProducts(1, search || undefined, e.target.value !== "TODAS" ? e.target.value : undefined, filterStock !== "TODOS" ? filterStock : undefined);
          }}
          className="select px-4 py-3"
        >
          <option value="TODAS">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={filterStock}
          onChange={(e) => {
            setFilterStock(e.target.value);
            setLoading(true);
            loadProducts(1, search || undefined, filterCategory !== "TODAS" ? filterCategory : undefined, e.target.value !== "TODOS" ? e.target.value : undefined);
          }}
          className="select px-4 py-3"
        >
          <option value="TODOS">Todo el stock</option>
          <option value="BAJO">Stock bajo</option>
          <option value="OK">Stock suficiente</option>
        </select>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {products.length === 0 ? (
          <EmptyState
            entity="inventario"
            title="No se encontraron productos"
            description={search || filterCategory !== "TODAS" || filterStock !== "TODOS" ? "Prueba con otros filtros." : "Agrega tu primer producto al inventario."}
            action={search || filterCategory !== "TODAS" || filterStock !== "TODOS" ? undefined : { label: "+ Nuevo Producto", onClick: () => { setForm(emptyForm); setEditingId(null); setShowForm(true); } }}
          />
        ) : (
          products.map((product) => {
            const isLowStock = product.quantity <= product.minStock;
            const stockPercentage = product.minStock > 0
              ? Math.min(100, (product.quantity / product.minStock) * 100)
              : 100;
            const cfg = categoryConfig[product.category || "GENERAL"] || categoryConfig.GENERAL;

            return (
              <div
                key={product.id}
                className={`bg-white rounded-xl border p-4 hover:shadow-md transition-all duration-200 group ${
                  isLowStock ? "border-danger/30 bg-danger-bg/30" : "border-border hover:border-primary/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{cfg.icon}</span>
                      <h3 className="font-semibold text-dark">{product.name}</h3>
                      {product.category && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                          {product.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {product.description && (
                        <p className="text-xs text-muted truncate max-w-xs">{product.description}</p>
                      )}
                      {product.price && (
                        <span className="text-xs text-muted flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-border" />
                          ${product.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    {/* Stock controls */}
                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleAdjustStock(product.id, -1)}
                          className="w-7 h-7 rounded-lg bg-white border border-border hover:bg-surface text-muted font-medium transition-colors flex items-center justify-center text-sm"
                          aria-label="Reducir stock"
                        >
                          −
                        </button>
                        <span className={`font-bold text-lg min-w-[3ch] text-center ${
                          isLowStock ? "text-danger" : "text-dark"
                        }`}>
                          {product.quantity}
                        </span>
                        <button
                          onClick={() => handleAdjustStock(product.id, 1)}
                          className="w-7 h-7 rounded-lg bg-white border border-border hover:bg-surface text-muted font-medium transition-colors flex items-center justify-center text-sm"
                          aria-label="Aumentar stock"
                        >
                          +
                        </button>
                      </div>
                      {isLowStock && (
                        <p className="text-[10px] text-danger font-medium mt-0.5">Mín: {product.minStock}</p>
                      )}
                    </div>

                    {/* Stock bar */}
                    <div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden hidden sm:block">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isLowStock ? "bg-danger" : "bg-success"
                        }`}
                        style={{ width: `${Math.min(100, stockPercentage)}%` }}
                      />
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-xs text-muted hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary-bg"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeleteTarget(product.id)}
                        className="text-xs text-muted hover:text-danger transition-colors px-2 py-1 rounded-lg hover:bg-danger-bg"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={totalProducts}
        pageLoading={pageLoading}
        itemLabel="producto"
        limit={10}
        onPageChange={(p) => { setPageLoading(true); loadProducts(p, search || undefined, filterCategory !== "TODAS" ? filterCategory : undefined, filterStock !== "TODOS" ? filterStock : undefined); }}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar producto"
        message="¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
      />
    </div>
  );
}
