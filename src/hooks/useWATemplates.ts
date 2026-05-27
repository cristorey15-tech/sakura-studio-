"use client";

import { useState, useEffect, useCallback } from "react";

export interface WATemplate {
  id: number;
  label: string;
  message: string;
}

export function renderTemplate(message: string, clientName: string): string {
  return message.replace(/\{nombre\}/g, clientName);
}

export function useWATemplates() {
  const [templates, setTemplates] = useState<WATemplate[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/wa-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch {
      // fallback silencioso
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const addTemplate = useCallback(async (label: string, message: string) => {
    if (!label.trim() || !message.trim()) return;
    try {
      const res = await fetch("/api/wa-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), message: message.trim() }),
      });
      if (res.ok) {
        const newTpl = await res.json();
        setTemplates((prev) => [...prev, newTpl]);
      }
    } catch { /* ignore */ }
  }, []);

  const editTemplate = useCallback(async (id: number, label: string, message: string) => {
    if (!label.trim() || !message.trim()) return;
    try {
      const res = await fetch("/api/wa-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, label: label.trim(), message: message.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
      }
    } catch { /* ignore */ }
  }, []);

  const deleteTemplate = useCallback(async (id: number) => {
    try {
      const res = await fetch("/api/wa-templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch { /* ignore */ }
  }, []);

  const resetDefaults = useCallback(async () => {
    try {
      await fetch("/api/wa-templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetAll: true }),
      });
      await loadTemplates();
    } catch { /* ignore */ }
  }, [loadTemplates]);

  return {
    templates,
    loaded,
    addTemplate,
    editTemplate,
    deleteTemplate,
    resetDefaults,
  };
}
