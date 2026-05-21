/**
 * Asset Types for Asset Management System
 * 
 * Defines TypeScript interfaces and types for asset-related data structures
 * used throughout the frontend application. This module supports the
 * asset detail page, Graphify knowledge graph integration, and audit logging.
 * 
 * @module asset.types
 * @version 1.0.0
 * @since 2024-01-15
 */

/**
 * Core asset entity representing a managed asset in the system.
 * 
 * An asset is a resource with economic value that is owned or controlled
 * by an organization. Assets can include physical items (hardware),
 * software licenses, digital assets, and more.
 * 
 * @interface Asset
 * @property {string} id - Unique identifier for the asset
 * @property {string} name - Display name of the asset
 * @property {AssetType} type - Classification type of the asset
 * @property {AssetStatus} status - Current operational status
 * @property {string} assetNumber - Business identifier (e.g., asset tag)
 * @property {string} [description] - Optional detailed description
 * @property {string} [serialNumber] - Manufacturer serial number
 * @property {string} [purchaseDate] - Date of acquisition (ISO 8601)
 * @property {number} [purchasePrice] - Original purchase cost
 * @property {number} [currentValue] - Current estimated value
 * @property {string} [location] - Physical or logical location
 * @property {string} [department] - Owning department identifier
 * @property {string} [assignedTo] - User ID of current assignee
 * @property {string} [categoryId] - Asset category reference
 * @property {Record<string, unknown>} [customFields] - Extensible custom attributes
 * @property {string} createdAt - Record creation timestamp
 * @property {string} updatedAt - Last modification timestamp
 * @property {string} [createdBy] - User ID of creator
 * @property {string} [updatedBy] - User ID of last modifier
 */
export interface Asset {
  /** Unique identifier for the asset */
  id: string;
  /** Display name of the asset */
  name: string;
  /** Classification type of the asset */
  type: AssetType;
  /** Current operational status */
  status: AssetStatus;
  /** Business identifier (e.g., asset tag) */
  assetNumber: string;
  /** Optional detailed description */
  description?: string;
  /** Manufacturer serial number */
  serialNumber?: string;
  /** Date of acquisition (ISO 8601 format) */
  purchaseDate?: string;
  /** Original purchase cost in base currency */
  purchasePrice?: number;
  /** Current estimated value after depreciation */
  currentValue?: number;
  /** Physical or logical location identifier */
  location?: string;
  /** Owning department identifier */
  department?: string;
  /** User ID of current assignee */
  assignedTo?: string;
  /** Asset category reference ID */
  categoryId?: string;
  /** Extensible custom attributes map */
  customFields?: Record<string, unknown>;
  /** Record creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last modification timestamp (ISO 8601) */
  updatedAt: string;
  /** User ID of record creator */
  createdBy?: string;
  /** User ID of last modifier */
  updatedBy?: string;
}

/**
 * Classification types for assets.
 * 
 * Assets are categorized to facilitate management, reporting,
 * and lifecycle tracking across different resource categories.
 * 
 * @typedef {string} AssetType
 * @property {'HARDWARE'} HARDWARE - Physical equipment and devices
 * @property {'SOFTWARE'} SOFTWARE - Software licenses and subscriptions
 * @property {'DIGITAL'} DIGITAL - Digital assets and virtual resources
 * @property {'INVENTORY'} INVENTORY - Consumable inventory items
 * @property {'VEHICLE'} VEHICLE - Vehicles and transportation equipment
 * @property {'FURNITURE'} FURNITURE - Office furniture and fixtures
 * @property {'OTHER'} OTHER - Miscellaneous uncategorized assets
 */
export type AssetType = 'HARDWARE' | 'SOFTWARE' | 'DIGITAL' | 'INVENTORY' | 'VEHICLE' | 'FURNITURE' | 'OTHER';

/**
 * Operational status values for assets.
 * 
 * Represents the lifecycle state of an asset from acquisition
 * through disposal.
 * 
 * @typedef {string} AssetStatus
 * @property {'ACTIVE'} ACTIVE - In use and operational
 * @property {'INACTIVE'} INACTIVE - Temporarily not in use
 * @property {'MAINTENANCE'} MAINTENANCE - Under repair or maintenance
 * @property {'RETIRED'} RETIRED - Decommissioned but not disposed
 * @property {'DISPOSED'} DISPOSED - Fully removed from inventory
 * @property {'LOST'} LOST - Missing or stolen
 * @property {'TRANSFERRED'} TRANSFERRED - Moved to another entity
 */
export type AssetStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'RETIRED' | 'DISPOSED' | 'LOST' | 'TRANSFERRED';

/**
 * Graphify node representation for knowledge graph visualization.
 * 
 * Graphify is a knowledge graph component that displays relationships
 * between assets, users, departments, and other entities. Each node
 * in the graph represents a connected entity.
 * 
 * @interface GraphifyNode
 * @property {string} id - Unique node identifier
 * @property {GraphifyNodeType} nodeType - Type/category of the node
 * @property {string} label - Display label for the node
 * @property {string} [subtitle] - Secondary text description
 * @property {string} [icon] - Icon identifier for visual representation
 * @property {GraphifyNodeStatus} [status] - Visual status indicator
 * @property {string} [assetId] - Associated asset ID (if nodeType is ASSET)
 * @property {string} [userId] - Associated user ID (if nodeType is USER)
 * @property {string} [departmentId] - Associated department ID (if nodeType is DEPARTMENT)
 * @property {Record<string, unknown>} [metadata] - Additional node metadata
 * @property {number} [x] - X coordinate position in graph (optional)
 * @property {number} [y] - Y coordinate position in graph (optional)
 */
export interface GraphifyNode {
  /** Unique node identifier */
  id: string;
  /** Type/category of the node */
  nodeType: GraphifyNodeType;
  /** Display label for the node */
  label: string;
  /** Secondary text description */
  subtitle?: string;
  /** Icon identifier for visual representation */
  icon?: string;
  /** Visual status indicator */
  status?: GraphifyNodeStatus;
  /** Associated asset ID (for ASSET node types) */
  assetId?: string;
  /** Associated user ID (for USER node types) */
  userId?: string;
  /** Associated department ID (for DEPARTMENT node types) */
  departmentId?: string;
  /** Additional node metadata for rendering and interactions */
  metadata?: Record<string, unknown>;
  /** X coordinate position in graph layout */
  x?: number;
  /** Y coordinate position in graph layout */
  y?: number;
}

/**
 * Node type classification for Graphify knowledge graph.
 * 
 * Defines the semantic type of each node in the knowledge graph,
 * which determines its visual representation and interaction behavior.
 * 
 * @typedef {string} GraphifyNodeType
 * @property {'ASSET'} ASSET - Represents an asset entity
 * @property {'USER'} USER - Represents a user/person entity
 * @property {'DEPARTMENT'} DEPARTMENT - Represents an organizational unit
 * @property {'VENDOR'} VENDOR - Represents a supplier/vendor entity
 * @property {'LOCATION'} LOCATION - Represents a physical location
 * @property {'CATEGORY'} CATEGORY - Represents an asset category
 * @property {'WORKFLOW'} WORKFLOW - Represents a workflow/process
 * @property {'AUDIT_LOG'} AUDIT_LOG - Represents an audit log entry
 */
export type GraphifyNodeType = 'ASSET' | 'USER' | 'DEPARTMENT' | 'VENDOR' | 'LOCATION' | 'CATEGORY' | 'WORKFLOW' | 'AUDIT_LOG';

/**
 * Visual status indicators for Graphify nodes.
 * 
 * Provides semantic meaning to node visual states,
 * enabling quick identification of entity status.
 * 
 * @typedef {string} GraphifyNodeStatus
 * @property {'default'} default - Normal/default state
 * @property {'success'} success - Positive/successful state
 * @property {'warning'} warning - Caution/attention needed
 * @property {'error'} error - Critical/problem state
 * @property {'info'} info - Informational state
 */
export type GraphifyNodeStatus = 'default' | 'success' | 'warning' | 'error' | 'info';

/**
 * Edge/relationship between two Graphify nodes.
 * 
 * Represents a directional connection between entities in the
 * knowledge graph with optional relationship metadata.
 * 
 * @interface GraphifyEdge
 * @property {string} id - Unique edge identifier
 * @property {string} source - Source node ID
 * @property {string} target - Target node ID
 * @property {GraphifyEdgeType} edgeType - Type of relationship
 * @property {string} [label] - Optional relationship label
 * @property {number} [weight] - Relationship strength/importance (0-1)
 * @property {Record<string, unknown>} [metadata] - Additional edge metadata
 */
export interface GraphifyEdge {
  /** Unique edge identifier */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Type of relationship */
  edgeType: GraphifyEdgeType;
  /** Optional relationship label for display */
  label?: string;
  /** Relationship strength/importance (0-1 scale) */
  weight?: number;
  /** Additional edge metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Edge type classification for Graphify relationships.
 * 
 * Defines the semantic meaning of connections between nodes,
 * enabling appropriate visualization and interaction patterns.
 * 
 * @typedef {string} GraphifyEdgeType
 * @property {'ASSIGNED_TO'} ASSIGNED_TO - Asset assigned to user
 * @property {'BELONGS_TO'} BELONGS_TO - Entity belongs to department
 * @property {'LOCATED_AT'} LOCATED_AT - Entity located at location
 * @property {'PURCHASED_FROM'} PURCHASED_FROM - Asset purchased from vendor
 * @property {'CATEGORIZED_AS'} CATEGORIZED_AS - Asset categorized under type
 * @property {'RELATED_TO'} RELATED_TO - Generic related connection
 * @property {'DEPENDS_ON'} DEPENDS_ON - Dependency relationship
 * @property {'AUDITED_BY'} AUDITED_BY - Entity audited by system
 */
export type GraphifyEdgeType = 'ASSIGNED_TO' | 'BELONGS_TO' | 'LOCATED_AT' | 'PURCHASED_FROM' | 'CATEGORIZED_AS' | 'RELATED_TO' | 'DEPENDS_ON' | 'AUDITED_BY';

/**
 * Graphify knowledge graph data structure.
 * 
 * Container for nodes and edges representing the complete
 * knowledge graph state for visualization.
 * 
 * @interface GraphifyGraphData
 * @property {GraphifyNode[]} nodes - Array of graph nodes
 * @property {GraphifyEdge[]} edges - Array of graph edges
 * @property {string} [centerNodeId] - ID of node to center view on
 * @property {number} [zoomLevel] - Initial zoom level (0-1)
 */
export interface GraphifyGraphData {
  /** Array of graph nodes */
  nodes: GraphifyNode[];
  /** Array of graph edges */
  edges: GraphifyEdge[];
  /** ID of node to center view on initially */
  centerNodeId?: string;
  /** Initial zoom level for graph view */
  zoomLevel?: number;
}

/**
 * Asset detail page view model combining asset data with related entities.
 * 
 * This is the primary data structure used by the asset detail page,
 * combining the core asset information with Graphify knowledge graph
 * data and associated audit logs.
 * 
 * @interface AssetDetailViewModel
 * @property {Asset} asset - Core asset information
 * @property {GraphifyGraphData} [graphData] - Knowledge graph visualization data
 * @property {GraphifyNode[]} [relatedNodes] - Directly related graph nodes
 * @property {GraphifyEdge[]} [relatedEdges] - Edges connecting to related nodes
 * @property {AuditLogEntry[]} [auditLogs] - Associated audit log entries
 * @property {AuditableField[]} [auditableFields] - List of @Auditable annotated fields
 * @property {number} [totalAuditCount] - Total number of audit entries
 */
export interface AssetDetailViewModel {
  /** Core asset information */
  asset: Asset;
  /** Knowledge graph visualization data */
  graphData?: GraphifyGraphData;
  /** Directly related graph nodes for current asset */
  relatedNodes?: GraphifyNode[];
  /** Edges connecting to related nodes */
  relatedEdges?: GraphifyEdge[];
  /** Associated audit log entries */
  auditLogs?: AuditLogEntry[];
  /** List of @Auditable annotated fields on this asset type */
  auditableFields?: AuditableField[];
  /** Total number of audit entries for pagination */
  totalAuditCount?: number;
}

/**
 * Represents a field annotated with @Auditable on the backend.
 * 
 * These fields are tracked for changes and included in audit logs.
 * The frontend binds to these to provide visual indicators.
 * 
 * @interface AuditableField
 * @property {string} fieldName - Name of the field/property
 * @property {string} displayName - Human-readable label for display
 * @property {string} [fieldType] - Data type (string, number, date, etc.)
 * @property {boolean} [isSensitive] - Whether field contains sensitive data
 * @property {string} [category] - Field category for grouping
 * @property {Record<string, unknown>} [metadata] - Additional field metadata
 */
export interface AuditableField {
  /** Name of the field/property */
  fieldName: string;
  /** Human-readable label for display */
  displayName: string;
  /** Data type for formatting (string, number, date, boolean, enum) */
  fieldType?: 'string' | 'number' | 'date' | 'boolean' | 'enum' | 'currency' | 'percentage';
  /** Whether field contains sensitive PII/sensitive data */
  isSensitive?: boolean;
  /** Field category for UI grouping */
  category?: string;
  /** Additional field metadata from annotation */
  metadata?: Record<string, unknown>;
}

/**
 * Audit log entry for tracking changes to auditable entities.
 * 
 * Represents a single audit event captured by the backend
 * AuditService when @Auditable fields are modified.
 * 
 * @interface AuditLogEntry
 * @property {string} id - Unique audit log entry ID
 * @property {string} entityType - Type of entity being audited
 * @property {string} entityId - ID of the entity being audited
 * @property {string} operation - Type of operation performed
 * @property {string} [fieldName] - Name of field changed (for UPDATE operations)
 * @property {string} [oldValue] - Previous value before change
 * @property {string} [newValue] - New value after change
 * @property {string} operatorId - User ID who performed the operation
 * @property {string} [operatorName] - Display name of operator
 * @property {string} timestamp - When the operation occurred
 * @property {string} [ipAddress] - IP address of the client
 * @property {string} [userAgent] - Browser/client user agent
 * @property {AuditLevel} [level] - Severity/importance level
 * @property {Record<string, unknown>} [metadata] - Additional audit context
 */
export interface AuditLogEntry {
  /** Unique audit log entry ID */
  id: string;
  /** Type of entity being audited (e.g., 'Asset', 'User') */
  entityType: string;
  /** ID of the entity being audited */
  entityId: string;
  /** Type of operation performed */
  operation: AuditOperation;
  /** Name of field changed (for UPDATE operations) */
  fieldName?: string;
  /** Previous value before change */
  oldValue?: string;
  /** New value after change */
  newValue?: string;
  /** User ID who performed the operation */
  operatorId: string;
  /** Display name of operator */
  operatorName?: string;
  /** When the operation occurred (ISO 8601) */
  timestamp: string;
  /** IP address of the client */
  ipAddress?: string;
  /** Browser/client user agent string */
  userAgent?: string;
  /** Severity/importance level of the audit entry */
  level?: AuditLevel;
  /** Additional audit context and metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Audit operation types representing actions on auditable entities.
 * 
 * @typedef {string} AuditOperation
 * @property {'CREATE'} CREATE - New entity created
 * @property {'UPDATE'} UPDATE - Existing entity modified
 * @property {'DELETE'} DELETE - Entity removed
 * @property {'VIEW'} VIEW - Entity viewed/accessed
 * @property {'EXPORT'} EXPORT - Entity data exported
 * @property {'APPROVE'} APPROVE - Entity approved in workflow
 * @property {'REJECT'} REJECT - Entity rejected in workflow
 */
export type AuditOperation = 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'EXPORT' | 'APPROVE' | 'REJECT';

/**
 * Audit log severity levels.
 * 
 * Used to categorize the importance/sensitivity of audit entries.
 * 
 * @typedef {string} AuditLevel
 * @property {'INFO'} INFO - General informational events
 * @property {'WARNING'} WARNING - Potential issues or anomalies
 * @property {'ERROR'} ERROR - Failed operations or errors
 * @property {'CRITICAL'} CRITICAL - Security-sensitive or high-impact events
 */
export type AuditLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

/**
 * Query parameters for fetching audit logs.
 * 
 * @interface AuditLogQuery
 * @property {string} [entityType] - Filter by entity type
 * @property {string} [entityId] - Filter by entity ID
 * @property {AuditOperation[]} [operations] - Filter by operation types
 * @property {AuditLevel[]} [levels] - Filter by severity levels
 * @property {string} [operatorId] - Filter by operator
 * @property {string} [startDate] - Filter by start date (inclusive)
 * @property {string} [endDate] - Filter by end date (inclusive)
 * @property {number} [page] - Page number (1-based)
 * @property {number} [pageSize] - Number of items per page
 * @property {string} [sortBy] - Field to sort by
 * @property {'asc' | 'desc'} [sortOrder] - Sort direction
 */
export interface AuditLogQuery {
  /** Filter by entity type */
  entityType?: string;
  /** Filter by specific entity ID */
  entityId?: string;
  /** Filter by operation types */
  operations?: AuditOperation[];
  /** Filter by severity levels */
  levels?: AuditLevel[];
  /** Filter by operator user ID */
  operatorId?: string;
  /** Filter by start date (ISO 8601, inclusive) */
  startDate?: string;
  /** Filter by end date (ISO 8601, inclusive) */
  endDate?: string;
  /** Page number (1-based indexing) */
  page?: number;
  /** Number of items per page (max 100) */
  pageSize?: number;
  /** Field to sort results by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response for audit log queries.
 * 
 * @interface AuditLogResponse
 * @property {AuditLogEntry[]} items - Array of audit log entries
 * @property {number} total - Total number of matching entries
 * @property {number} page - Current page number
 * @property {number} pageSize - Items per page
 * @property {number} totalPages - Total number of pages
 */
export interface AuditLogResponse {
  /** Array of audit log entries for current page */
  items: AuditLogEntry[];
  /** Total number of matching entries */
  total: number;
  /** Current page number */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of available pages */
  totalPages: number;
}

/**
 * Change summary for displaying field-level differences.
 * 
 * Used by the ChangeDiffView component to render
 * before/after values with appropriate formatting.
 * 
 * @interface FieldChange
 * @property {string} fieldName - Name of the changed field
 * @property {string} displayName - Human-readable field label
 * @property {string} oldValue - Previous value
 * @property {string} newValue - New value
 * @property {boolean} [isAuditable] - Whether field has @Auditable annotation
 * @property {string} [fieldType] - Data type for formatting
 */
export interface FieldChange {
  /** Name of the changed field */
  fieldName: string;
  /** Human-readable field label */
  displayName: string;
  /** Previous value before change */
  oldValue: string;
  /** New value after change */
  newValue: string;
  /** Whether field has @Auditable annotation */
  isAuditable?: boolean;
  /** Data type for value formatting */
  fieldType?: string;
}

/**
 * User information for audit log display.
 * 
 * Lightweight user object used in audit contexts.
 * 
 * @interface AuditUser
 * @property {string} id - User ID
 * @property {string} name - Display name
 * @property {string} [email] - Email address
 * @property {string} [avatar] - Avatar URL
 * @property {string} [department] - Department name
 */
export interface AuditUser {
  /** User ID */
  id: string;
  /** Display name */
  name: string;
  /** Email address */
  email?: string;
  /** Avatar image URL */
  avatar?: string;
  /** Department name */
  department?: string;
}

/**
 * Props for AssetDetailView component.
 * 
 * @interface AssetDetailViewProps
 * @property {string} assetId - ID of the asset to display
 * @property {boolean} [showAuditPanel] - Whether to show audit log panel
 * @property {boolean} [showGraphify] - Whether to show knowledge graph
 * @property {function} [onAuditLogClick] - Callback when audit log is clicked
 */
export interface AssetDetailViewProps {
  /** ID of the asset to display */
  assetId: string;
  /** Whether to show audit log panel by default */
  showAuditPanel?: boolean;
  /** Whether to show Graphify knowledge graph */
  showGraphify?: boolean;
  /** Callback when audit log entry is clicked */
  onAuditLogClick?: (log: AuditLogEntry) => void;
}

/**
 * Props for AuditLogPanel component.
 * 
 * @interface AuditLogPanelProps
 * @property {string} entityId - Entity ID to fetch logs for
 * @property {string} [entityType] - Entity type for filtering
 * @property {boolean} [compact] - Use compact/collapsed layout
 * @property {number} [maxHeight] - Maximum panel height in pixels
 */
export interface AuditLogPanelProps {
  /** Entity ID to fetch audit logs for */
  entityId: string;
  /** Entity type for filtering (defaults to 'Asset') */
  entityType?: string;
  /** Use compact/collapsed layout variant */
  compact?: boolean;
  /** Maximum panel height in pixels */
  maxHeight?: number;
}

/**
 * Props for AuditableFieldBadge component.
 * 
 * @interface AuditableFieldBadgeProps
 * @property {AuditableField} field - Field metadata
 * @property {'default' | 'highlight' | 'pulse'} [variant] - Visual variant
 * @property {function} [onClick] - Click handler
 */
export interface AuditableFieldBadgeProps {
  /** Field metadata with @Auditable information */
  field: AuditableField;
  /** Visual variant of the badge */
  variant?: 'default' | 'highlight' | 'pulse';
  /** Click handler for interactive badges */
  onClick?: (field: AuditableField) => void;
}

// Re-export types from audit module for convenience
export type {
  GraphifyGraphData as GraphData,
  GraphifyNode as NodeData,
  GraphifyEdge as EdgeData,
} from './audit.types';

/**
 * Default auditable field configuration for Asset entities.
 * 
 * Maps common asset fields to their @Auditable metadata.
 * This configuration is used when the backend does not provide
 * auditable field information.
 * 
 * @constant DEFAULT_ASSET_AUDITABLE_FIELDS
 */
export const DEFAULT_ASSET_AUDITABLE_FIELDS: AuditableField[] = [
  { fieldName: 'name', displayName: '资产名称', fieldType: 'string' },
  { fieldName: 'status', displayName: '资产状态', fieldType: 'enum' },
  { fieldName: 'location', displayName: '存放位置', fieldType: 'string' },
  { fieldName: 'department', displayName: '所属部门', fieldType: 'string' },
  { fieldName: 'assignedTo', displayName: '使用人', fieldType: 'string' },
  { fieldName: 'purchaseDate', displayName: '购置日期', fieldType: 'date' },
  { fieldName: 'purchasePrice', displayName: '采购价格', fieldType: 'currency' },
  { fieldName: 'currentValue', displayName: '当前价值', fieldType: 'currency' },
  { fieldName: 'description', displayName: '资产描述', fieldType: 'string', isSensitive: false },
  { fieldName: 'serialNumber', displayName: '序列号', fieldType: 'string' },
  { fieldName: 'categoryId', displayName: '资产类别', fieldType: 'string' },
];

/**
 * Asset type display labels for UI.
 * 
 * @constant ASSET_TYPE_LABELS
 */
export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  HARDWARE: '硬件设备',
  SOFTWARE: '软件资产',
  DIGITAL: '数字资产',
  INVENTORY: '库存物品',
  VEHICLE: '车辆设备',
  FURNITURE: '家具设施',
  OTHER: '其他资产',
};

/**
 * Asset status display labels and colors for UI.
 * 
 * @constant ASSET_STATUS_CONFIG
 */
export const ASSET_STATUS_CONFIG: Record<AssetStatus, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: '在用', color: 'text-green-700', bgColor: 'bg-green-100' },
  INACTIVE: { label: '闲置', color: 'text-gray-700', bgColor: 'bg-blue-50' },
  MAINTENANCE: { label: '维护中', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  RETIRED: { label: '已退役', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  DISPOSED: { label: '已处置', color: 'text-red-700', bgColor: 'bg-red-100' },
  LOST: { label: '已丢失', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  TRANSFERRED: { label: '已转移', color: 'text-blue-700', bgColor: 'bg-blue-100' },
};