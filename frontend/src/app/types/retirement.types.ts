/**
 * 资产退役/报废流程类型定义
 * @module retirement.types
 * @description 定义资产报废/退役相关的 TypeScript 类型、枚举和接口
 */

import type { User } from './user.types';

/**
 * 资产退役状态枚举
 * 状态流转: NORMAL -> RETIRING -> RETIRED
 */
export enum RetirementStatus {
  /** 正常状态 */
  NORMAL = 'NORMAL',
  /** 退役中 - 已提交报废申请，待审批 */
  RETIRING = 'RETIRING',
  /** 已报废 - 退役申请已通过，资产已退出使用 */
  RETIRED = 'RETIRED',
}

/**
 * 退役申请操作类型枚举
 */
export enum RetirementAction {
  /** 发起报废申请 */
  INITIATE = 'INITIATE',
  /** 审批通过 */
  APPROVE = 'APPROVE',
  /** 审批驳回 */
  REJECT = 'REJECT',
  /** 取消申请 */
  CANCEL = 'CANCEL',
}

/**
 * 报废原因枚举
 */
export enum RetirementReason {
  /** 设备老化 */
  EQUIPMENT_AGING = 'EQUIPMENT_AGING',
  /** 损坏无法修复 */
  DAMAGE_UNREPAIRABLE = 'DAMAGE_UNREPAIRABLE',
  /** 技术淘汰 */
  TECHNICAL_OBSOLESCENCE = 'TECHNICAL_OBSOLESCENCE',
  /** 业务变更 */
  BUSINESS_CHANGE = 'BUSINESS_CHANGE',
  /** 超过使用年限 */
  OVER_SERVICE_LIFE = 'OVER_SERVICE_LIFE',
  /** 其他原因 */
  OTHER = 'OTHER',
}

/**
 * 退役申请基础信息
 */
export interface RetirementApplication {
  /** 退役申请唯一标识 */
  id: string;
  /** 关联资产ID */
  assetId: string;
  /** 申请单号，格式: RET-{YYYYMMDD}-{6位序号} */
  retirementNo: string;
  /** 申请人信息 */
  applicant: User;
  /** 报废原因 */
  reason: RetirementReason;
  /** 详细描述/补充说明 */
  description?: string;
  /** 当前状态 */
  status: RetirementStatus;
  /** 附件URL列表 */
  attachmentUrls?: string[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 发起报废请求参数
 */
export interface InitiateRetirementRequest {
  /** 报废原因（必填） */
  reason: RetirementReason;
  /** 详细描述（可选，最大1000字符） */
  description?: string;
  /** 备注信息（可选，最大500字符） */
  remark?: string;
  /** 附件URL列表（可选） */
  attachmentUrls?: string[];
}

/**
 * 发起报废响应
 */
export interface InitiateRetirementResponse {
  /** 退役申请ID */
  id: string;
  /** 资产ID */
  assetId: string;
  /** 资产新状态 */
  status: RetirementStatus;
  /** 退役记录ID */
  retirementRecordId: string;
  /** 申请单号 */
  retirementNo: string;
}

/**
 * 退役历史记录
 */
export interface RetirementHistoryRecord {
  /** 记录唯一标识 */
  id: string;
  /** 关联资产ID */
  assetId: string;
  /** 操作人信息 */
  operator: User;
  /** 操作类型 */
  action: RetirementAction;
  /** 变更前状态 */
  fromStatus: RetirementStatus;
  /** 变更后状态 */
  toStatus: RetirementStatus;
  /** 操作原因/说明 */
  reason?: string;
  /** 备注信息 */
  remark?: string;
  /** 操作时间 */
  createdAt: string;
}

/**
 * 退役历史查询响应
 */
export interface RetirementHistoryResponse {
  /** 历史记录列表 */
  data: RetirementHistoryRecord[];
  /** 分页信息 */
  pagination: {
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    pageSize: number;
    /** 总记录数 */
    total: number;
    /** 总页数 */
    totalPages: number;
  };
}

/**
 * 退役历史查询参数
 */
export interface RetirementHistoryQuery {
  /** 页码（默认1） */
  page?: number;
  /** 每页数量（默认20） */
  pageSize?: number;
}

/**
 * 报废原因选项（用于下拉选择）
 */
export interface RetirementReasonOption {
  /** 原因值 */
  value: RetirementReason;
  /** 显示文本 */
  label: string;
  /** 描述说明 */
  description?: string;
}

/**
 * 报废原因选项映射表
 */
export const RETIREMENT_REASON_OPTIONS: RetirementReasonOption[] = [
  {
    value: RetirementReason.EQUIPMENT_AGING,
    label: '设备老化',
    description: '设备因长期使用导致性能下降，无法满足业务需求',
  },
  {
    value: RetirementReason.DAMAGE_UNREPAIRABLE,
    label: '损坏无法修复',
    description: '设备因意外事故或人为损坏，无法修复或修复成本过高',
  },
  {
    value: RetirementReason.TECHNICAL_OBSOLESCENCE,
    label: '技术淘汰',
    description: '设备因技术更新换代，已落后于当前技术标准',
  },
  {
    value: RetirementReason.BUSINESS_CHANGE,
    label: '业务变更',
    description: '因组织架构调整或业务需求变更，资产不再需要',
  },
  {
    value: RetirementReason.OVER_SERVICE_LIFE,
    label: '超过使用年限',
    description: '设备已超过设计使用年限，建议报废处理',
  },
  {
    value: RetirementReason.OTHER,
    label: '其他原因',
    description: '上述原因之外的其他报废原因',
  },
];

/**
 * 状态显示配置
 */
export interface StatusDisplayConfig {
  /** 状态值 */
  status: RetirementStatus;
  /** 显示文本 */
  label: string;
  /** CSS类名 */
  className: string;
  /** 是否可发起报废 */
  canInitiateRetirement: boolean;
}

/**
 * 退役状态显示配置映射
 */
export const RETIREMENT_STATUS_DISPLAY: Record<RetirementStatus, StatusDisplayConfig> = {
  [RetirementStatus.NORMAL]: {
    status: RetirementStatus.NORMAL,
    label: '正常',
    className: 'status-normal',
    canInitiateRetirement: true,
  },
  [RetirementStatus.RETIRING]: {
    status: RetirementStatus.RETIRING,
    label: '退役中',
    className: 'status-retiring',
    canInitiateRetirement: false,
  },
  [RetirementStatus.RETIRED]: {
    status: RetirementStatus.RETIRED,
    label: '已报废',
    className: 'status-retired',
    canInitiateRetirement: false,
  },
};

/**
 * 报废申请表单数据
 */
export interface RetirementFormData {
  /** 报废原因（必填） */
  reason: RetirementReason;
  /** 详细描述 */
  description: string;
  /** 备注 */
  remark: string;
  /** 附件 */
  attachments: File[];
}

/**
 * 报废申请表单初始值
 */
export const INITIAL_RETIREMENT_FORM: RetirementFormData = {
  reason: RetirementReason.EQUIPMENT_AGING,
  description: '',
  remark: '',
  attachments: [],
};

/**
 * 验证报废表单
 * @param data - 表单数据
 * @returns 验证错误信息，如果验证通过返回 null
 */
export function validateRetirementForm(data: RetirementFormData): string | null {
  if (!data.reason) {
    return '请选择报废原因';
  }

  if (data.description && data.description.length > 1000) {
    return '详细描述不能超过1000字符';
  }

  if (data.remark && data.remark.length > 500) {
    return '备注信息不能超过500字符';
  }

  return null;
}