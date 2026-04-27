/**
 * useAuditRealtime Hook
 * 
 * Provides real-time audit log streaming for asset detail pages.
 * Integrates with AuditService WebSocket endpoint for live updates.
 * 
 * @packageDocumentation
 * @module hooks/useAuditRealtime
 * @version 1.0.0
 * @requires @AMS/AuditService
 */

import { ref, onMounted, onUnmounted, computed } from 'vue';
import type { Ref } from 'vue';

/**
 * Configuration options for the real-time audit hook
 */
export interface UseAuditRealtimeOptions {
  /** Asset ID to subscribe to audit events */
  assetId: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Maximum number of cached events */
  maxCacheSize?: number;
  /** Auto-connect on mount */
  autoConnect?: boolean;
}

/**
 * Real-time audit event structure
 */
export interface RealtimeAuditEvent {
  /** Unique event identifier */
  id: string;
  /** Asset ID associated with the event */
  assetId: string;
  /** Operation type (CREATE, UPDATE, DELETE, VIEW) */
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT';
  /** Timestamp of the event */
  timestamp: Date;
  /** User who performed the action */
  operator: {
    id: string;
    name: string;
    avatar?: string;
  };
  /** Changed fields with old and new values */
  changes?: Array<{
    field: string;
    oldValue: string | null;
    newValue: string | null;
  }>;
  /** Event severity level */
  level: 'INFO' | 'WARNING' | 'CRITICAL';
}

/**
 * WebSocket connection state
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Main hook return type
 */
export interface UseAuditRealtimeReturn {
  /** Real-time audit events */
  events: Ref<RealtimeAuditEvent[]>;
  /** Current WebSocket connection state */
  connectionState: Ref<ConnectionState>;
  /** Whether real-time updates are enabled */
  isEnabled: Ref<boolean>;
  /** Error message if connection failed */
  error: Ref<string | null>;
  /** Connect to the WebSocket stream */
  connect: () => Promise<void>;
  /** Disconnect from the WebSocket stream */
  disconnect: () => void;
  /** Clear cached events */
  clearEvents: () => void;
  /** Manually refresh events */
  refresh: () => Promise<void>;
  /** Subscribe to a specific event type */
  subscribe: (operation: string, callback: (event: RealtimeAuditEvent) => void) => () => void;
}

/**
 * Hook for subscribing to real-time audit events for a specific asset.
 * 
 * @param options - Configuration options for the real-time connection
 * @returns Real-time audit event stream and connection controls
 * 
 * @example
 * ```typescript
 * const {
 *   events,
 *   connectionState,
 *   connect,
 *   disconnect
 * } = useAuditRealtime({
 *   assetId: 'asset-123',
 *   autoConnect: true
 * });
 * 
 * // Watch for new audit events
 * watch(events, (newEvents) => {
 *   console.log('New audit events:', newEvents);
 * });
 * ```
 */
export function useAuditRealtime(options: UseAuditRealtimeOptions): UseAuditRealtimeReturn {
  const { 
    assetId, 
    debug = false, 
    maxCacheSize = 100,
    autoConnect = true 
  } = options;

  // Reactive state
  const events = ref<RealtimeAuditEvent[]>([]) as Ref<RealtimeAuditEvent[]>;
  const connectionState = ref<ConnectionState>('disconnected');
  const isEnabled = ref(false);
  const error = ref<string | null>(null);

  // Internal state
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const subscribers = new Map<string, Set<(event: RealtimeAuditEvent) => void>>();

  /**
   * Logs debug messages when debug mode is enabled
   * 
   * @param message - Debug message
   * @param data - Optional data to log
   */
  const logDebug = (message: string, data?: unknown): void => {
    if (debug) {
      console.debug(`[useAuditRealtime] ${message}`, data ?? '');
    }
  };

  /**
   * Generates a unique event ID
   * 
   * @returns Unique identifier string
   */
  const generateEventId = (): string => {
    return `rt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Adds an event to the cache with size limit
   * 
   * @param event - Event to add to cache
   */
  const addEventToCache = (event: RealtimeAuditEvent): void => {
    const currentEvents = events.value;
    if (currentEvents.length >= maxCacheSize) {
      // Remove oldest event when cache is full
      events.value = [...currentEvents.slice(1), event];
    } else {
      events.value = [...currentEvents, event];
    }
    logDebug('Event added to cache', { eventId: event.id, totalEvents: events.value.length });
  };

  /**
   * Notifies all subscribers for a specific operation type
   * 
   * @param event - Event to broadcast
   */
  const notifySubscribers = (event: RealtimeAuditEvent): void => {
    const operationSubscribers = subscribers.get(event.operation);
    if (operationSubscribers) {
      operationSubscribers.forEach((callback) => {
        try {
          callback(event);
        } catch (err) {
          console.error(`[useAuditRealtime] Subscriber callback error:`, err);
        }
      });
    }

    // Also notify 'all' subscribers
    const allSubscribers = subscribers.get('*');
    if (allSubscribers) {
      allSubscribers.forEach((callback) => {
        try {
          callback(event);
        } catch (err) {
          console.error(`[useAuditRealtime] Subscriber callback error:`, err);
        }
      });
    }
  };

  /**
   * Parses incoming WebSocket message to AuditEvent
   * 
   * @param data - Raw message data
   * @returns Parsed RealtimeAuditEvent or null if invalid
   */
  const parseMessage = (data: unknown): RealtimeAuditEvent | null => {
    try {
      const parsed = data as Record<string, unknown>;
      
      if (!parsed.assetId || typeof parsed.assetId !== 'string') {
        logDebug('Invalid message: missing assetId');
        return null;
      }

      // Filter messages not for this asset
      if (parsed.assetId !== assetId) {
        logDebug('Ignoring event for different asset', { 
          expected: assetId, 
          received: parsed.assetId 
        });
        return null;
      }

      return {
        id: (parsed.id as string) || generateEventId(),
        assetId: parsed.assetId as string,
        operation: (parsed.operation as RealtimeAuditEvent['operation']) || 'VIEW',
        timestamp: parsed.timestamp 
          ? new Date(parsed.timestamp as string) 
          : new Date(),
        operator: {
          id: (parsed.operatorId as string) || 'unknown',
          name: (parsed.operatorName as string) || 'Unknown User',
          avatar: parsed.operatorAvatar as string | undefined,
        },
        changes: (parsed.changes as RealtimeAuditEvent['changes']) || [],
        level: (parsed.level as RealtimeAuditEvent['level']) || 'INFO',
      };
    } catch (err) {
      logDebug('Failed to parse message', { error: err, data });
      return null;
    }
  };

  /**
   * Handles incoming WebSocket message
   * 
   * @param event - WebSocket message event
   */
  const handleMessage = (event: MessageEvent): void => {
    try {
      const data = JSON.parse(event.data);
      const auditEvent = parseMessage(data);

      if (auditEvent) {
        addEventToCache(auditEvent);
        notifySubscribers(auditEvent);
        logDebug('Processed real-time event', { eventId: auditEvent.id });
      }
    } catch (err) {
      console.error('[useAuditRealtime] Message parsing error:', err);
    }
  };

  /**
   * Handles WebSocket connection errors
   * 
   * @param event - WebSocket error event
   */
  const handleError = (event: Event): void => {
    console.error('[useAuditRealtime] WebSocket error:', event);
    error.value = 'Connection error occurred';
    connectionState.value = 'error';
    isEnabled.value = false;
  };

  /**
   * Handles WebSocket connection closure
   * 
   * @param event - WebSocket close event
   */
  const handleClose = (event: CloseEvent): void => {
    logDebug('WebSocket connection closed', { 
      code: event.code, 
      reason: event.reason 
    });
    
    connectionState.value = 'disconnected';
    isEnabled.value = false;
    ws = null;

    // Auto-reconnect on unexpected close
    if (event.code !== 1000 && event.code !== 1001) {
      logDebug('Scheduling reconnect...');
      reconnectTimer = setTimeout(() => {
        connect();
      }, 5000);
    }
  };

  /**
   * Establishes WebSocket connection for real-time audit updates
   * 
   * @returns Promise that resolves when connected
   */
  const connect = async (): Promise<void> => {
    if (ws && connectionState.value === 'connected') {
      logDebug('Already connected');
      return;
    }

    // Clean up existing connection
    disconnect();

    connectionState.value = 'connecting';
    error.value = null;

    try {
      // Construct WebSocket URL (would be replaced with actual endpoint)
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/audit/stream?assetId=${encodeURIComponent(assetId)}`;
      
      logDebug('Connecting to WebSocket', { url: wsUrl });
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        logDebug('WebSocket connected');
        connectionState.value = 'connected';
        isEnabled.value = true;
        error.value = null;
      };

      ws.onmessage = handleMessage;
      ws.onerror = handleError;
      ws.onclose = handleClose;

    } catch (err) {
      console.error('[useAuditRealtime] Connection error:', err);
      error.value = err instanceof Error ? err.message : 'Failed to connect';
      connectionState.value = 'error';
      isEnabled.value = false;
      throw err;
    }
  };

  /**
   * Closes WebSocket connection and cleans up
   */
  const disconnect = (): void => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (ws) {
      logDebug('Closing WebSocket connection');
      ws.onclose = null; // Prevent auto-reconnect on intentional close
      ws.close(1000, 'Client disconnect');
      ws = null;
    }

    connectionState.value = 'disconnected';
    isEnabled.value = false;
  };

  /**
   * Clears all cached events
   */
  const clearEvents = (): void => {
    events.value = [];
    logDebug('Events cache cleared');
  };

  /**
   * Fetches initial events via REST API
   * Used for initial load and refresh
   * 
   * @returns Promise that resolves when refresh completes
   */
  const refresh = async (): Promise<void> => {
    logDebug('Refreshing audit events', { assetId });
    
    try {
      // This would typically call the AuditService REST endpoint
      // For now, we simulate the behavior
      const response = await fetch(`/api/audit/asset/${encodeURIComponent(assetId)}?limit=${maxCacheSize}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audit logs: ${response.status}`);
      }

      const data = await response.json();
      const parsedEvents = (data.events || data.data || []).map((item: Record<string, unknown>) => ({
        id: item.id as string,
        assetId: item.assetId as string,
        operation: item.operation as RealtimeAuditEvent['operation'],
        timestamp: new Date(item.timestamp as string),
        operator: {
          id: item.operator?.id as string || 'unknown',
          name: item.operator?.name as string || 'Unknown User',
          avatar: item.operator?.avatar as string | undefined,
        },
        changes: item.changes as RealtimeAuditEvent['changes'],
        level: (item.level as RealtimeAuditEvent['level']) || 'INFO',
      }));

      events.value = parsedEvents;
      logDebug('Audit events refreshed', { count: parsedEvents.length });
    } catch (err) {
      console.error('[useAuditRealtime] Refresh error:', err);
      error.value = err instanceof Error ? err.message : 'Failed to refresh';
      throw err;
    }
  };

  /**
   * Subscribes to specific operation type events
   * 
   * @param operation - Operation type to subscribe to ('*' for all)
   * @param callback - Callback function to invoke
   * @returns Unsubscribe function
   */
  const subscribe = (
    operation: string, 
    callback: (event: RealtimeAuditEvent) => void
  ): (() => void) => {
    if (!subscribers.has(operation)) {
      subscribers.set(operation, new Set());
    }
    
    subscribers.get(operation)!.add(callback);
    logDebug('Subscriber added', { operation, total: subscribers.get(operation)!.size });

    // Return unsubscribe function
    return () => {
      const opSubscribers = subscribers.get(operation);
      if (opSubscribers) {
        opSubscribers.delete(callback);
        if (opSubscribers.size === 0) {
          subscribers.delete(operation);
        }
      }
      logDebug('Subscriber removed', { operation });
    };
  };

  // Lifecycle hooks
  onMounted(() => {
    if (autoConnect) {
      connect();
    }
  });

  onUnmounted(() => {
    disconnect();
    subscribers.clear();
  });

  return {
    events,
    connectionState,
    isEnabled,
    error,
    connect,
    disconnect,
    clearEvents,
    refresh,
    subscribe,
  };
}

export default useAuditRealtime;