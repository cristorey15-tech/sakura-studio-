"use client";

import { useState, useCallback } from "react";

export interface HistoryEntry {
  id: string;
  clientName: string;
  clientPhone: string;
  message: string;
  templateLabel: string | null;
  type: "reminder" | "promo";
  sentAt: string; // ISO string
}

const STORAGE_KEY = "sakura_wa_history";
const MAX_ENTRIES = 200;

function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // localStorage might be full
  }
}

export function useWAHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  const addEntry = useCallback(
    (entry: Omit<HistoryEntry, "id" | "sentAt">) => {
      const newEntry: HistoryEntry = {
        ...entry,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        sentAt: new Date().toISOString(),
      };
      setHistory((prev) => {
        const updated = [newEntry, ...prev].slice(0, MAX_ENTRIES);
        saveHistory(updated);
        return updated;
      });
    },
    []
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  return { history, addEntry, clearHistory };
}
