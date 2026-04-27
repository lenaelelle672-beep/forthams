import React, { useState, useCallback } from 'react';
import { Input } from 'antd';
import { CommentOutlined } from '@ant-design/icons';

/**
 * 审批意见输入组件
 * 
 * 提供审批意见的文本输入功能，支持审批人填写审批备注。
 * 
 * @returns {JSX.Element} 审批意见输入组件
 */
const ApprovalComment: React.FC = () => {
  const [comment, setComment] = useState<string>('');

  /**
   * 处理审批意见输入变化
   * 
   * @param {React.ChangeEvent<HTMLTextAreaElement>} e - 输入事件对象
   * @returns {void}
   */
  const handleCommentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      setComment(e.target.value);
    },
    []
  );

  return (
    <div className="approval-comment-container" data-testid="approval-comment-input">
      <Input.TextArea
        placeholder="请输入审批意见（选填）"
        value={comment}
        onChange={handleCommentChange}
        rows={4}
        maxLength={500}
        showCount
        prefix={<CommentOutlined />}
      />
    </div>
  );
};

export default ApprovalComment;