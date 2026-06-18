"use client";

import { useEffect, useRef, useCallback } from "react";

interface SSEData {
  type: "snapshot" | "heartbeat" | "error";
  timestamp?: string;
  todaySalesTotal?: number;
  todaySalesCount?: number;
  lowStockCount?: number;
  lowStockProducts?: Array<{ id: number; name: string; quantity: number }>;
  todayAppointments?: number;
  message?: string;
}

interface UseSSEOptions {
  channel?: string;
  onSnapshot?: (data: SSEData) => void;
  enabled?: boolean;
}

export function useSSE({ channel = "general", onSnapshot, enabled = true }: UseSSEOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/events?channel=${channel}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEData;
        if (data.type === "snapshot" && onSnapshot) {
          onSnapshot(data);
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    };
  }, [channel, onSnapshot, enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);
}
