import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { AuditableFieldMetadata, AuditEvent, AuditBindingConfig } from '../types/audit.types';
import { auditService } from '../services/auditService';

const DEFAULT_BINDING_CONFIG: Required<AuditBindingConfig> = {
  assetId: '',
  entityType: 'Asset',
  enableRealtime: true,
  enableGraphify: true,
  cacheTimeout: 300000,
  maxRetries: 3,
  retryDelay: 1000,
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface GraphifyNodeMatch {
  nodeId: string;
  fieldName: string;
  confidence: number;
  events: AuditEvent[];
  metadata: Record<string, unknown>;
}

export interface FieldBinding {
  fieldId: string;
  fieldName: string;
  value: unknown;
  previousValue?: unknown;
  isDirty: boolean;
  events: AuditEvent[];
  graphifyMatches: GraphifyNodeMatch[];
  lastUpdated: number;
  status: 'idle' | 'loading' | 'bound' | 'error';
  error?: string;
}

export interface UseAuditableFieldsReturn {
  auditableFields: Map<string, FieldBinding>;
  fieldList: FieldBinding[];
  fieldCount: number;
  hasDirtyFields: boolean;
  isLoading: boolean;
  error: string | null;
  bindField: (fieldId: string, config?: Partial<FieldBinding>) => Promise<void>;
  unbindField: (fieldId: string) => void;
  updateField: (fieldId: string, value: unknown) => void;
  refreshMetadata: () => Promise<void>;
  getGraphifyMatches: (fieldId: string) => GraphifyNodeMatch[];
  clearBindings: () => void;
  exportAuditTrail: () => AuditEvent[];
}

export interface UseAuditableFieldsOptions {
  assetId: string;
  entityType: string;
  enableRealtime?: boolean;
  enableGraphify?: boolean;
  initialFields?: string[];
  cacheTimeout?: number;
}

export function useAuditableFields(
  options: UseAuditableFieldsOptions
): UseAuditableFieldsReturn {
  function validateAndMergeConfig(opts: UseAuditableFieldsOptions) {
    if (!opts.assetId) {
      throw new Error('useAuditableFields: assetId is required');
    }
    if (!opts.entityType) {
      throw new Error('useAuditableFields: entityType is required');
    }

    return {
      ...DEFAULT_BINDING_CONFIG,
      ...opts,
    } as Required<UseAuditableFieldsOptions>;
  }

  const config = validateAndMergeConfig(options);

  const [fieldBindings, setFieldBindings] = useState<Map<string, FieldBinding>>(
    () => new Map()
  );
  const [errorState, setErrorState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const subscriptionsRef = useRef(new Set<() => void>());
  const metadataCacheRef = useRef(new Map<string, CacheEntry<AuditableFieldMetadata>>());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      subscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
      subscriptionsRef.current.clear();
    };
  }, []);

  const auditableFields = useMemo(() => fieldBindings, [fieldBindings]);

  const fieldList = useMemo(
    () => Array.from(fieldBindings.values()),
    [fieldBindings]
  );

  const fieldCount = useMemo(() => fieldBindings.size, [fieldBindings]);

  const hasDirtyFields = useMemo(
    () => Array.from(fieldBindings.values()).some((binding) => binding.isDirty),
    [fieldBindings]
  );

  async function getCachedMetadata(
    fieldId: string,
    entityType: string
  ): Promise<AuditableFieldMetadata | null> {
    const cacheKey = `${entityType}:${fieldId}`;
    const cached = metadataCacheRef.current.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const metadata = await auditService.getFieldMetadata(entityType, fieldId);

      if (metadata && mountedRef.current) {
        metadataCacheRef.current.set(cacheKey, {
          data: metadata,
          timestamp: Date.now(),
          expiresAt: Date.now() + config.cacheTimeout,
        });
      }

      return metadata;
    } catch (err) {
      console.error(
        `[useAuditableFields] Failed to fetch metadata for ${cacheKey}:`,
        err
      );
      return null;
    }
  }

  async function fetchGraphifyNodes(
    fieldId: string,
    fieldName: string
  ): Promise<GraphifyNodeMatch[]> {
    if (!config.enableGraphify) {
      return [];
    }

    try {
      const nodes = await auditService.searchGraphifyNodes({
        query: fieldName,
        entityType: config.entityType,
        assetId: config.assetId,
        limit: 5,
      });

      if (!nodes || nodes.length === 0) {
        console.warn(
          `[useAuditableFields] No matching Graphify nodes found for field: ${fieldName}`
        );
        return [];
      }

      return nodes.map((node) => ({
        nodeId: node.id,
        fieldName,
        confidence: node.confidence || 0.5,
        events: node.relatedEvents || [],
        metadata: node.metadata || {},
      }));
    } catch (err) {
      console.error(
        `[useAuditableFields] Graphify node search failed for ${fieldId}:`,
        err
      );
      return [];
    }
  }

  async function fetchFieldEvents(fieldId: string): Promise<AuditEvent[]> {
    try {
      const events = await auditService.getFieldAuditHistory({
        assetId: config.assetId,
        entityType: config.entityType,
        fieldId,
        limit: 50,
      });

      return events;
    } catch (err) {
      console.error(
        `[useAuditableFields] Failed to fetch events for ${fieldId}:`,
        err
      );
      return [];
    }
  }

  function subscribeToFieldEvents(
    fieldId: string,
    callback: (event: AuditEvent) => void
  ): () => void {
    if (!config.enableRealtime) {
      return () => {};
    }

    const unsubscribe = auditService.subscribeToFieldUpdates(
      config.assetId,
      fieldId,
      (event) => {
        callback(event);
      }
    );

    subscriptionsRef.current.add(unsubscribe);
    return unsubscribe;
  }

  function updateBinding(
    fieldId: string,
    updates: Partial<FieldBinding>
  ): void {
    setFieldBindings((prev) => {
      const current = prev.get(fieldId);
      if (!current) return prev;
      const updated = { ...current, ...updates, lastUpdated: Date.now() };
      const next = new Map(prev);
      next.set(fieldId, updated);
      return next;
    });
  }

  const bindField = useCallback(
    async (fieldId: string, fieldConfig?: Partial<FieldBinding>) => {
      setFieldBindings((prev) => {
        if (prev.has(fieldId)) {
          console.warn(
            `[useAuditableFields] Field ${fieldId} is already bound`
          );
          return prev;
        }
        const initialBinding: FieldBinding = {
          fieldId,
          fieldName: fieldConfig?.fieldName || fieldId,
          value: fieldConfig?.value,
          isDirty: false,
          events: [],
          graphifyMatches: [],
          lastUpdated: Date.now(),
          status: 'loading',
        };
        const next = new Map(prev);
        next.set(fieldId, initialBinding);
        return next;
      });

      setErrorState(null);

      try {
        const [metadata, events, graphifyMatches] = await Promise.all([
          getCachedMetadata(fieldId, config.entityType),
          fetchFieldEvents(fieldId),
          fetchGraphifyNodes(fieldId, fieldConfig?.fieldName || fieldId),
        ]);

        if (!mountedRef.current) return;

        const binding: FieldBinding = {
          fieldId,
          fieldName:
            fieldConfig?.fieldName || metadata?.displayName || fieldId,
          value: fieldConfig?.value ?? metadata?.defaultValue,
          previousValue: undefined,
          isDirty: false,
          events,
          graphifyMatches,
          lastUpdated: Date.now(),
          status: 'bound',
        };

        setFieldBindings((prev) => {
          const next = new Map(prev);
          next.set(fieldId, binding);
          return next;
        });

        if (config.enableRealtime) {
          subscribeToFieldEvents(fieldId, (event) => {
            setFieldBindings((prev) => {
              const current = prev.get(fieldId);
              if (!current) return prev;
              const updatedEvents = [event, ...current.events].slice(0, 50);
              const updated = {
                ...current,
                events: updatedEvents,
                lastUpdated: Date.now(),
              };
              const next = new Map(prev);
              next.set(fieldId, updated);
              return next;
            });
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        updateBinding(fieldId, {
          status: 'error',
          error: `Failed to bind field: ${errorMessage}`,
        });
        setErrorState(`Binding failed for ${fieldId}: ${errorMessage}`);
      }
    },
    [config]
  );

  const unbindField = useCallback((fieldId: string) => {
    setFieldBindings((prev) => {
      const next = new Map(prev);
      next.delete(fieldId);
      return next;
    });
  }, []);

  const updateField = useCallback(
    (fieldId: string, value: unknown) => {
      setFieldBindings((prev) => {
        const binding = prev.get(fieldId);
        if (!binding) {
          console.warn(
            `[useAuditableFields] Cannot update unbound field: ${fieldId}`
          );
          return prev;
        }

        const isValueChanged = binding.value !== value;
        const previousValue = binding.value;

        const next = new Map(prev);
        next.set(fieldId, {
          ...binding,
          value,
          previousValue: isValueChanged ? previousValue : binding.previousValue,
          isDirty: isValueChanged,
          lastUpdated: Date.now(),
        });
        return next;
      });
    },
    []
  );

  const refreshMetadata = useCallback(async () => {
    setIsLoading(true);
    setErrorState(null);

    metadataCacheRef.current.clear();

    const fieldIds = Array.from(fieldBindings.keys());

    try {
      await Promise.all(
        fieldIds.map(async (fieldId) => {
          const binding = fieldBindings.get(fieldId);
          if (!binding) return;

          updateBinding(fieldId, { status: 'loading' });

          const [metadata, events, graphifyMatches] = await Promise.all([
            getCachedMetadata(fieldId, config.entityType),
            fetchFieldEvents(fieldId),
            fetchGraphifyNodes(fieldId, binding.fieldName),
          ]);

          updateBinding(fieldId, {
            events,
            graphifyMatches,
            status: 'bound',
            lastUpdated: Date.now(),
          });
        })
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Refresh failed';
      setErrorState(errorMessage);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fieldBindings, config]);

  const getGraphifyMatches = useCallback(
    (fieldId: string): GraphifyNodeMatch[] => {
      const binding = fieldBindings.get(fieldId);
      return binding?.graphifyMatches || [];
    },
    [fieldBindings]
  );

  const clearBindings = useCallback(() => {
    subscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
    subscriptionsRef.current.clear();

    setFieldBindings(new Map());
    metadataCacheRef.current.clear();
    setErrorState(null);
  }, []);

  const exportAuditTrail = useCallback((): AuditEvent[] => {
    const allEvents: AuditEvent[] = [];

    fieldBindings.forEach((binding) => {
      allEvents.push(...binding.events);
    });

    return allEvents.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [fieldBindings]);

  useEffect(() => {
    if (config.initialFields && config.initialFields.length > 0) {
      Promise.all(
        config.initialFields.map((fieldId) => bindField(fieldId))
      );
    }
  }, []);

  return {
    auditableFields,
    fieldList,
    fieldCount,
    hasDirtyFields,
    isLoading,
    error: errorState,
    bindField,
    unbindField,
    updateField,
    refreshMetadata,
    getGraphifyMatches,
    clearBindings,
    exportAuditTrail,
  };
}

export type {
  FieldBinding,
  GraphifyNodeMatch,
  UseAuditableFieldsOptions,
  UseAuditableFieldsReturn,
};
