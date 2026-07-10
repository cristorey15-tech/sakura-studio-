"use client";

import { useState } from "react";

interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

interface ReceiptProps {
  isOpen: boolean;
  onClose: () => void;
  sale: {
    id: number;
    date: string;
    total: number;
    totalBs?: number | null;
    paymentMethod?: string | null;
    client?: { name: string; phone?: string | null } | null;
    employee?: { name: string } | null;
    items: ReceiptItem[];
    paymentSplits?: { paymentMethod: string; amount: number }[];
  } | null;
}

function generateReceiptText(sale: ReceiptProps["sale"]): string {
  if (!sale) return "";
  const studioName = "Sakura Studio";
  const divider = "─".repeat(32);
  const date = new Date(sale.date).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let lines = [
    `🌸 *${studioName}* 🌸`,
    `Estudio de Belleza`,
    divider,
    `📅 ${date}`,
    `🔢 Recibo #${sale.id}`,
    divider,
  ];

  if (sale.client?.name) {
    lines.push(`👤 Cliente: ${sale.client.name}`);
  }
  if (sale.employee?.name) {
    lines.push(`💅 Empleada: ${sale.employee.name}`);
  }
  lines.push("");
  lines.push("*Servicios:*");

  for (const item of sale.items) {
    const qty = item.quantity > 1 ? `x${item.quantity} ` : "";
    lines.push(`• ${qty}${item.name} — $${item.price.toFixed(2)}`);
  }

  lines.push(divider);
  lines.push(`💰 *TOTAL: $${sale.total.toFixed(2)}*`);
  if (sale.totalBs) {
    lines.push(`Bs ${sale.totalBs.toFixed(2)}`);
  }

  // Payment splits
  if (sale.paymentSplits && sale.paymentSplits.length > 0) {
    lines.push("");
    lines.push("*Métodos de pago:*");
    for (const split of sale.paymentSplits) {
      const methodLabel: Record<string, string> = {
        EFECTIVO: "💵 Efectivo",
        TARJETA: "💳 Tarjeta",
        TRANSFERENCIA: "🏦 Transferencia",
        "PAGO MOVIL": "📱 Pago Móvil",
        OTRO: "📋 Otro",
      };
      lines.push(`• ${methodLabel[split.paymentMethod] || split.paymentMethod}: $${split.amount.toFixed(2)}`);
    }
  } else if (sale.paymentMethod) {
    const methodLabel: Record<string, string> = {
      EFECTIVO: "💵 Efectivo",
      TARJETA: "💳 Tarjeta",
      TRANSFERENCIA: "🏦 Transferencia",
      "PAGO MOVIL": "📱 Pago Móvil",
      OTRO: "📋 Otro",
    };
    lines.push(`${methodLabel[sale.paymentMethod] || sale.paymentMethod}`);
  }

  lines.push("");
  lines.push(divider);
  lines.push("¡Gracias por preferirnos! 🌸");
  lines.push("Sakura Studio — Estudio de Belleza");

  return lines.join("\n");
}

export default function ReceiptWhatsApp({ isOpen, onClose, sale }: ReceiptProps) {
  const [sending, setSending] = useState(false);

  if (!isOpen || !sale) return null;

  const receiptText = generateReceiptText(sale);
  const phone = (() => {
    const raw = sale.client?.phone?.replace(/[^0-9+]/g, "") || "";
    // Formato Venezuela: remover 0 inicial y agregar 58
    const withoutZero = raw.startsWith("0") ? raw.slice(1) : raw;
    return withoutZero.startsWith("58") || !raw ? raw : `58${withoutZero}`;
  })();

  const sendWhatsApp = () => {
    setSending(true);
    const encoded = encodeURIComponent(receiptText);
    const url = phone
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
    setTimeout(() => {
      setSending(false);
      onClose();
    }, 500);
  };

  const copyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(receiptText);
      alert("Recibo copiado al portapapeles");
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = receiptText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      alert("Recibo copiado al portapapeles");
    }
  };

  const pmLabels: Record<string, string> = {
    EFECTIVO: "💵 Efectivo",
    TARJETA: "💳 Tarjeta",
    TRANSFERENCIA: "🏦 Transferencia",
    "PAGO MOVIL": "📱 Pago Móvil",
    OTRO: "📋 Otro",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div className="card max-w-md w-full p-5 animate-scaleIn shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success-bg flex items-center justify-center">
              <span className="text-lg">🧾</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-dark">Recibo de Venta</h3>
              <p className="text-xs text-muted">Venta #{sale.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-dark transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Receipt preview */}
        <div className="bg-surface rounded-xl border border-border p-4 mb-4 max-h-80 overflow-y-auto">
          <pre className="text-xs text-dark whitespace-pre-wrap font-mono leading-relaxed">{receiptText}</pre>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={copyReceipt} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
            Copiar
          </button>
          <button onClick={sendWhatsApp} disabled={sending} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-lg text-sm font-medium hover:bg-[#1da851] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            {sending ? "Enviando..." : "Enviar por WhatsApp"}
          </button>
        </div>

        {/* Client phone info */}
        {phone && (
          <p className="text-xs text-muted text-center mt-3">Se enviará a: {sale.client?.name} ({phone})</p>
        )}
        {!phone && sale.client && (
          <p className="text-xs text-warning text-center mt-3">⚠️ Este cliente no tiene teléfono registrado. Se abrirá WhatsApp para elegir contacto.</p>
        )}
      </div>
    </div>
  );
}
