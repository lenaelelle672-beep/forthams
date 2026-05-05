import { ref, computed, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import type { AuditLog, FieldChange } from '../types/audit.types';
import type { GraphifyNode } from '@/hooks/useAuditLog';

/**
 * 字段严重程度计算枚举
 */
enum ChangeSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * 字段配置接口
 */
interface FieldConfig {
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  severity: ChangeSeverity;
}

/**
 * 字段配置映射表
 * 用于 Graphify 节点生成时的字段元数据关联
 */
const FIELD_CONFIG_MAP: Record<string, FieldConfig> = {
  assetName: { label: '资产名称', type: 'text', severity: ChangeSeverity.HIGH },
  assetCode: { label: '资产编码', type: 'text', severity: ChangeSeverity.MEDIUM },
  categoryId: { label: '资产分类', type: 'select', severity: ChangeSeverity.MEDIUM },
  locationId: { label: '存放地点', type: 'select', severity: ChangeSeverity.MEDIUM },
  custodianId: { label: '保管人', type: 'select', severity: ChangeSeverity.HIGH },
  status: { label: '资产状态', type: 'select', severity: ChangeSeverity.CRITICAL },
  purchaseDate: { label: '购置日期', type: 'date', severity: ChangeSeverity.LOW },
  purchasePrice: { label: '购置价格', type: 'number', severity: ChangeSeverity.MEDIUM },
  currentValue: { label: '当前价值', type: 'number', severity: ChangeSeverity.MEDIUM },
  depreciationRate: { label: '折旧率', type: 'number', severity: ChangeSeverity.LOW },
  serialNumber: { label: '序列号', type: 'text', severity: ChangeSeverity.MEDIUM },
  manufacturer: { label: '制造商', type: 'text', severity: ChangeSeverity.LOW },
  model: { label: '型号', type: 'text', severity: ChangeSeverity.LOW },
  vendorId: { label: '供应商', type: 'select', severity: ChangeSeverity.LOW },
  departmentId: { label: '所属部门', type: 'select', severity: ChangeSeverity.HIGH },
  maintenanceCycle: { label: '维护周期', type: 'number', severity: ChangeSeverity.LOW },
  nextMaintenanceDate: { label: '下次维护日期', type: 'date', severity: ChangeSeverity.MEDIUM },
  description: { label: '描述', type: 'text', severity: ChangeSeverity.LOW },
};

/**
 * 获取字段配置
 * 安全处理不存在的字段名
 * @param fieldName - 字段名称
 * @returns 字段配置，如果不存在返回默认配置
 */
function getFieldConfig(fieldName: string): FieldConfig {
  if (!fieldName || typeof fieldName !== 'string') {
    return {
      label: '未知字段',
      type: 'text',
      severity: ChangeSeverity.LOW,
    };
  }
  return FIELD_CONFIG_MAP[fieldName] || {
    label: fieldName,
    type: 'text',
    severity: ChangeSeverity.LOW,
  };
}

/**
 * 计算变更严重程度
 * 基于变更字段类型和变更值差异进行评估
 * @param fieldName - 变更字段名称
 * @param oldValue - 变更前值
 * @param newValue - 变更后值
 * @returns 严重程度枚举值
 */
function calculateChangeSeverity(
  fieldName: string,
  oldValue: unknown,
  newValue: unknown
): ChangeSeverity {
  const config = getFieldConfig(fieldName);

  // 基础严重程度来自字段配置
  let severity = config.severity;

  // 如果值发生实质性变化，提升严重程度
  if (oldValue !== newValue) {
    // 空值到有值的转换视为高风险
    if (oldValue === null || oldValue === undefined || oldValue === '') {
      severity = ChangeSeverity.HIGH;
    }
    // 有值到空值的转换视为高风险
    if (newValue === null || newValue === undefined || newValue === '') {
      severity = ChangeSeverity.HIGH;
    }
  }

  return severity;
}

/**
 * 安全获取变更值
 * 防止 null/undefined 导致异常
 * @param value - 变更值
 * @returns 安全处理后的值
 */
function safeGetValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * 将字段变更转换为 Graphify 节点数组
 * 用于知识图谱可视化展示
 *
 * @example
 * const changes: FieldChange[] = [
 *   { fieldName: 'assetName', oldValue: '旧名称', newValue: '新名称' },
 *   { fieldName: 'status', oldValue: '在用', newValue: '维修中' }
 * ];
 * const nodes = convertChangesToGraphifyNodes(changes, 'AST-2024-001');
 * // 返回可直接用于 GraphifyKnowledgeGraph 组件的节点数据
 *
 * @param changes - 字段变更列表
 * @param assetId - 资产唯一标识
 * @returns GraphifyNode 数组，用于知识图谱渲染
 */
export function convertChangesToGraphifyNodes(
  changes: FieldChange[],
  assetId: string
): GraphifyNode[] {
  // ATB-BC-007: 空数组输入 → 返回 []
  // ATB-BC-008: 非法 fieldName → 跳过或默认处理
  if (!Array.isArray(changes)) {
    return [];
  }

  if (changes.length === 0) {
    return [];
  }

  // ATB-EX-004: fieldName 映射失败处理 - getFieldConfig 已做防御
  // 计算节点布局参数（力导向布局简化版）
  const centerX = 400;
  const centerY = 300;
  const radius = 150;
  const totalNodes = changes.length;

  return changes.map((change, index) => {
    // 防御性检查：确保 change 对象有效
    if (!change || typeof change !== 'object') {
      return null;
    }

    // ATB-BC-008: 非法 fieldName 处理
    const fieldName = change.fieldName;
    if (!fieldName || typeof fieldName !== 'string') {
      // 跳过无效字段名
      return null;
    }

    // 获取字段配置（内部已做防御）
    const config = getFieldConfig(fieldName);

    // 计算变更严重程度（内部已做防御）
    const severity = calculateChangeSeverity(
      fieldName,
      change.oldValue,
      change.newValue
    );

    // 计算节点位置（圆形布局）
    const angle = (2 * Math.PI * index) / totalNodes;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    // 安全获取变更值
    const oldValueStr = safeGetValue(change.oldValue);
    const newValueStr = safeGetValue(change.newValue);

    return {
      id: `field-${assetId}-${fieldName}`,
      type: 'field',
      label: config.label,
      severity: severity,
      properties: {
        fieldName,
        oldValue: oldValueStr,
        newValue: newValueStr,
        changeType: oldValueStr && newValueStr ? 'modify' : (!oldValueStr ? 'add' : 'remove'),
      },
      x,
      y,
    };
  }).filter((node): node is GraphifyNode => node !== null);
}

/**
 * 验证 Graphify 节点数据格式
 * 用于数据入库前的前置校验
 *
 * @example
 * const nodes = convertChangesToGraphifyNodes(changes, 'AST-2024-001');
 * const isValid = validateGraphifyNodes(nodes);
 * if (!isValid) {
 *   console.error('节点数据格式错误');
 * }
 *
 * @param nodes - Graphify 节点数组
 * @returns 验证结果：true 表示数据格式有效
 */
export function validateGraphifyNodes(nodes: GraphifyNode[]): boolean {
  // ATB-BC-003: 非数组输入 → 返回 false
  // ATB-EX-002: 嵌套数组传入（伪数组）→ Array.isArray 检查
  if (!Array.isArray(nodes)) {
    return false;
  }

  if (nodes.length === 0) {
    return true; // 空数组是有效的
  }

  // 检查必需字段
  return nodes.every(
    (node) =>
      node &&
      typeof node === 'object' &&
      typeof node.id === 'string' &&
      node.id.length > 0 &&
      typeof node.type === 'string' &&
      node.type.length > 0 &&
      typeof node.label === 'string' &&
      node.label.length > 0 &&
      typeof node.severity === 'string' &&
      // ATB-BC-004: 包含无效字段的节点 → 返回 false
      (node.severity === ChangeSeverity.CRITICAL ||
        node.severity === ChangeSeverity.HIGH ||
        node.severity === ChangeSeverity.MEDIUM ||
        node.severity === ChangeSeverity.LOW) &&
      typeof node.x === 'number' &&
      !isNaN(node.x) &&
      typeof node.y === 'number' &&
      !isNaN(node.y)
  );
}

/**
 * useAuditableFields 组合式函数
 * 提供资产字段变更追踪功能
 *
 * @param assetIdRef - 资产ID响应式引用
 * @returns 包含字段配置、变更检测等逻辑的组合式函数
 */
export function useAuditableFields(
  assetIdRef: Ref<string>
) {
  const { t } = useI18n();
  const route = useRoute();

  // 当前资产的审计日志
  const auditLogs = ref<AuditLog[]>([]);

  // 可审计字段配置列表
  const auditableFields = computed(() => {
    return Object.entries(FIELD_CONFIG_MAP).map(([key, config]) => ({
      fieldName: key,
      label: config.label,
      type: config.type,
    }));
  });

  // 获取字段变更历史
  const getFieldChanges = (fieldName: string): FieldChange[] => {
    const changes: FieldChange[] = [];

    for (const log of auditLogs.value) {
      if (log.changes && log.changes[fieldName]) {
        const change = log.changes[fieldName];
        if (change && typeof change === 'object' && 'oldValue' in change) {
          changes.push({
            fieldName,
            oldValue: change.oldValue,
            newValue: change.newValue,
            timestamp: log.timestamp,
          });
        }
      }
    }

    return changes;
  };

  // 获取所有变更记录
  const getAllChanges = (): FieldChange[] => {
    const allChanges: FieldChange[] = [];

    for (const log of auditLogs.value) {
      if (log.changes) {
        for (const [fieldName, change] of Object.entries(log.changes)) {
          if (change && typeof change === 'object' && 'oldValue' in change) {
            allChanges.push({
              fieldName,
              oldValue: change.oldValue,
              newValue: change.newValue,
              timestamp: log.timestamp,
            });
          }
        }
      }
    }

    return allChanges;
  };

  // 生成 Graphify 知识图谱节点（带防御性检查）
  const generateGraphifyNodesFromChanges = (): GraphifyNode[] => {
    const changes = getAllChanges();

    // 防御性处理：确保输入有效
    if (!Array.isArray(changes) || changes.length === 0) {
      return [];
    }

    const nodes = convertChangesToGraphifyNodes(changes, assetIdRef.value);

    // 验证生成的节点
    if (!validateGraphifyNodes(nodes)) {
      console.warn('生成的 Graphify 节点数据格式验证失败，已过滤无效节点');
      return nodes.filter(node =>
        node &&
        typeof node.id === 'string' &&
        typeof node.type === 'string'
      );
    }

    return nodes;
  };

  // 监听资产ID变化，重新获取审计日志
  watch(
    assetIdRef,
    async (newAssetId) => {
      if (newAssetId) {
        // TODO: 从 API 加载审计日志
        // const response = await fetchAuditLogs(newAssetId);
        // auditLogs.value = response.data;
      }
    },
    { immediate: true }
  );

  return {
    auditLogs,
    auditableFields,
    getFieldChanges,
    getAllChanges,
    generateGraphifyNodesFromChanges,
    validateGraphifyNodes,
    convertChangesToGraphifyNodes,
    getFieldConfig,
    calculateChangeSeverity,
  };
}

export type { FieldConfig, ChangeSeverity };