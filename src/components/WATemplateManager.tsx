"use client";

import { useState } from "react";
import { useWATemplates, renderTemplate } from "@/hooks/useWATemplates";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function WATemplateManager({ isOpen, onClose }: Props) {
  const { templates, addTemplate, editTemplate, deleteTemplate, resetDefaults } = useWATemplates();
  const [editingTpl, setEditingTpl] = useState<{ id: number; label: string; message: string } | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newMessage, setNewMessage] = useState("");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8 bg-black/40 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={() => { onClose(); setEditingTpl(null); setNewLabel(""); setNewMessage(""); }}
    >
      <div
        className="card max-w-lg w-full p-5 animate-scaleIn shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#25D366]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-dark">Plantillas de WhatsApp</h3>
              <p className="text-xs text-muted">
                Usa <code className="text-[#25D366] bg-[#25D366]/10 px-1 rounded text-[11px]">{"{nombre}"}</code> para el nombre del cliente
              </p>
            </div>
          </div>
          <button
            onClick={() => { onClose(); setEditingTpl(null); setNewLabel(""); setNewMessage(""); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-dark transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulario agregar/editar */}
        {(editingTpl || newLabel || newMessage) && (
          <div className="mb-5 p-4 bg-surface rounded-xl border border-border">
            <h4 className="text-sm font-medium text-dark mb-3">
              {editingTpl ? "Editar plantilla" : "Nueva plantilla"}
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Etiqueta</label>
                <input
                  type="text"
                  value={editingTpl ? editingTpl.label : newLabel}
                  onChange={(e) =>
                    editingTpl
                      ? setEditingTpl({ ...editingTpl, label: e.target.value })
                      : setNewLabel(e.target.value)
                  }
                  className="input py-2 text-sm"
                  placeholder="Ej: Recordatorio"
                  maxLength={30}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Mensaje</label>
                <textarea
                  value={editingTpl ? editingTpl.message : newMessage}
                  onChange={(e) =>
                    editingTpl
                      ? setEditingTpl({ ...editingTpl, message: e.target.value })
                      : setNewMessage(e.target.value)
                  }
                  className="input min-h-[80px] resize-none text-sm"
                  placeholder="Ej: Hola {nombre}, recordatorio..."
                  maxLength={500}
                />
                <p className="text-[11px] text-muted mt-1">
                  <code className="text-[#25D366]">{"{nombre}"}</code> se reemplazará con el nombre del cliente
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (editingTpl) {
                      editTemplate(editingTpl.id, editingTpl.label, editingTpl.message);
                      setEditingTpl(null);
                    } else {
                      addTemplate(newLabel, newMessage);
                      setNewLabel("");
                      setNewMessage("");
                    }
                  }}
                  disabled={
                    editingTpl
                      ? !editingTpl.label.trim() || !editingTpl.message.trim()
                      : !newLabel.trim() || !newMessage.trim()
                  }
                  className="px-3 py-1.5 bg-[#25D366] text-white rounded-lg text-xs font-medium hover:bg-[#20BD5C] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {editingTpl ? "Guardar cambios" : "Agregar plantilla"}
                </button>
                {editingTpl && (
                  <button
                    onClick={() => setEditingTpl(null)}
                    className="px-3 py-1.5 btn-secondary text-xs"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lista de plantillas */}
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <p className="text-sm">No hay plantillas. ¡Crea una!</p>
            </div>
          ) : (
            templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-start gap-3 p-3 bg-surface rounded-xl border border-border group hover:border-primary/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-dark">{tpl.label}</p>
                  <p className="text-xs text-muted mt-0.5 line-clamp-2">
                    {renderTemplate(tpl.message, "Cliente")}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingTpl({ id: tpl.id, label: tpl.label, message: tpl.message });
                      setNewLabel("");
                      setNewMessage("");
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-primary-bg text-muted hover:text-primary transition-colors"
                    title="Editar"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-danger-bg text-muted hover:text-danger transition-colors"
                    title="Eliminar"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-5 pt-4 border-t border-border">
          <button
            onClick={() => {
              if (confirm("¿Restaurar plantillas por defecto? Las personalizadas se perderán.")) {
                resetDefaults();
              }
            }}
            className="text-xs text-muted hover:text-dark transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Restaurar defaults
          </button>
          <button
            onClick={() => { onClose(); setEditingTpl(null); setNewLabel(""); setNewMessage(""); }}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
