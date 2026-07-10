"use client";

import { useState } from "react";
import { useWATemplates, renderTemplate } from "@/hooks/useWATemplates";

interface Props {
  isOpen: boolean;
  clientName: string;
  clientPhone: string;
  onClose: () => void;
  onEditTemplates: () => void;
}

export default function WAChatPopover({ isOpen, clientName, clientPhone, onClose, onEditTemplates }: Props) {
  const [waMessage, setWaMessage] = useState("");
  const { templates } = useWATemplates();

  if (!isOpen) return null;

  const sendWhatsApp = (phone: string, msg: string) => {
    if (!phone.trim() || !msg.trim()) return;
    const cleaned = phone.replace(/\D/g, "");
    // Formato Venezuela: remover 0 inicial y agregar +58
    const withoutZero = cleaned.startsWith("0") ? cleaned.slice(1) : cleaned;
    const full = withoutZero.startsWith("58") ? withoutZero : `58${withoutZero}`;
    const text = encodeURIComponent(msg);
    window.open(`https://wa.me/${full}?text=${text}`, "_blank", "noopener,noreferrer");
    onClose();
    setWaMessage("");
  };

  const resolvedTemplates = templates.map((t) => ({
    ...t,
    message: renderTemplate(t.message, clientName),
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={() => { onClose(); setWaMessage(""); }}
    >
      <div
        className="card max-w-md w-full p-0 animate-scaleIn overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#25D366]/10 to-[#128C7E]/10 border-b border-border">
          <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-dark">{clientName}</h3>
            <p className="text-xs text-muted">{clientPhone}</p>
          </div>
          <button
            onClick={() => { onClose(); setWaMessage(""); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-dark transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Templates */}
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Plantillas</span>
            <button
              onClick={() => { onClose(); setTimeout(onEditTemplates, 100); }}
              className="text-[11px] text-primary hover:text-primary-dark font-medium transition-colors"
            >
              + Editar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {resolvedTemplates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setWaMessage(tpl.message)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-all duration-200 font-medium ${
                  waMessage === tpl.message
                    ? "bg-[#25D366]/10 text-[#128C7E] border-[#25D366]/30 shadow-sm"
                    : "bg-surface text-muted border-border hover:border-[#25D366]/30 hover:text-[#128C7E]"
                }`}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div className="p-4">
          <textarea
            autoFocus
            value={waMessage}
            onChange={(e) => setWaMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (waMessage.trim()) sendWhatsApp(clientPhone, waMessage);
              }
            }}
            className="input resize-none w-full min-h-[100px] text-sm"
            placeholder="Escribe tu mensaje..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-4 pb-4">
          <button
            onClick={() => { onClose(); setWaMessage(""); }}
            className="btn-secondary flex-1 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={() => sendWhatsApp(clientPhone, waMessage)}
            disabled={!waMessage.trim()}
            className="btn-primary flex-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enviar por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
