/**
 * Audit Types Module
 * 
 * Defines type definitions for the Graphify knowledge graph audit system.
 * These types support boundary condition handling and defensive coding patterns.
 * 
 * @module audit.types
 * @version 1.0.0
 * @see {@link https://docs.example.com/audit} for detailed API documentation
 */

/**
 * Graphify Node Properties
 * 
 * Extensible properties object for Graphify nodes.
 * Supports additional metadata for knowledge graph visualization.
 */
export interface GraphifyNodeProperties {
  /** Asset identifier for asset-type nodes */
  assetId?: string;
  /** Field name for field-change nodes */
  fieldName?: string;
  /** Change severity level */
  severity?: string;
  /** Additional custom properties */
  [key: string]: unknown;
}

/**
 * Graphify Node Configuration
 * 
 * Represents a single node in the Graphify knowledge graph visualization.
 * Used by both useAuditLog.ts and useAuditableFields.ts modules.
 * 
 * @example
 * ```typescript
 * const node: GraphifyNode = {
 *   id: 'asset-AST-001',
 *   type: 'asset',
 *   label: '资产',
 *   x: 400,
 *   y: 300,
 *   properties: { assetId: 'AST-001' }
 * };
 * ```
 */
export interface GraphifyNode {
  /** Unique identifier for the node */
  id: string;
  /** Node type classification (asset, field, user, etc.) */
  type: string;
  /** Display label for the node */
  label: string;
  /** X coordinate position in graph layout */
  x: number;
  /** Y coordinate position in graph layout */
  y: number;
  /** Optional severity level for change tracking */
  severity?: string;
  /** Extensible properties object */
  properties?: GraphifyNodeProperties;
}

/**
 * Graphify Edge Configuration
 * 
 * Represents a directed edge between two Graphify nodes.
 * Supports relationship visualization in the knowledge graph.
 */
export interface GraphifyEdge {
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge relationship type */
  type: string;
  /** Optional edge label */
  label?: string;
}

/**
 * Audit Log Entry - Core Type
 * 
 * Represents a single audit log record from the system.
 * Used by convertAuditLogsToGraphifyNodes for node generation.
 */
export interface AuditLogEntry {
  /** Unique identifier for the audit log entry */
  id?: string | number;
  /** Associated asset identifier */
  assetId?: string;
  /** User who performed the action */
  userId?: string;
  /** User display name */
  userName?: string;
  /** Timestamp of the audit event (ISO 8601 format) */
  timestamp?: string | Date;
  /** Action type performed */
  action?: string;
  /** Field changes associated with this audit entry */
  changes?: FieldChange[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Field Change Record
 * 
 * Represents a single field modification within an audit log.
 * Used by convertChangesToGraphifyNodes for change node generation.
 * 
 * @example
 * ```typescript
 * const change: FieldChange = {
 *   fieldName: 'assetName',
 *   oldValue: '旧名称',
 *   newValue: '新名称'
 * };
 * ```
 */
export interface FieldChange {
  /** Name of the modified field */
  fieldName: string;
  /** Previous value before change */
  oldValue?: unknown;
  /** New value after change */
  newValue?: unknown;
  /** Change timestamp */
  timestamp?: string | Date;
}

/**
 * Audit Log Configuration
 * 
 * Extended audit log type with additional context.
 * Used by generateGraphifyNodes in various hooks.
 */
export interface AuditLog {
  /** Unique identifier */
  id: string | number;
  /** Associated asset identifier */
  assetId?: string;
  /** User identifier */
  userId?: string;
  /** User display name */
  userName?: string;
  /** Action performed */
  action?: string;
  /** Timestamp of the event */
  timestamp?: string | Date;
  /** Detailed changes */
  changes?: FieldChange[];
  /** Operation status */
  status?: 'success' | 'failure' | 'pending';
  /** IP address of the request */
  ipAddress?: string;
}

/**
 * Validation Result Type
 * 
 * Encapsulates validation outcomes with detailed error information.
 * Used by validateGraphifyNodes for comprehensive validation feedback.
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** List of validation errors (populated on failure) */
  errors?: ValidationError[];
}

/**
 * Validation Error Detail
 * 
 * Provides detailed information about a single validation failure.
 */
export interface ValidationError {
  /** Node ID that failed validation */
  nodeId?: string;
  /** Field that failed validation */
  field: string;
  /** Expected value type or format */
  expected?: string;
  /** Actual value received */
  actual?: unknown;
  /** Human-readable error message */
  message: string;
}

/**
 * Graphify Graph Data Container
 * 
 * Complete graph structure containing nodes and edges.
 * Used for passing data to GraphifyKnowledgeGraph component.
 */
export interface GraphifyGraphData {
  /** Array of graph nodes */
  nodes: GraphifyNode[];
  /** Array of graph edges */
  edges?: GraphifyEdge[];
  /** Graph metadata */
  metadata?: {
    /** Total node count */
    nodeCount: number;
    /** Total edge count */
    edgeCount?: number;
    /** Graph generation timestamp */
    generatedAt?: string | Date;
  };
}

/**
 * Node Generation Options
 * 
 * Configuration options for node generation functions.
 * Supports flexible boundary condition handling.
 */
export interface NodeGenerationOptions {
  /** Center X coordinate for radial layout */
  centerX?: number;
  /** Center Y coordinate for radial layout */
  centerY?: number;
  /** Radius for radial node placement */
  radius?: number;
  /** Whether to include asset root node */
  includeAssetNode?: boolean;
  /** Whether to include field change nodes */
  includeFieldNodes?: boolean;
  /** Maximum number of nodes to generate (0 = unlimited) */
  maxNodes?: number;
  /** Node deduplication strategy */
  deduplicate?: boolean;
}

/**
 * Change Severity Levels
 * 
 * Enumeration of possible severity levels for field changes.
 * Used by calculateChangeSeverity in useAuditableFields.
 */
export type ChangeSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Node Type Classification
 * 
 * Union type of valid node type identifiers.
 * Used for type narrowing in Graphify components.
 */
export type NodeType = 'asset' | 'field' | 'user' | 'action' | 'system' | string;

/**
 * Audit Action Types
 * 
 * Enumeration of supported audit action types.
 */
export type AuditAction = 
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'approve'
  | 'reject'
  | 'transfer'
  | string;

/**
 * Type guard: Check if value is a valid GraphifyNode
 * 
 * @param value - Value to check
 * @returns True if value is a valid GraphifyNode
 * 
 * @example
 * ```typescript
 * const nodes: unknown[] = getNodes();
 * const validNodes = nodes.filter(isGraphifyNode);
 * ```
 */
export function isGraphifyNode(value: unknown): value is GraphifyNode {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const node = value as Record<string, unknown>;
  return (
    typeof node.id === 'string' &&
    typeof node.type === 'string' &&
    typeof node.label === 'string' &&
    typeof node.x === 'number' &&
    typeof node.y === 'number'
  );
}

/**
 * Type guard: Check if value is a non-empty array of GraphifyNodes
 * 
 * @param value - Value to check
 * @returns True if value is a GraphifyNode array with at least one element
 */
export function isNonEmptyNodeArray(
  value: unknown
): value is GraphifyNode[] {
  return Array.isArray(value) && value.length > 0 && value.every(isGraphifyNode);
}

/**
 * Type guard: Check if value is a valid FieldChange
 * 
 * @param value - Value to check
 * @returns True if value is a valid FieldChange
 */
export function isFieldChange(value: unknown): value is FieldChange {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const change = value as Record<string, unknown>;
  return typeof change.fieldName === 'string' && change.fieldName.length > 0;
}