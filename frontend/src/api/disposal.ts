/**
 * @file api/disposal.ts
 * @description 资产处置 API（报废/转移/清退/赔偿）
 * 对应后端：DisposalController (/disposals)、CompensationController (/compensation)
 *
 * 转移、清退、报废和赔偿均由对应业务端点创建，并由后端冻结审批流程。
 */

import http from '@/utils/http';
import type { PageData } from '@/types/common';

export type DisposalType = 'TRANSFER' | 'CLEARANCE' | 'SCRAP';
export type DisposalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'CANCELLED_REQUIRES_RESUBMISSION';

export const DISPOSAL_RESUBMISSION_STATUS = 'CANCELLED_REQUIRES_RESUBMISSION';

export const DISPOSAL_RESUBMISSION_HINT =
  '该处置单因处理人缺失被取消，需要重提或恢复。请基于原申请信息新建处置申请，系统会在提交时生成新的处理人快照。';

export function isDisposalResubmissionStatus(status: string | undefined): boolean {
  return status === DISPOSAL_RESUBMISSION_STATUS;
}

export interface Disposal {
  id: number;
  assetId: number;
  assetNo?: string;
  assetName?: string;
  applicationNo?: string;
  type: DisposalType;
  status: DisposalStatus;
  reason?: string;
  applicantName?: string;
  createdAt: string;
}

export interface DisposalListQuery {
  page?: number;
  pageSize?: number;
  type?: DisposalType;
  status?: DisposalStatus;
  keyword?: string;
}

export interface BatchApplicationSuccess<T> {
  assetId: number;
  response: T;
}

export interface BatchApplicationFailure {
  assetId: number;
  reason: unknown;
}

export interface BatchApplicationResult<T> {
  successes: BatchApplicationSuccess<T>[];
  failures: BatchApplicationFailure[];
}

type ApiRecord = Record<string, unknown>;

function isApiRecord(value: unknown): value is ApiRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireApiRecord(value: unknown, label: string): ApiRecord {
  if (!isApiRecord(value)) {
    throw new Error(`${label}响应格式无效`);
  }
  return value;
}

function readOptionalString(record: ApiRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readRequiredString(record: ApiRecord, key: string, label: string): string {
  const value = readOptionalString(record, key);
  if (!value) {
    throw new Error(`${label}响应缺少${key}`);
  }
  return value;
}

function readOptionalNumber(record: ApiRecord, key: string): number | undefined {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readRequiredPositiveInteger(record: ApiRecord, key: string, label: string): number {
  const value = readOptionalNumber(record, key);
  if (value == null || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label}响应中的${key}无效`);
  }
  return value;
}

function readRequiredPositiveNumber(record: ApiRecord, key: string, label: string): number {
  const value = readOptionalNumber(record, key);
  if (value == null || value <= 0) {
    throw new Error(`${label}响应中的${key}无效`);
  }
  return value;
}

function readPage<T>(value: unknown, label: string, mapRecord: (record: ApiRecord) => T): PageData<T> {
  const page = requireApiRecord(value, label);
  if (!Array.isArray(page.records)) {
    throw new Error(`${label}响应缺少records`);
  }

  const total = readOptionalNumber(page, 'total');
  const size = readOptionalNumber(page, 'size');
  const current = readOptionalNumber(page, 'current');
  const records: T[] = [];
  page.records.forEach((record, index) => {
    try {
      records.push(mapRecord(requireApiRecord(record, `${label}[${index}]`)));
    } catch {
      // 单条状态或字段无法识别时跳过，避免整表失败。
    }
  });
  return {
    records,
    total: total != null && Number.isSafeInteger(total) && total >= 0 ? total : 0,
    size: size != null && Number.isSafeInteger(size) && size >= 0 ? size : 0,
    current: current != null && Number.isSafeInteger(current) && current > 0 ? current : 1,
  };
}

function parseDisposalType(value: unknown): DisposalType {
  if (value === 'TRANSFER' || value === 'CLEARANCE' || value === 'SCRAP') {
    return value;
  }
  throw new Error('处置响应中的disposalType无效');
}

function parseDisposalStatus(value: unknown): DisposalStatus {
  if (
    value === 'PENDING'
    || value === 'APPROVED'
    || value === 'REJECTED'
    || value === 'CANCELLED'
    || value === DISPOSAL_RESUBMISSION_STATUS
  ) {
    return value;
  }
  throw new Error('处置响应中的status无效');
}

function toDisposal(record: ApiRecord): Disposal {
  return {
    id: readRequiredPositiveInteger(record, 'id', '处置'),
    assetId: readRequiredPositiveInteger(record, 'assetId', '处置'),
    assetNo: readOptionalString(record, 'assetNo'),
    assetName: readOptionalString(record, 'assetName'),
    applicationNo: readOptionalString(record, 'applicationNo'),
    type: parseDisposalType(record.disposalType),
    status: parseDisposalStatus(record.status),
    reason: readOptionalString(record, 'reason'),
    applicantName: readOptionalString(record, 'applicantName'),
    createdAt: readOptionalString(record, 'createTime') ?? '',
  };
}

/** 处置列表 */
export const getDisposalList = async (params?: DisposalListQuery): Promise<PageData<Disposal>> => {
  const { type, ...query } = params ?? {};
  const response: unknown = await http.get<unknown>('/disposals', {
    params: { ...query, ...(type ? { disposalType: type } : {}) },
  });
  return readPage(response, '处置列表', toDisposal);
};

/** 处置详情 */
export const getDisposalDetail = async (id: number): Promise<Disposal> => {
  const response: unknown = await http.get<unknown>(`/disposals/${id}`);
  return toDisposal(requireApiRecord(response, '处置详情'));
};

// ── 处置统计 ──────────────────────────────────────────────────────────────────

/** 处置统计聚合数据 */
export interface DisposalStats {
  /** 本月处置总量 */
  totalThisMonth: number;
  /** 较上月增量 */
  monthOverMonthDelta: number;
  /** 待审批数量 */
  pendingCount: number;
  /** 已完成数量 */
  completedCount: number;
  /** 本月资产回收价值 */
  recoveredValue: number;
}

/** 获取处置统计数据 */
export const getDisposalStats = async (): Promise<DisposalStats> => {
  const response: unknown = await http.get<unknown>('/disposals/statistics');
  const data = requireApiRecord(response, '处置统计');
  const thisMonthCount = readOptionalNumber(data, 'thisMonthCount') ?? 0;
  const previousMonthCount = readOptionalNumber(data, 'previousMonthCount') ?? 0;
  return {
    totalThisMonth: thisMonthCount,
    monthOverMonthDelta: thisMonthCount - previousMonthCount,
    pendingCount: readOptionalNumber(data, 'pendingCount') ?? 0,
    completedCount: readOptionalNumber(data, 'approvedCount') ?? 0,
    recoveredValue: 0,
  };
};

// ── 赔偿管理 ──────────────────────────────────────────────────────────────────

export interface Compensation {
  id: number;
  assetId: number;
  compensationNo: string;
  compensationType: string;
  compensationAmount: number;
  description?: string;
  incidentDate?: string;
  responsibleUserId: number;
  responsibleDeptId?: number;
  status: string;
  createTime?: string;
}

export interface CompensationListQuery {
  page?: number;
  pageSize?: number;
}

function toCompensation(record: ApiRecord): Compensation {
  return {
    id: readRequiredPositiveInteger(record, 'id', '赔偿'),
    assetId: readRequiredPositiveInteger(record, 'assetId', '赔偿'),
    compensationNo: readRequiredString(record, 'compensationNo', '赔偿'),
    compensationType: readRequiredString(record, 'compensationType', '赔偿'),
    compensationAmount: readRequiredPositiveNumber(record, 'compensationAmount', '赔偿'),
    description: readOptionalString(record, 'description'),
    incidentDate: readOptionalString(record, 'incidentDate'),
    responsibleUserId: readRequiredPositiveInteger(record, 'responsibleUserId', '赔偿'),
    responsibleDeptId: readOptionalNumber(record, 'responsibleDeptId'),
    status: readRequiredString(record, 'status', '赔偿'),
    createTime: readOptionalString(record, 'createTime'),
  };
}

/** 赔偿列表 */
export const getCompensationList = async (params?: CompensationListQuery): Promise<PageData<Compensation>> => {
  const response: unknown = await http.get<unknown>('/compensation', { params: params ?? {} });
  return readPage(response, '赔偿列表', toCompensation);
};

/** 赔偿详情 */
export const getCompensationDetail = async (id: number): Promise<Compensation> => {
  const response: unknown = await http.get<unknown>(`/compensation/${id}`);
  return toCompensation(requireApiRecord(response, '赔偿详情'));
};

/** 赔偿创建 DTO（对应后端 CompensationCreateDTO） */
export interface CompensationCreatePayload {
  assetId: number;
  compensationType: string;
  compensationAmount: number;
  description: string;
  incidentDate?: string;
  responsibleUserId: number;
  responsibleDeptId?: number;
}

/** 赔偿更新 DTO（对应后端 CompensationUpdateDTO） */
export interface CompensationUpdatePayload extends Partial<CompensationCreatePayload> {}

export const MAX_COMPENSATION_DESCRIPTION_LENGTH = 500;
export const MAX_DISPOSAL_REASON_LENGTH = 500;

export function getCompensationAmountError(value: number): string | undefined {
  if (!Number.isFinite(value) || value <= 0) {
    return '赔偿金额必须大于 0';
  }
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(String(value))) {
    return '赔偿金额最多 8 位整数和 2 位小数';
  }
  return undefined;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label}必须为正整数`);
  }
}

function assertCompensationAmount(value: number): void {
  const error = getCompensationAmountError(value);
  if (error) {
    throw new Error(error);
  }
}

function assertCompensationPayload(data: CompensationCreatePayload): void {
  assertPositiveInteger(data.assetId, '资产ID');
  assertPositiveInteger(data.responsibleUserId, '责任人ID');
  if (data.responsibleDeptId != null) {
    assertPositiveInteger(data.responsibleDeptId, '责任部门ID');
  }
  if (!data.compensationType.trim() || data.compensationType.length > 32) {
    throw new Error('赔偿类型不能为空且不能超过32个字符');
  }
  assertCompensationAmount(data.compensationAmount);
  if (!data.description.trim()) {
    throw new Error('赔偿事由不能为空');
  }
  if (data.description.length > MAX_COMPENSATION_DESCRIPTION_LENGTH) {
    throw new Error(`赔偿事由不能超过${MAX_COMPENSATION_DESCRIPTION_LENGTH}个字符`);
  }
}

/** 提交赔偿申请；后端会创建并冻结受控审批流程。 */
export const createCompensation = async (data: CompensationCreatePayload): Promise<Compensation> => {
  assertCompensationPayload(data);
  const response: unknown = await http.post<unknown>('/compensation', data);
  return toCompensation(requireApiRecord(response, '赔偿创建'));
};

/** 更新赔偿记录（PUT /compensation/{id}） */
export const updateCompensation = async (id: number, data: CompensationUpdatePayload): Promise<Compensation> => {
  if (data.compensationAmount !== undefined) {
    assertCompensationAmount(data.compensationAmount);
  }
  const response: unknown = await http.put<unknown>(`/compensation/${id}`, data);
  return toCompensation(requireApiRecord(response, '赔偿更新'));
};

export interface CompensationApplicationItem {
  assetId: number;
  compensationAmount: number;
}

export interface CompensationBatchPayload extends Omit<CompensationCreatePayload, 'assetId' | 'compensationAmount'> {
  assets: CompensationApplicationItem[];
}

/**
 * 按资产独立创建赔偿申请，完整保留每项的提交结果，便于仅重试失败资产。
 */
export async function submitCompensationApplications(
  data: CompensationBatchPayload,
): Promise<BatchApplicationResult<Compensation>> {
  if (data.assets.length === 0) {
    throw new Error('请至少选择一项资产');
  }

  const seenAssetIds = new Set<number>();
  data.assets.forEach(({ assetId, compensationAmount }) => {
    assertPositiveInteger(assetId, '资产ID');
    assertCompensationAmount(compensationAmount);
    if (seenAssetIds.has(assetId)) {
      throw new Error('同一资产不能重复提交赔偿申请');
    }
    seenAssetIds.add(assetId);
  });

  const settled = await Promise.allSettled(data.assets.map(async (asset) => ({
    assetId: asset.assetId,
    response: await createCompensation({
      assetId: asset.assetId,
      compensationAmount: asset.compensationAmount,
      compensationType: data.compensationType,
      description: data.description,
      incidentDate: data.incidentDate,
      responsibleUserId: data.responsibleUserId,
      responsibleDeptId: data.responsibleDeptId,
    }),
  })));
  const successes: BatchApplicationSuccess<Compensation>[] = [];
  const failures: BatchApplicationFailure[] = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successes.push(result.value);
    } else {
      failures.push({ assetId: data.assets[index].assetId, reason: result.reason });
    }
  });
  return { successes, failures };
}

// ── 报废申请 ────────────────────────────────────────────────────────────────

export interface ScrapApplicationPayload {
  assetIds: string[];
  scrapDate: string;
  scrapReason: string;
  disposalMethod: string;
  estimatedResidualValue?: string;
  approvalFlow: string;
  remark?: string;
}

/** 提交报废申请；每项资产创建独立受控审批流程。 */
export const submitScrapApplication = (data: ScrapApplicationPayload) => {
  const reason = buildScrapDisposalReason(data);
  return submitForAssets(data.assetIds, (assetId) =>
    http.post<unknown>('/disposals/scrap', { assetId, reason }),
  );
};

export function buildScrapDisposalReason(data: Pick<
  ScrapApplicationPayload,
  'scrapReason' | 'disposalMethod' | 'estimatedResidualValue' | 'remark'
>): string {
  return requireDisposalReasonLength(joinReason([
    `报废原因：${data.scrapReason}`,
    `处置方式：${data.disposalMethod}`,
    data.estimatedResidualValue ? `预估残值：¥${data.estimatedResidualValue}` : null,
    data.remark ? `备注：${data.remark}` : null,
  ]));
}

export interface ScrapDraftData {
  scrapDate: string;
  scrapReason: string;
  disposalMethod: string;
  estimatedResidualValue?: string;
  approvalFlow: string;
  remark?: string;
  assetIds: string[];
}

/** 保存报废申请草稿到 localStorage */
export const saveScrapDraft = (data: ScrapDraftData): boolean => {
  try {
    const timestamp = Date.now();
    const dataKey = `ams_draft_scrap_${timestamp}`;
    const indexKey = 'ams_draft_latest_scrap';
    localStorage.setItem(dataKey, JSON.stringify(data));
    localStorage.setItem(indexKey, dataKey);
    return true;
  } catch {
    return false;
  }
};

// ── 清退申请 ────────────────────────────────────────────────────────────────

export interface ClearanceApplicationPayload {
  assetIds: string[];
  clearanceReason: string;
  disposalMethod: string;
  estimatedResidualValue?: number;
  approvalFlow: string;
  urgency: string;
  remark?: string;
  applicationDate: string;
}

/** 提交清退申请；每项资产创建独立受控审批流程。 */
export const submitClearanceApplication = (data: ClearanceApplicationPayload) => {
  const reason = buildClearanceDisposalReason(data);
  return submitForAssets(data.assetIds, (assetId) =>
    http.post<unknown>('/disposals/clearance', { assetId, reason }),
  );
};

export function buildClearanceDisposalReason(data: Pick<
  ClearanceApplicationPayload,
  'clearanceReason' | 'disposalMethod' | 'estimatedResidualValue' | 'urgency' | 'remark'
>): string {
  return requireDisposalReasonLength(joinReason([
    `清退原因：${data.clearanceReason}`,
    `处置方式：${data.disposalMethod}`,
    data.estimatedResidualValue != null ? `预估残值：¥${data.estimatedResidualValue}` : null,
    `紧急程度：${data.urgency}`,
    data.remark ? `备注：${data.remark}` : null,
  ]));
}

export interface ClearanceDraftData {
  clearanceReason: string;
  disposalMethod: string;
  estimatedResidualValue?: number;
  approvalFlow: string;
  urgency: string;
  remark?: string;
  applicationDate: string;
  assetIds: string[];
}

/** 保存清退申请草稿到 localStorage */
export const saveClearanceDraft = (data: ClearanceDraftData): boolean => {
  try {
    const timestamp = Date.now();
    const dataKey = `ams_draft_clearance_${timestamp}`;
    const indexKey = 'ams_draft_latest_clearance';
    localStorage.setItem(dataKey, JSON.stringify(data));
    localStorage.setItem(indexKey, dataKey);
    return true;
  } catch {
    return false;
  }
};

// ── 调拨申请 ────────────────────────────────────────────────────────────────

export interface TransferApplicationPayload {
  assetIds: string[];
  transferType: string;
  fromDept: string;
  toDept: string;
  fromLocation?: string;
  toLocation?: string;
  expectedWorkflowDefinitionId?: number;
  expectedWorkflowVersion?: number;
  priority: string;
  notes?: string;
}

/** 提交调拨申请；每项资产创建独立受控审批流程。 */
export const submitTransferApplication = (data: TransferApplicationPayload) => {
  const targetDeptId = toPositiveId(data.toDept, '目标部门');
  const reason = buildTransferDisposalReason(data);
  return submitForAssets(data.assetIds, (assetId) =>
    http.post<unknown>('/disposals/transfer', {
      assetId,
      targetDeptId,
      targetLocation: data.toLocation || undefined,
      reason,
    }),
  );
};

export function buildTransferDisposalReason(data: Pick<
  TransferApplicationPayload,
  'transferType' | 'fromDept' | 'toDept' | 'fromLocation' | 'toLocation' | 'priority' | 'notes'
>): string {
  return requireDisposalReasonLength(joinReason([
    `调拨类型：${data.transferType}`,
    `调出部门：${data.fromDept}`,
    `调入部门：${data.toDept}`,
    data.fromLocation ? `调出位置：${data.fromLocation}` : null,
    data.toLocation ? `调入位置：${data.toLocation}` : null,
    `紧急程度：${data.priority}`,
    data.notes ? `备注：${data.notes}` : null,
  ]));
}

async function submitForAssets<T>(
  assetIds: string[],
  submit: (assetId: number) => Promise<T>,
): Promise<BatchApplicationResult<T>> {
  const normalizedAssetIds = toPositiveAssetIds(assetIds);
  const settled = await Promise.allSettled(normalizedAssetIds.map(async (assetId) => ({
    assetId,
    response: await submit(assetId),
  })));
  const successes: BatchApplicationSuccess<T>[] = [];
  const failures: BatchApplicationFailure[] = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successes.push(result.value);
    } else {
      failures.push({ assetId: normalizedAssetIds[index], reason: result.reason });
    }
  });
  return { successes, failures };
}

function toPositiveAssetIds(assetIds: string[]): number[] {
  if (assetIds.length === 0) {
    throw new Error('请至少选择一项资产');
  }
  return assetIds.map((assetId) => toPositiveId(assetId, '资产'));
}

function toPositiveId(value: string | number, label: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`${label} ID 必须为正整数`);
  }
  return id;
}

function joinReason(parts: Array<string | null>): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join('；');
}

function requireDisposalReasonLength(reason: string): string {
  if (reason.length > MAX_DISPOSAL_REASON_LENGTH) {
    throw new Error(`处置事由拼接后不能超过${MAX_DISPOSAL_REASON_LENGTH}个字符，请缩短备注或说明后再提交`);
  }
  return reason;
}
