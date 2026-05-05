/**
 * WorkOrderFormPage Component
 * 
 * 工单表单页面 - 负责工单的创建和提交审批
 * 
 * @description
 * - 用户可在该页面填写工单信息（标题、描述、优先级等）
 * - 支持保存草稿和直接提交审批
 * - 提交后自动跳转到工单详情页
 * 
 * @module WorkOrder/pages/WorkOrderFormPage
 * @category Components
 * @subcategory WorkOrder
 * 
 * @example
 * // 在路由中使用
 * <Route path="/workorders/new" element={<WorkOrderFormPage />} />
 * 
 * @features
 * - [x] 表单验证
 * - [x] 草稿保存
 * - [x] 提交审批
 * - [x] 错误处理
 * - [x] 加载状态
 * 
 * @dependencies
 * - react-router-dom: 路由跳转
 * - axios: API 请求
 * - react-hook-form: 表单管理
 * 
 * @see {@link WorkOrderDetailPage} 工单详情页
 * @see {@link WorkOrderListPage} 工单列表页
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workOrderApi } from '../../api/workOrderApi';
import { userApi } from '../../api/userApi';
import type { WorkOrder, WorkOrderPriority, WorkOrderFormData } from '../../types/workOrder.types';
import type { User } from '../../types/user.types';

/**
 * WorkOrderFormPage Props
 */
interface WorkOrderFormPageProps {
  /** 编辑模式下的工单ID */
  workOrderId?: string;
  /** 编辑模式标识 */
  isEditMode?: boolean;
}

/**
 * 优先级选项配置
 */
const PRIORITY_OPTIONS: Array<{ value: WorkOrderPriority; label: string; color: string }> = [
  { value: 'low', label: '低', color: '#52c41a' },
  { value: 'normal', label: '普通', color: '#1890ff' },
  { value: 'high', label: '高', color: '#faad14' },
  { value: 'urgent', label: '紧急', color: '#ff4d4f' },
];

/**
 * 工单类型选项
 */
const WORKORDER_TYPE_OPTIONS = [
  { value: 'procurement', label: '采购申请' },
  { value: 'maintenance', label: '维修申请' },
  { value: 'retirement', label: '报废申请' },
  { value: 'transfer', label: '调拨申请' },
  { value: 'other', label: '其他' },
];

/**
 * WorkOrderFormPage Component
 * 
 * 工单表单页面组件，提供工单创建和编辑功能
 * 
 * @param props - 组件属性
 * @returns React 组件
 */
const WorkOrderFormPage: React.FC<WorkOrderFormPageProps> = ({
  workOrderId,
  isEditMode = false,
}) => {
  const navigate = useNavigate();
  
  // 表单状态
  const [formData, setFormData] = useState<WorkOrderFormData>({
    title: '',
    description: '',
    type: 'other',
    priority: 'normal',
    assigneeId: '',
    attachments: [],
  });
  
  // UI 状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assignees, setAssignees] = useState<User[]>([]);
  const [currentWorkOrder, setCurrentWorkOrder] = useState<WorkOrder | null>(null);
  
  // 加载审批人列表
  useEffect(() => {
    const loadAssignees = async () => {
      try {
        const response = await userApi.getApprovers();
        setAssignees(response.data);
      } catch (error) {
        console.error('加载审批人列表失败:', error);
      }
    };
    loadAssignees();
  }, []);
  
  // 加载已有工单数据（编辑模式）
  useEffect(() => {
    if (isEditMode && workOrderId) {
      const loadWorkOrder = async () => {
        try {
          const response = await workOrderApi.getById(workOrderId);
          const workOrder = response.data;
          setCurrentWorkOrder(workOrder);
          setFormData({
            title: workOrder.title,
            description: workOrder.description,
            type: workOrder.type,
            priority: workOrder.priority,
            assigneeId: workOrder.assigneeId || '',
            attachments: workOrder.attachments || [],
          });
        } catch (error) {
          console.error('加载工单数据失败:', error);
        }
      };
      loadWorkOrder();
    }
  }, [isEditMode, workOrderId]);
  
  /**
   * 表单字段变更处理
   * 
   * @param field - 字段名
   * @param value - 字段值
   */
  const handleFieldChange = (field: keyof WorkOrderFormData, value: unknown): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除字段错误
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };
  
  /**
   * 表单验证
   * 
   * @returns 验证是否通过
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = '请输入工单标题';
    } else if (formData.title.length > 200) {
      newErrors.title = '标题长度不能超过200个字符';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = '请输入工单描述';
    } else if (formData.description.length > 2000) {
      newErrors.description = '描述长度不能超过2000个字符';
    }
    
    if (!formData.type) {
      newErrors.type = '请选择工单类型';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  /**
   * 提交工单审批
   * 
   * @description
   * - 验证表单数据
   * - 调用提交API
   * - 处理成功/失败结果
   */
  const handleSubmit = async (): Promise<void> => {
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = isEditMode && workOrderId
        ? await workOrderApi.update(workOrderId, formData)
        : await workOrderApi.submit(formData);
      
      const submittedWorkOrder = response.data;
      
      // 显示成功提示
      alert(isEditMode ? '工单更新成功' : '工单提交成功');
      
      // 跳转到详情页
      navigate(`/workorders/${submittedWorkOrder.id}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '提交失败，请重试';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  /**
   * 保存草稿
   * 
   * @description
   * - 保存工单为草稿状态
   * - 不触发审批流程
   */
  const handleSaveDraft = async (): Promise<void> => {
    setIsSavingDraft(true);
    
    try {
      const response = await workOrderApi.saveDraft(formData);
      const draftWorkOrder = response.data;
      
      alert('草稿保存成功');
      
      // 如果是新建工单，刷新页面进入编辑模式
      if (!isEditMode) {
        navigate(`/workorders/${draftWorkOrder.id}/edit`, { replace: true });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '保存失败，请重试';
      alert(errorMessage);
    } finally {
      setIsSavingDraft(false);
    }
  };
  
  /**
   * 取消操作
   * 
   * @description 返回工单列表页
   */
  const handleCancel = (): void => {
    navigate('/workorders');
  };
  
  /**
   * 获取状态徽章颜色
   * 
   * @param status - 工单状态
   * @returns CSS 颜色值
   */
  const getStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      DRAFT: '#d9d9d9',
      PENDING: '#1890ff',
      APPROVED: '#52c41a',
      REJECTED: '#ff4d4f',
      TRANSFERRED: '#722ed1',
    };
    return statusColors[status] || '#d9d9d9';
  };
  
  return (
    <div className="workorder-form-page" data-testid="workorder-form-page">
      {/* 页面头部 */}
      <div className="page-header">
        <h1 className="page-title">
          {isEditMode ? '编辑工单' : '新建工单'}
        </h1>
        {currentWorkOrder && (
          <span 
            className="status-badge"
            data-testid="status-badge"
            style={{ backgroundColor: getStatusColor(currentWorkOrder.status) }}
          >
            {currentWorkOrder.statusText}
          </span>
        )}
      </div>
      
      {/* 工单表单 */}
      <form className="workorder-form" onSubmit={(e) => e.preventDefault()}>
        {/* 工单标题 */}
        <div className="form-group">
          <label htmlFor="title" className="form-label required">
            工单标题
          </label>
          <input
            id="title"
            type="text"
            className={`form-input ${errors.title ? 'error' : ''}`}
            data-testid="title"
            value={formData.title}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            placeholder="请输入工单标题"
            maxLength={200}
          />
          {errors.title && (
            <span className="error-message" data-testid="title-error">
              {errors.title}
            </span>
          )}
          <span className="char-count">
            {formData.title.length}/200
          </span>
        </div>
        
        {/* 工单类型 */}
        <div className="form-group">
          <label htmlFor="type" className="form-label required">
            工单类型
          </label>
          <select
            id="type"
            className={`form-select ${errors.type ? 'error' : ''}`}
            data-testid="type"
            value={formData.type}
            onChange={(e) => handleFieldChange('type', e.target.value)}
          >
            <option value="">请选择工单类型</option>
            {WORKORDER_TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.type && (
            <span className="error-message" data-testid="type-error">
              {errors.type}
            </span>
          )}
        </div>
        
        {/* 优先级 */}
        <div className="form-group">
          <label className="form-label required">优先级</label>
          <div className="priority-selector" data-testid="priority-selector">
            {PRIORITY_OPTIONS.map(option => (
              <label key={option.value} className="priority-option">
                <input
                  type="radio"
                  name="priority"
                  value={option.value}
                  checked={formData.priority === option.value}
                  onChange={(e) => handleFieldChange('priority', e.target.value)}
                />
                <span 
                  className="priority-dot"
                  style={{ backgroundColor: option.color }}
                />
                <span className="priority-label">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* 工单描述 */}
        <div className="form-group">
          <label htmlFor="description" className="form-label required">
            工单描述
          </label>
          <textarea
            id="description"
            className={`form-textarea ${errors.description ? 'error' : ''}`}
            data-testid="description"
            value={formData.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder="请详细描述工单内容"
            rows={6}
            maxLength={2000}
          />
          {errors.description && (
            <span className="error-message" data-testid="description-error">
              {errors.description}
            </span>
          )}
          <span className="char-count">
            {formData.description.length}/2000
          </span>
        </div>
        
        {/* 审批人选择 */}
        <div className="form-group">
          <label htmlFor="assignee" className="form-label">
            审批人
          </label>
          <select
            id="assignee"
            className="form-select"
            data-testid="assignee"
            value={formData.assigneeId}
            onChange={(e) => handleFieldChange('assigneeId', e.target.value)}
          >
            <option value="">请选择审批人</option>
            {assignees.map(assignee => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.name} ({assignee.department})
              </option>
            ))}
          </select>
          <span className="helper-text">
            如不选择，系统将自动分配审批人
          </span>
        </div>
        
        {/* 附件上传 */}
        <div className="form-group">
          <label className="form-label">附件</label>
          <div className="attachment-upload" data-testid="attachment-upload">
            <input
              type="file"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                handleFieldChange('attachments', files);
              }}
            />
            <span className="helper-text">
              支持上传图片、文档等文件，单个文件不超过10MB
            </span>
          </div>
        </div>
        
        {/* 表单操作按钮 */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="cancel-btn"
            onClick={handleCancel}
            disabled={isSubmitting || isSavingDraft}
          >
            取消
          </button>
          <button
            type="button"
            className="btn btn-outline"
            data-testid="draft-btn"
            onClick={handleSaveDraft}
            disabled={isSubmitting || isSavingDraft}
          >
            {isSavingDraft ? '保存中...' : '保存草稿'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="submit-btn"
            onClick={handleSubmit}
            disabled={isSubmitting || isSavingDraft}
          >
            {isSubmitting ? '提交中...' : '提交审批'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default WorkOrderFormPage;