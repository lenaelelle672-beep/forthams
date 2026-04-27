/**
 * @fileoverview Audit Types - Type definitions for audit log and auditable field structures
 * @module audit/types
 * @description 
 *   Provides TypeScript interfaces for the audit logging system used in the asset
 *   management platform. These types support the @Auditable annotation tracking
 *   and audit event visualization requirements per SWARM-051 specification.
 * 
 * @see {@link https://docs/audit-service.md} for API documentation
 * @since SWARM-051 v1.0
 */

/**
 * Represents a single field change within an audit log entry
 * @interface FieldChange
 * @description 
 *   Tracks the modification of a single field including its previous and new values.
 *   Used to display field-level change diffs in the audit log panel.
 * 
 * @example
 * ```typescript
 * const change: FieldChange = {
 *   field: 'status',
 *   oldValue: 'INACTIVE',
 *   newValue: 'ACTIVE'
 * };
 * ```
 */
export interface FieldChange {
  /** Name of the field that was changed */
  field: string;
  /** Previous value before the change (null for CREATE operations) */
  oldValue: string | null;
  /** New value after the change (null for DELETE operations) */
  newValue: string | null;
}

/**
 * Supported audit action types for operation tracking
 * @typedef {'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW'} AuditAction
 */
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';

/**
 * Represents a single audit log entry recording an operation on an asset
 * @interface AuditLogEntry
 * @description 
 *   Core data structure for audit trail entries. Each entry captures a discrete
 *   operation performed on an asset, including who performed it, when, and what changed.
 *   Supports the @Auditable field tracking requirement per specification.
 * 
 * @example
 * ```typescript
 * const logEntry: AuditLogEntry = {
 *   id: 'audit-001',
 *   assetId: 'asset-123',
 *   action: 'UPDATE',
 *   operator: 'admin@company.com',
 *   timestamp: '2024-01-15T08:30:00Z',
 *   changes: [
 *     { field: 'status', oldValue: 'INACTIVE', newValue: 'ACTIVE' },
 *     { field: 'owner', oldValue: 'dept-A', newValue: 'dept-B' }
 *   ]
 * };
 * ```
 */
export interface AuditLogEntry {
  /** Unique identifier for this audit log entry */
  id: string;
  /** ID of the asset this audit entry is associated with */
  assetId: string;
  /** Type of operation performed */
  action: AuditAction;
  /** User or system identifier that performed the operation */
  operator: string;
  /** ISO 8601 formatted timestamp of when the operation occurred */
  timestamp: string;
  /** Array of field-level changes recorded by this operation */
  changes: FieldChange[];
}

/**
 * Metadata for an auditable field marked with @Auditable annotation
 * @interface AuditableField
 * @description 
 *   Provides metadata about fields that are marked for audit tracking.
 *   Used by the UI to highlight auditable fields and enable change visualization.
 * 
 * @example
 * ```typescript
 * const auditableField: AuditableField = {
 *   name: 'status',
 *   label: '资产状态',
 *   type: 'string',
 *   isHighlighted: true
 * };
 * ```
 */
export interface AuditableField {
  /** Field name matching the entity property name */
  name: string;
  /** Human-readable label for display purposes */
  label: string;
  /** Data type of the field (string, number, boolean, date, etc.) */
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'object';
  /** Whether this field should be visually highlighted in the UI */
  isHighlighted: boolean;
  /** Optional description explaining why this field is audited */
  description?: string;
}

/**
 * Query parameters for filtering audit logs
 * @interface AuditLogQueryParams
 * @description 
 *   Parameters used to filter audit log requests when querying the AuditService API.
 *   Supports pagination, time range filtering, and action type filtering.
 */
export interface AuditLogQueryParams {
  /** ID of the asset to retrieve audit logs for */
  assetId: string;
  /** Number of records to retrieve per page (default: 20, max: 100) */
  pageSize?: number;
  /** Page number for pagination (1-indexed) */
  page?: number;
  /** Start of time range in ISO 8601 format (default: 90 days ago) */
  startDate?: string;
  /** End of time range in ISO 8601 format (default: now) */
  endDate?: string;
  /** Filter by specific action types */
  actions?: AuditAction[];
  /** Filter by operator/user identifier */
  operator?: string;
}

/**
 * Paginated response from the audit logs API
 * @interface AuditLogResponse
 * @description 
 *   Standard paginated response wrapper for audit log queries.
 *   Includes metadata for client-side pagination controls.
 */
export interface AuditLogResponse {
  /** Array of audit log entries for the current page */
  data: AuditLogEntry[];
  /** Total number of records matching the query */
  total: number;
  /** Current page number */
  page: number;
  /** Number of records per page */
  pageSize: number;
  /** Whether there are more records available */
  hasMore: boolean;
}

/**
 * Props interface for the AuditLogItem component
 * @interface AuditLogItemProps
 * @description 
 *   Component props for rendering a single audit log entry with expandable details.
 */
export interface AuditLogItemProps {
  /** The audit log entry data to render */
  entry: AuditLogEntry;
  /** Whether the item details should be expanded by default */
  defaultExpanded?: boolean;
  /** Callback fired when expansion state changes */
  onExpansionChange?: (expanded: boolean) => void;
  /** Array of auditable field names for highlighting */
  auditableFields?: string[];
}

/**
 * Props interface for the FieldChangeDiff component
 * @interface FieldChangeDiffProps
 * @description 
 *   Component props for rendering a field change with visual diff highlighting.
 */
export interface FieldChangeDiffProps {
  /** The field change data to render */
  change: FieldChange;
  /** Whether this field is marked as @Auditable */
  isAuditable?: boolean;
  /** Optional custom class name for styling */
  className?: string;
}

/**
 * Props interface for the AuditLogPanel component
 * @interface AuditLogPanelProps
 * @description 
 *   Component props for the main audit log panel container.
 */
export interface AuditLogPanelProps {
  /** Asset ID to load audit logs for */
  assetId: string;
  /** Initial filter parameters */
  initialFilters?: Partial<AuditLogQueryParams>;
  /** Callback fired when an audit log entry is selected */
  onEntrySelect?: (entry: AuditLogEntry) => void;
  /** Whether to show the filter bar */
  showFilters?: boolean;
  /** Whether to show pagination controls */
  showPagination?: boolean;
  /** Maximum number of entries to display without "load more" */
  maxDisplayEntries?: number;
}