/**
 * ApprovalModal Component
 * 
 * 工单审批弹窗组件 - Phase 3 实现
 * 支持一键审批/驳回操作，自动触发后端状态机推进
 * 
 * @module WorkOrder
 * @version 1.0.0
 * @since SWARM-2025-Q2-P0-003 Iteration 3
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Button,
  Space,
  Form,
  Input,
  message,
  Select,
  Tooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { WorkOrderDTO, WorkOrderStatus } from '@/types/approval';
import { useApprovalStore } from '@/store/approvalStore';
import { canUserApprove } from '@/composables/useApprovalBinding';
import { workOrderAPI } from '../api/workOrderApi';
import { useCurrentUser } from '@/hooks/useCurrentUser';

import './ApprovalModal.less';

const { TextArea } = Input;

/**
 * 审批操作类型枚举
 * @description 定义支持的操作类型
 */
export enum ApprovalAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

/**
 * 审批表单数据结构
 * @description 用于收集用户的审批操作信息
 */
interface ApprovalFormData {
  action: ApprovalAction;
  comment: string;
  /** 审批人 ID */
  approverId?: string;
}

/**
 * ApprovalModal Props 接口定义
 * @description 组件接收的属性配置
 */
export interface ApprovalModalProps {
  /** 弹窗是否可见 */
  visible: boolean;
  /** 当前待审批的工单 */
  workOrder: WorkOrderDTO | null;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 审批成功回调 */
  onSuccess?: (workOrderId: string, action: ApprovalAction) => void;
  /** 审批失败回调 */
  onError?: (error: Error) => void;
  /** 是否显示批量操作模式 */
  batchMode?: boolean;
  /** 批量选中的工单 ID 列表 */
  batchWorkOrderIds?: string[];
}

/**
 * 审批结果统计接口
 * @description 用于批量审批操作的结果反馈
 */
interface BatchResult {
  successCount: number;
  failureCount: number;
  failedIds: string[];
  errors: Array<{ id: string; message: string }>;
}

/**
 * ApprovalModal 组件
 * 
 * 工单审批主组件，提供审批/驳回操作界面
 * 
 * 功能特性：
 * - 支持单条和批量审批操作
 * - 审批理由可选填写
 * - 操作前权限校验
 * - 操作结果反馈（成功/失败）
 * 
 * @param props - ApprovalModalProps
 * @returns React 组件
 * 
 * @example
 * ```tsx
 * <ApprovalModal
 *   visible={isModalOpen}
 *   workOrder={currentWorkOrder}
 *   onClose={() => setIsModalOpen(false)}
 *   onSuccess={(id, action) => console.log('审批成功', id, action)}
 * />
 * ```
 */
export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  visible,
  workOrder,
  onClose,
  onSuccess,
  onError,
  batchMode = false,
  batchWorkOrderIds = [],
}) => {
  const { t } = useTranslation('workOrder');
  const [form] = Form.useForm<ApprovalFormData>();
  const queryClient = useQueryClient();
  
  // 获取当前用户信息
  const { user } = useCurrentUser();
  
  // 从审批 store 获取状态
  const { 
    pendingCount, 
    lastApprovalTime,
    setLastApprovalTime,
  } = useApprovalStore();

  // 本地状态管理
  const [loading, setLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // 批量模式下显示的工单 ID 列表
  const displayIds = useMemo(() => {
    return batchMode ? batchWorkOrderIds : (workOrder ? [workOrder.id] : []);
  }, [batchMode, batchWorkOrderIds, workOrder]);

  /**
   * 权限校验
   * @description 根据用户和工单信息判断是否可以执行审批操作
   */
  const canApprove = useMemo(() => {
    if (!user || !workOrder) return false;
    return canUserApprove(workOrder, user.id, user.role);
  }, [user, workOrder]);

  /**
   * 工单是否可以审批
   * @description 工单状态必须为 PENDING_APPROVAL
   */
  const canBeApproved = useMemo(() => {
    if (!workOrder) return false;
    return workOrder.status === WorkOrderStatus.PENDING_APPROVAL;
  }, [workOrder]);

  /**
   * 单条审批 mutation
   * @description 调用后端 API 执行单条工单审批
   */
  const approveSingleMutation = useMutation({
    mutationFn: async (params: {
      workOrderId: string;
      action: ApprovalAction;
      comment: string;
    }) => {
      const response = await workOrderAPI.approve(params.workOrderId, {
        action: params.action,
        comment: params.comment,
      });
      return response;
    },
    onSuccess: (data, variables) => {
      message.success(
        t('approval.message.success', { 
          action: variables.action === ApprovalAction.APPROVE 
            ? t('approval.action.approve') 
            : t('approval.action.reject')
        })
      );
      queryClient.invalidateQueries({ queryKey: ['workOrders', 'pending'] });
      setLastApprovalTime(Date.now());
      onSuccess?.(variables.workOrderId, variables.action);
    },
    onError: (error: Error) => {
      message.error(t('approval.message.error', { detail: error.message }));
      onError?.(error);
    },
  });

  /**
   * 批量审批 mutation
   * @description 调用后端 API 执行批量工单审批
   */
  const approveBatchMutation = useMutation({
    mutationFn: async (params: {
      workOrderIds: string[];
      action: ApprovalAction;
      comment: string;
    }) => {
      const response = await workOrderAPI.batchApprove(params.workOrderIds, {
        action: params.action,
        comment: params.comment,
      });
      return response as BatchResult;
    },
    onSuccess: (data) => {
      const resultMessage = batchMode
        ? t('approval.message.batchSuccess', {
            success: data.successCount,
            total: data.successCount + data.failureCount,
          })
        : t('approval.message.success');
      
      message.success(resultMessage);
      
      // 如果有失败项，显示警告
      if (data.failureCount > 0) {
        message.warning(
          t('approval.message.batchPartialSuccess', {
            failed: data.failureCount,
          })
        );
      }
      
      queryClient.invalidateQueries({ queryKey: ['workOrders', 'pending'] });
      setLastApprovalTime(Date.now());
      onSuccess?.('', batchMode ? ApprovalAction.APPROVE : ApprovalAction.APPROVE);
    },
    onError: (error: Error) => {
      message.error(t('approval.message.error', { detail: error.message }));
      onError?.(error);
    },
  });

  /**
   * 确认审批操作
   * @description 表单提交后的处理逻辑
   */
  const handleConfirm = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);

      if (batchMode) {
        // 批量审批模式
        const maxBatchSize = 50;
        if (batchWorkOrderIds.length > maxBatchSize) {
          message.error(t('approval.message.batchExceedsLimit', { limit: maxBatchSize }));
          return;
        }
        await approveBatchMutation.mutateAsync({
          workOrderIds: batchWorkOrderIds,
          action: values.action,
          comment: values.comment,
        });
      } else if (workOrder) {
        // 单条审批模式
        await approveSingleMutation.mutateAsync({
          workOrderId: workOrder.id,
          action: values.action,
          comment: values.comment,
        });
      }
      
      onClose();
      form.resetFields();
    } catch (error) {
      // 表单验证失败或用户取消
      if ((error as Error).message !== 'cancel') {
        console.error('Approval submission error:', error);
      }
    } finally {
      setConfirmLoading(false);
    }
  }, [
    form, 
    batchMode, 
    batchWorkOrderIds, 
    workOrder, 
    approveBatchMutation, 
    approveSingleMutation,
    onClose,
    t,
  ]);

  /**
   * 取消操作
   * @description 关闭弹窗并重置表单
   */
  const handleCancel = useCallback(() => {
    form.resetFields();
    onClose();
  }, [form, onClose]);

  /**
   * 审批操作变化处理
   * @description 当用户选择审批/驳回时，更新表单
   */
  const handleActionChange = useCallback((value: ApprovalAction) => {
    form.setFieldValue('action', value);
  }, [form]);

  // 监听 visible 变化，重置表单状态
  useEffect(() => {
    if (!visible) {
      form.resetFields();
    }
  }, [visible, form]);

  /**
   * 审批按钮禁用状态判断
   */
  const isSubmitDisabled = useMemo(() => {
    if (batchMode) {
      return batchWorkOrderIds.length === 0;
    }
    return !canBeApproved || !canApprove;
  }, [batchMode, batchWorkOrderIds.length, canBeApproved, canApprove]);

  /**
   * 获取当前操作类型
   */
  const currentAction = Form.useWatch('action', form);

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
          <span>
            {batchMode
              ? t('approval.title.batch', { count: displayIds.length })
              : t('approval.title.single')}
          </span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={
        <Space>
          <Button onClick={handleCancel} disabled={loading}>
            {t('approval.button.cancel')}
          </Button>
          <Button
            type="default"
            danger
            icon={<CloseCircleOutlined />}
            loading={confirmLoading}
            onClick={() => {
              form.setFieldValue('action', ApprovalAction.REJECT);
              handleConfirm();
            }}
            disabled={isSubmitDisabled}
          >
            {t('approval.button.reject')}
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={confirmLoading}
            onClick={() => {
              form.setFieldValue('action', ApprovalAction.APPROVE);
              handleConfirm();
            }}
            disabled={isSubmitDisabled}
          >
            {t('approval.button.approve')}
          </Button>
        </Space>
      }
      confirmLoading={confirmLoading}
      destroyOnClose
      maskClosable={false}
      width={520}
    >
      <div className="approval-modal-content">
        {/* 批量模式提示 */}
        {batchMode && (
          <div className="batch-info">
            <HistoryOutlined />
            <span>
              {t('approval.batchInfo', { count: batchWorkOrderIds.length })}
            </span>
          </div>
        )}

        {/* 工单信息展示 */}
        {!batchMode && workOrder && (
          <div className="work-order-info">
            <div className="info-row">
              <span className="label">{t('approval.label.workOrderId')}:</span>
              <span className="value">{workOrder.id}</span>
            </div>
            <div className="info-row">
              <span className="label">{t('approval.label.title')}:</span>
              <span className="value">{workOrder.title}</span>
            </div>
            <div className="info-row">
              <span className="label">{t('approval.label.status')}:</span>
              <span className={`status-badge status-${workOrder.status.toLowerCase()}`}>
                {t(`approval.status.${workOrder.status}`)}
              </span>
            </div>
          </div>
        )}

        {/* 权限警告 */}
        {!canApprove && visible && (
          <div className="permission-warning">
            <ExclamationCircleOutlined />
            <span>{t('approval.warning.noPermission')}</span>
          </div>
        )}

        {/* 审批表单 */}
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          initialValues={{
            action: ApprovalAction.APPROVE,
            comment: '',
          }}
        >
          <Form.Item
            name="comment"
            label={t('approval.label.comment')}
            tooltip={t('approval.tooltip.comment')}
          >
            <TextArea
              rows={4}
              maxLength={500}
              placeholder={t('approval.placeholder.comment')}
              showCount
            />
          </Form.Item>
        </Form>

        {/* 操作说明 */}
        <div className="approval-instructions">
          <div className="instruction-item">
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>{t('approval.instruction.approve')}</span>
          </div>
          <div className="instruction-item">
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>{t('approval.instruction.reject')}</span>
          </div>
        </div>

        {/* 待审批数量提示 */}
        <div className="pending-count">
          <Tooltip title={t('approval.tooltip.pendingCount')}>
            <span>
              {t('approval.label.pendingCount', { count: pendingCount })}
            </span>
          </Tooltip>
        </div>
      </div>
    </Modal>
  );
};

/**
 * 审批成功消息提示
 * @description 在组件外部调用的成功通知
 */
export const showApprovalSuccessMessage = (
  action: ApprovalAction,
  t: (key: string) => string
): void => {
  const actionText = action === ApprovalAction.APPROVE
    ? t('approval.action.approve')
    : t('approval.action.reject');
  message.success(t('approval.message.actionSuccess', { action: actionText }));
};

/**
 * 审批失败消息提示
 * @description 在组件外部调用的错误通知
 */
export const showApprovalErrorMessage = (
  error: Error,
  t: (key: string) => string
): void => {
  message.error(t('approval.message.actionFailed', { detail: error.message }));
};

export default ApprovalModal;