import { useState, useCallback } from 'react';
import { message } from 'antd';
import http from '@/utils/http';

/** 盘点任务创建表单值 */
export interface CreateTaskFormValues {
  /** 任务名称 */
  taskName: string;
  /** 盘点范围类型: 按位置 / 按分类 */
  scopeType: 'location' | 'category';
  /** 位置 ID 列表 (scopeType 为 location 时必填) */
  locationIds?: string[];
  /** 分类 ID 列表 (scopeType 为 category 时必填) */
  categoryIds?: string[];
  /** 盘点截止日期 (ISO string) */
  deadline?: string;
  /** 任务描述 */
  description?: string;
}

/**
 * useCreateTask — 新建盘点任务 Hook
 *
 * 管理新建盘点任务弹窗的可见性状态、表单校验、
 * 提交请求至后端 API (POST /api/inventory/tasks)，
 * 以及成功/失败后的回调处理。
 *
 * @param onSuccess - 任务创建成功后的回调，通常用于刷新任务列表
 * @returns 弹窗状态、提交中状态及控制方法
 */
export function useCreateTask(onSuccess?: () => void) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /** 打开新建盘点任务弹窗 */
  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  /** 关闭新建盘点任务弹窗 */
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  /**
   * 校验并提交创建盘点任务请求
   *
   * 在客户端完成表单校验后，将 payload 发送至
   * POST /api/inventory/tasks。成功时关闭弹窗并调用
   * onSuccess 回调以刷新任务列表数据。
   *
   * @param formValues - 表单提交的盘点任务数据
   */
  const createTask = useCallback(
    async (formValues: CreateTaskFormValues) => {
      // ---------- 客户端校验 ----------
      if (!formValues.taskName?.trim()) {
        message.warning('请输入任务名称');
        return;
      }

      if (
        formValues.scopeType === 'location' &&
        (!formValues.locationIds || formValues.locationIds.length === 0)
      ) {
        message.warning('请至少选择一个盘点位置');
        return;
      }

      if (
        formValues.scopeType === 'category' &&
        (!formValues.categoryIds || formValues.categoryIds.length === 0)
      ) {
        message.warning('请至少选择一个资产分类');
        return;
      }

      // ---------- 提交请求 ----------
      setSubmitting(true);
      try {
        await http.post('/api/inventory/tasks', formValues);

        message.success('盘点任务创建成功');
        closeModal();
        onSuccess?.();
      } catch (error: unknown) {
        const err = error as {
          response?: { data?: { message?: string; detail?: string } };
        };
        const errorMessage =
          err.response?.data?.message ??
          err.response?.data?.detail ??
          '创建盘点任务失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, closeModal],
  );

  return {
    isModalOpen,
    submitting,
    openModal,
    closeModal,
    createTask,
  };
}

export default useCreateTask;