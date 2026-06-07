"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

interface QuickCreateClientProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (client: { id: number; name: string; phone: string | null }) => void;
}

export default function QuickCreateClient({ isOpen, onClose, onCreated }: QuickCreateClientProps) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    const { data, error } = await apiFetch("/api/clientes", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
    });
    if (data) {
      showToast("success", "Cliente creado");
      onCreated(data as { id: number; name: string; phone: string | null });
      setName("");
      setPhone("");
      onClose();
    } else {
      showToast("error", error || "Error al crear cliente");
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
          <div className="w-10 h-10 rounded-xl bg-primary-bg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-dark">Nuevo Cliente Rápido</h3>
            <p className="text-xs text-muted mt-0.5">Se guardará tu venta actual</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark mb-1.5">Nombre *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Nombre del cliente"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark mb-1.5">Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="Opcional"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={submitting || !name.trim()} className="btn-primary flex-1 disabled:opacity-50">
              {submitting ? "Creando..." : "Crear Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
