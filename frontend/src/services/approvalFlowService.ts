/**
 * 审批流程API服务层 (SWARM-052-I3)
 *
 * 职责：G3链路通信 - API对接、网络异常捕获与自动重试机制
 * 约束：严格遵从approval_flow_v2.yaml接口契约，禁止自行拼装聚合接口
 */

import axios from 'axios';

// 常量定义
const APPROVAL_API_BASE = '/api/v2/approval';
const REQUEST_TIMEOUT_MS = 5000; // 硬编码5s超时阈值
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// 类型定义
export interface ApprovalSubmitPayload {
  approvalId: string;
  nodeId: string;
  action: 'approve' | 'reject' | 'transfer';
  comment?: string;
  transferToUserId?: string;
  idempotencyKey?: string;
}

export interface ApprovalSubmitResponse {
  success: boolean;
  data?: {
    approvalId: string;
    nodeId: string;
    status: 'approved' | 'rejected' | 'transferred';
    idempotencyKey: string;
    completed?: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface ApprovalFlowError extends Error {
  statusCode?: number;
  isRetryable: boolean;
  originalPayload?: ApprovalSubmitPayload;
  retryCount: number;
}

// 工具函数：生成UUID格式的idempotency_key (^[0-9a-f]{8}-)
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

// 工具函数：显示Toast错误提示（降级策略，禁止window.alert）
function showToastError(message: string): void {
  // 尝试通过DOM操作显示toast-error（.toast-error类选择器）
  const existingToast = document.querySelector('.toast-error');
  if (existingToast) {
    (existingToast as HTMLElement).textContent = message;
    (existingToast as HTMLElement).style.display = 'block';
    setTimeout(() => {
      (existingToast as HTMLElement).style.display = 'none';
    }, 3000);
    return;
  }

  // 如果没有现有toast容器，创建一个
  const toast = document.createElement('div');
  toast.className = 'toast-error';
  toast.textContent = message;
  toast.style.cssText =
    'position:fixed;top:20px;right:20px;z-index:9999;padding:12px 24px;' +
    'background:#ef4444;color:#fff;border-radius:6px;font-size:14px;';
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.display = 'none';
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

// 工具函数：判断是否为可重试的错误（5xx、网络错误、超时）
function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as Record<string, any>;
  // Axios网络错误或超时
  if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') return true;
  // 5xx服务器错误
  if (err.response?.status >= 500 && err.response?.status < 600) return true;
  return false;
}

// 工具函数：延迟执行（指数退避）
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建结构化错误对象（不直接触发UI）
 */
export function createApprovalError(
  message: string,
  statusCode?: number,
  originalPayload?: ApprovalSubmitPayload,
  retryCount: number = 0
): ApprovalFlowError {
  const error = new Error(message) as ApprovalFlowError;
  error.statusCode = statusCode;
  error.isRetryable = false;
  error.originalPayload = originalPayload;
  error.retryCount = retryCount;
  return error;
}

/**
 * 提交审批请求（带重试机制与幂等性控制）
 *
 * - 首次提交注入客户端生成的idempotencyKey
 * - 5xx/网络错误自动重试（最多3次，指数退避）
 * - 重试依赖后端返回的idempotency_key实现幂等
 * - 降级为Toast提示，禁止window.alert弹窗阻断
 * - 保留当前表单数据不清空（由上层hook负责）
 */
export async function submitApproval(
  payload: ApprovalSubmitPayload
): Promise<ApprovalSubmitResponse> {
  const submissionPayload: ApprovalSubmitPayload = payload.idempotencyKey
    ? { ...payload }
    : { ...payload, idempotencyKey: generateIdempotencyKey() };

  let lastError: Error | null = null;
  let attempts = 0;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    attempts = attempt + 1;
    try {
      const response = await axios.post<ApprovalSubmitResponse>(
        `${APPROVAL_API_BASE}/submit`,
        submissionPayload,
        {
          timeout: REQUEST_TIMEOUT_MS,
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': submissionPayload.idempotencyKey!,
          },
        }
      );

      const responseData = response.data;

      // 如果服务端返回新的idempotencyKey，更新payload用于后续重试
      if (responseData.data?.idempotencyKey) {
        submissionPayload.idempotencyKey = responseData.data.idempotencyKey;
      }

      return responseData;
    } catch (error: any) {
      lastError = error;

      // 非可重试错误（4xx等），不重试直接跳出
      if (!isRetryableError(error)) {
        break;
      }

      console.warn(
        `[ApprovalFlow] Submit attempt ${attempt + 1} failed:`,
        error.message
      );

      // 不是最后一次尝试，等待后重试（指数退避）
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        await delay(RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  // 所有重试失败或不可重试错误：降级为Toast提示
  const errorMessage = lastError?.message || '审批提交失败，请稍后重试';
  showToastError(errorMessage);

  const flowError = createApprovalError(
    errorMessage,
    (lastError as { response?: { status?: number } })?.response?.status,
    submissionPayload,
    attempts
  );
  throw flowError;
}

/**
 * 获取审批详情
 */
export async function getApprovalDetail(approvalId: string): Promise<any> {
  const response = await axios.get(`${APPROVAL_API_BASE}/${approvalId}`, {
    timeout: REQUEST_TIMEOUT_MS,
  });
  return response.data;
}

/**
 * 获取待办审批列表
 */
export async function getPendingList(
  params?: Record<string, string>
): Promise<any> {
  const queryString = params
    ? `?${new URLSearchParams(params).toString()}`
    : '';
  const response = await axios.get(
    `${APPROVAL_API_BASE}/pending${queryString}`,
    { timeout: REQUEST_TIMEOUT_MS }
  );
  return response.data;
}

export default {
  submitApproval,
  getApprovalDetail,
  getPendingList,
  generateIdempotencyKey,
};