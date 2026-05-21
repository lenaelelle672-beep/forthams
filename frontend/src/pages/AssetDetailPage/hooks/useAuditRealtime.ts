import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAuditRealtimeOptions {
  assetId: string;
  eventType?: string;
}

interface AuditRealtimeEvent {
  event: unknown;
  timestamp: number;
}

export function useAuditRealtime(options: UseAuditRealtimeOptions) {
  const { assetId, eventType } = options;
  const [lastEvent, setLastEvent] = useState<AuditRealtimeEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!assetId) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/audit?assetId=${assetId}${eventType ? `&eventType=${eventType}` : ''}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          setLastEvent({ event: data, timestamp: Date.now() });
        } catch {
          setLastEvent({ event: event.data, timestamp: Date.now() });
        }
      };

      ws.onerror = () => {
        // Silently handle — real-time is best-effort
      };

      ws.onclose = () => {
        wsRef.current = null;
      };
    } catch {
      // WebSocket not available or connection failed — real-time is best-effort
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [assetId, eventType]);

  return { lastEvent };
}

export default useAuditRealtime;
