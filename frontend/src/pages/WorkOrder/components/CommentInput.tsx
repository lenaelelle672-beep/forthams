/**
 * CommentInput Component
 * 
 * 工单审批意见输入组件，用于审批人在审批工单时输入审批意见。
 * 支持文本输入、字符计数、必填校验、提交处理等功能。
 * 
 * @package 工单审批流程 (SWARM-S5-001)
 * @module WorkOrder/components
 * @version Iteration 1
 * 
 * @example
 * ```tsx
 * // 审批通过场景
 * <CommentInput
 *   actionType="approve"
 *   onSubmit={handleApprove}
 *   loading={isSubmitting}
 * />
 * 
 * // 审批驳回场景
 * <CommentInput
 *   actionType="reject"
 *   onSubmit={handleReject}
 *   required={true}
 *   placeholder="请输入驳回原因"
 * />
 * ```
 * 
 * @features
 * - 支持审批通过/驳回两种模式
 * - 字符数限制与实时计数
 * - 必填/非必填模式切换
 * - 提交状态管理
 * - 自定义占位符文本
 * 
 * @design_decisions
 * - 使用受控组件模式管理输入状态
 * - 驳回模式默认要求填写意见（防止误操作）
 * - 最大字符数限制为500字符，符合业务规范
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Input, Button, Typography, Space, Alert } from 'antd';
import { SendOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { TextArea } = Input;
const { Text } = Typography;

/** 审批操作类型枚举 */
type ApprovalActionType = 'approve' | 'reject';

/** CommentInput 组件 Props 接口 */
export interface CommentInputProps {
  /** 审批操作类型：approve-审批通过，reject-审批驳回 */
  actionType: ApprovalActionType;
  /** 提交回调函数，参数为用户输入的审批意见 */
  onSubmit: (comment: string) => void | Promise<void>;
  /** 提交按钮加载状态 */
  loading?: boolean;
  /** 是否必填意见（驳回时默认true，通过时默认false） */
  required?: boolean;
  /** 最大字符数限制 */
  maxLength?: number;
  /** 输入框占位符文本 */
  placeholder?: string;
  /** 自定义类名 */
  className?: string;
  /** 输入框初始值 */
  initialValue?: string;
  /** 禁用状态 */
  disabled?: boolean;
  /** 提交前的额外校验函数 */
  validate?: (comment: string) => string | null;
  /** 提交成功后是否清空输入框 */
  clearOnSuccess?: boolean;
}

/** 组件内部状态管理接口 */
interface CommentInputState {
  /** 当前输入的审批意见 */
  value: string;
  /** 是否正在提交 */
  isSubmitting: boolean;
  /** 错误信息 */
  errorMessage: string | null;
  /** 是否已触及输入框（用于触发校验） */
  touched: boolean;
}

/**
 * Default maximum character limit for approval comments
 * 审批意见默认最大字符数：500字符
 */
const DEFAULT_MAX_LENGTH = 500;

/**
 * Default placeholder texts based on action type
 */
const DEFAULT_PLACEHOLDERS: Record<ApprovalActionType, string> = {
  approve: '请输入审批通过意见（可选）...',
  reject: '请输入审批驳回原因（必填）...',
};

/**
 * CommentInput 组件
 * 
 * 用于工单审批流程中，审批人输入审批意见的专用组件。
 * 根据审批操作类型（通过/驳回）自动调整UI样式和校验规则。
 * 
 * @param props - CommentInputProps
 * @returns React.FC<CommentInputProps>
 * 
 * @since Iteration 1 (SWARM-S5-001)
 * @author SWARM-S5-001 Team
 * 
 * @performance
 * - 使用 useMemo 缓存计算属性，减少不必要的重渲染
 * - 使用 useCallback 缓存回调函数
 * 
 * @accessibility
 * - 支持键盘导航
 * - 错误状态通过 aria-describedby 关联
 * - 按钮有清晰的 loading 状态提示
 */
const CommentInput: React.FC<CommentInputProps> = ({
  actionType,
  onSubmit,
  loading = false,
  required,
  maxLength = DEFAULT_MAX_LENGTH,
  placeholder,
  className,
  initialValue = '',
  disabled = false,
  validate,
  clearOnSuccess = true,
}) => {
  // 根据 actionType 确定是否默认必填
  const isRequired = useMemo(() => {
    if (required !== undefined) {
      return required;
    }
    return actionType === 'reject';
  }, [required, actionType]);

  // 实际使用的 placeholder
  const actualPlaceholder = useMemo(() => {
    return placeholder || DEFAULT_PLACEHOLDERS[actionType];
  }, [placeholder, actionType]);

  // 组件内部状态
  const [state, setState] = useState<CommentInputState>({
    value: initialValue,
    isSubmitting: false,
    errorMessage: null,
    touched: false,
  });

  /**
   * 校验输入内容
   * 
   * @param value - 待校验的字符串
   * @returns 错误信息字符串，无错误时返回 null
   * 
   * @validation_rules
   * - 必填校验：内容不能为空
   * - 长度校验：不能超过 maxLength
   * - 自定义校验：如果提供了 validate 函数，执行自定义校验
   */
  const validateComment = useCallback(
    (value: string): string | null => {
      // 必填校验
      if (isRequired && !value.trim()) {
        return actionType === 'reject'
          ? '请输入驳回原因，以便申请人了解改进方向'
          : '请输入审批意见';
      }

      // 长度校验
      if (value.length > maxLength) {
        return `审批意见不能超过 ${maxLength} 字符`;
      }

      // 自定义校验
      if (validate) {
        return validate(value);
      }

      return null;
    },
    [isRequired, actionType, maxLength, validate]
  );

  /**
   * 处理输入框内容变化
   * 
   * @param e - React.ChangeEvent<HTMLTextAreaElement>
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      
      // 强制截断超过最大长度的内容
      const truncatedValue = newValue.slice(0, maxLength);
      
      setState((prev) => ({
        ...prev,
        value: truncatedValue,
        touched: true,
        errorMessage: prev.touched ? validateComment(truncatedValue) : null,
      }));
    },
    [maxLength, validateComment]
  );

  /**
   * 处理输入框失焦事件
   * 触发校验逻辑
   */
  const handleBlur = useCallback(() => {
    const error = validateComment(state.value);
    setState((prev) => ({
      ...prev,
      errorMessage: error,
    }));
  }, [state.value, validateComment]);

  /**
   * 处理提交操作
   * 
   * @async
   * @returns Promise<void>
   * 
   * @流程
   * 1. 先进行校验
   * 2. 校验失败显示错误
   * 3. 校验成功调用 onSubmit 回调
   * 4. 成功后根据 clearOnSuccess 清空输入
   */
  const handleSubmit = useCallback(async () => {
    const trimmedValue = state.value.trim();
    
    // 执行校验
    const error = validateComment(trimmedValue);
    if (error) {
      setState((prev) => ({
        ...prev,
        errorMessage: error,
        touched: true,
      }));
      return;
    }

    // 开始提交
    setState((prev) => ({
      ...prev,
      isSubmitting: true,
      errorMessage: null,
    }));

    try {
      await onSubmit(trimmedValue);
      
      // 提交成功后清空（如果配置了的话）
      if (clearOnSuccess) {
        setState((prev) => ({
          ...prev,
          value: '',
          isSubmitting: false,
          touched: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isSubmitting: false,
        }));
      }
    } catch (error) {
      // 提交失败处理
      const errorMsg = error instanceof Error 
        ? error.message 
        : '提交失败，请重试';
      
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        errorMessage: errorMsg,
      }));
    }
  }, [state.value, validateComment, onSubmit, clearOnSuccess]);

  /**
   * 计算字符计数显示
   */
  const charCountDisplay = useMemo(() => {
    const currentLength = state.value.length;
    const isNearLimit = currentLength >= maxLength * 0.9;
    
    return {
      current: currentLength,
      max: maxLength,
      isNearLimit,
      isAtLimit: currentLength >= maxLength,
    };
  }, [state.value.length, maxLength]);

  /**
   * 获取按钮文本
   */
  const buttonText = useMemo(() => {
    if (state.isSubmitting || loading) {
      return actionType === 'approve' ? '提交中...' : '驳回中...';
    }
    return actionType === 'approve' ? '审批通过' : '确认驳回';
  }, [actionType, state.isSubmitting, loading]);

  /**
   * 获取按钮图标
   */
  const buttonIcon = useMemo(() => {
    if (state.isSubmitting || loading) {
      return null;
    }
    return actionType === 'approve' 
      ? <CheckCircleOutlined /> 
      : <CloseCircleOutlined />;
  }, [actionType, state.isSubmitting, loading]);

  /**
   * 获取按钮类型
   */
  const buttonType = actionType === 'approve' ? 'primary' : 'default';
  
  /**
   * 获取按钮危险属性（驳回按钮使用 danger 样式）
   */
  const buttonDanger = actionType === 'reject';

  // 生成唯一ID用于无障碍访问
  const inputId = `comment-input-${actionType}`;
  const errorId = `comment-input-error-${actionType}`;

  return (
    <div 
      className={`comment-input-container ${className || ''}`}
      data-testid={`comment-input-${actionType}`}
      data-action-type={actionType}
    >
      {/* 错误提示 */}
      {state.errorMessage && (
        <Alert
          message={state.errorMessage}
          type="error"
          showIcon
          closable
          onClose={() => setState((prev) => ({ ...prev, errorMessage: null }))}
          style={{ marginBottom: 12 }}
          id={errorId}
        />
      )}

      {/* 输入区域 */}
      <div className="comment-input-wrapper">
        <TextArea
          id={inputId}
          value={state.value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={actualPlaceholder}
          disabled={disabled || state.isSubmitting || loading}
          rows={4}
          maxLength={maxLength}
          showCount={true}
          aria-describedby={state.errorMessage ? errorId : undefined}
          aria-required={isRequired}
          data-testid="comment-textarea"
          style={{
            resize: 'none',
            fontSize: 14,
          }}
        />
      </div>

      {/* 操作区域 */}
      <div className="comment-input-actions">
        <Space direction="horizontal" size="middle">
          {/* 字符计数 */}
          <Text 
            type={charCountDisplay.isNearLimit ? 'warning' : 'secondary'}
            className="char-count"
            data-testid="char-count"
          >
            {charCountDisplay.current} / {charCountDisplay.max}
          </Text>

          {/* 提交按钮 */}
          <Button
            type={buttonType}
            danger={buttonDanger}
            icon={buttonIcon}
            onClick={handleSubmit}
            loading={state.isSubmitting || loading}
            disabled={disabled}
            htmlType="button"
            data-testid="submit-button"
            aria-busy={state.isSubmitting || loading}
          >
            {buttonText}
          </Button>
        </Space>
      </div>

      {/* 提示信息 */}
      {isRequired && !state.touched && (
        <Text 
          type="secondary" 
          className="required-hint"
          style={{ fontSize: 12, marginTop: 4 }}
        >
          * {actionType === 'reject' ? '驳回时必须填写原因' : '请认真填写审批意见'}
        </Text>
      )}
    </div>
  );
};

/**
 * 审批意见表单集成组件
 * 
 * 提供完整的审批意见表单，包含通过和驳回两个操作入口。
 * 适用于工单详情页的审批区域。
 * 
 * @example
 * ```tsx
 * <ApprovalCommentForm
 *   workOrderId="WO-001"
 *   onApprove={(comment) => handleApprove(comment)}
 *   onReject={(comment) => handleReject(comment)}
 * />
 * ```
 */
export interface ApprovalCommentFormProps {
  /** 工单ID */
  workOrderId: string;
  /** 审批通过回调 */
  onApprove: (comment: string) => void | Promise<void>;
  /** 审批驳回调 */
  onReject: (comment: string) => void | Promise<void>;
  /** 通过按钮加载状态 */
  approveLoading?: boolean;
  /** 驳回按钮加载状态 */
  rejectLoading?: boolean;
  /** 禁用所有操作 */
  disabled?: boolean;
  /** 通过意见是否必填 */
  approveRequired?: boolean;
  /** 驳回意见是否必填 */
  rejectRequired?: boolean;
}

/**
 * ApprovalCommentForm 组件
 * 
 * 完整的审批意见表单，同时提供审批通过和审批驳回两个操作。
 * 
 * @param props - ApprovalCommentFormProps
 * @returns React.FC<ApprovalCommentFormProps>
 */
export const ApprovalCommentForm: React.FC<ApprovalCommentFormProps> = ({
  workOrderId,
  onApprove,
  onReject,
  approveLoading = false,
  rejectLoading = false,
  disabled = false,
  approveRequired = false,
  rejectRequired = true,
}) => {
  const [approveComment, setApproveComment] = useState('');
  const [rejectComment, setRejectComment] = useState('');

  const handleApproveSubmit = useCallback(
    async (comment: string) => {
      setApproveComment(comment);
      await onApprove(comment);
    },
    [onApprove]
  );

  const handleRejectSubmit = useCallback(
    async (comment: string) => {
      setRejectComment(comment);
      await onReject(comment);
    },
    [onReject]
  );

  return (
    <div 
      className="approval-comment-form"
      data-testid="approval-comment-form"
      data-workorder-id={workOrderId}
    >
      <div className="approval-form-header">
        <Typography.Title level={5}>审批操作</Typography.Title>
      </div>

      <div className="approval-form-content">
        <div className="approval-section">
          <Typography.Text strong>审批通过</Typography.Text>
          <CommentInput
            actionType="approve"
            onSubmit={handleApproveSubmit}
            loading={approveLoading}
            required={approveRequired}
            initialValue={approveComment}
            disabled={disabled}
          />
        </div>

        <Divider />

        <div className="reject-section">
          <Typography.Text strong type="danger">审批驳回</Typography.Text>
          <CommentInput
            actionType="reject"
            onSubmit={handleRejectSubmit}
            loading={rejectLoading}
            required={rejectRequired}
            initialValue={rejectComment}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

// 引入 Divider 组件
import { Divider } from 'antd';

// ===================== Type Exports =====================

/** CommentInput 组件导出 */
export default CommentInput;

/** 组件名称常量 - 用于日志和调试 */
export const COMMENT_INPUT_DISPLAY_NAME = 'CommentInput';

/** 组件版本 - 用于调试和追踪 */
export const COMMENT_INPUT_VERSION = '1.0.0';

/** 审批意见最大长度常量 */
export const COMMENT_MAX_LENGTH = DEFAULT_MAX_LENGTH;

/** 审批意见最小长度（当必填时） */
export const COMMENT_MIN_LENGTH = 1;

// ===================== Styled Components (Optional) =====================

/**
 * CSS-in-JS 样式定义（可选使用）
 * 如项目使用 Tailwind CSS，可忽略此部分
 */
export const commentInputStyles = {
  container: {
    padding: '16px',
    backgroundColor: '#fafafa',
    borderRadius: '8px',
    border: '1px solid #f0f0f0',
  },
  inputWrapper: {
    marginBottom: '12px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  charCount: {
    fontSize: '12px',
  },
  requiredHint: {
    color: '#999',
    fontSize: '12px',
  },
};

// ===================== Hook: useCommentInput =====================

/**
 * CommentInput 状态管理 Hook
 * 
 * 用于在组件外部管理审批意见的状态逻辑。
 * 提供状态管理、校验逻辑和提交处理的完整封装。
 * 
 * @param initialValue - 初始值
 * @param options - 配置选项
 * @returns 状态管理对象
 * 
 * @example
 * ```tsx
 * const commentState = useCommentInput('', {
 *   required: true,
 *   maxLength: 500,
 * });
 * 
 * return (
 *   <CommentInput
 *     {...commentState}
 *     actionType="reject"
 *     onSubmit={handleSubmit}
 *   />
 * );
 * ```
 */
export interface UseCommentInputOptions {
  /** 是否必填 */
  required?: boolean;
  /** 最大字符数 */
  maxLength?: number;
  /** 自定义校验函数 */
  validate?: (value: string) => string | null;
  /** 提交前回调 */
  beforeSubmit?: (value: string) => boolean;
  /** 提交后回调 */
  afterSubmit?: () => void;
}

export interface UseCommentInputReturn {
  /** 当前输入值 */
  value: string;
  /** 输入值变化处理函数 */
  onChange: (value: string) => void;
  /** 是否触及过输入框 */
  touched: boolean;
  /** 错误信息 */
  error: string | null;
  /** 是否正在提交 */
  submitting: boolean;
  /** 重置状态 */
  reset: () => void;
  /** 提交处理函数 */
  submit: (onSubmit: (value: string) => void | Promise<void>) => Promise<void>;
  /** 是否可以提交 */
  canSubmit: boolean;
}

export function useCommentInput(
  initialValue: string = '',
  options: UseCommentInputOptions = {}
): UseCommentInputReturn {
  const {
    required = false,
    maxLength = DEFAULT_MAX_LENGTH,
    validate,
    beforeSubmit,
    afterSubmit,
  } = options;

  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * 内部校验函数
   */
  const internalValidate = useCallback(
    (val: string): string | null => {
      if (required && !val.trim()) {
        return '请输入审批意见';
      }
      if (val.length > maxLength) {
        return `意见不能超过 ${maxLength} 字符`;
      }
      if (validate) {
        return validate(val);
      }
      return null;
    },
    [required, maxLength, validate]
  );

  /**
   * 处理输入变化
   */
  const onChange = useCallback(
    (newValue: string) => {
      const truncated = newValue.slice(0, maxLength);
      setValue(truncated);
      setTouched(true);
      if (touched) {
        setError(internalValidate(truncated));
      }
    },
    [maxLength, touched, internalValidate]
  );

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setValue(initialValue);
    setTouched(false);
    setError(null);
    setSubmitting(false);
  }, [initialValue]);

  /**
   * 提交处理
   */
  const submit = useCallback(
    async (onSubmit: (value: string) => void | Promise<void>) => {
      const validationError = internalValidate(value);
      if (validationError) {
        setError(validationError);
        setTouched(true);
        return;
      }

      if (beforeSubmit && !beforeSubmit(value)) {
        return;
      }

      setSubmitting(true);
      try {
        await onSubmit(value.trim());
        afterSubmit?.();
      } finally {
        setSubmitting(false);
      }
    },
    [value, internalValidate, beforeSubmit, afterSubmit]
  );

  /**
   * 是否可以提交
   */
  const canSubmit = useMemo(() => {
    if (required) {
      return value.trim().length > 0 && !error && !submitting;
    }
    return !submitting;
  }, [required, value, error, submitting]);

  return {
    value,
    onChange,
    touched,
    error,
    submitting,
    reset,
    submit,
    canSubmit,
  };
}