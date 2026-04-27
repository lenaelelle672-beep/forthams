/**
 * WorkOrder Apply Composable
 * 工单审批申请 - 组合式函数
 * 
 * 功能说明：
 * - 提供工单申请表单的状态管理和业务逻辑
 * - 支持工单提交、验证、状态追踪
 * 
 * @module composables/useWorkOrderApply
 * @version 1.0.0
 */

import { ref, computed, reactive } from 'vue';
import type { Ref } from 'vue';

/**
 * 工单状态枚举
 */
export enum WorkOrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVING = 'APPROVING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  CLOSED = 'CLOSED'
}

/**
 * 工单申请表单数据结构
 */
export interface WorkOrderFormData {
  /** 工单标题 */
  title: string;
  /** 工单描述 */
  description: string;
  /** 工单类别 */
  category: string;
  /** 优先级 */
  priority: 'low' | 'medium' | 'high' | 'urgent';
  /** 附件列表 */
  attachments: string[];
  /** 审批人 ID */
  approverId?: string;
}

/**
 * 工单详情数据结构
 */
export interface WorkOrderDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: WorkOrderStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  attachments: string[];
  approverId?: string;
}

/**
 * 审批历史节点
 */
export interface ApprovalHistoryNode {
  id: string;
  status: WorkOrderStatus;
  operator: string;
  operatedAt: string;
  comment?: string;
}

/**
 * 表单验证规则
 */
export interface FormValidationRule {
  required: boolean;
  message: string;
  trigger: 'blur' | 'change' | 'submit';
  max?: number;
  min?: number;
}

/**
 * 提交结果
 */
export interface SubmitResult {
  success: boolean;
  workOrderId?: string;
  error?: string;
}

/**
 * useWorkOrderApply 组合式函数返回值
 */
export interface UseWorkOrderApplyReturn {
  /** 表单数据 */
  formData: WorkOrderFormData;
  /** 表单验证规则 */
  formRules: Record<string, FormValidationRule[]>;
  /** 是否正在提交 */
  isSubmitting: Ref<boolean>;
  /** 是否提交成功 */
  isSubmitSuccess: Ref<boolean>;
  /** 提交错误信息 */
  submitError: Ref<string | null>;
  /** 当前工单 ID（提交成功后） */
  currentWorkOrderId: Ref<string | null>;
  /** 表单引用 */
  formRef: Ref<any | null>;
  /** 设置表单引用 */
  setFormRef: (el: any) => void;
  /** 更新表单字段 */
  updateField: (field: keyof WorkOrderFormData, value: any) => void;
  /** 表单验证 */
  validateForm: () => Promise<boolean>;
  /** 重置表单 */
  resetForm: () => void;
  /** 提交工单 */
  submitWorkOrder: () => Promise<SubmitResult>;
  /** 添加附件 */
  addAttachment: (fileId: string) => void;
  /** 移除附件 */
  removeAttachment: (fileId: string) => void;
}

/**
 * 工单申请组合式函数
 * 
 * 提供工单申请表单的完整状态管理和业务逻辑
 * 
 * @example
 * ```typescript
 * const {
 *   formData,
 *   isSubmitting,
 *   submitWorkOrder,
 *   validateForm,
 *   resetForm
 * } = useWorkOrderApply();
 * 
 * // 提交表单
 * const handleSubmit = async () => {
 *   if (await validateForm()) {
 *     await submitWorkOrder();
 *   }
 * };
 * ```
 * 
 * @returns {UseWorkOrderApplyReturn} 表单操作接口
 */
export function useWorkOrderApply(): UseWorkOrderApplyReturn {
  // 响应式状态
  const isSubmitting = ref(false);
  const isSubmitSuccess = ref(false);
  const submitError = ref<string | null>(null);
  const currentWorkOrderId = ref<string | null>(null);
  const formRef = ref<any | null>(null);

  // 表单数据
  const formData = reactive<WorkOrderFormData>({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    attachments: [],
    approverId: undefined
  });

  // 表单验证规则
  const formRules: Record<string, FormValidationRule[]> = {
    title: [
      { required: true, message: '请输入工单标题', trigger: 'blur' },
      { max: 100, message: '标题不能超过100字符', trigger: 'blur' }
    ],
    description: [
      { required: true, message: '请输入工单描述', trigger: 'blur' },
      { min: 10, message: '描述至少10个字符', trigger: 'blur' }
    ],
    category: [
      { required: true, message: '请选择工单类别', trigger: 'change' }
    ],
    priority: [
      { required: true, message: '请选择优先级', trigger: 'change' }
    ]
  };

  /**
   * 设置表单引用
   * @param el - 表单 DOM 元素或组件实例
   */
  const setFormRef = (el: any): void => {
    formRef.value = el;
  };

  /**
   * 更新表单字段
   * @param field - 字段名
   * @param value - 字段值
   */
  const updateField = (field: keyof WorkOrderFormData, value: any): void => {
    (formData as any)[field] = value;
  };

  /**
   * 表单验证
   * @returns {Promise<boolean>} 验证是否通过
   */
  const validateForm = async (): Promise<boolean> => {
    if (!formRef.value) {
      console.warn('Form ref not set, skipping validation');
      return true;
    }

    try {
      await formRef.value.validate();
      return true;
    } catch (error) {
      console.error('Form validation failed:', error);
      return false;
    }
  };

  /**
   * 重置表单
   */
  const resetForm = (): void => {
    formData.title = '';
    formData.description = '';
    formData.category = '';
    formData.priority = 'medium';
    formData.attachments = [];
    formData.approverId = undefined;
    
    submitError.value = null;
    isSubmitSuccess.value = false;
    currentWorkOrderId.value = null;

    if (formRef.value) {
      formRef.value.clearValidate();
    }
  };

  /**
   * 提交工单
   * 
   * 将表单数据提交到后端API
   * 
   * @returns {Promise<SubmitResult>} 提交结果
   */
  const submitWorkOrder = async (): Promise<SubmitResult> => {
    // 防止重复提交
    if (isSubmitting.value) {
      return {
        success: false,
        error: '正在提交中，请勿重复操作'
      };
    }

    // 表单验证
    const isValid = await validateForm();
    if (!isValid) {
      return {
        success: false,
        error: '表单验证失败，请检查输入'
      };
    }

    isSubmitting.value = true;
    submitError.value = null;
    isSubmitSuccess.value = false;

    try {
      // 构造请求数据
      const requestData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        priority: formData.priority,
        attachments: formData.attachments,
        approverId: formData.approverId
      };

      // 模拟 API 调用（实际项目中替换为真实 API）
      // const response = await fetch('/api/workorder', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(requestData)
      // });
      
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 模拟成功响应
      const workOrderId = `WO-${Date.now()}`;
      
      // 更新状态
      currentWorkOrderId.value = workOrderId;
      isSubmitSuccess.value = true;

      return {
        success: true,
        workOrderId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '提交失败，请稍后重试';
      submitError.value = errorMessage;
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      isSubmitting.value = false;
    }
  };

  /**
   * 添加附件
   * @param fileId - 文件 ID
   */
  const addAttachment = (fileId: string): void => {
    if (!formData.attachments.includes(fileId)) {
      formData.attachments.push(fileId);
    }
  };

  /**
   * 移除附件
   * @param fileId - 文件 ID
   */
  const removeAttachment = (fileId: string): void => {
    const index = formData.attachments.indexOf(fileId);
    if (index > -1) {
      formData.attachments.splice(index, 1);
    }
  };

  return {
    formData,
    formRules,
    isSubmitting,
    isSubmitSuccess,
    submitError,
    currentWorkOrderId,
    formRef,
    setFormRef,
    updateField,
    validateForm,
    resetForm,
    submitWorkOrder,
    addAttachment,
    removeAttachment
  };
}

// ============================================================
// 状态追踪相关组合式函数
// ============================================================

/**
 * 状态标签颜色映射
 */
const STATUS_COLOR_MAP: Record<WorkOrderStatus, string> = {
  [WorkOrderStatus.DRAFT]: 'info',
  [WorkOrderStatus.PENDING]: 'warning',
  [WorkOrderStatus.APPROVING]: 'primary',
  [WorkOrderStatus.APPROVED]: 'success',
  [WorkOrderStatus.REJECTED]: 'danger',
  [WorkOrderStatus.CANCELLED]: 'info',
  [WorkOrderStatus.CLOSED]: 'success'
};

/**
 * 状态标签文本映射
 */
const STATUS_TEXT_MAP: Record<WorkOrderStatus, string> = {
  [WorkOrderStatus.DRAFT]: '草稿',
  [WorkOrderStatus.PENDING]: '待审批',
  [WorkOrderStatus.APPROVING]: '审批中',
  [WorkOrderStatus.APPROVED]: '已通过',
  [WorkOrderStatus.REJECTED]: '已拒绝',
  [WorkOrderStatus.CANCELLED]: '已撤回',
  [WorkOrderStatus.CLOSED]: '已关闭'
};

/**
 * useWorkOrderStatus 状态追踪组合式函数
 * 
 * 用于追踪工单的审批状态和历史流转
 * 
 * @param workOrderId - 工单 ID
 * @returns 状态追踪接口
 */
export function useWorkOrderStatus(workOrderId: string | Ref<string | null>) {
  const id = isRef(workOrderId) ? workOrderId.value : workOrderId;
  
  const currentStatus = ref<WorkOrderStatus>(WorkOrderStatus.PENDING);
  const historyTimeline = ref<ApprovalHistoryNode[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /**
   * 获取状态标签颜色
   * @param status - 工单状态
   * @returns Element Plus 标签类型
   */
  const getStatusType = (status: WorkOrderStatus): string => {
    return STATUS_COLOR_MAP[status] || 'info';
  };

  /**
   * 获取状态标签文本
   * @param status - 工单状态
   * @returns 状态中文名称
   */
  const getStatusText = (status: WorkOrderStatus): string => {
    return STATUS_TEXT_MAP[status] || status;
  };

  /**
   * 获取当前状态标签类型
   */
  const currentStatusType = computed(() => getStatusType(currentStatus.value));

  /**
   * 获取当前状态文本
   */
  const currentStatusText = computed(() => getStatusText(currentStatus.value));

  /**
   * 获取当前节点是否为高亮状态
   */
  const isCurrentNode = (node: ApprovalHistoryNode): boolean => {
    return node.status === currentStatus.value;
  };

  /**
   * 是否审批中状态
   */
  const isApproving = computed(() => 
    currentStatus.value === WorkOrderStatus.APPROVING ||
    currentStatus.value === WorkOrderStatus.PENDING
  );

  /**
   * 是否已完成（通过或拒绝）
   */
  const isFinished = computed(() =>
    currentStatus.value === WorkOrderStatus.APPROVED ||
    currentStatus.value === WorkOrderStatus.REJECTED ||
    currentStatus.value === WorkOrderStatus.CLOSED
  );

  /**
   * 刷新状态数据
   */
  const refresh = async (): Promise<void> => {
    if (!id) return;

    isLoading.value = true;
    error.value = null;

    try {
      // 模拟 API 调用
      // const response = await fetch(`/api/workorder/${id}`);
      // const data = await response.json();
      
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 模拟数据更新
      currentStatus.value = WorkOrderStatus.APPROVING;
      historyTimeline.value = [
        {
          id: '1',
          status: WorkOrderStatus.PENDING,
          operator: '张三',
          operatedAt: new Date(Date.now() - 86400000).toISOString(),
          comment: '提交审批申请'
        },
        {
          id: '2',
          status: WorkOrderStatus.APPROVING,
          operator: '系统',
          operatedAt: new Date().toISOString(),
          comment: '等待审批中'
        }
      ];
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取状态失败';
    } finally {
      isLoading.value = false;
    }
  };

  return {
    currentStatus,
    currentStatusType,
    currentStatusText,
    historyTimeline,
    isLoading,
    error,
    isApproving,
    isFinished,
    getStatusType,
    getStatusText,
    isCurrentNode,
    refresh
  };
}

// 辅助函数：判断是否为 Ref
function isRef(value: any): value is Ref<any> {
  return value && typeof value === 'object' && 'value' in value;
}

// 导出辅助工具函数
export { STATUS_COLOR_MAP, STATUS_TEXT_MAP };