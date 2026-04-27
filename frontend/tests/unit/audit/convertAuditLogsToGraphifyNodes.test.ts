/**
 * Audit Logs to Graphify Nodes Conversion Tests
 * 
 * ATB-001: 验证审计日志到 Graphify 节点转换的正确性
 * ATB-002: 验证节点 ID 生成不产生重复
 * ATB-003: 验证节点类型映射正确
 * 
 * @module audit/convertAuditLogsToGraphifyNodes.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateGraphifyNodesMock,
  validateGraphifyNodesMock,
  convertChangesToGraphifyNodesMock,
} from '../memory/index';

// Mock GraphifyKnowledgeGraph module
vi.mock('../../src/components/audit/GraphifyKnowledgeGraph', () => ({
  GraphifyKnowledgeGraph: vi.fn(),
  nodeSize: vi.fn(() => 20),
}));

// Mock auditApi
vi.mock('../../src/services/auditApi', () => ({
  fetchAuditLogs: vi.fn(),
  createAuditLog: vi.fn(),
}));

// Mock auditableFieldMap
vi.mock('../../src/pages/AssetDetailPage/config/auditableFieldMap', () => ({
  auditableFieldMap: {
    assetName: { label: '资产名称', type: 'string' },
    status: { label: '状态', type: 'enum' },
    location: { label: '位置', type: 'string' },
    assignee: { label: '负责人', type: 'user' },
    retirementReason: { label: '退役原因', type: 'text' },
  },
  getAuditableFields: vi.fn(() => ['assetName', 'status', 'location', 'assignee']),
}));

// Test data factory
interface AuditLogChange {
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
}

interface AuditLog {
  id: string;
  assetId: string;
  operatorId: string;
  action: string;
  timestamp: string;
  changes?: Record<string, AuditLogChange>;
}

interface GraphifyNode {
  id: string;
  type: 'asset' | 'change' | 'operator' | 'timestamp';
  label: string;
  x?: number;
  y?: number;
  properties?: Record<string, unknown>;
}

const createMockAuditLog = (overrides?: Partial<AuditLog>): AuditLog => ({
  id: 'log-001',
  assetId: 'asset-123',
  operatorId: 'user-456',
  action: 'UPDATE',
  timestamp: '2024-01-15T10:30:00Z',
  changes: {
    status: {
      fieldName: 'status',
      oldValue: 'ACTIVE',
      newValue: 'RETIRED',
    },
  },
  ...overrides,
});

const createMockGraphifyNodes = (assetId: string): GraphifyNode[] => {
  const nodes: GraphifyNode[] = [];
  
  // Asset node
  nodes.push({
    id: `asset-${assetId}`,
    type: 'asset',
    label: '资产',
    properties: { assetId },
  });
  
  // Change nodes
  const centerX = 400;
  const centerY = 300;
  const radius = 150;
  
  nodes.push({
    id: `change-${assetId}-status-0`,
    type: 'change',
    label: 'status',
    x: centerX + radius,
    y: centerY,
    properties: { oldValue: 'ACTIVE', newValue: 'RETIRED' },
  });
  
  return nodes;
};

describe('convertAuditLogsToGraphifyNodes', () => {
  /**
   * ATB-001: 验证审计日志到 Graphify 节点转换的正确性
   * 
   * 测试步骤:
   * 1. 创建包含变更记录的审计日志
   * 2. 调用节点转换函数
   * 3. 验证返回的节点数组包含资产节点和变更节点
   * 4. 验证节点属性正确映射
   */
  it('should convert audit logs to graphify nodes correctly', () => {
    const auditLog = createMockAuditLog({
      assetId: 'test-asset-001',
      changes: {
        status: { fieldName: 'status', oldValue: 'ACTIVE', newValue: 'RETIRED' },
        assignee: { fieldName: 'assignee', oldValue: 'user-A', newValue: 'user-B' },
      },
    });

    const nodes = generateGraphifyNodesMock([auditLog], auditLog.assetId);

    // ATB-001.1: 验证资产节点存在
    expect(nodes.some(n => n.id === `asset-${auditLog.assetId}`)).toBe(true);
    
    // ATB-001.2: 验证变更节点数量与变更记录数一致
    const changeNodes = nodes.filter(n => n.type === 'change');
    expect(changeNodes.length).toBe(Object.keys(auditLog.changes || {}).length);
    
    // ATB-001.3: 验证节点属性正确
    const statusNode = changeNodes.find(n => n.label === 'status');
    expect(statusNode?.properties?.oldValue).toBe('ACTIVE');
    expect(statusNode?.properties?.newValue).toBe('RETIRED');
  });

  /**
   * ATB-002: 验证节点 ID 生成不产生重复
   * 
   * 测试步骤:
   * 1. 创建多个审计日志
   * 2. 调用节点转换函数
   * 3. 验证所有节点 ID 唯一
   */
  it('should generate unique node IDs without duplicates', () => {
    const auditLogs = [
      createMockAuditLog({ id: 'log-001', assetId: 'asset-100' }),
      createMockAuditLog({ id: 'log-002', assetId: 'asset-100' }),
      createMockAuditLog({ id: 'log-003', assetId: 'asset-100' }),
    ];

    const nodes = generateGraphifyNodesMock(auditLogs, 'asset-100');
    const nodeIds = nodes.map(n => n.id);
    const uniqueIds = new Set(nodeIds);

    // ATB-002.1: 验证节点 ID 数量等于唯一 ID 数量
    expect(nodeIds.length).toBe(uniqueIds.size);
    
    // ATB-002.2: 验证没有 "No matching nodes" 的 ID 模式
    expect(nodeIds.some(id => id.includes('undefined'))).toBe(false);
    expect(nodeIds.some(id => id.includes('null'))).toBe(false);
  });

  /**
   * ATB-003: 验证节点类型映射正确
   * 
   * 测试步骤:
   * 1. 创建包含不同字段类型变更的审计日志
   * 2. 调用节点转换函数
   * 3. 验证各类型节点正确生成
   */
  it('should map node types correctly based on field types', () => {
    const auditLog = createMockAuditLog({
      assetId: 'asset-type-test',
      changes: {
        assetName: { fieldName: 'assetName', oldValue: 'Old Name', newValue: 'New Name' },
        status: { fieldName: 'status', oldValue: 'ACTIVE', newValue: 'IDLE' },
        assignee: { fieldName: 'assignee', oldValue: null, newValue: 'user-789' },
      },
    });

    const nodes = generateGraphifyNodesMock([auditLog], auditLog.assetId);

    // ATB-003.1: 验证资产节点类型
    const assetNode = nodes.find(n => n.type === 'asset');
    expect(assetNode).toBeDefined();
    expect(assetNode?.id).toBe(`asset-${auditLog.assetId}`);
    
    // ATB-003.2: 验证变更节点类型
    const changeNodes = nodes.filter(n => n.type === 'change');
    expect(changeNodes.length).toBe(3);
    expect(changeNodes.every(n => n.type === 'change')).toBe(true);
  });

  /**
   * ATB-004: 验证空变更记录处理
   * 
   * 测试步骤:
   * 1. 创建无变更记录的审计日志
   * 2. 调用节点转换函数
   * 3. 验证仅返回资产节点
   */
  it('should handle empty changes gracefully', () => {
    const auditLog = createMockAuditLog({
      changes: undefined,
    });

    const nodes = generateGraphifyNodesMock([auditLog], auditLog.assetId);

    // ATB-004.1: 验证仅返回资产节点
    expect(nodes.length).toBe(1);
    expect(nodes[0].type).toBe('asset');
  });

  /**
   * ATB-005: 验证大规模数据集性能
   * 
   * 测试步骤:
   * 1. 创建 100 条审计日志
   * 2. 调用节点转换函数
   * 3. 验证执行时间 < 1 秒
   */
  it('should handle large datasets efficiently', () => {
    const largeAuditLogs: AuditLog[] = Array.from({ length: 100 }, (_, i) =>
      createMockAuditLog({
        id: `log-${i}`,
        assetId: `asset-${i}`,
        changes: {
          fieldA: { fieldName: 'fieldA', oldValue: i, newValue: i + 1 },
          fieldB: { fieldName: 'fieldB', oldValue: `old-${i}`, newValue: `new-${i}` },
        },
      })
    );

    const startTime = performance.now();
    const nodes = generateGraphifyNodesMock(largeAuditLogs, 'asset-bulk');
    const endTime = performance.now();

    // ATB-005.1: 验证节点数量正确
    expect(nodes.length).toBeGreaterThan(0);
    
    // ATB-005.2: 验证性能要求
    expect(endTime - startTime).toBeLessThan(1000);
  });
});

describe('validateGraphifyNodes', () => {
  /**
   * ATB-006: 验证节点数组验证函数
   * 
   * 测试步骤:
   * 1. 测试有效节点数组
   * 2. 测试无效节点数组（缺少必需字段）
   * 3. 测试空数组
   */
  it('should validate valid node arrays correctly', () => {
    const validNodes: GraphifyNode[] = [
      { id: 'node-1', type: 'asset', label: 'Asset', x: 100, y: 100 },
      { id: 'node-2', type: 'change', label: 'Change', x: 200, y: 200 },
    ];

    expect(validateGraphifyNodesMock(validNodes)).toBe(true);
  });

  it('should reject nodes missing required fields', () => {
    const invalidNodes: GraphifyNode[] = [
      { id: 'node-1', type: 'asset', label: 'Asset' }, // 缺少 x, y
      { id: 'node-2', type: 'change', label: 'Change' }, // 缺少 x, y
    ];

    expect(validateGraphifyNodesMock(invalidNodes)).toBe(false);
  });

  it('should return true for empty arrays', () => {
    expect(validateGraphifyNodesMock([])).toBe(true);
  });

  it('should reject non-array inputs', () => {
    expect(validateGraphifyNodesMock(null as unknown as GraphifyNode[])).toBe(false);
    expect(validateGraphifyNodesMock(undefined as unknown as GraphifyNode[])).toBe(false);
  });
});

describe('convertChangesToGraphifyNodes', () => {
  /**
   * ATB-007: 验证变更记录转换函数
   * 
   * 测试步骤:
   * 1. 创建变更记录数组
   * 2. 调用转换函数
   * 3. 验证返回节点数组的格式和数量
   */
  it('should convert changes to nodes with correct positioning', () => {
    const changes = [
      { fieldName: 'status', oldValue: 'A', newValue: 'B' },
      { fieldName: 'location', oldValue: 'Loc1', newValue: 'Loc2' },
    ];

    const nodes = convertChangesToGraphifyNodesMock(changes, 'asset-xyz');

    // ATB-007.1: 验证节点数量
    expect(nodes.length).toBe(changes.length);
    
    // ATB-007.2: 验证节点 ID 格式
    expect(nodes[0].id).toContain('asset-xyz');
    expect(nodes[0].id).toContain('status');
    
    // ATB-007.3: 验证节点类型
    expect(nodes.every(n => n.type === 'change')).toBe(true);
  });

  it('should handle empty changes array', () => {
    const nodes = convertChangesToGraphifyNodesMock([], 'asset-empty');
    expect(nodes).toEqual([]);
  });

  it('should position nodes in circular layout', () => {
    const changes = [
      { fieldName: 'field1', oldValue: 1, newValue: 2 },
      { fieldName: 'field2', oldValue: 3, newValue: 4 },
      { fieldName: 'field3', oldValue: 5, newValue: 6 },
    ];

    const nodes = convertChangesToGraphifyNodesMock(changes, 'asset-circular');

    // ATB-007.4: 验证节点有 x, y 坐标
    nodes.forEach(node => {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
    });
  });
});

describe('Graphify integration tests', () => {
  /**
   * ATB-008: 集成测试 - 完整转换流程
   * 
   * 测试步骤:
   * 1. 准备审计日志数据
   * 2. 执行完整转换流程
   * 3. 验证最终结果
   */
  it('should complete full conversion flow without errors', () => {
    const auditLog = createMockAuditLog({
      assetId: 'integration-test-asset',
      changes: {
        assetName: { fieldName: 'assetName', oldValue: 'Server A', newValue: 'Server B' },
        status: { fieldName: 'status', oldValue: 'ACTIVE', newValue: 'RETIRED' },
        retirementReason: { fieldName: 'retirementReason', oldValue: '', newValue: 'End of life' },
      },
    });

    // Step 1: Generate nodes
    const nodes = generateGraphifyNodesMock([auditLog], auditLog.assetId);
    
    // Step 2: Validate nodes
    const isValid = validateGraphifyNodesMock(nodes);
    expect(isValid).toBe(true);
    
    // Step 3: Verify no "No matching nodes found" error
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.every(n => n.id !== 'undefined' && n.id !== 'null')).toBe(true);
  });

  /**
   * ATB-009: 边界测试 - 处理异常数据
   * 
   * 测试步骤:
   * 1. 传入 null 值
   * 2. 传入 undefined 值
   * 3. 验证函数健壮性
   */
  it('should handle edge cases without throwing', () => {
    // Empty audit logs array
    expect(() => generateGraphifyNodesMock([], '')).not.toThrow();
    
    // Single change
    const singleChange = [createMockAuditLog({ changes: { single: { fieldName: 'single', oldValue: 1, newValue: 2 } } })];
    expect(() => generateGraphifyNodesMock(singleChange, 'asset-single')).not.toThrow();
    
    // Many changes (stress test)
    const manyChanges: AuditLogChange[] = Array.from({ length: 50 }, (_, i) => ({
      fieldName: `field${i}`,
      oldValue: i,
      newValue: i + 1,
    }));
    expect(() => convertChangesToGraphifyNodesMock(manyChanges, 'asset-stress')).not.toThrow();
  });
});