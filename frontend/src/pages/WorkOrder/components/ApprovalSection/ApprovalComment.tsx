/**
 * ApprovalComment Component
 *
 * 审批意见输入组件，用于工单审批流程中的审批人填写审批备注。
 * Iteration 1 阶段：仅提供 UI 展示，输入功能受控，实际提交逻辑 Phase 2 实现。
 *
 * @package components/WorkOrder/ApprovalSection
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { Input } from 'antd';
import { CommentOutlined } from '@ant-design/icons';
import './ApprovalComment.css';

const { TextArea } = Input;

/**
 * Props 接口定义
 *
 * @interface ApprovalCommentProps
 * @description ApprovalComment 组件属性
 */
interface ApprovalCommentProps {
  /**
   * 当前工单ID
   * @type {string}
   */
  workOrderId?: string;

  /**
   * 当前用户是否为审批人
   * @type {boolean}
   * @default false
   */
  isApprover?: boolean;

  /**
   * 最大字符数限制
   * @type {number}
   * @default 500
   */
  maxLength?: number;

  /**
   * 占位符文本（可选定制）
   * @type {string}
   * @default '请输入审批意见（选填）'
   */
  placeholder?: string;

  /**
   * 初始值
   * @type {string}
   * @default ''
   */
  initialValue?: string;

  /**
   * 禁用状态
   * @type {boolean}
   * @default false
   */
  disabled?: boolean;

  /**
   * 值变化回调
   * @param {string} value - 当前输入值
   */
  onChange?: (value: string) => void;
}

/**
 * ApprovalComment 组件
 *
 * 工单审批意见输入组件，集成到 ApprovalSection 审批区块中。
 * 支持审批人填写审批备注，字符数限制 500。
 *
 * @function ApprovalComment
 * @param {ApprovalCommentProps} props - 组件属性
 * @returns {React.ReactElement} 审批意见输入组件
 *
 * @example
 * ```tsx
 * <ApprovalComment
 *   workOrderId="WO-001"
 *   isApprover={true}
 *   onChange={(value) => console.log(value)}
 * />
 * ```
 *
 * @since Iteration 1 - Phase 1
 * @see ApprovalSection
 */
const ApprovalComment: React.FC<ApprovalCommentProps> = ({
  workOrderId,
  isApprover = false,
  maxLength = 500,
  placeholder = '请输入审批意见（选填）',
  initialValue = '',
  disabled = false,
  onChange,
}) => {
  /**
   * 审批意见状态
   * @type {string}
   */
  const [commentValue, setCommentValue] = useState<string>(initialValue);

  /**
   * 处理输入值变化
   *
   * @function handleChange
   * @param {React.ChangeEvent<HTMLTextAreaElement>} e - 输入事件
   * @returns {void}
   */
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const value = e.target.value;

    // Iteration 1: 字符数限制
    if (value.length <= maxLength) {
      setCommentValue(value);
      onChange?.(value);
    }
  };

  /**
   * 计算当前字符数
   *
   * @function getCharCount
   * @returns {number} 当前字符数
   */
  const getCharCount = (): number => {
    return commentValue.length;
  };

  /**
   * 计算字符数占比（用于进度条显示）
   *
   * @function getCharPercentage
   * @returns {number} 百分比值 0-100
   */
  const getCharPercentage = (): number => {
    return Math.round((getCharCount() / maxLength) * 100);
  };

  /**
   * 渲染字符数状态标签
   *
   * @function renderCharCounter
   * @returns {React.ReactElement | null}
   */
  const renderCharCounter = (): React.ReactElement | null => {
    // 超过 80% 显示警告
    const isWarning = getCharPercentage() >= 80;

    return (
      <span
        className={`approval-comment-counter ${isWarning ? 'warning' : ''}`}
        title={`已输入 ${getCharCount()} / ${maxLength} 字符`}
      >
        {getCharCount()}/{maxLength}
      </span>
    );
  };

  return (
    <div
      className="approval-comment-container"
      data-testid="approval-comment-input"
      data-work-order-id={workOrderId}
    >
      {/* 标签区域 */}
      <div className="approval-comment-header">
        <CommentOutlined className="approval-comment-icon" />
        <span className="approval-comment-label">审批意见</span>
        {renderCharCounter()}
      </div>

      {/* 输入区域 */}
      <TextArea
        value={commentValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        rows={4}
        showCount={false}
        className="approval-comment-textarea"
        title={
          disabled
            ? '审批意见输入 Phase 2 实现'
            : '请输入审批意见（选填）'
        }
        style={{
          resize: 'vertical',
          minHeight: '100px',
        }}
      />

      {/* 辅助信息 */}
      {isApprover && !disabled && (
        <div className="approval-comment-hint">
          <span className="hint-icon">💡</span>
          <span>审批意见将记录到审批历史中</span>
        </div>
      )}

      {/* Phase 1 提示信息 */}
      {disabled && (
        <div className="approval-comment-phase-notice">
          <span className="notice-badge">Phase 1</span>
          <span>审批意见功能 Phase 2 开放</span>
        </div>
      )}
    </div>
  );
};

/**
 * 默认导出
 */
export default ApprovalComment;

/**
 * 具名导出
 */
export { ApprovalComment };
export type { ApprovalCommentProps };