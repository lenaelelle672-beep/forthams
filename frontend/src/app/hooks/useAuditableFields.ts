/**
 * useAuditableFields Hook - 可审计字段管理
 * 
 * 提供可审计字段的注册、变更检测与 Graphify 节点转换功能
 * 用于审批流程中的字段变更追踪
 * 
 * @module hooks/useAuditableFields
 * @requires types/audit.types
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import type { 
  FieldChange, 
  ChangeSeverity, 
  GraphifyNode,
  AuditableFieldConfig 
} from '../types/audit.types';

/**
 * 字段配置映射表
 */
const fieldConfigMap: Map<string, AuditableFieldConfig> = new Map();

/**
 * 注册可审计字段配置
 * 
 * @param fieldName - 字段名称
 * @param config - 字段配置
 * @example
 * ```ts
 * registerFieldConfig('assetName', {
 *   label: '资产名称',
 *   type: 'text',
 *   auditable: true
 * });
 * ```
 */
export function registerFieldConfig(
  fieldName: string,
  config: AuditableFieldConfig
): void {
  fieldConfigMap.set(fieldName, config);
}

/**
 * 获取字段配置
 * 
 * @param fieldName - 字段名称
 * @returns 字段配置或 undefined
 * @example
 * ```ts
 * const config = getFieldConfig('assetName');
 * if (config) {
 *   console.log(config.label); // '资产名称'
 * }
 * ```
 */
export function getFieldConfig(fieldName: string): AuditableFieldConfig | undefined {
  return fieldConfigMap.get(fieldName);
}

/**
 * 计算变更严重性等级
 * 
 * @param fieldName - 字段名称
 * @param oldValue - 旧值
 * @param newValue - 新值
 * @returns 变更严重性
 * @example
 * ```ts
 * const severity = calculateChangeSeverity('assetValue', '1000', '2000');
 * // Returns: 'HIGH' (数值变化超过50%)
 * ```
 */
export function calculateChangeSeverity(
  fieldName: string,
  oldValue: string | null,
  newValue: string | null
): ChangeSeverity {
  if (!oldValue && newValue) return 'HIGH';
  if (oldValue && !newValue) return 'MEDIUM';
  
  const oldNum = parseFloat(oldValue || '0');
  const newNum = parseFloat(newValue || '0');
  
  if (oldNum === 0) {
    return newNum > 0 ? 'HIGH' : 'LOW';
  }
  
  const changeRate = Math.abs((newNum - oldNum) / oldNum);
  
  if (changeRate > 0.5) return 'HIGH';
  if (changeRate > 0.2) return 'MEDIUM';
  return 'LOW';
}

/**
 * 检测字段变更
 * 
 * @param oldData - 旧数据对象
 * @param newData - 新数据对象
 * @param auditableFields - 可审计字段列表
 * @returns 变更列表
 * @example
 * ```ts
 * const changes = detectFieldChanges(
 *   { name: '资产A', value: 1000 },
 *   { name: '资产A', value: 2000 },
 *   ['name', 'value']
 * );
 * // Returns: [{ fieldName: 'value', oldValue: '1000', newValue: '2000' }]
 * ```
 */
export function detectFieldChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  auditableFields: string[]
): FieldChange[] {
  const changes: FieldChange[] = [];
  
  for (const field of auditableFields) {
    const oldValue = oldData[field];
    const newValue = newData[field];
    
    if (!Object.is(oldValue, newValue)) {
      changes.push({
        fieldName: field,
        oldValue: oldValue != null ? String(oldValue) : null,
        newValue: newValue != null ? String(newValue) : null,
        timestamp: Date.now()
      });
    }
  }
  
  return changes;
}

/**
 * 转换变更记录为 Graphify 节点
 * 
 * 将字段变更列表转换为可用于 Graphify 知识图谱组件渲染的节点数据格式。
 * 每个变更会生成一个独立的节点，包含变更的详细信息和空间位置。
 * 
 * @param changes - 字段变更列表
 * @param assetId - 资产ID，用于关联节点与资产
 * @returns Graphify 节点数组
 * @example
 * ```ts
 * const changes: FieldChange[] = [
 *   { fieldName: 'assetValue', oldValue: '1000', newValue: '2000', timestamp: Date.now() }
 * ];
 * const nodes = convertChangesToGraphifyNodes(changes, 'AST-2024-001');
 * // Returns: [{ id: 'change-0', label: '资产价值变更', type: 'change', ... }]
 * ```
 */
export function convertChangesToGraphifyNodes(
  changes: FieldChange[],
  assetId: string
): Array<{
  id: string;
  label: string;
  type: string;
  severity: ChangeSeverity;
  oldValue: string;
  newValue: string;
  timestamp: number;
  assetId: string;
}> {
  if (!changes || changes.length === 0) {
    return [];
  }

  const nodes: Array<{
    id: string;
    label: string;
    type: string;
    severity: ChangeSeverity;
    oldValue: string;
    newValue: string;
    timestamp: number;
    assetId: string;
  }> = [];

  const centerX = 400;
  const centerY = 300;
  const radius = 150;

  // 添加资产根节点
  nodes.push({
    id: `asset-${assetId}`,
    label: '资产',
    type: 'asset',
    severity: 'LOW',
    oldValue: '',
    newValue: assetId,
    timestamp: Date.now(),
    assetId
  });

  // 为每个变更创建节点
  changes.forEach((change, index) => {
    const config = getFieldConfig(change.fieldName);
    const severity = calculateChangeSeverity(
      change.fieldName,
      change.oldValue,
      change.newValue
    );

    const angle = (2 * Math.PI * index) / Math.max(changes.length, 1);
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    nodes.push({
      id: `change-${index}-${change.fieldName}`,
      label: config?.label || change.fieldName,
      type: 'change',
      severity,
      oldValue: change.oldValue || '',
      newValue: change.newValue || '',
      timestamp: change.timestamp,
      assetId
    });
  });

  return nodes;
}

/**
 * useAuditableFields 组合式函数
 * 
 * 提供响应式的可审计字段管理功能
 * 
 * @param initialFields - 初始字段配置列表
 * @returns 可审计字段管理接口
 * @example
 * ```ts
 * const {
 *   fields,
 *   changes,
 *   addField,
 *   detectChanges
 * } = useAuditableFields(['assetName', 'assetValue']);
 * ```
 */
export function useAuditableFields(initialFields: string[] = []) {
  const auditableFields: Ref<string[]> = ref([...initialFields]);
  const fieldChanges: Ref<FieldChange[]> = ref([]);
  const previousData: Ref<Record<string, unknown> | null> = ref(null);

  /**
   * 添加可审计字段
   */
  const addField = (fieldName: string): void => {
    if (!auditableFields.value.includes(fieldName)) {
      auditableFields.value.push(fieldName);
    }
  };

  /**
   * 移除可审计字段
   */
  const removeField = (fieldName: string): void => {
    const index = auditableFields.value.indexOf(fieldName);
    if (index > -1) {
      auditableFields.value.splice(index, 1);
    }
  };

  /**
   * 检测数据变更
   */
  const detectChanges = (
    newData: Record<string, unknown>
  ): FieldChange[] => {
    if (!previousData.value) {
      previousData.value = { ...newData };
      return [];
    }

    const changes = detectFieldChanges(
      previousData.value,
      newData,
      auditableFields.value
    );

    fieldChanges.value = changes;
    previousData.value = { ...newData };

    return changes;
  };

  /**
   * 转换为 Graphify 节点
   */
  const toGraphifyNodes = (assetId: string): GraphifyNode[] => {
    return convertChangesToGraphifyNodes(fieldChanges.value, assetId) as unknown as GraphifyNode[];
  };

  /**
   * 清除变更记录
   */
  const clearChanges = (): void => {
    fieldChanges.value = [];
  };

  /**
   * 是否有变更
   */
  const hasChanges: ComputedRef<boolean> = computed(
    () => fieldChanges.value.length > 0
  );

  return {
    auditableFields,
    fieldChanges,
    addField,
    removeField,
    detectChanges,
    toGraphifyNodes,
    clearChanges,
    hasChanges
  };
}

export default useAuditableFields;