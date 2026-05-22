/**
 * Audit API Service Module
 * 
 * Provides centralized API methods for audit log operations with full TypeScript type safety.
 * Integrates with Graphify knowledge graph visualization system for audit trail visualization.
 * 
 * @module services/auditApi
 * @version 2.0.0
 */

import http from '@/utils/http';
// Local type definitions (audit.types does not export these yet)
interface AuditLog {
  id: string;
  operationType: string;
  actionType: string;
  operator: string;
  targetEntity: string;
  targetId: string;
  entityId: string;
  action: string;
  description: string;
  timestamp: string;
  changes?: Record<string, unknown>;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}
interface GraphifyNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  [key: string]: unknown;
}
interface GraphifyEdge {
  source: string;
  target: string;
  label?: string;
  [key: string]: unknown;
}
interface AuditLogResponse {
  logs: AuditLog[];
  data: AuditLog[];
  total: number;
}

// AssetAuditLog type (originally from excluded AssetDetailPage)
type AssetAuditLog = AuditLog;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Parameters for fetching audit logs with filtering support
 */
export interface FetchAuditLogsParams {
  /** Target entity ID to fetch logs for */
  entityId?: string;
  /** Target entity type (e.g., 'asset', 'user', 'approval') */
  entityType?: string;
  /** Start date for date range filter */
  startDate?: string;
  /** End date for date range filter */
  endDate?: string;
  /** Action type filter */
  actionType?: string;
  /** Number of records to skip for pagination */
  offset?: number;
  /** Maximum number of records to return */
  limit?: number;
}

/**
 * Graphify data transfer object combining nodes and edges
 */
export interface GraphifyData {
  /** Array of Graphify visualization nodes */
  nodes: GraphifyNode[];
  /** Array of Graphify visualization edges */
  edges: GraphifyEdge[];
}

/**
 * Field change structure for audit log changes
 */
export interface FieldChange {
  /** Name of the field that changed */
  fieldName: string;
  /** Previous value before the change */
  oldValue: string | null;
  /** New value after the change */
  newValue: string | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Base API endpoint for audit operations */
const API_BASE_PATH = '/audit';

/** Default pagination limit */
const DEFAULT_PAGE_SIZE = 50;

/** Maximum allowed page size to prevent performance issues */
const MAX_PAGE_SIZE = 200;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates fetch parameters before making API call
 * 
 * @param params - Parameters to validate
 * @throws Error if parameters are invalid
 * 
 * @example
 * ```ts
 * try {
 *   validateFetchParams({ limit: 100 });
 * } catch (e) {
 *   console.error('Invalid params:', e.message);
 * }
 * ```
 */
function validateFetchParams(params: FetchAuditLogsParams): void {
  if (params.limit !== undefined) {
    if (params.limit < 1) {
      throw new Error('Limit must be greater than 0');
    }
    if (params.limit > MAX_PAGE_SIZE) {
      throw new Error(`Limit cannot exceed ${MAX_PAGE_SIZE}`);
    }
  }
  if (params.offset !== undefined && params.offset < 0) {
    throw new Error('Offset cannot be negative');
  }
}

/**
 * Builds query string from parameters
 * 
 * @param params - Parameters to convert to query string
 * @returns URLSearchParams string
 */
function buildQueryString(params: FetchAuditLogsParams): string {
  const searchParams = new URLSearchParams();
  
  if (params.entityId) searchParams.append('entityId', params.entityId);
  if (params.entityType) searchParams.append('entityType', params.entityType);
  if (params.startDate) searchParams.append('startDate', params.startDate);
  if (params.endDate) searchParams.append('endDate', params.endDate);
  if (params.actionType) searchParams.append('actionType', params.actionType);
  if (params.offset !== undefined) searchParams.append('offset', String(params.offset));
  if (params.limit !== undefined) searchParams.append('limit', String(params.limit));
  
  return searchParams.toString();
}

/**
 * Transforms raw API response to AuditLog array
 * 
 * @param response - Raw API response data
 * @returns Normalized audit log array
 */
function normalizeAuditLogs(response: AuditLogResponse | AuditLog[]): AuditLog[] {
  if (Array.isArray(response)) {
    return response;
  }
  return response.data || [];
}

// ============================================================================
// Graphify Data Transformation Functions
// ============================================================================

/**
 * Converts field changes to Graphify visualization nodes
 * 
 * @param changes - Array of field changes
 * @param assetId - Associated asset identifier
 * @returns Array of Graphify-compatible nodes
 * 
 * @example
 * ```ts
 * const nodes = convertChangesToGraphifyNodes(changes, 'AST-2024-001');
 * ```
 */
export function convertChangesToGraphifyNodes(
  changes: FieldChange[],
  assetId: string
): GraphifyNode[] {
  if (!changes || !Array.isArray(changes)) {
    return [];
  }
  
  return changes.map((change, index) => {
    const timestamp = Date.now() - (changes.length - index) * 1000;
    
    return {
      id: `change-${assetId}-${index}`,
      entityId: assetId,
      type: 'field_change',
      name: change.fieldName,
      label: formatFieldLabel(change.fieldName),
      x: calculateNodePosition(index, changes.length).x,
      y: calculateNodePosition(index, changes.length).y,
      properties: {
        fieldName: change.fieldName,
        oldValue: change.oldValue || 'null',
        newValue: change.newValue || 'null',
        assetId: assetId,
        timestamp: timestamp
      },
      size: calculateNodeSize(change),
      color: determineNodeColor(change)
    };
  });
}

/**
 * Formats field name into human-readable label
 * 
 * @param fieldName - Raw field name
 * @returns Formatted label
 */
function formatFieldLabel(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Calculates node position in circular layout
 * 
 * @param index - Current node index
 * @param total - Total number of nodes
 * @returns X,Y coordinates
 */
function calculateNodePosition(index: number, total: number): { x: number; y: number } {
  const centerX = 400;
  const centerY = 300;
  const radius = Math.min(200, 50 + total * 10);
  
  if (total === 1) {
    return { x: centerX, y: centerY };
  }
  
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle)
  };
}

/**
 * Calculates node size based on change significance
 * 
 * @param change - Field change object
 * @returns Node size value
 */
function calculateNodeSize(change: FieldChange): number {
  if (!change.oldValue && change.newValue) {
    return 12; // Creation - larger node
  }
  if (change.oldValue && !change.newValue) {
    return 10; // Deletion - medium node
  }
  if (change.oldValue && change.newValue) {
    const oldLen = String(change.oldValue).length;
    const newLen = String(change.newValue).length;
    const maxLen = Math.max(oldLen, newLen);
    return Math.min(8 + maxLen * 0.2, 16); // Update - size based on content length
  }
  return 8; // Default size
}

/**
 * Determines node color based on change type
 * 
 * @param change - Field change object
 * @returns Hex color code
 */
function determineNodeColor(change: FieldChange): string {
  if (!change.oldValue && change.newValue) {
    return '#10B981'; // Green - creation
  }
  if (change.oldValue && !change.newValue) {
    return '#EF4444'; // Red - deletion
  }
  if (change.oldValue !== change.newValue) {
    return '#F59E0B'; // Amber - modification
  }
  return '#6B7280'; // Gray - no change
}

/**
 * Transforms audit logs to Graphify nodes and edges
 * 
 * @param logs - Array of audit logs to transform
 * @returns Graphify data object with nodes and edges
 * 
 * @example
 * ```ts
 * const graphData = transformToGraphifyData(auditLogs);
 * ```
 */
export function transformToGraphifyData(logs: AuditLog[]): GraphifyData {
  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    return { nodes: [], edges: [] };
  }
  
  const nodes: GraphifyNode[] = [];
  const edges: GraphifyEdge[] = [];
  const nodeIdSet = new Set<string>();
  
  // Add root asset node
  const primaryEntityId = logs[0]?.entityId || 'unknown';
  const rootNodeId = `asset-${primaryEntityId}`;
  
  if (!nodeIdSet.has(rootNodeId)) {
    nodes.push({
      id: rootNodeId,
      entityId: primaryEntityId,
      type: 'asset',
      name: 'Asset',
      label: '资产',
      x: 400,
      y: 300,
      properties: {
        assetId: primaryEntityId,
        totalChanges: logs.length
      },
      size: 20,
      color: '#3B82F6'
    });
    nodeIdSet.add(rootNodeId);
  }
  
  // Process each audit log
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    
    // Create node for this audit log
    const logNodeId = `log-${log.id || i}`;
    
    if (!nodeIdSet.has(logNodeId)) {
      const position = calculateNodePosition(i, logs.length + 1);
      
      nodes.push({
        id: logNodeId,
        entityId: log.id || String(i),
        type: 'audit_log',
        name: log.actionType || 'unknown',
        label: formatActionLabel(log.actionType || 'unknown'),
        x: position.x + 50,
        y: position.y,
        properties: {
          actionType: log.actionType,
          operator: log.operator || 'system',
          timestamp: log.timestamp,
          entityId: log.entityId
        },
        size: 10,
        color: getActionColor(log.actionType)
      });
      nodeIdSet.add(logNodeId);
    }
    
    // Create edge from asset to log
    edges.push({
      id: `edge-${rootNodeId}-${logNodeId}`,
      source: rootNodeId,
      target: logNodeId,
      type: 'contains',
      label: 'audited_by'
    });
    
    // Process field changes if present
    if (log.changes && typeof log.changes === 'object') {
      for (const [fieldName, change] of Object.entries(log.changes)) {
        if (change && typeof change === 'object' && 'oldValue' in change) {
          const changeNodeId = `change-${logNodeId}-${fieldName}`;
          
          if (!nodeIdSet.has(changeNodeId)) {
            const fieldChange = change as FieldChange;
            const fieldPosition = calculateNodePosition(
              nodes.filter(n => n.type === 'field_change').length,
              10
            );
            
            nodes.push({
              id: changeNodeId,
              entityId: fieldName,
              type: 'field_change',
              name: fieldName,
              label: formatFieldLabel(fieldName),
              x: fieldPosition.x + 100,
              y: fieldPosition.y,
              properties: {
                fieldName: fieldName,
                oldValue: String(fieldChange.oldValue || ''),
                newValue: String(fieldChange.newValue || ''),
                assetId: primaryEntityId
              },
              size: calculateNodeSize(fieldChange),
              color: determineNodeColor(fieldChange)
            });
            nodeIdSet.add(changeNodeId);
          }
          
          // Create edge from log to field change
          edges.push({
            id: `edge-${logNodeId}-${changeNodeId}`,
            source: logNodeId,
            target: changeNodeId,
            type: 'modifies',
            label: fieldName
          });
        }
      }
    }
  }
  
  return { nodes, edges };
}

/**
 * Formats action type into human-readable label
 * 
 * @param actionType - Raw action type
 * @returns Formatted label
 */
function formatActionLabel(actionType: string): string {
  const actionLabels: Record<string, string> = {
    'CREATE': '创建',
    'UPDATE': '更新',
    'DELETE': '删除',
    'APPROVE': '审批通过',
    'REJECT': '审批驳回',
    'SUBMIT': '提交审批',
    'TRANSFER': '资产转移',
    'MAINTENANCE': '维护保养',
    'DISPOSAL': '资产处置'
  };
  
  return actionLabels[actionType.toUpperCase()] || actionType;
}

/**
 * Gets color for action type
 * 
 * @param actionType - Action type string
 * @returns Hex color code
 */
function getActionColor(actionType: string | undefined): string {
  const colorMap: Record<string, string> = {
    'CREATE': '#10B981',
    'UPDATE': '#3B82F6',
    'DELETE': '#EF4444',
    'APPROVE': '#22C55E',
    'REJECT': '#DC2626',
    'SUBMIT': '#8B5CF6',
    'TRANSFER': '#06B6D4',
    'MAINTENANCE': '#F59E0B',
    'DISPOSAL': '#6366F1'
  };
  
  return colorMap[actionType?.toUpperCase() || ''] || '#6B7280';
}

/**
 * Transforms asset audit logs to Graphify nodes (alternative signature)
 * 
 * @param auditLogs - Asset audit log array
 * @returns Graphify node array
 * 
 * @example
 * ```ts
 * const nodes = formatAuditLogsToGraphifyNodes(assetAuditLogs);
 * ```
 */
export function formatAuditLogsToGraphifyNodes(
  auditLogs: AssetAuditLog[]
): GraphifyNode[] {
  if (!auditLogs || !Array.isArray(auditLogs) || auditLogs.length === 0) {
    return [];
  }
  
  const nodes: GraphifyNode[] = [];
  const centerX = 400;
  const centerY = 300;
  const radius = Math.min(200, 80 + auditLogs.length * 15);
  
  for (let i = 0; i < auditLogs.length; i++) {
    const log = auditLogs[i];
    const angle = (2 * Math.PI * i) / auditLogs.length - Math.PI / 2;
    
    nodes.push({
      id: `audit-${log.id || i}`,
      entityId: log.id || String(i),
      type: 'audit_entry',
      name: log.actionType || 'audit',
      label: log.description || formatActionLabel(log.actionType || 'unknown'),
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      properties: {
        id: log.id,
        actionType: log.actionType,
        operator: log.operator,
        timestamp: log.timestamp,
        description: log.description
      },
      size: 10,
      color: getActionColor(log.actionType)
    });
  }
  
  return nodes;
}

/**
 * Validates Graphify nodes array for completeness
 * 
 * @param nodes - Array of Graphify nodes to validate
 * @returns True if nodes array is valid
 * 
 * @example
 * ```ts
 * if (validateGraphifyNodes(nodes)) {
 *   renderGraph(nodes);
 * }
 * ```
 */
export function validateGraphifyNodes(nodes: GraphifyNode[]): boolean {
  if (!Array.isArray(nodes)) {
    return false;
  }
  
  if (nodes.length === 0) {
    return true; // Empty array is valid
  }
  
  return nodes.every(
    (node) =>
      node.id &&
      node.type &&
      node.entityId &&
      typeof node.x === 'number' &&
      typeof node.y === 'number'
  );
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * Fetches audit logs from the server with optional filtering
 * 
 * @param params - Query parameters for filtering audit logs
 * @returns Promise resolving to audit log response
 * @throws Error if parameters are invalid or request fails
 * 
 * @example
 * ```ts
 * const response = await fetchAuditLogs({
 *   entityId: 'AST-001',
 *   limit: 20
 * });
 * ```
 */
export async function fetchAuditLogs(
  params: FetchAuditLogsParams = {}
): Promise<AuditLogResponse> {
  validateFetchParams(params);
  
  const queryString = buildQueryString({
    ...params,
    limit: params.limit || DEFAULT_PAGE_SIZE
  });
  
  const url = `${API_BASE_PATH}/logs${queryString ? `?${queryString}` : ''}`;
  
  try {
    const response = await http.get<AuditLogResponse>(url);
    // http 拦截器已解包 response.data
    return response as any as AuditLogResponse;
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    throw error;
  }
}

/**
 * Fetches audit logs for a specific entity
 * 
 * @param entityId - Entity identifier
 * @param entityType - Entity type (default: 'asset')
 * @returns Promise resolving to normalized audit log array
 * 
 * @example
 * ```ts
 * const logs = await getAuditLogsByEntity('AST-2024-001', 'asset');
 * ```
 */
export async function getAuditLogsByEntity(
  entityId: string,
  entityType: string = 'asset'
): Promise<AuditLog[]> {
  const response = await fetchAuditLogs({
    entityId,
    entityType,
    limit: DEFAULT_PAGE_SIZE
  });
  
  return normalizeAuditLogs(response);
}

/**
 * Fetches Graphify-compatible audit data for visualization
 * 
 * @param entityId - Entity identifier to fetch data for
 * @param options - Additional fetch options
 * @returns Promise resolving to Graphify visualization data
 * 
 * @example
 * ```ts
 * const graphData = await getGraphifyAuditData('AST-001', { maxDepth: 2 });
 * ```
 */
export async function getGraphifyAuditData(
  entityId: string,
  options: {
    maxDepth?: number;
    includeFieldChanges?: boolean;
  } = {}
): Promise<GraphifyData> {
  const logs = await getAuditLogsByEntity(entityId);
  
  if (!options.includeFieldChanges) {
    // Return simple node representation without detailed field changes
    return {
      nodes: logs.map((log, index) => ({
        id: `log-${log.id || index}`,
        entityId: log.id || String(index),
        type: 'audit_log',
        name: log.actionType || 'unknown',
        label: formatActionLabel(log.actionType || 'unknown'),
        x: 400 + 150 * Math.cos((2 * Math.PI * index) / logs.length),
        y: 300 + 150 * Math.sin((2 * Math.PI * index) / logs.length),
        properties: {
          actionType: log.actionType,
          operator: log.operator,
          timestamp: log.timestamp
        },
        size: 10,
        color: getActionColor(log.actionType)
      })),
      edges: []
    };
  }
  
  return transformToGraphifyData(logs);
}

/**
 * Gets approval-related audit logs
 * 
 * @param approvalId - Approval process ID
 * @returns Promise resolving to approval audit logs
 * 
 * @example
 * ```ts
 * const approvalLogs = await getApprovalAuditLogs('APR-2024-001');
 * ```
 */
export async function getApprovalAuditLogs(approvalId: string): Promise<AuditLog[]> {
  return getAuditLogsByEntity(approvalId, 'approval');
}

/**
 * Transforms audit logs to Graphify nodes for knowledge graph visualization
 * 
 * @param logs - Audit logs to transform
 * @returns Graphify nodes array ready for visualization
 * 
 * @example
 * ```ts
 * const nodes = generateGraphifyNodes(auditLogs);
 * ```
 */
export function generateGraphifyNodes(logs: AuditLog[]): GraphifyNode[] {
  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    return [];
  }
  
  const nodes: GraphifyNode[] = [];
  const nodeIdSet = new Set<string>();
  
  // Add central asset node
  const primaryEntityId = logs[0]?.entityId || 'unknown';
  const assetNodeId = `asset-${primaryEntityId}`;
  
  nodes.push({
    id: assetNodeId,
    entityId: primaryEntityId,
    type: 'asset',
    name: 'Asset',
    label: '资产',
    x: 400,
    y: 300,
    properties: {
      assetId: primaryEntityId,
      logCount: logs.length
    },
    size: 20,
    color: '#3B82F6'
  });
  nodeIdSet.add(assetNodeId);
  
  // Add log nodes in circular arrangement
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const nodeId = `log-${log.id || i}`;
    
    if (nodeIdSet.has(nodeId)) {
      continue;
    }
    
    const angle = (2 * Math.PI * i) / logs.length;
    const radius = 180;
    
    nodes.push({
      id: nodeId,
      entityId: log.id || String(i),
      type: 'audit_log',
      name: log.actionType || 'audit',
      label: formatActionLabel(log.actionType || 'unknown'),
      x: 400 + radius * Math.cos(angle),
      y: 300 + radius * Math.sin(angle),
      properties: {
        actionType: log.actionType,
        operator: log.operator || 'system',
        timestamp: log.timestamp,
        entityId: log.entityId
      },
      size: 10,
      color: getActionColor(log.actionType)
    });
    
    nodeIdSet.add(nodeId);
  }
  
  return nodes;
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Audit API Service
 * 
 * Provides comprehensive methods for audit operations with Graphify integration.
 * All methods return promises and handle errors gracefully.
 */
const auditApi = {
  fetchAuditLogs,
  getAuditLogsByEntity,
  getGraphifyAuditData,
  getApprovalAuditLogs,
  generateGraphifyNodes,
  transformToGraphifyData,
  convertChangesToGraphifyNodes,
  formatAuditLogsToGraphifyNodes,
  validateGraphifyNodes
};

export default auditApi;
