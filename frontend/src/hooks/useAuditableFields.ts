/**
 * useAuditableFields Hook
 * 
 * Provides reactive bindings for @Auditable annotated fields visualization.
 * Integrates with the AuditService to fetch and display audit-related metadata
 * for asset detail pages.
 * 
 * @packageDocumentation
 * @module hooks
 * @category AssetDetail
 * @subcategory AuditBinding
 * 
 * @remarks
 * This hook manages the extraction and binding of audit metadata for fields
 * marked with the @Auditable annotation. It provides:
 * - Field metadata extraction and caching
 * - Real-time audit event subscription
 * - Change tracking for auditable fields
 * - Graphify knowledge graph node matching
 * 
 * @example
 * ```typescript
 * const { auditableFields, bindField, unbindField, refreshMetadata } = useAuditableFields({
 *   assetId: 'asset-123',
 *   entityType: 'HardwareAsset'
 * });
 * ```
 * 
 * @author SWARM-051 Team
 * @since Iteration 10
 * @version 1.0.0
 */

import { ref, computed, watch, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue';
import type { AuditableFieldMetadata, AuditEvent, AuditBindingConfig } from '../types/audit.types';
import { auditService } from '../services/auditService';

/**
 * Default configuration for auditable field binding
 * 
 * @internal
 */
const DEFAULT_BINDING_CONFIG: Required<AuditBindingConfig> = {
  assetId: '',
  entityType: 'Asset',
  enableRealtime: true,
  enableGraphify: true,
  cacheTimeout: 300000, // 5 minutes
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Cache entry for auditable field metadata
 * 
 * @internal
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Graphify node matching result
 * 
 * @public
 */
export interface GraphifyNodeMatch {
  /** Unique node identifier in the knowledge graph */
  nodeId: string;
  /** Field name this node represents */
  fieldName: string;
  /** Match confidence score (0-1) */
  confidence: number;
  /** Associated audit events */
  events: AuditEvent[];
  /** Node metadata from Graphify */
  metadata: Record<string, unknown>;
}

/**
 * Binding state for a single auditable field
 * 
 * @public
 */
export interface FieldBinding {
  /** Field identifier */
  fieldId: string;
  /** Field display name */
  fieldName: string;
  /** Current field value */
  value: unknown;
  /** Previous field value (if changed) */
  previousValue?: unknown;
  /** Whether field has unsaved changes */
  isDirty: boolean;
  /** Associated audit events */
  events: AuditEvent[];
  /** Graphify node matches */
  graphifyMatches: GraphifyNodeMatch[];
  /** Last update timestamp */
  lastUpdated: number;
  /** Binding status */
  status: 'idle' | 'loading' | 'bound' | 'error';
  /** Error message if status is error */
  error?: string;
}

/**
 * Return type for useAuditableFields hook
 * 
 * @public
 */
export interface UseAuditableFieldsReturn {
  /** All currently bound auditable fields */
  auditableFields: ComputedRef<Map<string, FieldBinding>>;
  /** Array of auditable field bindings */
  fieldList: ComputedRef<FieldBinding[]>;
  /** Count of bound fields */
  fieldCount: ComputedRef<number>;
  /** Whether any fields have unsaved changes */
  hasDirtyFields: ComputedRef<boolean>;
  /** Currently loading fields */
  isLoading: ComputedRef<boolean>;
  /** Error state */
  error: Ref<string | null>;
  /** Bind a field to audit tracking */
  bindField: (fieldId: string, config?: Partial<FieldBinding>) => Promise<void>;
  /** Unbind a field from audit tracking */
  unbindField: (fieldId: string) => void;
  /** Update field value */
  updateField: (fieldId: string, value: unknown) => void;
  /** Refresh metadata for all bound fields */
  refreshMetadata: () => Promise<void>;
  /** Get graphify matches for a field */
  getGraphifyMatches: (fieldId: string) => GraphifyNodeMatch[];
  /** Clear all bindings */
  clearBindings: () => void;
  /** Export audit trail for bound fields */
  exportAuditTrail: () => AuditEvent[];
}

/**
 * Configuration options for useAuditableFields hook
 * 
 * @public
 */
export interface UseAuditableFieldsOptions {
  /** Asset ID to bind audit fields to */
  assetId: string;
  /** Entity type (e.g., 'HardwareAsset', 'SoftwareAsset') */
  entityType: string;
  /** Enable real-time audit event subscription */
  enableRealtime?: boolean;
  /** Enable Graphify knowledge graph integration */
  enableGraphify?: boolean;
  /** Initial fields to bind */
  initialFields?: string[];
  /** Cache timeout in milliseconds */
  cacheTimeout?: number;
}

/**
 * useAuditableFields Hook
 * 
 * Provides reactive bindings for @Auditable annotated fields visualization.
 * This hook handles:
 * 1. Extraction of @Auditable field metadata from entity definitions
 * 2. Binding fields to audit tracking with the AuditService
 * 3. Graphify knowledge graph node matching for enhanced visualization
 * 4. Real-time audit event subscriptions
 * 
 * @param options - Configuration options for the hook
 * @returns Object containing reactive audit field bindings and utilities
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const { auditableFields, bindField } = useAuditableFields({
 *   assetId: 'asset-123',
 *   entityType: 'HardwareAsset'
 * });
 * 
 * // Bind a specific field
 * await bindField('assetName', { fieldName: 'Asset Name' });
 * 
 * // Access bound fields
 * console.log(auditableFields.value.get('assetName'));
 * ```
 * 
 * @throws {Error} When assetId is not provided
 * @throws {Error} When entityType is not recognized
 * 
 * @see {@link https://docs.example.com/audit-binding | Audit Binding Documentation}
 */
export function useAuditableFields(
  options: UseAuditableFieldsOptions
): UseAuditableFieldsReturn {
  // ============================================================================
  // Validation and Configuration
  // ============================================================================
  
  /**
   * Validates the provided options and merges with defaults
   * 
   * @param opts - User-provided options
   * @returns Merged configuration with defaults
   * 
   * @throws {Error} If required options are missing
   */
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

  // ============================================================================
  // Reactive State
  // ============================================================================
  
  /** Map of field ID to FieldBinding */
  const fieldBindings = ref<Map<string, FieldBinding>>(new Map());
  
  /** Error state */
  const error = ref<string | null>(null);
  
  /** Loading state */
  const isLoading = ref(false);

  /** Subscription handles for cleanup */
  const subscriptions = new Set<() => void>();

  /** Metadata cache */
  const metadataCache = new Map<string, CacheEntry<AuditableFieldMetadata>>();

  // ============================================================================
  // Computed Properties
  // ============================================================================
  
  /**
   * All currently bound auditable fields as a reactive Map
   */
  const auditableFields = computed(() => fieldBindings.value);

  /**
   * Array of all field bindings for iteration
   */
  const fieldList = computed(() => Array.from(fieldBindings.value.values()));

  /**
   * Count of currently bound fields
   */
  const fieldCount = computed(() => fieldBindings.value.size);

  /**
   * Whether any field has unsaved changes
   */
  const hasDirtyFields = computed(() =>
    Array.from(fieldBindings.value.values()).some(binding => binding.isDirty)
  );

  // ============================================================================
  // Private Methods
  // ============================================================================
  
  /**
   * Retrieves cached metadata or fetches from service
   * 
   * @param fieldId - Field identifier
   * @param entityType - Entity type
   * @returns Cached or fetched metadata
   * 
   * @internal
   */
  async function getCachedMetadata(
    fieldId: string,
    entityType: string
  ): Promise<AuditableFieldMetadata | null> {
    const cacheKey = `${entityType}:${fieldId}`;
    const cached = metadataCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const metadata = await auditService.getFieldMetadata(entityType, fieldId);
      
      if (metadata) {
        metadataCache.set(cacheKey, {
          data: metadata,
          timestamp: Date.now(),
          expiresAt: Date.now() + config.cacheTimeout,
        });
      }

      return metadata;
    } catch (err) {
      console.error(`[useAuditableFields] Failed to fetch metadata for ${cacheKey}:`, err);
      return null;
    }
  }

  /**
   * Fetches Graphify knowledge graph nodes for a field
   * 
   * @param fieldId - Field identifier
   * @param fieldName - Field display name
   * @returns Array of matching Graphify nodes
   * 
   * @internal
   */
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
        console.warn(`[useAuditableFields] No matching Graphify nodes found for field: ${fieldName}`);
        return [];
      }

      return nodes.map(node => ({
        nodeId: node.id,
        fieldName,
        confidence: node.confidence || 0.5,
        events: node.relatedEvents || [],
        metadata: node.metadata || {},
      }));
    } catch (err) {
      console.error(`[useAuditableFields] Graphify node search failed for ${fieldId}:`, err);
      return [];
    }
  }

  /**
   * Fetches audit events for a specific field
   * 
   * @param fieldId - Field identifier
   * @returns Array of audit events
   * 
   * @internal
   */
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
      console.error(`[useAuditableFields] Failed to fetch events for ${fieldId}:`, err);
      return [];
    }
  }

  /**
   * Subscribes to real-time audit events for a field
   * 
   * @param fieldId - Field identifier
   * @param callback - Callback for new events
   * @returns Unsubscribe function
   * 
   * @internal
   */
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

    subscriptions.add(unsubscribe);
    return unsubscribe;
  }

  /**
   * Updates a field binding with new data
   * 
   * @param fieldId - Field identifier
   * @param updates - Partial updates to apply
   * 
   * @internal
   */
  function updateBinding(
    fieldId: string,
    updates: Partial<FieldBinding>
  ): void {
    const current = fieldBindings.value.get(fieldId);
    if (current) {
      const updated = { ...current, ...updates, lastUpdated: Date.now() };
      fieldBindings.value.set(fieldId, updated);
    }
  }

  // ============================================================================
  // Public Methods
  // ============================================================================
  
  /**
   * Binds a field to audit tracking
   * 
   * This method:
   * 1. Validates the field exists in the entity definition
   * 2. Fetches @Auditable metadata for the field
   * 3. Retrieves historical audit events
   * 4. Queries Graphify for knowledge graph nodes
   * 5. Subscribes to real-time updates
   * 
   * @param fieldId - Unique identifier for the field
   * @param config - Optional field binding configuration
   * @returns Promise that resolves when binding is complete
   * 
   * @example
   * ```typescript
   * await bindField('serialNumber', {
   *   fieldName: 'Serial Number',
   *   value: 'SN-12345'
   * });
   * ```
   */
  async function bindField(
    fieldId: string,
    config?: Partial<FieldBinding>
  ): Promise<void> {
    // Prevent duplicate bindings
    if (fieldBindings.value.has(fieldId)) {
      console.warn(`[useAuditableFields] Field ${fieldId} is already bound`);
      return;
    }

    // Initialize binding in loading state
    const initialBinding: FieldBinding = {
      fieldId,
      fieldName: config?.fieldName || fieldId,
      value: config?.value,
      isDirty: false,
      events: [],
      graphifyMatches: [],
      lastUpdated: Date.now(),
      status: 'loading',
    };

    fieldBindings.value.set(fieldId, initialBinding);
    error.value = null;

    try {
      // Fetch metadata, events, and graphify data in parallel
      const [metadata, events, graphifyMatches] = await Promise.all([
        getCachedMetadata(fieldId, config.entityType || config.entityType),
        fetchFieldEvents(fieldId),
        fetchGraphifyNodes(fieldId, config?.fieldName || fieldId),
      ]);

      // Update binding with fetched data
      const binding: FieldBinding = {
        fieldId,
        fieldName: config?.fieldName || metadata?.displayName || fieldId,
        value: config?.value ?? metadata?.defaultValue,
        previousValue: undefined,
        isDirty: false,
        events,
        graphifyMatches,
        lastUpdated: Date.now(),
        status: 'bound',
      };

      fieldBindings.value.set(fieldId, binding);

      // Subscribe to real-time updates if enabled
      if (config.enableRealtime !== false) {
        subscribeToFieldEvents(fieldId, (event) => {
          const current = fieldBindings.value.get(fieldId);
          if (current) {
            const updatedEvents = [event, ...current.events].slice(0, 50);
            updateBinding(fieldId, { events: updatedEvents });
          }
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      updateBinding(fieldId, {
        status: 'error',
        error: `Failed to bind field: ${errorMessage}`,
      });
      error.value = `Binding failed for ${fieldId}: ${errorMessage}`;
    }
  }

  /**
   * Unbinds a field from audit tracking
   * 
   * Removes the field from the bindings map and cleans up any subscriptions.
   * 
   * @param fieldId - Field identifier to unbind
   * 
   * @example
   * ```typescript
   * unbindField('serialNumber');
   * ```
   */
  function unbindField(fieldId: string): void {
    fieldBindings.value.delete(fieldId);
  }

  /**
   * Updates the value of a bound field
   * 
   * Marks the field as dirty if the value has changed from the previous value.
   * 
   * @param fieldId - Field identifier
   * @param value - New value for the field
   * 
   * @example
   * ```typescript
   * updateField('assetName', 'New Asset Name');
   * // Field is now marked as dirty
   * ```
   */
  function updateField(fieldId: string, value: unknown): void {
    const binding = fieldBindings.value.get(fieldId);
    if (!binding) {
      console.warn(`[useAuditableFields] Cannot update unbound field: ${fieldId}`);
      return;
    }

    const isValueChanged = binding.value !== value;
    const previousValue = binding.value;

    updateBinding(fieldId, {
      value,
      previousValue: isValueChanged ? previousValue : binding.previousValue,
      isDirty: isValueChanged,
    });
  }

  /**
   * Refreshes metadata for all bound fields
   * 
   * Clears the cache and re-fetches metadata, events, and graphify data
   * for all currently bound fields.
   * 
   * @returns Promise that resolves when all fields are refreshed
   * 
   * @example
   * ```typescript
   * await refreshMetadata();
   * ```
   */
  async function refreshMetadata(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    // Clear metadata cache
    metadataCache.clear();

    // Re-bind all fields
    const fieldIds = Array.from(fieldBindings.value.keys());
    
    try {
      await Promise.all(
        fieldIds.map(async (fieldId) => {
          const binding = fieldBindings.value.get(fieldId);
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
      const errorMessage = err instanceof Error ? err.message : 'Refresh failed';
      error.value = errorMessage;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Gets Graphify knowledge graph matches for a specific field
   * 
   * @param fieldId - Field identifier
   * @returns Array of matching Graphify nodes
   * 
   * @example
   * ```typescript
   * const matches = getGraphifyMatches('serialNumber');
   * console.log(`Found ${matches.length} related nodes`);
   * ```
   */
  function getGraphifyMatches(fieldId: string): GraphifyNodeMatch[] {
    const binding = fieldBindings.value.get(fieldId);
    return binding?.graphifyMatches || [];
  }

  /**
   * Clears all field bindings
   * 
   * Removes all bindings and cleans up subscriptions.
   * 
   * @example
   * ```typescript
   * clearBindings();
   * // All fields are now unbound
   * ```
   */
  function clearBindings(): void {
    // Clean up all subscriptions
    subscriptions.forEach(unsubscribe => unsubscribe());
    subscriptions.clear();

    // Clear bindings
    fieldBindings.value.clear();
    
    // Clear cache
    metadataCache.clear();
    
    // Reset state
    error.value = null;
  }

  /**
   * Exports the complete audit trail for all bound fields
   * 
   * @returns Array of all audit events across all bound fields
   * 
   * @example
   * ```typescript
   * const trail = exportAuditTrail();
   * // Send to backend or generate report
   * ```
   */
  function exportAuditTrail(): AuditEvent[] {
    const allEvents: AuditEvent[] = [];
    
    fieldBindings.value.forEach(binding => {
      allEvents.push(...binding.events);
    });

    // Sort by timestamp descending
    return allEvents.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================
  
  /**
   * Initialize hook and bind initial fields
   */
  onMounted(async () => {
    if (config.initialFields && config.initialFields.length > 0) {
      await Promise.all(
        config.initialFields.map(fieldId => bindField(fieldId))
      );
    }
  });

  /**
   * Cleanup on unmount
   */
  onUnmounted(() => {
    clearBindings();
  });

  // ============================================================================
  // Return Public API
  // ============================================================================
  
  return {
    auditableFields,
    fieldList,
    fieldCount,
    hasDirtyFields,
    isLoading,
    error,
    bindField,
    unbindField,
    updateField,
    refreshMetadata,
    getGraphifyMatches,
    clearBindings,
    exportAuditTrail,
  };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================
export type {
  FieldBinding,
  GraphifyNodeMatch,
  UseAuditableFieldsOptions,
  UseAuditableFieldsReturn,
};