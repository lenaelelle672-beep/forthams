/**
 * Mock data for Asset Detail page
 * 
 * This module provides comprehensive mock data for testing the asset detail page,
 * including asset information, audit logs, approval processes, and Graphify knowledge graph nodes.
 * 
 * @module mocks/assetDetail
 * @version 1.0.0
 */

export interface Asset {
  id: string;
  assetName: string;
  assetCode: string;
  categoryId: string;
  categoryName: string;
  serialNumber: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue: number;
  status: string;
  location: string;
  custodian: string;
  department: string;
  supplier: string;
  warrantyPeriod: number;
  maintenanceStatus: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetAuditLog {
  id: string;
  assetId: string;
  action: string;
  operator: string;
  operatorDept: string;
  timestamp: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
}

export interface ApprovalStage {
  stage: number;
  approver: string;
  approverRole: string;
  status: 'approved' | 'pending' | 'rejected';
  comment: string | null;
  actionDate: string | null;
}

export interface ApprovalProcess {
  id: string;
  assetId: string;
  processType: string;
  currentStage: number;
  totalStages: number;
  status: string;
  applicant: string;
  applicantDept: string;
  applyDate: string;
  estimatedCompletionDate: string;
  actualCompletionDate: string | null;
  remarks: string;
  approvalStages: ApprovalStage[];
}

export interface ApprovalRecord {
  id: string;
  processId: string;
  stage: number;
  approver: string;
  action: string;
  comment: string;
  timestamp: string;
}

export interface GraphifyNodeResult {
  id: string;
  label: string;
  nodeType: MockGraphifyNode['nodeType'];
  x: number;
  y: number;
  metadata: Record<string, unknown>;
}

export interface GraphifyEdgeResult {
  id: string;
  source: string;
  target: string;
  label: string;
  edgeType: MockGraphifyEdge['edgeType'];
  metadata: Record<string, unknown>;
}

// ============================================================================
// Mock Asset IDs
// ============================================================================

/**
 * Predefined asset IDs for testing purposes
 */
export const MOCK_ASSET_IDS = {
  PRIMARY: 'AST-2024-001',
  SECONDARY: 'AST-2024-002',
  TRANSFER: 'AST-2024-003',
  SCRAP: 'AST-2024-004',
  CLEARANCE: 'AST-2024-005',
} as const;

/**
 * Mock asset ID for approval workflow testing
 */
export const MOCK_APPROVAL_ASSET_ID = 'AST-APPROVAL-001';

/**
 * Mock asset ID for transfer workflow testing
 */
export const MOCK_TRANSFER_ASSET_ID = 'AST-TRANSFER-001';

// ============================================================================
// Mock Graphify Types
// ============================================================================

/**
 * Represents a node in the Graphify knowledge graph
 */
export interface MockGraphifyNode {
  /** Unique node identifier */
  id: string;
  /** Associated asset ID */
  assetId: string;
  /** Node label displayed in the graph */
  label: string;
  /** Node type for categorization */
  nodeType: 'asset' | 'user' | 'action' | 'status' | 'field';
  /** X coordinate position */
  x: number;
  /** Y coordinate position */
  y: number;
  /** Node metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Represents an edge (connection) in the Graphify knowledge graph
 */
export interface MockGraphifyEdge {
  /** Unique edge identifier */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge label */
  label: string;
  /** Edge type for styling */
  edgeType: 'reference' | 'change' | 'approval' | 'transfer';
}

// ============================================================================
// Mock Graphify Nodes Data
// ============================================================================

/**
 * Mock Graphify nodes for knowledge graph visualization
 * 
 * @remarks
 * These nodes represent audit trail data for asset AST-2024-001,
 * including asset info, users involved, actions taken, and status changes.
 */
export const MOCK_GRAPHIFY_NODES: MockGraphifyNode[] = [
  // Asset node (center)
  {
    id: 'node-asset-AST-2024-001',
    assetId: 'AST-2024-001',
    label: '资产 AST-2024-001',
    nodeType: 'asset',
    x: 400,
    y: 300,
    metadata: {
      assetName: 'Dell PowerEdge R740 服务器',
      category: '服务器',
      status: '在用',
    },
  },
  // User nodes
  {
    id: 'node-user-zhangsan',
    assetId: 'AST-2024-001',
    label: '张三',
    nodeType: 'user',
    x: 250,
    y: 200,
    metadata: {
      department: 'IT部',
      role: '资产管理员',
    },
  },
  {
    id: 'node-user-lisi',
    assetId: 'AST-2024-001',
    label: '李四',
    nodeType: 'user',
    x: 550,
    y: 200,
    metadata: {
      department: '财务部',
      role: '财务主管',
    },
  },
  {
    id: 'node-user-wangwu',
    assetId: 'AST-2024-001',
    label: '王五',
    nodeType: 'user',
    x: 250,
    y: 400,
    metadata: {
      department: 'IT部',
      role: '运维工程师',
    },
  },
  // Action nodes
  {
    id: 'node-action-create',
    assetId: 'AST-2024-001',
    label: '资产创建',
    nodeType: 'action',
    x: 400,
    y: 150,
    metadata: {
      actionType: 'create',
      timestamp: '2024-01-15T10:30:00Z',
    },
  },
  {
    id: 'node-action-update-location',
    assetId: 'AST-2024-001',
    label: '位置变更',
    nodeType: 'action',
    x: 550,
    y: 300,
    metadata: {
      actionType: 'update',
      field: 'location',
      timestamp: '2024-02-20T14:45:00Z',
    },
  },
  {
    id: 'node-action-transfer',
    assetId: 'AST-2024-001',
    label: '资产调拨',
    nodeType: 'action',
    x: 400,
    y: 450,
    metadata: {
      actionType: 'transfer',
      timestamp: '2024-03-10T09:15:00Z',
    },
  },
  // Status nodes
  {
    id: 'node-status-active',
    assetId: 'AST-2024-001',
    label: '在用',
    nodeType: 'status',
    x: 150,
    y: 300,
    metadata: {
      statusCode: 'ACTIVE',
      effectiveDate: '2024-01-15',
    },
  },
  {
    id: 'node-status-idle',
    assetId: 'AST-2024-001',
    label: '闲置',
    nodeType: 'status',
    x: 650,
    y: 300,
    metadata: {
      statusCode: 'IDLE',
      effectiveDate: '2024-02-01',
    },
  },
  // Field change nodes
  {
    id: 'node-field-location',
    assetId: 'AST-2024-001',
    label: '位置: A栋3层 → B栋5层',
    nodeType: 'field',
    x: 475,
    y: 225,
    metadata: {
      fieldName: 'location',
      oldValue: 'A栋3层',
      newValue: 'B栋5层',
    },
  },
  {
    id: 'node-field custodian',
    assetId: 'AST-2024-001',
    label: '保管人: 张三 → 王五',
    nodeType: 'field',
    x: 475,
    y: 375,
    metadata: {
      fieldName: 'custodian',
      oldValue: '张三',
      newValue: '王五',
    },
  },
];

// ============================================================================
// Mock Graphify Edges Data
// ============================================================================

/**
 * Mock Graphify edges for knowledge graph visualization
 * 
 * @remarks
 * Edges connect nodes to represent relationships and data flow
 * in the audit trail visualization.
 */
export const MOCK_GRAPHIFY_EDGES: MockGraphifyEdge[] = [
  // Asset creation flow
  {
    id: 'edge-create-asset',
    source: 'node-action-create',
    target: 'node-asset-AST-2024-001',
    label: '创建',
    edgeType: 'reference',
  },
  {
    id: 'edge-create-user',
    source: 'node-user-zhangsan',
    target: 'node-action-create',
    label: '操作',
    edgeType: 'reference',
  },
  {
    id: 'edge-create-status',
    source: 'node-action-create',
    target: 'node-status-active',
    label: '初始状态',
    edgeType: 'reference',
  },
  // Location update flow
  {
    id: 'edge-update-location',
    source: 'node-asset-AST-2024-001',
    target: 'node-action-update-location',
    label: '触发',
    edgeType: 'change',
  },
  {
    id: 'edge-update-user',
    source: 'node-user-lisi',
    target: 'node-action-update-location',
    label: '审批',
    edgeType: 'approval',
  },
  {
    id: 'edge-location-field',
    source: 'node-action-update-location',
    target: 'node-field-location',
    label: '变更字段',
    edgeType: 'change',
  },
  {
    id: 'edge-field-asset',
    source: 'node-field-location',
    target: 'node-asset-AST-2024-001',
    label: '影响',
    edgeType: 'change',
  },
  // Transfer flow
  {
    id: 'edge-transfer-asset',
    source: 'node-asset-AST-2024-001',
    target: 'node-action-transfer',
    label: '调拨',
    edgeType: 'transfer',
  },
  {
    id: 'edge-transfer-custodian',
    source: 'node-action-transfer',
    target: 'node-field-custodian',
    label: '变更保管人',
    edgeType: 'change',
  },
  {
    id: 'edge-custodian-user',
    source: 'node-field-custodian',
    target: 'node-user-wangwu',
    label: '新保管人',
    edgeType: 'reference',
  },
  // Status transitions
  {
    id: 'edge-status-idle',
    source: 'node-status-active',
    target: 'node-status-idle',
    label: '状态变更',
    edgeType: 'change',
  },
];

// ============================================================================
// Mock Asset Data
// ============================================================================

/**
 * Mock asset data for testing
 */
export const MOCK_ASSET: Asset = {
  id: 'AST-2024-001',
  assetName: 'Dell PowerEdge R740 服务器',
  assetCode: 'SRV-2024-001',
  categoryId: 'CAT-001',
  categoryName: '服务器',
  serialNumber: 'SN1234567890',
  purchaseDate: '2024-01-15',
  purchasePrice: 25000.00,
  currentValue: 23000.00,
  status: '在用',
  location: 'A栋3层',
  custodian: '张三',
  department: 'IT部',
  supplier: 'Dell中国',
  warrantyPeriod: 36,
  maintenanceStatus: '维保中',
  remarks: '测试用服务器',
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-03-10T09:15:00Z',
};

/**
 * Mock asset list for testing
 */
export const MOCK_ASSET_LIST: Asset[] = [
  MOCK_ASSET,
  {
    id: 'AST-2024-002',
    assetName: 'HP LaserJet Pro MFP',
    assetCode: 'PRT-2024-001',
    categoryId: 'CAT-002',
    categoryName: '打印机',
    serialNumber: 'SN9876543210',
    purchaseDate: '2024-02-01',
    purchasePrice: 3500.00,
    currentValue: 3200.00,
    status: '在用',
    location: 'B栋2层',
    custodian: '李四',
    department: '财务部',
    supplier: 'HP中国',
    warrantyPeriod: 12,
    maintenanceStatus: '正常',
    remarks: '',
    createdAt: '2024-02-01T14:00:00Z',
    updatedAt: '2024-02-01T14:00:00Z',
  },
];

// ============================================================================
// Mock Audit Logs
// ============================================================================

/**
 * Mock audit log entries for testing
 */
export const MOCK_AUDIT_LOGS: AssetAuditLog[] = [
  {
    id: 'AUD-2024-001',
    assetId: 'AST-2024-001',
    action: '创建',
    operator: '张三',
    operatorDept: 'IT部',
    timestamp: '2024-01-15T10:30:00Z',
    field: null,
    oldValue: null,
    newValue: null,
    reason: '新购资产入库',
  },
  {
    id: 'AUD-2024-002',
    assetId: 'AST-2024-001',
    action: '更新',
    operator: '李四',
    operatorDept: '财务部',
    timestamp: '2024-02-20T14:45:00Z',
    field: 'location',
    oldValue: 'A栋3层',
    newValue: 'B栋5层',
    reason: '办公区域调整',
  },
  {
    id: 'AUD-2024-003',
    assetId: 'AST-2024-001',
    action: '更新',
    operator: '张三',
    operatorDept: 'IT部',
    timestamp: '2024-03-10T09:15:00Z',
    field: 'custodian',
    oldValue: '张三',
    newValue: '王五',
    reason: '人员调动',
  },
];

// ============================================================================
// Mock Approval Process Data
// ============================================================================

/**
 * Mock approval process for testing
 */
export const MOCK_APPROVAL_PROCESS: ApprovalProcess = {
  id: 'APR-2024-001',
  assetId: 'AST-APPROVAL-001',
  processType: 'transfer',
  currentStage: 2,
  totalStages: 3,
  status: 'pending',
  applicant: '张三',
  applicantDept: 'IT部',
  applyDate: '2024-03-15T10:00:00Z',
  estimatedCompletionDate: '2024-03-20',
  actualCompletionDate: null,
  remarks: '资产调拨申请',
  approvalStages: [
    {
      stage: 1,
      approver: '李四',
      approverRole: '部门主管',
      status: 'approved',
      comment: '同意调拨',
      actionDate: '2024-03-16T09:00:00Z',
    },
    {
      stage: 2,
      approver: '王五',
      approverRole: '运维主管',
      status: 'pending',
      comment: null,
      actionDate: null,
    },
    {
      stage: 3,
      approver: '赵六',
      approverRole: '财务主管',
      status: 'pending',
      comment: null,
      actionDate: null,
    },
  ],
};

/**
 * Mock approval records for testing
 */
export const MOCK_APPROVAL_RECORDS: ApprovalRecord[] = [
  {
    id: 'APR-REC-001',
    processId: 'APR-2024-001',
    stage: 1,
    approver: '李四',
    action: 'approve',
    comment: '同意调拨',
    timestamp: '2024-03-16T09:00:00Z',
  },
];

// ============================================================================
// Graphify Knowledge Graph Functions
// ============================================================================

/**
 * Matches a Graphify node by asset ID
 * 
 * @param node - The Graphify node to check
 * @param assetId - The asset ID to match against
 * @returns True if the node matches the asset ID, false otherwise
 * 
 * @remarks
 * A node matches if its assetId property equals the target assetId,
 * or if the assetId is a prefix of the node ID (for nodes that include
 * the asset ID in their identifier).
 * 
 * This ensures comprehensive matching for nodes that may store
 * the asset reference in different formats.
 * 
 * @example
 * ```typescript
 * const node = { id: 'node-asset-AST-2024-001', assetId: 'AST-2024-001', ... };
 * const result = matchNodeByAssetId(node, 'AST-2024-001');
 * // result === true
 * ```
 */
function matchNodeByAssetId(node: MockGraphifyNode, assetId: string): boolean {
  if (!node || !assetId) {
    return false;
  }
  
  // Direct match on assetId property
  if (node.assetId === assetId) {
    return true;
  }
  
  // Match if assetId is a prefix of the node ID
  // This handles cases like 'node-asset-AST-2024-001' matching 'AST-2024-001'
  if (node.id && node.id.includes(assetId)) {
    return true;
  }
  
  // Match nodes that have the asset ID embedded in metadata
  if (node.metadata?.assetId === assetId) {
    return true;
  }
  
  return false;
}

/**
 * Matches a Graphify edge by asset ID
 * 
 * @param edge - The Graphify edge to check
 * @param assetId - The asset ID to match against
 * @returns True if the edge has a node reference matching the asset ID
 * 
 * @remarks
 * An edge is considered relevant if either its source or target node
 * ID contains the asset ID, indicating the edge connects nodes
 * related to the specified asset.
 */
function matchEdgeByAssetId(edge: MockGraphifyEdge, assetId: string): boolean {
  if (!edge || !assetId) {
    return false;
  }
  
  // Check if either source or target contains the asset ID
  const sourceMatch = edge.source && edge.source.includes(assetId);
  const targetMatch = edge.target && edge.target.includes(assetId);
  
  return sourceMatch || targetMatch;
}

/**
 * Retrieves Graphify nodes filtered by asset ID
 *
 * @param assetId - Optional asset ID to filter nodes
 * @returns Array of matching graphify nodes
 *
 * @remarks
 * When no assetId is provided, returns all nodes. When assetId is provided,
 * returns only nodes associated with that asset. The matching logic checks:
 * 1. Direct assetId property match
 * 2. Asset ID as substring of node ID
 * 3. Asset ID in node metadata
 *
 * This ensures comprehensive node retrieval for the knowledge graph.
 *
 * @example
 * ```typescript
 * // Get nodes for a specific asset
 * const nodes = getMockGraphifyNodesByAssetId('AST-2024-001');
 * 
 * // Get all nodes (no filter)
 * const allNodes = getMockGraphifyNodesByAssetId();
 * ```
 * 
 * @category Graphify
 * @see MOCK_GRAPHIFY_NODES
 * @see matchNodeByAssetId
 */
export function getMockGraphifyNodesByAssetId(assetId?: string): MockGraphifyNode[] {
  if (!assetId) {
    return MOCK_GRAPHIFY_NODES;
  }
  
  // Use the comprehensive matching function for asset ID
  const matchedNodes = MOCK_GRAPHIFY_NODES.filter(node => matchNodeByAssetId(node, assetId));
  
  // Log for debugging purposes (helps identify matching issues)
  if (matchedNodes.length === 0) {
    console.warn(`[Graphify Mock] No matching nodes found for asset: ${assetId}`);
    console.debug('[Graphify Mock] Available node IDs:', MOCK_GRAPHIFY_NODES.map(n => n.id));
  }
  
  return matchedNodes;
}

/**
 * Retrieves graphify edges filtered by asset ID
 *
 * @param assetId - Optional asset ID to filter edges
 * @returns Array of matching graphify edges
 *
 * @remarks
 * Edges are filtered based on whether either the source or target node
 * belongs to the target asset. This ensures all relevant connections
 * are displayed in the knowledge graph.
 *
 * @example
 * ```typescript
 * const edges = getMockGraphifyEdgesByAssetId('AST-2024-001');
 * ```
 * 
 * @category Graphify
 * @see MOCK_GRAPHIFY_EDGES
 * @see matchEdgeByAssetId
 */
export function getMockGraphifyEdgesByAssetId(assetId?: string): MockGraphifyEdge[] {
  if (!assetId) {
    return MOCK_GRAPHIFY_EDGES;
  }
  
  // Filter edges based on node references
  return MOCK_GRAPHIFY_EDGES.filter(edge => matchEdgeByAssetId(edge, assetId));
}

/**
 * Retrieves all graphify nodes (alias for getMockGraphifyNodesByAssetId without filter)
 *
 * @returns Array of all graphify nodes
 * 
 * @category Graphify
 * @see getMockGraphifyNodesByAssetId
 */
export function getMockGraphifyNodes(): MockGraphifyNode[] {
  return getMockGraphifyNodesByAssetId();
}

/**
 * Retrieves all graphify edges (alias for getMockGraphifyEdgesByAssetId without filter)
 *
 * @returns Array of all graphify edges
 * 
 * @category Graphify
 * @see getMockGraphifyEdgesByAssetId
 */
export function getMockGraphifyEdges(): MockGraphifyEdge[] {
  return getMockGraphifyEdgesByAssetId();
}

/**
 * Converts mock Graphify nodes to API response format
 *
 * @param assetId - Optional asset ID to filter nodes
 * @returns Array of GraphifyNodeResult in API response format
 *
 * @remarks
 * This function transforms internal mock nodes to the format expected
 * by the Graphify component, ensuring compatibility between mock data
 * and real API responses.
 *
 * @example
 * ```typescript
 * const nodes = convertMockNodesToApiFormat('AST-2024-001');
 * // Returns nodes in GraphifyNodeResult format
 * ```
 * 
 * @category Graphify
 * @see GraphifyNodeResult
 */
export function convertMockNodesToApiFormat(assetId?: string): GraphifyNodeResult[] {
  const mockNodes = getMockGraphifyNodesByAssetId(assetId);
  
  return mockNodes.map((node, index) => ({
    id: node.id,
    label: node.label,
    nodeType: node.nodeType,
    x: node.x,
    y: node.y,
    metadata: {
      ...node.metadata,
      // Ensure assetId is always present in metadata for Graphify component
      assetId: node.assetId,
      index,
    },
  }));
}

/**
 * Converts mock Graphify edges to API response format
 *
 * @param assetId - Optional asset ID to filter edges
 * @returns Array of GraphifyEdgeResult in API response format
 *
 * @remarks
 * This function transforms internal mock edges to the format expected
 * by the Graphify component.
 *
 * @example
 * ```typescript
 * const edges = convertMockEdgesToApiFormat('AST-2024-001');
 * // Returns edges in GraphifyEdgeResult format
 * ```
 * 
 * @category Graphify
 * @see GraphifyEdgeResult
 */
export function convertMockEdgesToApiFormat(assetId?: string): GraphifyEdgeResult[] {
  const mockEdges = getMockGraphifyEdgesByAssetId(assetId);
  
  return mockEdges.map((edge, index) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    edgeType: edge.edgeType,
    metadata: {
      index,
    },
  }));
}

/**
 * Gets the list of available mock asset IDs
 *
 * @returns Object containing predefined asset IDs for testing
 * 
 * @see MOCK_ASSET_IDS
 */
export function getMockAssetIds(): typeof MOCK_ASSET_IDS {
  return { ...MOCK_ASSET_IDS };
}

/**
 * Gets the primary mock asset ID for testing
 *
 * @returns The primary asset ID string
 * 
 * @remarks
 * Convenience function to retrieve the most commonly used
 * asset ID in tests.
 * 
 * @example
 * ```typescript
 * const assetId = getPrimaryMockAssetId();
 * // Returns 'AST-2024-001'
 * ```
 */
export function getPrimaryMockAssetId(): string {
  return MOCK_ASSET_IDS.PRIMARY;
}

/**
 * Verifies if a node matches the given asset ID (public utility)
 *
 * @param node - The Graphify node to verify
 * @param assetId - The asset ID to check against
 * @returns Boolean indicating if the node matches
 * 
 * @remarks
 * Exposes the internal matching logic for external use in tests
 * and validation scenarios.
 * 
 * @example
 * ```typescript
 * const node = getMockGraphifyNodesByAssetId('AST-2024-001')[0];
 * const isMatch = verifyNodeAssetMatch(node, 'AST-2024-001');
 * ```
 */
export function verifyNodeAssetMatch(node: MockGraphifyNode, assetId: string): boolean {
  return matchNodeByAssetId(node, assetId);
}

/**
 * Resets mock data to initial state
 *
 * @remarks
 * Utility function for test cleanup, ensuring each test starts
 * with fresh mock data state.
 * 
 * @example
 * ```typescript
 * beforeEach(() => {
 *   resetMockData();
 * });
 * ```
 */
export function resetMockData(): void {
  // In a real implementation with mutable state, this would reset MOCK_GRAPHIFY_NODES
  // For now, this is a placeholder for future state management
  console.debug('[Graphify Mock] Mock data reset requested');
}

// ============================================================================
// Mock Data Getters for Different Test Scenarios
// ============================================================================

/**
 * Gets mock data for approval workflow testing
 *
 * @returns Object containing approval-related mock data
 * 
 * @example
 * ```typescript
 * const { process, records } = getMockApprovalData();
 * ```
 */
export function getMockApprovalData(): {
  process: ApprovalProcess;
  records: ApprovalRecord[];
} {
  return {
    process: MOCK_APPROVAL_PROCESS,
    records: MOCK_APPROVAL_RECORDS,
  };
}

/**
 * Gets mock data for asset detail page testing
 *
 * @param assetId - Optional asset ID, defaults to primary mock asset
 * @returns Object containing all asset detail mock data
 * 
 * @example
 * ```typescript
 * const { asset, auditLogs, graphifyNodes } = getMockAssetDetailData('AST-2024-001');
 * ```
 */
export function getMockAssetDetailData(assetId: string = MOCK_ASSET_IDS.PRIMARY): {
  asset: Asset;
  auditLogs: AssetAuditLog[];
  graphifyNodes: GraphifyNodeResult[];
  graphifyEdges: GraphifyEdgeResult[];
} {
  return {
    asset: MOCK_ASSET,
    auditLogs: MOCK_AUDIT_LOGS,
    graphifyNodes: convertMockNodesToApiFormat(assetId),
    graphifyEdges: convertMockEdgesToApiFormat(assetId),
  };
}

/**
 * Validates that mock Graphify data is properly configured
 *
 * @returns Validation result with status and any error messages
 * 
 * @remarks
 * Useful for integration testing to ensure mock data setup
 * is correct before running tests.
 * 
 * @example
 * ```typescript
 * const validation = validateMockGraphifyData();
 * if (!validation.isValid) {
 *   throw new Error(validation.errors.join(', '));
 * }
 * ```
 */
export function validateMockGraphifyData(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate nodes have required properties
  for (const node of MOCK_GRAPHIFY_NODES) {
    if (!node.id) errors.push('Node missing id');
    if (!node.label) errors.push(`Node ${node.id} missing label`);
    if (!node.nodeType) errors.push(`Node ${node.id} missing nodeType`);
  }
  
  // Validate edges have required properties
  for (const edge of MOCK_GRAPHIFY_EDGES) {
    if (!edge.id) errors.push('Edge missing id');
    if (!edge.source) errors.push(`Edge ${edge.id} missing source`);
    if (!edge.target) errors.push(`Edge ${edge.id} missing target`);
  }
  
  // Check for orphan edges (edges pointing to non-existent nodes)
  const nodeIds = new Set(MOCK_GRAPHIFY_NODES.map(n => n.id));
  for (const edge of MOCK_GRAPHIFY_EDGES) {
    if (!nodeIds.has(edge.source)) {
      warnings.push(`Edge ${edge.id} has unknown source: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      warnings.push(`Edge ${edge.id} has unknown target: ${edge.target}`);
    }
  }
  
  // Validate primary asset has associated nodes
  const primaryAssetNodes = getMockGraphifyNodesByAssetId(MOCK_ASSET_IDS.PRIMARY);
  if (primaryAssetNodes.length === 0) {
    errors.push(`Primary asset ${MOCK_ASSET_IDS.PRIMARY} has no associated nodes`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
