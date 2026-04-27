/**
 * 审计字段映射配置 (auditableFieldMap.ts)
 * 
 * 定义资产详情页中可审计字段的映射关系，供操作日志仪表板使用。
 * 修复了节点匹配问题，确保 Graphify 知识图谱能正确显示审计节点。
 * 
 * @since 1.0.0
 * @module auditableFieldMap
 * @see {@link https://docs.example.com/audit-field-mapping}
 */

export interface AuditableFieldConfig {
  /** 字段键名 */
  fieldKey: string;
  /** 显示标签 */
  label: string;
  /** 字段类型 */
  type: 'string' | 'number' | 'date' | 'enum' | 'boolean' | 'relation';
  /** 是否高风险字段（影响安全级别） */
  isHighRisk: boolean;
  /** 可选值枚举（当 type 为 enum 时） */
  enumValues?: string[];
  /** 关联实体类型（当 type 为 relation 时） */
  relatedEntity?: string;
}

/**
 * 资产详情页可审计字段映射表
 * 
 * @example
 * ```typescript
 * const config = auditableFieldMap['assetName'];
 * console.log(config.label); // "资产名称"
 * ```
 */
export const auditableFieldMap: Record<string, AuditableFieldConfig> = {
  // === 基础信息字段 ===
  assetName: {
    fieldKey: 'assetName',
    label: '资产名称',
    type: 'string',
    isHighRisk: false,
  },
  assetCode: {
    fieldKey: 'assetCode',
    label: '资产编码',
    type: 'string',
    isHighRisk: false,
  },
  serialNumber: {
    fieldKey: 'serialNumber',
    label: '序列号',
    type: 'string',
    isHighRisk: true,
  },
  
  // === 状态与分类字段 ===
  status: {
    fieldKey: 'status',
    label: '资产状态',
    type: 'enum',
    isHighRisk: true,
    enumValues: ['idle', 'in_use', 'maintenance', 'retired', 'scrapped'],
  },
  categoryId: {
    fieldKey: 'categoryId',
    label: '资产分类',
    type: 'relation',
    isHighRisk: false,
    relatedEntity: 'AssetCategory',
  },
  locationId: {
    fieldKey: 'locationId',
    label: '存放地点',
    type: 'relation',
    isHighRisk: false,
    relatedEntity: 'Location',
  },
  
  // === 财务字段 ===
  purchasePrice: {
    fieldKey: 'purchasePrice',
    label: '购置价格',
    type: 'number',
    isHighRisk: true,
  },
  currentValue: {
    fieldKey: 'currentValue',
    label: '当前价值',
    type: 'number',
    isHighRisk: true,
  },
  depreciationMethod: {
    fieldKey: 'depreciationMethod',
    label: '折旧方法',
    type: 'enum',
    isHighRisk: true,
    enumValues: ['straight_line', 'double_declining', 'units_of_production'],
  },
  
  // === 人员关联字段 ===
  custodianId: {
    fieldKey: 'custodianId',
    label: '保管人',
    type: 'relation',
    isHighRisk: true,
    relatedEntity: 'User',
  },
  departmentId: {
    fieldKey: 'departmentId',
    label: '所属部门',
    type: 'relation',
    isHighRisk: false,
    relatedEntity: 'Department',
  },
  vendorId: {
    fieldKey: 'vendorId',
    label: '供应商',
    type: 'relation',
    isHighRisk: false,
    relatedEntity: 'Vendor',
  },
  
  // === 安全敏感字段 ===
  password: {
    fieldKey: 'password',
    label: '密码',
    type: 'string',
    isHighRisk: true, // ATB-BC-001: 高风险字段，需脱敏
  },
  apiKey: {
    fieldKey: 'apiKey',
    label: 'API密钥',
    type: 'string',
    isHighRisk: true,
  },
  encryptionKey: {
    fieldKey: 'encryptionKey',
    label: '加密密钥',
    type: 'string',
    isHighRisk: true,
  },
  
  // === 运维字段 ===
  maintenanceInterval: {
    fieldKey: 'maintenanceInterval',
    label: '维护周期(天)',
    type: 'number',
    isHighRisk: false,
  },
  lastMaintenanceDate: {
    fieldKey: 'lastMaintenanceDate',
    label: '最后维护日期',
    type: 'date',
    isHighRisk: false,
  },
  nextMaintenanceDate: {
    fieldKey: 'nextMaintenanceDate',
    label: '下次维护日期',
    type: 'date',
    isHighRisk: false,
  },
  
  // === 退役相关字段 ===
  retirementDate: {
    fieldKey: 'retirementDate',
    label: '退役日期',
    type: 'date',
    isHighRisk: true,
  },
  retirementReason: {
    fieldKey: 'retirementReason',
    label: '退役原因',
    type: 'string',
    isHighRisk: true,
  },
  disposalMethod: {
    fieldKey: 'disposalMethod',
    label: '处置方式',
    type: 'enum',
    isHighRisk: true,
    enumValues: ['sale', 'scrapped', 'recycled', 'donated'],
  },
};

/**
 * 获取高风险字段列表
 * 
 * @returns 高风险字段配置数组
 * @since 1.0.0
 * @performance 时间复杂度 O(n)，n 为字段总数
 * 
 * @example
 * ```typescript
 * const highRiskFields = getHighRiskFields();
 * console.log(highRiskFields.map(f => f.label));
 * // ['序列号', '资产状态', '购置价格', ...]
 * ```
 */
export function getHighRiskFields(): AuditableFieldConfig[] {
  return Object.values(auditableFieldMap).filter(config => config.isHighRisk);
}

/**
 * 根据字段类型获取映射配置
 * 
 * @param type - 字段类型
 * @returns 指定类型的字段配置数组
 * @since 1.0.0
 * @performance 时间复杂度 O(n)
 */
export function getFieldsByType(type: AuditableFieldConfig['type']): AuditableFieldConfig[] {
  return Object.values(auditableFieldMap).filter(config => config.type === type);
}

/**
 * 验证字段键是否在映射表中
 * 
 * @param fieldKey - 待验证的字段键
 * @returns 是否存在
 * @since 1.0.0
 * @performance 时间复杂度 O(1)
 */
export function isFieldAuditable(fieldKey: string): boolean {
  return fieldKey in auditableFieldMap;
}

/**
 * 获取字段的风险等级
 * 
 * @param fieldKey - 字段键
 * @returns 风险等级: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
 * @since 1.0.0
 * @performance 时间复杂度 O(1)
 */
export function getFieldRiskLevel(fieldKey: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const config = auditableFieldMap[fieldKey];
  if (!config) return 'LOW';
  
  // ATB-003: 根据字段重要性动态评估风险等级
  const highRiskFields: Record<string, 'CRITICAL' | 'HIGH'> = {
    password: 'CRITICAL',
    encryptionKey: 'CRITICAL',
    apiKey: 'HIGH',
    retirementReason: 'HIGH',
  };
  
  return highRiskFields[fieldKey] ?? (config.isHighRisk ? 'HIGH' : 'LOW');
}

export default auditableFieldMap;