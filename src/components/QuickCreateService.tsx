"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

interface QuickCreateServiceProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (service: { id: number; name: string; category: string; price: number; duration: number; commissionPercent: number; active: boolean }) => void;
}

const CATEGORIES = ["GENERAL", "MAQUILLAJE", "CEJAS", "PESTAÑAS", "MANICURE"];

export default function QuickCreateService({ isOpen, onClose, onCreated }: QuickCreateServiceProps) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const [commissionPercent, setCommissionPercent] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;
    setSubmitting(true);
    const { data, error } = await apiFetch("/api/servicios", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        category,
        price: Number(price),
        duration: Number(duration),
        commissionPercent: Number(commissionPercent),
        active: true,
      }),
    });
    if (data) {
      showToast("success", "Servicio creado");
      const svc = data as { id: number; name: string; category: string; price: number; duration: number; commissionPercent: number; active: boolean };
      onCreated(svc);
      setName("");
      setPrice("");
      setDuration("30");
      setCommissionPercent("0");
      onClose();
    } else {
      showToast("error", error || "Error al crear servicio");
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-border overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-dark">Nuevo Servicio Rápido</h3>
            <p className="text-xs text-muted mt-0.5">Se guardará tu venta actual</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark mb-1.5">Nombre *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Nombre del servicio" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Categoría</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="select">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Precio ($) *</label>
              <input type="number" required min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="input" placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Duración (min)</label>
              <input type="number" min="5" step="5" value={duration} onChange={(e) => setDuration(e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark mb-1.5">Comisión (%)</label>
              <input type="number" min="0" max="100" value={commissionPercent} onChange={(e) => setCommissionPercent(e.target.value)} className="input" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={submitting || !name.trim() || !price} className="btn-primary flex-1 disabled:opacity-50">
              {submitting ? "Creando..." : "Crear Servicio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
