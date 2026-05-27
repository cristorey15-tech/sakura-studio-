"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface SearchClient {
  id: number;
  name: string;
  phone: string | null;
}

interface SearchService {
  id: number;
  name: string;
  category: string;
  price: number;
}

interface SearchEmployee {
  id: number;
  name: string;
  role: string;
}

interface SearchResults {
  clients: SearchClient[];
  services: SearchService[];
  employees: SearchEmployee[];
}

const categoryIcon: Record<string, string> = {
  GENERAL: "🔧",
  MAQUILLAJE: "💄",
  CEJAS: "👁️",
  PESTAÑAS: "✨",
  MANICURE: "💅",
};

export default function GlobalSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd+K / Ctrl+K toggle + custom event from sidebar button
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-global-search", handleOpen);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-global-search", handleOpen);
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search
  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 1) {
      setResults(null);
      return;
    }
    setLoading(true);
    const { data } = await apiFetch<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`);
    if (data) {
      setResults(data);
      setSelectedIndex(0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(query), 200);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [query, doSearch]);

  // Flatten results for keyboard navigation
  const flatResults: Array<{
    type: "client" | "service" | "employee";
    label: string;
    subtitle: string;
    href: string;
    icon: string;
  }> = [];

  if (results) {
    results.clients.forEach((c) => {
      flatResults.push({
        type: "client",
        label: c.name,
        subtitle: c.phone || "Sin teléfono",
        href: `/clientes/${c.id}`,
        icon: "👤",
      });
    });
    results.services.forEach((s) => {
      flatResults.push({
        type: "service",
        label: s.name,
        subtitle: `${categoryIcon[s.category] || ""} ${s.category} — $${s.price.toFixed(2)}`,
        href: `/servicios`,
        icon: categoryIcon[s.category] || "📋",
      });
    });
    results.employees.forEach((e) => {
      flatResults.push({
        type: "employee",
        label: e.name,
        subtitle: e.role,
        href: `/empleadas`,
        icon: "👩‍💼",
      });
    });
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && flatResults[selectedIndex]) {
      e.preventDefault();
      router.push(flatResults[selectedIndex].href);
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
          onClick={() => setIsOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl border border-border overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <svg className="w-5 h-5 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar clientes, servicios, empleadas..."
                className="flex-1 text-sm text-dark placeholder:text-muted/50 bg-transparent border-none outline-none focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              {loading && (
                <svg className="w-4 h-4 text-muted animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-medium text-muted flex-shrink-0">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {!query && (
                <div className="text-center py-10">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface flex items-center justify-center">
                    <svg className="w-6 h-6 text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted font-medium">¿Qué estás buscando?</p>
                  <p className="text-xs text-muted/60 mt-1">Clientes, servicios, empleadas...</p>
                </div>
              )}

              {query && !loading && flatResults.length === 0 && (
                <div className="text-center py-10">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface flex items-center justify-center">
                    <svg className="w-6 h-6 text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted font-medium">Sin resultados</p>
                  <p className="text-xs text-muted/60 mt-1">Prueba con otro término de búsqueda</p>
                </div>
              )}

              {flatResults.length > 0 && (
                <div className="space-y-0.5">
                  {flatResults.map((item, idx) => (
                    <Link
                      key={`${item.type}-${item.label}-${idx}`}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                        idx === selectedIndex
                          ? "bg-primary-bg text-primary-dark"
                          : "text-dark hover:bg-surface"
                      }`}
                    >
                      <span className="text-base flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-surface">
                        {item.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.label}</p>
                        <p className={`text-xs truncate mt-0.5 ${
                          idx === selectedIndex ? "text-primary/70" : "text-muted"
                        }`}>{item.subtitle}</p>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-medium flex-shrink-0 ${
                        item.type === "client"
                          ? "text-primary"
                          : item.type === "service"
                          ? "text-emerald-600"
                          : "text-violet-600"
                      }`}>{item.type}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Footer hints */}
            {flatResults.length > 0 && (
              <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted/50">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-[9px]">↑↓</kbd> Navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-[9px]">⏎</kbd> Abrir
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-[9px]">ESC</kbd> Cerrar
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
