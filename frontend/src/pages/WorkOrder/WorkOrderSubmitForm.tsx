/**
 * WorkOrderSubmitForm.tsx
 * 
 * 工单提交表单组件
 * 用于用户提交工单申请，包含标题、描述、审批人选择等字段
 * 
 * 功能范围：
 * - 工单标题输入（最大200字符）
 * - 工单描述输入（最大5000字符）
 * - 审批人选择
 * - 表单验证与提交
 * - 提交成功/失败提示
 * 
 * 状态流转：
 * - DRAFT -> PENDING_APPROVAL (submit)
 * 
 * @packageDocumentation
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { workOrderApi } from '../../api/workorder';
import type { WorkOrder, WorkOrderCreateDTO, WorkOrderStatus, User } from '../../types/workorder.types';
import { useWorkOrderPermission } from '../../composables/useWorkOrderPermission';

/**
 * 表单字段接口定义
 */
interface FormFields {
  title: string;
  description: string;
  approverId: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  attachmentIds: string[];
}

/**
 * 表单错误定义
 */
interface FormErrors {
  title?: string;
  description?: string;
  approverId?: string;
  general?: string;
}

/**
 * 表单验证规则常量
 */
const VALIDATION_RULES = {
  title: {
    minLength: 1,
    maxLength: 200,
    required: true,
  },
  description: {
    minLength: 1,
    maxLength: 5000,
    required: true,
  },
  approverId: {
    required: true,
  },
} as const;

/**
 * WorkOrderSubmitForm 组件属性接口
 */
export interface WorkOrderSubmitFormProps {
  /** 初始化工单数据（如草稿恢复） */
  initialData?: Partial<WorkOrderCreateDTO>;
  /** 提交成功回调 */
  onSuccess?: (workOrder: WorkOrder) => void;
  /** 提交失败回调 */
  onError?: (error: Error) => void;
  /** 取消回调 */
  onCancel?: () => void;
}

/**
 * WorkOrderSubmitForm 组件
 * 
 * 工单提交表单，提供用户提交工单申请的完整功能
 * 
 * @param props - 组件属性
 * @returns React 组件
 * 
 * @example
 * ```tsx
 * <WorkOrderSubmitForm
 *   onSuccess={(wo) => navigate(`/workorder/${wo.id}`)}
 *   onCancel={() => navigate('/workorder/list')}
 * />
 * ```
 */
export const WorkOrderSubmitForm: React.FC<WorkOrderSubmitFormProps> = ({
  initialData,
  onSuccess,
  onError,
  onCancel,
}) => {
  // 路由导航
  const navigate = useNavigate();
  
  // 权限钩子
  const { canSubmitWorkOrder, canSelectApprover } = useWorkOrderPermission();

  // 表单状态
  const [fields, setFields] = useState<FormFields>({
    title: initialData?.title ?? '',
    description: initialData?.description ?? '',
    approverId: initialData?.approver_id ?? '',
    priority: initialData?.priority ?? 'MEDIUM',
    attachmentIds: initialData?.attachment_ids ?? [],
  });

  // 错误状态
  const [errors, setErrors] = useState<FormErrors>({});

  // 提交状态
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitResult, setSubmitResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  /**
   * 验证单个字段
   * 
   * @param fieldName - 字段名
   * @param value - 字段值
   * @returns 错误消息或undefined
   */
  const validateField = useCallback((fieldName: keyof typeof VALIDATION_RULES, value: string): string | undefined => {
    const rule = VALIDATION_RULES[fieldName];
    
    if (rule.required && (!value || value.trim().length === 0)) {
      return `${fieldName} 为必填项`;
    }
    
    if (fieldName === 'title' && value.length > rule.maxLength) {
      return `标题不能超过 ${rule.maxLength} 字符`;
    }
    
    if (fieldName === 'description' && value.length > rule.maxLength) {
      return `描述不能超过 ${rule.maxLength} 字符`;
    }
    
    return undefined;
  }, []);

  /**
   * 验证整个表单
   * 
   * @returns 是否通过验证
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    
    const titleError = validateField('title', fields.title);
    if (titleError) newErrors.title = titleError;
    
    const descError = validateField('description', fields.description);
    if (descError) newErrors.description = descError;
    
    const approverError = validateField('approverId', fields.approverId);
    if (approverError) newErrors.approverId = approverError;
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fields, validateField]);

  /**
   * 处理字段变更
   * 
   * @param fieldName - 字段名
   * @param value - 新值
   */
  const handleFieldChange = useCallback((fieldName: keyof FormFields, value: string) => {
    setFields(prev => ({ ...prev, [fieldName]: value }));
    
    // 清除字段错误
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName as keyof FormErrors];
      return newErrors;
    });
  }, []);

  /**
   * 处理表单提交
   * 
   * @param event - 表单提交事件
   */
  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // 权限检查
    if (!canSubmitWorkOrder()) {
      setSubmitResult({
        type: 'error',
        message: '您没有权限提交工单',
      });
      return;
    }

    // 表单验证
    if (!validateForm()) {
      setSubmitResult({
        type: 'error',
        message: '请检查表单填写是否正确',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // 构建提交数据
      const submitData: WorkOrderCreateDTO = {
        title: fields.title.trim(),
        description: fields.description.trim(),
        approver_id: fields.approverId,
        priority: fields.priority,
        attachment_ids: fields.attachmentIds,
      };

      // 调用API创建工单
      const createdWorkOrder = await workOrderApi.createWorkOrder(submitData);

      // 提交成功后自动提交审批
      const submittedWorkOrder = await workOrderApi.submitWorkOrder(createdWorkOrder.id);

      setSubmitResult({
        type: 'success',
        message: '工单提交成功',
      });

      // 调用成功回调
      onSuccess?.(submittedWorkOrder);

      // 延迟跳转
      setTimeout(() => {
        navigate(`/workorder/${submittedWorkOrder.id}`);
      }, 1500);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '提交失败，请重试';
      
      setSubmitResult({
        type: 'error',
        message: errorMessage,
      });

      // 调用错误回调
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    fields,
    canSubmitWorkOrder,
    validateForm,
    navigate,
    onSuccess,
    onError,
  ]);

  /**
   * 处理取消操作
   */
  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  }, [navigate, onCancel]);

  /**
   * 处理重置表单
   */
  const handleReset = useCallback(() => {
    setFields({
      title: '',
      description: '',
      approverId: '',
      priority: 'MEDIUM',
      attachmentIds: [],
    });
    setErrors({});
    setSubmitResult(null);
  }, []);

  /**
   * 字符计数计算
   */
  const titleCharCount = useMemo(() => fields.title.length, [fields.title]);
  const descriptionCharCount = useMemo(() => fields.description.length, [fields.description]);

  /**
   * 判断是否为草稿状态
   */
  const isDraft = useMemo(() => true, []);

  return (
    <div className="work-order-submit-form bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">提交工单</h1>
        <p className="text-sm text-gray-500 mt-1">
          请填写以下信息提交工单申请，审批人将收到通知
        </p>
      </div>

      {/* 状态提示 */}
      {submitResult && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            submitResult.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center">
            {submitResult.type === 'success' ? (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <span>{submitResult.message}</span>
          </div>
        </div>
      )}

      {/* 工单表单 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 标题字段 */}
        <div className="form-field">
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            工单标题 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={fields.title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            maxLength={VALIDATION_RULES.title.maxLength}
            placeholder="请输入工单标题，简明扼要地描述问题"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
              errors.title
                ? 'border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
            }`}
            aria-describedby={errors.title ? 'title-error' : undefined}
            aria-invalid={errors.title ? 'true' : 'false'}
          />
          <div className="flex justify-between mt-1">
            {errors.title ? (
              <span id="title-error" className="text-sm text-red-500">
                {errors.title}
              </span>
            ) : (
              <span />
            )}
            <span className="text-sm text-gray-400">
              {titleCharCount}/{VALIDATION_RULES.title.maxLength}
            </span>
          </div>
        </div>

        {/* 描述字段 */}
        <div className="form-field">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            工单描述 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={fields.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            maxLength={VALIDATION_RULES.description.maxLength}
            rows={6}
            placeholder="请详细描述工单内容，包括问题描述、期望结果等"
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-y ${
              errors.description
                ? 'border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
            }`}
            aria-describedby={errors.description ? 'description-error' : undefined}
            aria-invalid={errors.description ? 'true' : 'false'}
          />
          <div className="flex justify-between mt-1">
            {errors.description ? (
              <span id="description-error" className="text-sm text-red-500">
                {errors.description}
              </span>
            ) : (
              <span />
            )}
            <span className="text-sm text-gray-400">
              {descriptionCharCount}/{VALIDATION_RULES.description.maxLength}
            </span>
          </div>
        </div>

        {/* 审批人选择 */}
        <div className="form-field">
          <label
            htmlFor="approverId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            审批人 <span className="text-red-500">*</span>
          </label>
          <select
            id="approverId"
            name="approverId"
            value={fields.approverId}
            onChange={(e) => handleFieldChange('approverId', e.target.value)}
            disabled={!canSelectApprover()}
            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
              errors.approverId
                ? 'border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
            } ${!canSelectApprover() ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            aria-describedby={errors.approverId ? 'approver-error' : undefined}
            aria-invalid={errors.approverId ? 'true' : 'false'}
          >
            <option value="">请选择审批人</option>
            <option value="approver_001">张经理（资产管理部门）</option>
            <option value="approver_002">李总监（财务部门）</option>
            <option value="approver_003">王主管（IT运维部门）</option>
          </select>
          {errors.approverId && (
            <span id="approver-error" className="text-sm text-red-500 mt-1 block">
              {errors.approverId}
            </span>
          )}
          {!canSelectApprover() && (
            <span className="text-sm text-gray-400 mt-1">
              您没有权限选择审批人，系统将自动分配
            </span>
          )}
        </div>

        {/* 优先级选择 */}
        <div className="form-field">
          <label
            htmlFor="priority"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            优先级
          </label>
          <div className="flex gap-4">
            {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
              <label
                key={p}
                className={`inline-flex items-center px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                  fields.priority === p
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  value={p}
                  checked={fields.priority === p}
                  onChange={(e) => handleFieldChange('priority', e.target.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium">
                  {p === 'LOW' && '低'}
                  {p === 'MEDIUM' && '中'}
                  {p === 'HIGH' && '高'}
                  {p === 'URGENT' && '紧急'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* 附件上传区域（占位） */}
        <div className="form-field">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            附件
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer">
            <svg
              className="w-8 h-8 mx-auto text-gray-400 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-sm text-gray-500">
              点击或拖拽文件到此处上传
            </span>
            <span className="text-xs text-gray-400 block mt-1">
              支持 jpg、png、pdf、docx 格式，单个文件不超过10MB
            </span>
          </div>
        </div>

        {/* 状态流转说明 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">工单状态说明</h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="px-2 py-1 bg-gray-200 rounded">草稿</span>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">待审批</span>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">审批中</span>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">已完成</span>
            <span className="mx-2">或</span>
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded">已拒绝</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            重置
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>提交中...</span>
              </>
            ) : (
              '提交工单'
            )}
          </button>
        </div>
      </form>

      {/* 审批通知提示 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-800">提交后将自动通知审批人</h4>
            <p className="text-sm text-blue-600 mt-1">
              工单提交后，系统将自动向审批人发送站内通知和邮件提醒（已配置邮箱通知）。
              您可以在工单详情页查看审批进度。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkOrderSubmitForm;