/**
 * ApprovalCommentInput Component
 * 
 * 工单审批意见输入组件
 * 用于在审批详情页录入审批意见
 * 
 * @spec SWARM-2025-Q2-P0-003
 * @spec_phase Phase 2: 前端审批页面
 * @iteration Iteration 8
 * 
 * @constraints
 * - 审批意见非必填
 * - 最大 500 字符
 */

import React, { useState, useCallback, useEffect } from 'react';

export interface ApprovalCommentInputProps {
  /** 初始值 */
  initialValue?: string;
  /** 意见变更回调 */
  onChange?: (value: string) => void;
  /** 最大字符数 */
  maxLength?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 占位符文本 */
  placeholder?: string;
  /** 是否显示字符计数 */
  showCharCount?: boolean;
  /** 样式类名 */
  className?: string;
}

/**
 * 审批意见输入组件
 * 
 * @param props - 组件属性
 * @returns 审批意见输入 JSX 元素
 */
export const ApprovalCommentInput: React.FC<ApprovalCommentInputProps> = ({
  initialValue = '',
  onChange,
  maxLength = 500,
  disabled = false,
  placeholder = '请输入审批意见（可选）',
  showCharCount = true,
  className = '',
}) => {
  const [comment, setComment] = useState(initialValue);
  const [charCount, setCharCount] = useState(initialValue.length);

  // 同步初始值变化
  useEffect(() => {
    setComment(initialValue);
    setCharCount(initialValue.length);
  }, [initialValue]);

  /**
   * 处理输入值变更
   * 
   * @param event - 输入事件对象
   */
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      
      // 限制最大字符数
      if (value.length <= maxLength) {
        setComment(value);
        setCharCount(value.length);
        onChange?.(value);
      }
    },
    [maxLength, onChange]
  );

  /**
   * 获取字符计数颜色
   * 
   * @returns 样式类名
   */
  const getCharCountColor = useCallback(() => {
    const ratio = charCount / maxLength;
    if (ratio >= 0.9) {
      return 'text-red-500';
    }
    if (ratio >= 0.7) {
      return 'text-amber-500';
    }
    return 'text-gray-500';
  }, [charCount, maxLength]);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-gray-700">
        审批意见
      </label>
      
      <textarea
        value={comment}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        rows={4}
        className={`
          w-full px-3 py-2
          border border-gray-300 rounded-lg
          text-gray-900 text-sm
          placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
          resize-none
          transition-colors duration-200
        `}
        aria-label="审批意见"
        aria-describedby={showCharCount ? 'comment-char-count' : undefined}
      />
      
      {showCharCount && (
        <div className="flex justify-end" id="comment-char-count">
          <span className={`text-xs ${getCharCountColor()}`}>
            {charCount}/{maxLength}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * 审批意见验证钩子
 * 
 * @param comment - 审批意见内容
 * @param maxLength - 最大长度
 * @returns 验证结果
 */
export const useApprovalCommentValidation = (
  comment: string,
  maxLength: number = 500
) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (comment.length > maxLength) {
      setError(`审批意见不能超过 ${maxLength} 个字符`);
    } else {
      setError(null);
    }
  }, [comment, maxLength]);

  const isValid = comment.length === 0 || comment.length <= maxLength;

  return { isValid, error };
};

export default ApprovalCommentInput;