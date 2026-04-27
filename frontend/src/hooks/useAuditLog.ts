// frontend/src/hooks/useAuditLog.ts
// ============================================================
// Graphify Knowledge Graph Integration Hook
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import type { AuditLogEntry, GraphifyNode, GraphifyEdge, AuditLogFilter } from './types';

/**
 * Audit log conversion options
 */
export interface ConvertOptions {
  /** Center X coordinate for asset root node */
  centerX?: number;
  /** Center Y coordinate for asset root node */
  centerY?: number;
  /** Maximum number of nodes to generate */
  maxNodes?: number;
  /** Include edge data in conversion */
  includeEdges?: boolean;
}

/**
 * Validation result for graphify nodes
 */
export interface ValidationResult {
  isValid: boolean;
  invalidIndices: number[];
  errors: string[];
}

/**
 * Graphify node type definitions
 */
export type NodeType = 'asset' | 'operation' | 'user' | 'field' | 'value';

/**
 * Graphify edge type definitions
 */
export type EdgeType = 'owns' | 'performs' | 'modifies' | 'changes';

/**
 * Risk level for audit operations
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * @deprecated Use AuditLogEntry from './types' instead
 */
export interface LegacyAuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  operation: string;
  assetId: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  riskLevel?: RiskLevel;
}

// ============================================================
// Core Conversion Functions
// ============================================================

/**
 * Validates if the given input is a valid GraphifyNode
 * 
 * @param node - Node to validate
 * @param index - Index in array for error reporting
 * @param strict - Enable strict validation mode
 * @returns Validation result
 */
function isValidNode(node: unknown, index: number, strict: boolean): { valid: boolean; error?: string } {
  if (!node || typeof node !== 'object') {
    return { valid: false, error: `Index ${index}: Node is not an object` };
  }
  
  const n = node as Record<string, unknown>;
  
  // Required fields
  if (!n.id || typeof n.id !== 'string') {
    return { valid: false, error: `Index ${index}: Missing or invalid 'id' field` };
  }
  
  if (!n.type || typeof n.type !== 'string') {
    return { valid: false, error: `Index ${index}: Missing or invalid 'type' field` };
  }
  
  // Strict mode checks
  if (strict) {
    if (!n.label || typeof n.label !== 'string') {
      return { valid: false, error: `Index ${index}: Missing or invalid 'label' field` };
    }
    
    if (typeof n.x !== 'number' || typeof n.y !== 'number') {
      return { valid: false, error: `Index ${index}: Missing or invalid coordinates` };
    }
  }
  
  return { valid: true };
}

/**
 * Generates unique node IDs for Graphify visualization
 * 
 * @param prefix - ID prefix (e.g., 'asset', 'op', 'user')
 * @param id - Unique identifier
 * @returns Formatted node ID string
 */
export function generateNodeId(prefix: string, id: string): string {
  return `${prefix}-${id}`.replace(/[^a-zA-Z0-9-_]/g, '_');
}

/**
 * Calculates node position in radial layout
 * 
 * @param index - Node index in the sequence
 * @param total - Total number of nodes
 * @param centerX - Center X coordinate
 * @param centerY - Center Y coordinate
 * @param radius - Radius from center
 * @returns {x, y} coordinates
 */
export function calculateNodePosition(
  index: number,
  total: number,
  centerX: number = 400,
  centerY: number = 300,
  radius: number = 150
): { x: number; y: number } {
  if (total === 0) {
    return { x: centerX, y: centerY };
  }
  
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle)
  };
}

/**
 * @deprecated Use generateNodeId instead
 */
export function generateGraphifyNodeId(prefix: string, id: string): string {
  return generateNodeId(prefix, id);
}

/**
 * Converts audit log entries to Graphify visualization nodes
 * 
 * ATB-001: Converts audit logs into a node-edge graph format for knowledge graph visualization.
 *          Handles empty/undefined input gracefully by returning asset root node if assetId is valid.
 * 
 * @param auditLogs - Array of audit log entries to convert
 * @param assetId - The asset ID for root node
 * @param options - Conversion options (centerX, centerY, maxNodes)
 * @returns Array of GraphifyNode objects suitable for visualization
 * 
 * @performance Time complexity O(n), Space complexity O(n)
 * @since 1.0.0
 * 
 * @example
 * ```typescript
 * const nodes = convertAuditLogsToGraphifyNodes(logs, 'asset-123', { centerX: 400, centerY: 300 });
 * ```
 */
export function convertAuditLogsToGraphifyNodes(
  auditLogs: AuditLogEntry[] | undefined | null,
  assetId: string,
  options: ConvertOptions = {}
): GraphifyNode[] {
  // ATB-BC-001, ATB-BC-002: Defensive checks - handle empty arrays and undefined input
  if (!auditLogs || auditLogs.length === 0) {
    // ATB-001: Even if auditLogs is empty, return asset root node (if assetId is valid)
    if (assetId && assetId.trim() !== '') {
      return [{
        id: generateNodeId('asset', assetId),
        type: 'asset',
        label: '资产',
        x: options.centerX ?? 400,
        y: options.centerY ?? 300,
        properties: { assetId }
      }];
    }
    return [];
  }

  const nodes: GraphifyNode[] = [];
  const maxNodes = options.maxNodes ?? 100;
  const centerX = options.centerX ?? 400;
  const centerY = options.centerY ?? 300;
  
  // Add root asset node
  const rootNode: GraphifyNode = {
    id: generateNodeId('asset', assetId),
    type: 'asset',
    label: '资产',
    x: centerX,
    y: centerY,
    properties: { assetId }
  };
  nodes.push(rootNode);

  // Limit processing to maxNodes to prevent performance issues
  const logsToProcess = auditLogs.slice(0, maxNodes - 1);
  
  // Group logs by type for efficient node generation
  const typeGroups = new Map<string, AuditLogEntry[]>();
  for (const log of logsToProcess) {
    const type = log.operation || 'UNKNOWN';
    if (!typeGroups.has(type)) {
      typeGroups.set(type, []);
    }
    typeGroups.get(type)!.push(log);
  }

  // Generate operation cluster nodes (one per unique operation type)
  let operationIndex = 0;
  const operationNodes: GraphifyNode[] = [];
  
  for (const [operationType, logs] of typeGroups.entries()) {
    const pos = calculateNodePosition(operationIndex++, typeGroups.size, centerX, centerY, 120);
    
    const opNode: GraphifyNode = {
      id: generateNodeId('op', operationType),
      type: 'operation',
      label: operationType,
      x: pos.x,
      y: pos.y,
      properties: {
        operationType,
        count: logs.length
      }
    };
    operationNodes.push(opNode);
    nodes.push(opNode);
  }

  // Generate user nodes (unique users from audit logs)
  const userGroups = new Map<string, AuditLogEntry[]>();
  for (const log of logsToProcess) {
    const userId = log.userId || 'anonymous';
    if (!userGroups.has(userId)) {
      userGroups.set(userId, []);
    }
    userGroups.get(userId)!.push(log);
  }

  let userIndex = 0;
  for (const [userId, logs] of userGroups.entries()) {
    const pos = calculateNodePosition(userIndex++, userGroups.size, centerX, centerY, 200);
    
    const userNode: GraphifyNode = {
      id: generateNodeId('user', userId),
      type: 'user',
      label: userId,
      x: pos.x,
      y: pos.y,
      properties: {
        userId,
        operationCount: logs.length
      }
    };
    nodes.push(userNode);
  }

  // Add recent activity nodes (last 10 logs as individual nodes)
  const recentLogs = logsToProcess.slice(0, 10);
  let recentIndex = 0;
  
  for (const log of recentLogs) {
    const pos = calculateNodePosition(recentIndex++, recentLogs.length, centerX, centerY, 80);
    
    const logNode: GraphifyNode = {
      id: generateNodeId('log', log.id || String(recentIndex)),
      type: 'operation',
      label: log.operation || '操作',
      x: pos.x,
      y: pos.y,
      properties: {
        timestamp: log.timestamp,
        operation: log.operation,
        riskLevel: log.riskLevel || 'LOW'
      }
    };
    nodes.push(logNode);
  }

  return nodes;
}

/**
 * Converts audit logs to Graphify edges
 * 
 * @param auditLogs - Array of audit log entries
 * @param nodes - Already generated nodes
 * @param assetId - Root asset ID
 * @returns Array of GraphifyEdge objects
 */
export function convertAuditLogsToGraphifyEdges(
  auditLogs: AuditLogEntry[] | undefined | null,
  nodes: GraphifyNode[],
  assetId: string
): GraphifyEdge[] {
  const edges: GraphifyEdge[] = [];
  
  if (!auditLogs || auditLogs.length === 0 || nodes.length === 0) {
    return edges;
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const rootId = generateNodeId('asset', assetId);

  for (const log of auditLogs.slice(0, 50)) {
    const userId = log.userId || 'anonymous';
    const operationType = log.operation || 'UNKNOWN';
    
    // Asset -> Operation edge
    const opNodeId = generateNodeId('op', operationType);
    if (nodeMap.has(opNodeId)) {
      edges.push({
        source: rootId,
        target: opNodeId,
        type: 'owns',
        properties: { weight: 1 }
      });
    }
    
    // User -> Operation edge
    const userNodeId = generateNodeId('user', userId);
    if (nodeMap.has(userNodeId)) {
      edges.push({
        source: userNodeId,
        target: opNodeId,
        type: 'performs',
        properties: { timestamp: log.timestamp }
      });
    }
    
    // Operation -> Log edge
    const logNodeId = generateNodeId('log', log.id || '');
    if (nodeMap.has(logNodeId)) {
      edges.push({
        source: opNodeId,
        target: logNodeId,
        type: 'modifies',
        properties: { field: log.field }
      });
    }
  }

  return edges;
}

/**
 * Validates an array of GraphifyNodes
 * 
 * ATB-BC-003, ATB-EX-002: Defensive check for non-array input
 * ATB-ML-002: Uses every() instead of forEach for better performance on large arrays
 * 
 * @param nodes - Array of nodes to validate
 * @param options - Validation options (strict mode)
 * @returns true if all nodes are valid, false otherwise
 * 
 * @performance Time complexity O(n), Space complexity O(1)
 * @since 1.0.0
 */
export function validateGraphifyNodes(
  nodes: GraphifyNode[] | undefined | null,
  options: { strict?: boolean } = {}
): boolean {
  const { strict = false } = options;

  // ATB-BC-003, ATB-EX-002: Defensive check - non-array input
  if (!Array.isArray(nodes)) {
    return false;
  }

  // ATB-BC-001: Empty array is valid
  if (nodes.length === 0) {
    return true;
  }

  // ATB-ML-002: Optimize large array processing - use every instead of forEach
  return nodes.every((node, index) => {
    // ATB-EX-002: Check for valid object
    if (!node || typeof node !== 'object') {
      return false;
    }

    // Required field validation
    if (!node.id || typeof node.id !== 'string') {
      return false;
    }
    
    if (!node.type || typeof node.type !== 'string') {
      return false;
    }

    // Strict mode additional checks
    if (strict) {
      if (!node.label || typeof node.label !== 'string') {
        return false;
      }
      
      if (typeof node.x !== 'number' || typeof node.y !== 'number') {
        return false;
      }
    }

    return true;
  });
}

/**
 * Validates GraphifyNodes with detailed error reporting
 * 
 * @param nodes - Array of nodes to validate
 * @returns ValidationResult with detailed error information
 */
export function validateGraphifyNodesDetailed(
  nodes: GraphifyNode[] | undefined | null
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    invalidIndices: [],
    errors: []
  };

  // Check if input is array
  if (!Array.isArray(nodes)) {
    result.isValid = false;
    result.errors.push('Input is not an array');
    return result;
  }

  // Empty array is valid
  if (nodes.length === 0) {
    return result;
  }

  // Validate each node
  nodes.forEach((node, index) => {
    const validation = isValidNode(node, index, false);
    if (!validation.valid) {
      result.isValid = false;
      result.invalidIndices.push(index);
      if (validation.error) {
        result.errors.push(validation.error);
      }
    }
  });

  return result;
}

/**
 * Filters audit logs by risk level
 * 
 * @param logs - Audit logs to filter
 * @param minLevel - Minimum risk level to include
 * @returns Filtered audit logs
 */
export function filterAuditLogsByRiskLevel(
  logs: AuditLogEntry[],
  minLevel: RiskLevel = 'LOW'
): AuditLogEntry[] {
  const levelPriority: Record<RiskLevel, number> = {
    'LOW': 0,
    'MEDIUM': 1,
    'HIGH': 2,
    'CRITICAL': 3
  };

  const minPriority = levelPriority[minLevel] ?? 0;
  
  return logs.filter(log => {
    const logLevel = log.riskLevel || 'LOW';
    return (levelPriority[logLevel] ?? 0) >= minPriority;
  });
}

/**
 * Groups audit logs by operation type
 * 
 * @param logs - Audit logs to group
 * @returns Map of operation type to logs
 */
export function groupAuditLogsByOperation(
  logs: AuditLogEntry[]
): Map<string, AuditLogEntry[]> {
  const groups = new Map<string, AuditLogEntry[]>();
  
  for (const log of logs) {
    const type = log.operation || 'UNKNOWN';
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type)!.push(log);
  }
  
  return groups;
}

// ============================================================
// React Hook: useAuditLog
// ============================================================

/**
 * Hook for managing audit log state and Graphify visualization
 * 
 * @param assetId - The asset ID to fetch audit logs for
 * @param initialFilter - Initial filter options
 * @returns Audit log management interface
 */
export function useAuditLog(
  assetId: string,
  initialFilter?: AuditLogFilter
) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [nodes, setNodes] = useState<GraphifyNode[]>([]);
  const [edges, setEdges] = useState<GraphifyEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AuditLogFilter>(initialFilter || {});

  /**
   * Generates Graphify nodes and edges from audit logs
   * 
   * ATB-001: Main entry point for generating visualization data
   *          Resolves "No matching nodes found" issue by ensuring
   *          at minimum the asset root node is always created
   */
  const generateVisualization = useCallback((
    auditLogs: AuditLogEntry[],
    options?: ConvertOptions
  ) => {
    if (!auditLogs || auditLogs.length === 0) {
      // ATB-001 FIX: Always generate at least the asset root node
      const rootNode: GraphifyNode = {
        id: generateNodeId('asset', assetId),
        type: 'asset',
        label: '资产',
        x: options?.centerX ?? 400,
        y: options?.centerY ?? 300,
        properties: { assetId, message: '暂无审计日志' }
      };
      setNodes([rootNode]);
      setEdges([]);
      return;
    }

    // ATB-001: Generate full visualization with audit logs
    const generatedNodes = convertAuditLogsToGraphifyNodes(auditLogs, assetId, options);
    const generatedEdges = convertAuditLogsToGraphifyEdges(auditLogs, generatedNodes, assetId);
    
    setNodes(generatedNodes);
    setEdges(generatedEdges);
  }, [assetId]);

  /**
   * Updates filter and regenerates visualization if needed
   */
  const updateFilter = useCallback((newFilter: AuditLogFilter) => {
    setFilter(newFilter);
  }, []);

  /**
   * Validates current nodes state
   * 
   * @returns true if nodes are valid for rendering
   */
  const isValidVisualization = useCallback((): boolean => {
    return validateGraphifyNodes(nodes, { strict: false });
  }, [nodes]);

  /**
   * Gets nodes filtered by type
   * 
   * @param type - Node type to filter by
   * @returns Filtered nodes array
   */
  const getNodesByType = useCallback((type: NodeType): GraphifyNode[] => {
    return nodes.filter(node => node.type === type);
  }, [nodes]);

  /**
   * Gets statistics about current visualization
   */
  const getVisualizationStats = useMemo(() => {
    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      operationCount: getNodesByType('operation').length,
      userCount: getNodesByType('user').length,
      hasAssetRoot: nodes.some(n => n.type === 'asset' && n.id.includes(assetId))
    };
  }, [nodes, edges, assetId, getNodesByType]);

  return {
    logs,
    nodes,
    edges,
    loading,
    error,
    filter,
    generateVisualization,
    updateFilter,
    isValidVisualization,
    getNodesByType,
    getVisualizationStats
  };
}

export default useAuditLog;