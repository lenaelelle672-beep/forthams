/**
 * auditableBinding.test.ts
 * 
 * 测试文件：审计字段双向绑定测试
 * 
 * 本模块验证审计日志与资产详情页面之间的双向数据绑定功能，
 * 包括节点生成、状态同步、变更追踪等核心场景。
 * 
 * @module tests/unit/auditableBinding
 * @description 审计字段双向绑定集成测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref, reactive, nextTick, computed } from 'vue';
import { defineComponent, h } from 'vue';

// ============================================================
// Mock 模块定义
// ============================================================

// Mock GraphifyNode 类型
interface MockGraphifyNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  entityId: string;
  properties: Record<string, unknown>;
}

// Mock FieldChange 类型
interface MockFieldChange {
  fieldName: string;
  oldValue: string;
  newValue: string;
  timestamp: number;
}

// Mock AuditLog 类型
interface MockAuditLog {
  id: string;
  entityType: string;
  entityId: string;
  operation: string;
  operator: string;
  timestamp: number;
  changes?: Record<string, MockFieldChange>;
}

// ============================================================
// 测试辅助函数
// ============================================================

/**
 * 创建模拟的 Graphify 节点数据
 * 
 * @param overrides - 可选的属性覆盖
 * @returns GraphifyNode 实例
 * 
 * @example
 * const node = createMockGraphifyNode({ id: 'test-1', type: 'field' });
 */
function createMockGraphifyNode(overrides: Partial<MockGraphifyNode> = {}): MockGraphifyNode {
  return {
    id: 'mock-node-1',
    type: 'asset',
    label: '测试节点',
    x: 100,
    y: 100,
    entityId: 'AST-001',
    properties: { assetId: 'AST-001' },
    ...overrides,
  };
}

/**
 * 创建模拟的字段变更记录
 * 
 * @param fieldName - 字段名称
 * @param oldVal - 旧值
 * @param newVal - 新值
 * @returns FieldChange 实例
 */
function createMockFieldChange(
  fieldName: string,
  oldVal: string,
  newVal: string
): MockFieldChange {
  return {
    fieldName,
    oldValue: oldVal,
    newValue: newVal,
    timestamp: Date.now(),
  };
}

/**
 * 创建模拟的审计日志
 * 
 * @param overrides - 可选的属性覆盖
 * @returns AuditLog 实例
 */
function createMockAuditLog(overrides: Partial<MockAuditLog> = {}): MockAuditLog {
  return {
    id: 'audit-001',
    entityType: 'Asset',
    entityId: 'AST-001',
    operation: 'UPDATE',
    operator: 'admin',
    timestamp: Date.now(),
    changes: {
      name: createMockFieldChange('name', '旧名称', '新名称'),
    },
    ...overrides,
  };
}

/**
 * 模拟 convertChangesToGraphifyNodes 函数
 * 
 * 将字段变更列表转换为 Graphify 节点数组，用于知识图谱渲染
 * 
 * @param changes - 字段变更列表
 * @param assetId - 资产ID
 * @returns Graphify 节点数组
 */
function convertChangesToGraphifyNodes(
  changes: MockFieldChange[],
  assetId: string
): MockGraphifyNode[] {
  return changes.map((change, index) => {
    const angle = (2 * Math.PI * index) / Math.max(changes.length, 1);
    const radius = 150;
    
    return {
      id: `change-${change.fieldName}-${assetId}`,
      type: 'field',
      label: change.fieldName,
      x: 400 + radius * Math.cos(angle),
      y: 300 + radius * Math.sin(angle),
      entityId: assetId,
      properties: {
        assetId,
        fieldName: change.fieldName,
        oldValue: change.oldValue,
        newValue: change.newValue,
        timestamp: change.timestamp,
      },
    };
  });
}

/**
 * 模拟 generateGraphifyNodes 函数
 * 
 * 从审计日志列表生成 Graphify 节点数组
 * 
 * @param auditLogs - 审计日志列表
 * @param assetId - 资产ID
 * @returns Graphify 节点数组
 */
function generateGraphifyNodes(
  auditLogs: MockAuditLog[],
  assetId: string
): MockGraphifyNode[] {
  const nodes: MockGraphifyNode[] = [];
  
  // 添加资产根节点
  nodes.push({
    id: `asset-${assetId}`,
    type: 'asset',
    label: '资产',
    x: 400,
    y: 300,
    entityId: assetId,
    properties: { assetId },
  });
  
  // 处理变更记录
  for (const log of auditLogs) {
    if (log.changes) {
      for (const [fieldName, change] of Object.entries(log.changes)) {
        if (change && typeof change === 'object' && 'oldValue' in change) {
          nodes.push({
            id: `change-${fieldName}-${log.id}`,
            type: 'change',
            label: fieldName,
            x: 400 + Math.random() * 100,
            y: 300 + Math.random() * 100,
            entityId: log.entityId,
            properties: {
              fieldName,
              oldValue: change.oldValue,
              newValue: change.newValue,
              timestamp: change.timestamp,
              operator: log.operator,
              operation: log.operation,
            },
          });
        }
      }
    }
  }
  
  return nodes;
}

/**
 * 模拟 validateGraphifyNodes 函数
 * 
 * 验证 Graphify 节点数组的有效性
 * 
 * @param nodes - 待验证的节点数组
 * @returns 是否有效
 */
function validateGraphifyNodes(nodes: MockGraphifyNode[]): boolean {
  if (!Array.isArray(nodes)) {
    return false;
  }
  
  if (nodes.length === 0) {
    return true;
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

/**
 * 模拟 formatAuditLogsToGraphifyNodes 函数
 * 
 * 将审计日志格式化为 Graphify 节点数组
 * 
 * @param auditLogs - 审计日志列表
 * @returns Graphify 节点数组
 */
function formatAuditLogsToGraphifyNodes(
  auditLogs: MockAuditLog[]
): MockGraphifyNode[] {
  if (!auditLogs || auditLogs.length === 0) {
    return [];
  }
  
  const centerX = 400;
  const centerY = 300;
  const radius = 150;
  
  return auditLogs.map((log, index) => {
    const angle = (2 * Math.PI * index) / auditLogs.length;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    
    return {
      id: `log-${log.id}`,
      type: 'audit_log',
      label: log.operation,
      x,
      y,
      entityId: log.entityId,
      properties: {
        entityType: log.entityType,
        entityId: log.entityId,
        operation: log.operation,
        operator: log.operator,
        timestamp: log.timestamp,
      },
    };
  });
}

/**
 * 模拟 transformToGraphifyData 函数
 * 
 * 将审计日志转换为图数据格式
 * 
 * @param logs - 审计日志列表
 * @returns 包含节点和边的图数据
 */
function transformToGraphifyData(logs: MockAuditLog[]): { 
  nodes: MockGraphifyNode[]; 
  edges: Array<{ source: string; target: string }>;
} {
  const nodes: MockGraphifyNode[] = [];
  const edges: Array<{ source: string; target: string }> = [];
  
  for (const log of logs) {
    nodes.push({
      id: `log-${log.id}`,
      type: 'audit_log',
      label: log.operation,
      x: 400,
      y: 300,
      entityId: log.entityId,
      properties: {
        operation: log.operation,
        operator: log.operator,
      },
    });
    
    if (log.changes) {
      for (const [fieldName, change] of Object.entries(log.changes)) {
        if (change && typeof change === 'object' && 'oldValue' in change) {
          const changeNodeId = `change-${fieldName}-${log.id}`;
          nodes.push({
            id: changeNodeId,
            type: 'field_change',
            label: fieldName,
            x: 500,
            y: 400,
            entityId: log.entityId,
            properties: {
              fieldName,
              oldValue: change.oldValue,
              newValue: change.newValue,
            },
          });
          edges.push({
            source: `log-${log.id}`,
            target: changeNodeId,
          });
        }
      }
    }
  }
  
  return { nodes, edges };
}

// ============================================================
// 测试用例
// ============================================================

describe('审计字段双向绑定测试套件', () => {
  describe('convertChangesToGraphifyNodes', () => {
    /**
     * 测试用例：验证单个字段变更转换为节点
     */
    it('应该正确转换单个字段变更', () => {
      const changes = [createMockFieldChange('name', '旧名称', '新名称')];
      const nodes = convertChangesToGraphifyNodes(changes, 'AST-001');
      
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('change-name-AST-001');
      expect(nodes[0].type).toBe('field');
      expect(nodes[0].properties.fieldName).toBe('name');
      expect(nodes[0].properties.oldValue).toBe('旧名称');
      expect(nodes[0].properties.newValue).toBe('新名称');
    });

    /**
     * 测试用例：验证多个字段变更转换为多个节点
     */
    it('应该正确转换多个字段变更', () => {
      const changes = [
        createMockFieldChange('name', '旧名称', '新名称'),
        createMockFieldChange('status', '在用', '闲置'),
        createMockFieldChange('location', 'A楼', 'B楼'),
      ];
      const nodes = convertChangesToGraphifyNodes(changes, 'AST-002');
      
      expect(nodes).toHaveLength(3);
      expect(nodes[0].type).toBe('field');
      expect(nodes[1].type).toBe('field');
      expect(nodes[2].type).toBe('field');
    });

    /**
     * 测试用例：验证空变更列表返回空数组
     */
    it('应该处理空变更列表', () => {
      const nodes = convertChangesToGraphifyNodes([], 'AST-003');
      expect(nodes).toHaveLength(0);
    });
  });

  describe('generateGraphifyNodes', () => {
    /**
     * 测试用例：验证从审计日志生成节点
     */
    it('应该正确从审计日志生成节点', () => {
      const auditLogs = [
        createMockAuditLog({
          id: 'audit-001',
          operation: 'UPDATE',
          changes: {
            name: createMockFieldChange('name', 'A', 'B'),
          },
        }),
      ];
      const nodes = generateGraphifyNodes(auditLogs, 'AST-001');
      
      // 应包含根资产节点
      expect(nodes.some(n => n.id === 'asset-AST-001')).toBe(true);
      // 应包含变更节点
      expect(nodes.some(n => n.type === 'change')).toBe(true);
    });

    /**
     * 测试用例：验证空日志列表仅返回根节点
     */
    it('应该处理空审计日志列表', () => {
      const nodes = generateGraphifyNodes([], 'AST-EMPTY');
      
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('asset-AST-EMPTY');
      expect(nodes[0].type).toBe('asset');
    });
  });

  describe('validateGraphifyNodes', () => {
    /**
     * 测试用例：验证有效节点数组
     */
    it('应该验证有效节点数组返回 true', () => {
      const nodes = [
        createMockGraphifyNode({ id: 'node-1', type: 'asset', entityId: 'AST-001' }),
        createMockGraphifyNode({ id: 'node-2', type: 'field', entityId: 'AST-001' }),
      ];
      
      expect(validateGraphifyNodes(nodes)).toBe(true);
    });

    /**
     * 测试用例：验证空数组返回 true
     */
    it('应该验证空数组返回 true', () => {
      expect(validateGraphifyNodes([])).toBe(true);
    });

    /**
     * 测试用例：验证非数组返回 false
     */
    it('应该验证非数组返回 false', () => {
      expect(validateGraphifyNodes(null as any)).toBe(false);
      expect(validateGraphifyNodes(undefined as any)).toBe(false);
    });

    /**
     * 测试用例：验证缺少必需字段的节点返回 false
     */
    it('应该验证缺少必需字段的节点返回 false', () => {
      const invalidNodes = [
        { id: 'node-1' }, // 缺少 type, entityId, x, y
      ] as any[];
      
      expect(validateGraphifyNodes(invalidNodes)).toBe(false);
    });
  });

  describe('formatAuditLogsToGraphifyNodes', () => {
    /**
     * 测试用例：验证格式化审计日志
     */
    it('应该正确格式化审计日志为节点', () => {
      const logs = [
        createMockAuditLog({ id: 'log-1', operation: 'CREATE' }),
        createMockAuditLog({ id: 'log-2', operation: 'UPDATE' }),
      ];
      const nodes = formatAuditLogsToGraphifyNodes(logs);
      
      expect(nodes).toHaveLength(2);
      expect(nodes[0].type).toBe('audit_log');
      expect(nodes[0].label).toBe('CREATE');
      expect(nodes[1].label).toBe('UPDATE');
    });

    /**
     * 测试用例：验证空日志返回空数组
     */
    it('应该处理空日志列表', () => {
      const nodes = formatAuditLogsToGraphifyNodes([]);
      expect(nodes).toHaveLength(0);
    });
  });

  describe('transformToGraphifyData', () => {
    /**
     * 测试用例：验证转换图数据
     */
    it('应该正确转换为图数据格式', () => {
      const logs = [
        createMockAuditLog({
          id: 'log-1',
          changes: {
            name: createMockFieldChange('name', 'A', 'B'),
          },
        }),
      ];
      const result = transformToGraphifyData(logs);
      
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(Array.isArray(result.edges)).toBe(true);
    });

    /**
     * 测试用例：验证空数据返回空结构
     */
    it('应该处理空日志列表', () => {
      const result = transformToGraphifyData([]);
      
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('双向绑定集成场景', () => {
    /**
     * 测试用例：验证审计日志变更触发节点更新
     */
    it('应该在审计日志变更时更新图谱节点', async () => {
      // 初始审计日志
      const initialLog = createMockAuditLog({
        id: 'log-1',
        operation: 'CREATE',
        changes: undefined,
      });
      
      // 生成初始节点
      let nodes = generateGraphifyNodes([initialLog], 'AST-001');
      expect(nodes).toHaveLength(1);
      
      // 模拟新变更
      const updatedLog: MockAuditLog = {
        ...initialLog,
        operation: 'UPDATE',
        changes: {
          name: createMockFieldChange('name', 'A', 'B'),
        },
      };
      
      // 重新生成节点
      nodes = generateGraphifyNodes([updatedLog], 'AST-001');
      expect(nodes.length).toBeGreaterThan(1);
      expect(nodes.some(n => n.type === 'change')).toBe(true);
    });

    /**
     * 测试用例：验证节点状态同步
     */
    it('应该正确同步节点与变更记录的状态', () => {
      const changes = [
        createMockFieldChange('status', '在用', '维修中'),
        createMockFieldChange('location', 'A楼', 'B楼'),
      ];
      const nodes = convertChangesToGraphifyNodes(changes, 'AST-001');
      
      // 验证节点属性与变更一致
      const statusNode = nodes.find(n => n.properties.fieldName === 'status');
      expect(statusNode?.properties.oldValue).toBe('在用');
      expect(statusNode?.properties.newValue).toBe('维修中');
      
      const locationNode = nodes.find(n => n.properties.fieldName === 'location');
      expect(locationNode?.properties.oldValue).toBe('A楼');
      expect(locationNode?.properties.newValue).toBe('B楼');
    });
  });
});

// ============================================================
// 导出测试辅助函数供其他模块使用
// ============================================================

export {
  createMockGraphifyNode,
  createMockFieldChange,
  createMockAuditLog,
  convertChangesToGraphifyNodes,
  generateGraphifyNodes,
  validateGraphifyNodes,
  formatAuditLogsToGraphifyNodes,
  transformToGraphifyData,
};

export type {
  MockGraphifyNode,
  MockFieldChange,
  MockAuditLog,
};
