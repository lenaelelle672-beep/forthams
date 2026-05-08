/**
 * useApproval.ts — 审批流 Composable
 *
 * 基于Vue 3 Composition API封装审批流核心交互逻辑，抽象四个原子能力：
 * - fetchPendingApprovals：拉取待审批列表并同步到Store
 * - approve：审批通过
 * - reject：审批驳回
 * - subscribe：建立订阅链路，触发数据刷新
 *
 * 所有列表数据唯一真实来源为 useApprovalStore().pendingApprovals。
 * 异常原样冒泡至调用方，不在此层静默处理。
 */

import { useApprovalStore } from '@/stores/approvalStore'
import {
  getPendingApprovals,
  approveOrder,
  rejectOrder,
} from '@/api/approval'
import type {
  PendingApprovalListParams,
  ApproveRequest,
  RejectRequest,
} from '@/api/approval'

/** 订阅轮询间隔（毫秒） */
const DEFAULT_POLL_INTERVAL = 15_000

/**
 * 审批流 Composable
 *
 * 返回四个具名方法，供组件直接调用。
 */
export function useApproval() {
  const store = useApprovalStore()

  /**
   * 拉取待审批列表并同步到 Store
   *
   * @param params - 可选的分页与搜索参数
   */
  async function fetchPendingApprovals(params?: PendingApprovalListParams): Promise<void> {
    const response = await getPendingApprovals(params)
    store.setPendingApprovals(response.content)
  }

  /**
   * 审批通过
   *
   * @param id      - 工单 ID
   * @param comment - 审批意见（可选）
   */
  async function approve(id: number, comment?: string): Promise<void> {
    const item = store.pendingApprovals.find((a: { id: number }) => a.id === id)
    const version: number = item?.version ?? 0
    await approveOrder(id, { version })
    await fetchPendingApprovals()
  }

  /**
   * 审批驳回
   *
   * @param id      - 工单 ID
   * @param comment - 驳回原因（必填）
   */
  async function reject(id: number, comment: string): Promise<void> {
    const item = store.pendingApprovals.find((a: { id: number }) => a.id === id)
    const version: number = item?.version ?? 0
    await rejectOrder(id, { rejectionReason: comment, version })
    await fetchPendingApprovals()
  }

  /**
   * 建立订阅链路（轮询方式）
   *
   * 定时拉取待审批列表以保持 Store 数据最新。
   * 返回取消订阅的函数，供调用方在 onUnmounted 中清理。
   *
   * @param interval - 轮询间隔（毫秒），默认 15 秒
   * @returns 取消订阅函数
   */
  function subscribe(interval: number = DEFAULT_POLL_INTERVAL): () => void {
    let timer: ReturnType<typeof setInterval> | null = null

    // 首次立即拉取
    fetchPendingApprovals()

    timer = setInterval(() => {
      fetchPendingApprovals()
    }, interval)

    return () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    }
  }

  return {
    fetchPendingApprovals,
    approve,
    reject,
    subscribe,
  }
}