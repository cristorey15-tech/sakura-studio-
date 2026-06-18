"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

export interface DropdownClient {
  id: number;
  name: string;
  phone: string | null;
  freeServiceAvailable?: boolean;
  visitCount?: number;
  saleCount?: number;
  appointmentCount?: number;
  lastVisit?: string | null;
}

interface ClientSelectProps {
  value: string;
  onChange: (clientId: string, client?: DropdownClient) => void;
  onQuickCreate?: () => void;
  placeholder?: string;
  showHistory?: boolean;
  className?: string;
  refreshTrigger?: number;
}

const stripAccents = (str: string) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function ClientSelect({
  value,
  onChange,
  onQuickCreate,
  placeholder = "Buscar cliente...",
  showHistory = true,
  className = "",
  refreshTrigger = 0,
}: ClientSelectProps) {
  const [clients, setClients] = useState<DropdownClient[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedClient = clients.find((c) => String(c.id) === value);

  // Fetch clients — only show loading spinner on initial load, not on search
  const isInitialLoad = useRef(true);
  const fetchClients = useCallback(async (q: string) => {
    if (isInitialLoad.current) setLoading(true);
    const url = q ? `/api/clientes/dropdown?q=${encodeURIComponent(q)}` : "/api/clientes/dropdown?limit=500";
    const { data } = await apiFetch<DropdownClient[]>(url);
    if (data) setClients(data);
    if (isInitialLoad.current) {
      setLoading(false);
      isInitialLoad.current = false;
    }
  }, []);

  // Keep a ref to the latest search value for the refresh effect
  const searchRef = useRef(search);
  searchRef.current = search;

  // Initial load + refresh on trigger change
  useEffect(() => {
    fetchClients(searchRef.current);
  }, [fetchClients, refreshTrigger]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchClients(search);
    }, 200);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, fetchClients]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const filtered = clients.filter(matchesSearch);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && filtered[highlightIndex]) {
        selectClient(filtered[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Backspace" && search === "" && value) {
      onChange("");
    }
  };

  const selectClient = (client: DropdownClient) => {
    onChange(String(client.id), client);
    setSearch("");
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  const matchesSearch = (c: DropdownClient) => {
    if (!search) return true;
    const s = stripAccents(search);
    return stripAccents(c.name).includes(s) || (c.phone || '').toLowerCase().includes(s);
  };

  const filteredClients = clients.filter(matchesSearch);

  // Separate recent clients (visited in last 30 days)
  const recentClients = filteredClients.filter((c) => {
    if (!c.lastVisit) return false;
    const daysSince = (Date.now() - new Date(c.lastVisit).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 30;
  }).slice(0, 5);

  const otherClients = filteredClients.filter((c) => !recentClients.includes(c));

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input */}
      <div className="relative">
        <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none transition-opacity duration-150 ${(isOpen && search) || selectedClient ? 'opacity-0' : 'opacity-100'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : (selectedClient?.name || "")}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearch("");
            setHighlightIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedClient ? selectedClient.name : placeholder}
          className="input pl-10 pr-10 text-sm"
        />
        {selectedClient && (
          <button
            type="button"
            onClick={() => { onChange(""); setSearch(""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-surface text-muted hover:text-dark transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {!selectedClient && (
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-border shadow-lg max-h-80 overflow-hidden animate-scaleIn">
          <div className="max-h-80 overflow-y-auto">
            {/* Recent clients chips */}
            {recentClients.length > 0 && search === "" && (
              <div className="p-2 border-b border-border/50">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider px-2 mb-1.5">Clientes Recientes</p>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {recentClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                        String(c.id) === value
                          ? "bg-primary text-white"
                          : "bg-primary-bg text-primary hover:bg-primary/10 border border-primary/20"
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate max-w-[100px]">{c.name.split(" ")[0]}</span>
                      {c.freeServiceAvailable && <span>🎁</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="px-4 py-3 text-center">
                <svg className="w-4 h-4 text-muted animate-spin mx-auto" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}

            {/* Client list */}
            {!loading && filteredClients.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted">No se encontraron clientes</p>
                {onQuickCreate && (
                  <button
                    type="button"
                    onClick={() => { setIsOpen(false); onQuickCreate(); }}
                    className="mt-2 text-xs text-primary hover:text-primary-dark font-medium"
                  >
                    + Crear cliente nuevo
                  </button>
                )}
              </div>
            )}

            {!loading && filteredClients.length > 0 && (
              <>
                {/* Recent section label */}
                {recentClients.length > 0 && search === "" && otherClients.length > 0 && (
                  <div className="px-3 pt-2 pb-1">
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Todos los Clientes</p>
                  </div>
                )}

                {/* All clients */}
                {(search ? filteredClients : otherClients).map((c, idx) => {
                  const globalIdx = search ? idx : recentClients.length + idx;
                  const isSelected = String(c.id) === value;
                  const isHighlighted = globalIdx === highlightIndex;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c)}
                      onMouseEnter={() => setHighlightIndex(globalIdx)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        isSelected ? "bg-primary-bg" : isHighlighted ? "bg-surface" : "hover:bg-surface/60"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        isSelected ? "bg-primary text-white" : "bg-primary-bg text-primary"
                      }`}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-dark truncate">{c.name}</span>
                          {c.freeServiceAvailable && <span className="text-xs">🎁</span>}
                        </div>
                        {c.phone && <p className="text-[11px] text-muted truncate">{c.phone}</p>}
                      </div>
                      {showHistory && c.saleCount != null && c.saleCount > 0 && (
                        <div className="text-right flex-shrink-0">
                          <span className="text-[10px] text-muted block">{c.saleCount} ventas</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </>
            )}

            {/* Quick create button */}
            {onQuickCreate && (
              <button
                type="button"
                onClick={() => { setIsOpen(false); onQuickCreate(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-primary hover:bg-primary-bg border-t border-border/50 transition-colors font-medium"
              >
                <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">+</span>
                Crear nuevo cliente
              </button>
            )}
          </div>
        </div>
      )}

      {/* Client history tooltip */}
      {selectedClient && showHistory && isOpen === false && (selectedClient.saleCount ?? 0) > 0 && (
        <div className="mt-1 flex items-center gap-3 px-2 text-[10px] text-muted">
          <span>{selectedClient.visitCount ?? 0} visitas</span>
          <span>·</span>
          <span>{selectedClient.saleCount ?? 0} ventas</span>
          {selectedClient.lastVisit && (
            <>
              <span>·</span>
              <span>Última: {new Date(selectedClient.lastVisit).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
