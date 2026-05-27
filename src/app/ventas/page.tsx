"use client";

import { useEffect, useRef, useState } from "react";
import WAChatPopover from "@/components/WAChatPopover";
import WATemplateManager from "@/components/WATemplateManager";
import Pagination from "@/components/Pagination";
import { SkeletonPageHeader, SkeletonStatsRow, SkeletonGrid } from "@/components/LoadingSkeleton";
import { useToast } from "@/hooks/useToast";
import { apiFetch } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";

type ViewMode = "list" | "pos";

// ─── Shared Types ───
interface Employee {
  id: number;
  name: string;
  active: boolean;
}

interface Service {
  id: number;
  name: string;
  category: string;
  price: number;
  duration: number;
  commissionPercent: number;
  active: boolean;
}

interface Client {
  id: number;
  name: string;
  phone: string | null;
  freeServiceAvailable?: boolean;
  visitCount?: number;
}

// ─── List Types ───
interface SaleItem {
  id?: number;
  quantity: number;
  price: number;
  serviceId?: number;
  productId?: number;
  service?: { name: string } | null;
  product?: { name: string } | null;
}

interface SaleEmployee {
  id: number;
  name: string;
}

interface FormItem {
  serviceId: string;
  price: number;
}

interface PendingSale {
  clientId: number;
  clientName: string;
  serviceId: number;
  serviceName: string;
  servicePrice: number;
  appointmentDate: string;
}

interface Sale {
  id: number;
  date: string;
  total: number;
  totalBs: number | null;
  exchangeRate: number | null;
  paymentMethod: string | null;
  notes: string | null;
  clientId: number | null;
  client: Client | null;
  employee: SaleEmployee | null;
  items: SaleItem[];
}

// ─── POS Types ───
// ─── POS Types ───
interface CartItem {
  id: number;
  name: string;
  category: string;
  price: number;
  duration: number;
  commissionPercent: number;
}

type Step = "services" | "payment";

const categories = ["MAQUILLAJE", "CEJAS", "PESTAÑAS", "MANICURE"];

const categoryConfig: Record<string, { color: string; bg: string; icon: string }> = {
  MAQUILLAJE: { color: "text-primary", bg: "bg-primary-bg", icon: "💄" },
  CEJAS: { color: "text-warning", bg: "bg-warning-bg", icon: "👁️" },
  PESTAÑAS: { color: "text-violet-600", bg: "bg-violet-50", icon: "✨" },
  MANICURE: { color: "text-rose-600", bg: "bg-rose-50", icon: "💅" },
};

const paymentMethods = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "PAGO MOVIL", "OTRO"];
const methodsRequiringRate = ["TARJETA", "TRANSFERENCIA", "PAGO MOVIL"];

export default function VentasPage() {
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // ─── Shared Data ───
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sharedLoading, setSharedLoading] = useState(true);

  // ─── List State ───
  const [sales, setSales] = useState<Sale[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<"ALL" | "USD" | "BS">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSales, setTotalSales] = useState(0);
  const [pageLoading, setPageLoading] = useState(false);
  const [fromAppointmentInfo, setFromAppointmentInfo] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    clientId: "",
    employeeId: "",
    serviceDate: todayStr,
    paymentMethod: "EFECTIVO",
    exchangeRate: "",
    notes: "",
    items: [] as FormItem[],
  });
  const [salesStats, setSalesStats] = useState({
    todaySalesCount: 0,
    todayTotalUSD: 0,
    todayTotalBs: 0,
    monthlyTotalUSD: 0,
    monthlyTotalBs: 0,
  });
  const [chatTarget, setChatTarget] = useState<{ id: number; name: string; phone: string } | null>(null);
  const [showManager, setShowManager] = useState(false);

  // ─── POS State ───
  const [posStep, setPosStep] = useState<Step>("services");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [posEmployeeId, setPosEmployeeId] = useState("");
  const [posClientId, setPosClientId] = useState("");
  const [posPaymentMethod, setPosPaymentMethod] = useState("EFECTIVO");
  const [posExchangeRate, setPosExchangeRate] = useState("");
  const [posSubmitting, setPosSubmitting] = useState(false);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);

  // Silent polling cada 15s
  useEffect(() => {
    const interval = setInterval(() => {
      const params = new URLSearchParams({ page: String(currentPage), limit: "15" });
      if (search) params.set("q", search);
      if (currencyFilter !== "ALL") params.set("currency", currencyFilter);
      apiFetch<{ data: Sale[]; total: number; page: number; totalPages: number; stats: typeof salesStats }>(`/api/ventas?${params}`)
        .then(({ data }) => {
          if (data) {
            setSales(data.data);
            setCurrentPage(data.page);
            setTotalPages(data.totalPages);
            setTotalSales(data.total);
            if (data.stats) setSalesStats(data.stats);
          }
        })
        .catch(() => {});
    }, 15000);

    return () => clearInterval(interval);
  }, [currentPage, search, currencyFilter]);

  // ─── Data Loaders ───
  const loadSales = (p: number, q?: string, currency?: string) => {
    const params = new URLSearchParams({ page: String(p), limit: "15" });
    if (q) params.set("q", q);
    if (currency && currency !== "ALL") params.set("currency", currency);
    apiFetch<{ data: Sale[]; total: number; page: number; totalPages: number; stats: typeof salesStats }>(`/api/ventas?${params}`)
      .then(({ data }) => {
        if (data) {
          setSales(data.data);
          setCurrentPage(data.page);
          setTotalPages(data.totalPages);
          setTotalSales(data.total);
          if (data.stats) setSalesStats(data.stats);
        }
        setListLoading(false);
        setPageLoading(false);
      });
  };

  const loadFormData = () => {
    Promise.all([
      apiFetch<Service[]>("/api/servicios").then(({ data }) => data || []),
      apiFetch<{ data: Client[] }>("/api/clientes").then(({ data }) => data?.data || []),
      apiFetch<Employee[]>("/api/empleadas").then(({ data }) => data || []),
    ]).then(([s, c, e]) => {
      const activeSv = (s as Service[]).filter((sv) => sv.active);
      setServices(activeSv);
      setClients(c as Client[]);
      setEmployees((e as Employee[]).filter((emp) => emp.active));
      if (activeSv.length > 0) {
        const cats = [...new Set(activeSv.map((sv) => sv.category))];
        setActiveCategory(cats[0] || null);
      }
      setSharedLoading(false);
    });
  };

  useEffect(() => {
    loadSales(1);
    loadFormData();

    // Verificar si hay una venta pendiente desde la agenda
    const pendingRaw = sessionStorage.getItem("pendingSale");
    if (pendingRaw) {
      sessionStorage.removeItem("pendingSale");
      try {
        const pending: PendingSale = JSON.parse(pendingRaw);
        setFromAppointmentInfo(`🧾 ${pending.serviceName} — ${pending.clientName}`);
        const aptDate = new Date(pending.appointmentDate);
        const aptDateStr = `${aptDate.getFullYear()}-${String(aptDate.getMonth() + 1).padStart(2, "0")}-${String(aptDate.getDate()).padStart(2, "0")}`;
        setForm({
          clientId: String(pending.clientId),
          employeeId: "",
          serviceDate: aptDateStr,
          paymentMethod: "EFECTIVO",
          exchangeRate: "",
          notes: `Desde cita del ${aptDate.toLocaleDateString("es-MX")}`,
          items: [{
            serviceId: String(pending.serviceId),
            price: pending.servicePrice,
          }],
        });
        setShowForm(true);
        setViewMode("list");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {
        // Ignorar datos inválidos
      }
    }
  }, []);

  // ─── List Handlers ───
  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { serviceId: "", price: 0 }],
    });
  };

  const removeItem = (idx: number) => {
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== idx),
    });
  };

  const updateItem = (idx: number, field: keyof FormItem, value: string | number) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };

    if (field === "serviceId") {
      const service = services.find((s) => s.id === Number(value));
      if (service) {
        items[idx].price = service.price;
      }
    }

    setForm({ ...form, items });
  };

  const totalForm = form.items.reduce((sum, item) => sum + Number(item.price), 0);
  const needsRate = methodsRequiringRate.includes(form.paymentMethod);
  const exchangeRateNum = Number(form.exchangeRate);
  const totalBsForm = needsRate && exchangeRateNum > 0 ? totalForm * exchangeRateNum : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error: apiError } = await apiFetch("/api/ventas", {
      method: "POST",
      body: JSON.stringify({
        total: totalForm,
        totalBs: totalBsForm > 0 ? totalBsForm : null,
        exchangeRate: exchangeRateNum > 0 ? exchangeRateNum : null,
        paymentMethod: form.paymentMethod,
        notes: form.notes,
        clientId: form.clientId || null,
        employeeId: form.employeeId || null,
        serviceDate: form.serviceDate || null,
        items: form.items.map((item) => ({
          quantity: 1,
          price: Number(item.price),
          serviceId: item.serviceId ? Number(item.serviceId) : null,
        })),
      }),
    });

    if (data) {
      showToast("success", "Venta registrada exitosamente");
      setShowForm(false);
      setFromAppointmentInfo(null);
      resetForm();
      setListLoading(true);
      loadSales(1, search || undefined, currencyFilter !== "ALL" ? currencyFilter : undefined);
    } else {
      showToast("error", apiError || "Error al registrar la venta");
    }
  };

  const resetForm = () => {
    setForm({ clientId: "", employeeId: "", serviceDate: todayStr, paymentMethod: "EFECTIVO", exchangeRate: "", notes: "", items: [] });
    setFromAppointmentInfo(null);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget === null) return;
    const { data } = await apiFetch(`/api/ventas/${deleteTarget}`, { method: "DELETE" });
    if (data) {
      showToast("success", "Venta eliminada");
      const newPage = sales.length <= 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      setListLoading(true);
      loadSales(newPage, search || undefined, currencyFilter !== "ALL" ? currencyFilter : undefined);
    } else {
      showToast("error", "Error al eliminar la venta");
    }
    setDeleteTarget(null);
  };

  // ─── POS Handlers ───
  const filteredServices = activeCategory
    ? services.filter((s) => s.category === activeCategory)
    : services;

  const addToCart = (service: Service) => {
    if (cartItems.find((item) => item.id === service.id)) {
      showToast("info", `${service.name} ya está en el carrito`);
      return;
    }
    setCartItems([...cartItems, {
      id: service.id,
      name: service.name,
      category: service.category,
      price: service.price,
      duration: service.duration,
      commissionPercent: service.commissionPercent,
    }]);
    showToast("success", `${service.name} agregado — $${service.price.toFixed(2)}`);
  };

  const removeFromCart = (serviceId: number) => {
    setCartItems(cartItems.filter((item) => item.id !== serviceId));
    setEditingPrice(null);
  };

  const updateCartItemPrice = (serviceId: number, newPrice: number) => {
    setCartItems(cartItems.map((item) =>
      item.id === serviceId ? { ...item, price: newPrice } : item
    ));
  };

  const clearCart = () => {
    setCartItems([]);
    setPosStep("services");
    setPosExchangeRate("");
  };

  const posTotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const posNeedsRate = methodsRequiringRate.includes(posPaymentMethod);
  const posExchangeRateNum = Number(posExchangeRate);
  const posTotalBs = posNeedsRate && posExchangeRateNum > 0 ? posTotal * posExchangeRateNum : 0;

  const handlePosCheckout = async () => {
    if (cartItems.length === 0) return;
    setPosSubmitting(true);

    const { data, error: apiError } = await apiFetch("/api/ventas/quick", {
      method: "POST",
      body: JSON.stringify({
        clientId: posClientId || null,
        employeeId: posEmployeeId || null,
        paymentMethod: posPaymentMethod,
        exchangeRate: posExchangeRateNum > 0 ? posExchangeRateNum : null,
        totalBs: posTotalBs > 0 ? posTotalBs : null,
        items: cartItems.map((item) => ({
          serviceId: item.id,
          price: item.price,
        })),
      }),
    });

    if (data) {
      showToast("success", "✅ Venta registrada exitosamente");
      setCartItems([]);
      setPosStep("services");
      setPosEmployeeId("");
      setPosPaymentMethod("EFECTIVO");
      setPosExchangeRate("");
      // Refresh list stats if user switches back
      loadSales(currentPage, search || undefined, currencyFilter !== "ALL" ? currencyFilter : undefined);
    } else {
      showToast("error", apiError || "Error al procesar la venta");
    }
    setPosSubmitting(false);
  };

  const loading = sharedLoading || (viewMode === "list" && listLoading && sales.length === 0);

  // ─── Render ───
  if (loading && viewMode === "list") {
    return (
      <div className="space-y-4">
        <SkeletonPageHeader />
        <SkeletonStatsRow count={3} />
      </div>
    );
  }

  if (sharedLoading && viewMode === "pos") {
    return (
      <div className="space-y-4 animate-fadeIn">
        <SkeletonPageHeader />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <SkeletonGrid count={8} height="h-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* ═══════════ HEADER + MODE TOGGLE ═══════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark">Ventas</h1>
          <p className="text-sm text-muted mt-1">
            {viewMode === "list"
              ? "Registro de ventas del estudio"
              : "Cobro express — selecciona servicios y cobra al instante"}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Mode toggle */}
          <div className="flex bg-surface p-0.5 rounded-xl border border-border">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                viewMode === "list"
                  ? "bg-white text-dark shadow-sm border border-border"
                  : "text-muted hover:text-dark"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              Lista
            </button>
            <button
              onClick={() => setViewMode("pos")}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                viewMode === "pos"
                  ? "bg-white text-dark shadow-sm border border-border"
                  : "text-muted hover:text-dark"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Caja Rápida
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════ */}
      {/* ═══  MODO: LISTA  ═══ */}
      {/* ════════════════════════════════════════════════ */}
      {viewMode === "list" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card-hover p-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-muted font-medium">Ventas Hoy</p>
                  <p className="text-xl font-bold text-dark mt-0.5">{salesStats.todaySalesCount}</p>
                </div>
              </div>
            </div>
            <div className="card-hover p-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-muted font-medium">Total Hoy</p>
                  <p className="text-xl font-bold text-dark mt-0.5">${salesStats.todayTotalUSD.toFixed(2)} USD</p>
                  {salesStats.todayTotalBs > 0 && (
                    <p className="text-xs font-semibold text-amber-700 mt-0.5">Bs {salesStats.todayTotalBs.toFixed(2)}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="card-hover p-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-muted font-medium">Total General</p>
                  <p className="text-xl font-bold text-dark mt-0.5">${salesStats.monthlyTotalUSD.toFixed(2)} USD</p>
                  {salesStats.monthlyTotalBs > 0 && (
                    <p className="text-xs font-semibold text-amber-700 mt-0.5">Bs {salesStats.monthlyTotalBs.toFixed(2)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Currency filter */}
            <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-border w-fit self-start">
              <button
                onClick={() => { setCurrencyFilter("ALL"); setListLoading(true); loadSales(1, search || undefined, "ALL"); }}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${currencyFilter === "ALL" ? "bg-white text-dark shadow-sm border border-border" : "text-muted hover:text-dark"}`}
              >
                Todas
              </button>
              <button
                onClick={() => { setCurrencyFilter("USD"); setListLoading(true); loadSales(1, search || undefined, "USD"); }}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${currencyFilter === "USD" ? "bg-white text-dark shadow-sm border border-border" : "text-muted hover:text-dark"}`}
              >
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  USD
                </span>
              </button>
              <button
                onClick={() => { setCurrencyFilter("BS"); setListLoading(true); loadSales(1, search || undefined, "BS"); }}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${currencyFilter === "BS" ? "bg-white text-dark shadow-sm border border-border" : "text-muted hover:text-dark"}`}
              >
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Bs
                </span>
              </button>
            </div>

            <button
              onClick={() => setShowForm(!showForm)}
              className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all duration-200 shadow-sm"
            >
              {showForm ? "Cancelar" : "+ Nueva Venta"}
            </button>
          </div>

          {/* Formulario */}
          {showForm && (
            <form onSubmit={handleSubmit} className="card p-4 space-y-4 animate-scaleIn">
              <div className="section-header">
                <span className="section-accent" />
                <h2 className="section-title">Nueva Venta</h2>
              </div>

              {fromAppointmentInfo && (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary-bg border border-primary/20 rounded-lg text-sm text-primary font-medium">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {fromAppointmentInfo}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark mb-1.5">Cliente (opcional)</label>
                  <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="select">
                    <option value="">Sin cliente</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1.5">Atendió</label>
                  <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="select">
                    <option value="">Seleccionar empleada...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1.5">Fecha del servicio</label>
                  <input type="date" value={form.serviceDate} onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1.5">Método de Pago</label>
                  <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="select">
                    {paymentMethods.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {needsRate && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Tasa de Cambio del Día (Bs/USD)
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">Bs</span>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={form.exchangeRate}
                        onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })}
                        className="input pl-10"
                        placeholder="0.00"
                        autoFocus
                      />
                    </div>
                    {exchangeRateNum > 0 && totalForm > 0 && (
                      <div className="text-sm text-amber-700 font-medium">
                        = <span className="font-bold">Bs {totalBsForm.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-amber-600/70">
                    Ingresa la tasa del día para facturar en Bolívares (1 USD × tasa = Bs)
                  </p>
                </div>
              )}

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-dark">Servicios</label>
                  <button type="button" onClick={addItem} className="text-xs text-primary hover:text-primary-dark transition-colors font-medium">+ Agregar servicio</button>
                </div>
                {form.items.length === 0 ? (
                  <p className="text-sm text-muted text-center py-4 border border-dashed border-border rounded-lg bg-surface">Agrega servicios a la venta</p>
                ) : (
                  <div className="space-y-2">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <select required value={item.serviceId} onChange={(e) => updateItem(idx, "serviceId", e.target.value)} className="select flex-1">
                          <option value="">Seleccionar...</option>
                          {services.filter((s) => s.active).map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <div className="relative w-28">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
                          <input type="number" required min="0" step="0.01" value={item.price} onChange={(e) => updateItem(idx, "price", Number(e.target.value))} className="input pl-7" />
                        </div>
                        <button type="button" onClick={() => removeItem(idx)} className="p-2.5 text-muted hover:text-danger hover:bg-danger-bg rounded-lg transition-colors" aria-label="Eliminar servicio">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div>
                  <p className="text-sm text-muted font-medium">Total</p>
                  <p className="text-2xl font-bold text-primary">${totalForm.toFixed(2)} USD</p>
                  {totalBsForm > 0 && (
                    <p className="text-sm font-semibold text-amber-700 mt-0.5">
                      ≈ Bs {totalBsForm.toFixed(2)} @ tasa {exchangeRateNum}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary">Cancelar</button>
                  <button type="submit" disabled={form.items.length === 0} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">Registrar Venta</button>
                </div>
              </div>
            </form>
          )}

          {/* Search */}
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
                setListLoading(true);
                if (searchTimeout.current) clearTimeout(searchTimeout.current);
                searchTimeout.current = setTimeout(() => {
                  loadSales(1, value || undefined, currencyFilter !== "ALL" ? currencyFilter : undefined);
                }, 250);
              }}
              placeholder="Buscar ventas..."
              className="input pl-10 py-3"
            />
          </div>

          {/* List */}
          <div className="space-y-2.5">
            {sales.length === 0 ? (
              <EmptyState
                entity="ventas"
                title="No se encontraron ventas"
                description={search || currencyFilter !== "ALL" ? "Prueba con otros filtros." : "Registra tu primera venta para comenzar."}
                action={search || currencyFilter !== "ALL" ? undefined : { label: "+ Nueva Venta", onClick: () => setShowForm(true) }}
              />
            ) : (
              sales.map((sale) => (
                <div key={sale.id} className="card-hover p-4 group">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="font-semibold text-dark text-sm flex items-center gap-1.5 truncate">
                          {sale.client?.name || "Sin cliente"}
                          {sale.employee && (
                            <span className="text-xs font-normal text-muted ml-1 hidden sm:inline">
                              · {sale.employee.name}
                            </span>
                          )}
                          {sale.client?.phone && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setChatTarget({ id: sale.client!.id, name: sale.client!.name, phone: sale.client!.phone ?? "" });
                              }}
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-all duration-200"
                              title="Enviar WhatsApp"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                            </button>
                          )}
                        </span>
                        {sale.employee && (
                          <span className="text-xs font-normal text-muted sm:hidden">
                            · {sale.employee.name}
                          </span>
                        )}
                        <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium border bg-warning-bg text-warning border-warning/20 w-fit">
                          {sale.paymentMethod}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {new Date(sale.date).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sale.items.map((item, idx) => (
                          <span key={idx} className="text-xs text-muted">
                            {item.service?.name || item.product?.name || "Producto"}
                            {idx < sale.items.length - 1 ? ", " : ""}
                          </span>
                        )                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2 sm:ml-4">
                      <p className="font-bold text-lg text-dark">${sale.total.toFixed(2)} USD</p>
                      {sale.totalBs && (
                        <div className="mt-0.5">
                          <p className="text-sm font-semibold text-amber-700">Bs {sale.totalBs.toFixed(2)}</p>
                          {sale.exchangeRate && (
                            <p className="text-[10px] text-muted">@ tasa {sale.exchangeRate}</p>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => setDeleteTarget(sale.id)}
                        className="text-xs text-muted hover:text-danger transition-colors mt-1 opacity-0 group-hover:opacity-100"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={totalSales}
            pageLoading={pageLoading}
            itemLabel="venta"
            limit={15}
            onPageChange={(p) => { setPageLoading(true); loadSales(p, search || undefined, currencyFilter !== "ALL" ? currencyFilter : undefined); }}
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

          <ConfirmDialog
            isOpen={deleteTarget !== null}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDeleteConfirm}
            title="Eliminar venta"
            message="¿Estás seguro de eliminar esta venta? Esta acción no se puede deshacer."
            confirmLabel="Eliminar"
            variant="danger"
          />
        </>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* ═══  MODO: CAJA RÁPIDA (POS)  ═══ */}
      {/* ════════════════════════════════════════════════ */}
      {viewMode === "pos" && (
        <div className="flex flex-col min-h-0">
          {/* POS header extra */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {posStep === "payment" && (
                <button onClick={() => setPosStep("services")} className="btn-secondary text-sm px-3 py-2">
                  ← Seguir agregando
                </button>
              )}
            </div>
            <div className="px-3 py-2 bg-surface rounded-lg border border-border text-sm">
              <span className="text-muted">Carrito: </span>
              <span className="font-bold text-dark">{cartItems.length}</span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
            {/* ═══ LEFT: Services Grid ═══ */}
            <div className="lg:col-span-2 flex flex-col min-h-0">
              {/* Category tabs */}
              <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-none pb-1">
                {categories.map((cat) => {
                  const count = services.filter((s) => s.category === cat).length;
                  const cfg = categoryConfig[cat];
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                        isActive
                          ? "bg-white text-dark shadow-sm border border-border ring-1 ring-primary/20"
                          : "text-muted hover:text-dark hover:bg-white/60 border border-transparent"
                      }`}
                    >
                      <span>{cfg.icon}</span>
                      <span>{cat}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive ? "bg-primary/10 text-primary" : "bg-surface text-muted"
                      }`}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Service grid */}
              <div className="flex-1 overflow-y-auto scrollbar-none -mx-1 px-1 max-h-[60vh] lg:max-h-none">
                {filteredServices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <div className="w-14 h-14 mb-3 rounded-full bg-surface flex items-center justify-center">
                      <svg className="w-7 h-7 text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-muted">Sin servicios en esta categoría</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-4">
                    {filteredServices.map((service) => {
                      const inCart = cartItems.some((item) => item.id === service.id);
                      const cfg = categoryConfig[service.category];
                      return (
                        <button
                          key={service.id}
                          onClick={() => !inCart && addToCart(service)}
                          disabled={inCart}
                          className={`relative text-left p-3 rounded-xl border-2 transition-all duration-200 ${
                            inCart
                              ? "border-emerald-400 bg-emerald-50 shadow-sm"
                              : "border-border bg-white hover:border-primary/40 hover:shadow-sm active:scale-[0.98]"
                          } disabled:cursor-default`}
                        >
                          {inCart && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-lg">{cfg.icon}</span>
                            <span className="text-xs text-muted font-medium">{service.category}</span>
                          </div>
                          <p className="text-sm font-semibold text-dark truncate pr-4">{service.name}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-base font-bold text-primary">${service.price.toFixed(2)}</span>
                            <span className="text-[10px] text-muted">{service.duration}min</span>
                          </div>
                          {service.commissionPercent > 0 && (
                            <div className="mt-1 text-[10px] text-muted">
                              Comisión: <span className="font-medium text-emerald-600">{service.commissionPercent}%</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ RIGHT: Cart ═══ */}
            <div className="bg-white rounded-xl border border-border shadow-sm flex flex-col min-h-0">
              {/* Cart header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-dark flex items-center gap-2">
                    <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                    </svg>
                    Carrito
                  </h2>
                  {cartItems.length > 0 && (
                    <button onClick={clearCart} className="text-xs text-muted hover:text-danger transition-colors">
                      Vaciar
                    </button>
                  )}
                </div>

                {/* Cliente & Empleada */}
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Cliente</label>
                    <select
                      value={posClientId}
                      onChange={(e) => setPosClientId(e.target.value)}
                      className="select text-sm py-2"
                    >
                      <option value="">🧑 Cliente de Paso</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.freeServiceAvailable ? ' 🎁' : ''}
                        </option>
                      ))}
                    </select>
                    {posClientId && (() => {
                      const selectedClient = clients.find(c => String(c.id) === posClientId);
                      if (!selectedClient || !selectedClient.freeServiceAvailable) return null;
                      return (
                        <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center gap-1.5">
                          <span className="text-sm">🎁</span>
                          <span className="text-[11px] font-medium text-amber-700">¡Tiene servicio gratis disponible!</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Atendió</label>
                    <select
                      value={posEmployeeId}
                      onChange={(e) => setPosEmployeeId(e.target.value)}
                      className="select text-sm py-2"
                    >
                      <option value="">— Sin asignar —</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Cart items */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[40vh] lg:max-h-none">
                {cartItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <div className="w-12 h-12 mb-2 rounded-full bg-surface flex items-center justify-center">
                      <svg className="w-6 h-6 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-muted">Carrito vacío</p>
                    <p className="text-xs text-muted/60 mt-1">Selecciona servicios de la lista</p>
                  </div>
                ) : (
                  cartItems.map((item) => {
                    const cfg = categoryConfig[item.category];
                    const commissionAmount = item.commissionPercent > 0
                      ? (item.price * item.commissionPercent) / 100
                      : 0;
                    const isEditing = editingPrice === item.id;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-surface/70 hover:bg-surface transition-colors group"
                      >
                        <span className="text-lg flex-shrink-0">{cfg?.icon || "📋"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-dark truncate flex items-center gap-2">
                            {item.name}
                            <button
                              onClick={() => setEditingPrice(isEditing ? null : item.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted hover:text-primary transition-all p-0.5"
                              title="Editar precio"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {isEditing ? (
                              <div className="relative w-24">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted font-medium">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.price}
                                  onChange={(e) => updateCartItemPrice(item.id, Number(e.target.value))}
                                  onBlur={() => setEditingPrice(null)}
                                  onKeyDown={(e) => e.key === "Enter" && setEditingPrice(null)}
                                  className="w-full pl-5 pr-2 py-1 text-sm font-bold text-primary bg-white border border-primary/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingPrice(item.id)}
                                className="text-sm font-bold text-primary hover:text-primary-dark transition-colors cursor-pointer"
                              >
                                ${item.price.toFixed(2)}
                              </button>
                            )}
                            {commissionAmount > 0 && (
                              <span className="text-[10px] text-emerald-600">+${commissionAmount.toFixed(2)} com.</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-danger-bg text-muted hover:text-danger transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Cart footer */}
              <div className="p-4 border-t border-border space-y-3">
                {/* Payment method */}
                {cartItems.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-muted mb-1 block">Método de pago</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {paymentMethods.slice(0, 3).map((method) => (
                        <button
                          key={method}
                          onClick={() => setPosPaymentMethod(method)}
                          className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                            posPaymentMethod === method
                              ? "bg-primary text-white shadow-sm"
                              : "bg-surface text-muted hover:text-dark border border-border"
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                      <select
                        value={paymentMethods.slice(3).includes(posPaymentMethod) ? posPaymentMethod : ""}
                        onChange={(e) => e.target.value && setPosPaymentMethod(e.target.value)}
                        className="select text-xs py-1.5 col-span-3"
                      >
                        <option value="">Otro...</option>
                        {paymentMethods.slice(3).map((method) => (
                          <option key={method} value={method}>{method}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Tasa de Cambio (solo para TARJETA, TRANSFERENCIA, PAGO MOVIL) */}
                {posNeedsRate && cartItems.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Tasa de Cambio (Bs/USD)
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 max-w-[160px]">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted font-medium">Bs</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={posExchangeRate}
                          onChange={(e) => setPosExchangeRate(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-1.5 text-sm font-medium text-amber-900 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300/50"
                          placeholder="0.00"
                          autoFocus
                        />
                      </div>
                      {posExchangeRateNum > 0 && posTotal > 0 && (
                        <div className="text-xs text-amber-700 font-semibold whitespace-nowrap">
                          = Bs {posTotalBs.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-amber-600/70">
                      1 USD × tasa = monto en Bolívares
                    </p>
                  </div>
                )}

                {/* Total */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div>
                    <p className="text-xs text-muted font-medium">Total</p>
                    <p className="text-xs text-muted/60">{cartItems.length} servicio{cartItems.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">${posTotal.toFixed(2)}</p>
                    {posTotalBs > 0 && (
                      <p className="text-xs font-semibold text-amber-700 mt-0.5">Bs {posTotalBs.toFixed(2)}</p>
                    )}
                  </div>
                </div>

                {/* Cobrar button */}
                <button
                  onClick={handlePosCheckout}
                  disabled={cartItems.length === 0 || posSubmitting}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-bold text-white transition-all duration-200 shadow-sm ${
                    cartItems.length === 0
                      ? "bg-gray-300 cursor-not-allowed"
                      : posSubmitting
                      ? "bg-primary/70 cursor-wait"
                      : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-md active:scale-[0.98]"
                  }`}
                >
                  {posSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Procesando...
                    </span>
                  ) : cartItems.length === 0 ? (
                    "Selecciona servicios para cobrar"
                  ) : (
                    `💰 Cobrar $${posTotal.toFixed(2)}`
                  )}
                </button>

                {cartItems.length > 0 && (
                  <p className="text-[10px] text-center text-muted/60">
                    ¿Cliente de paso? Solo selecciona servicios y cobra — se asignará automáticamente
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
