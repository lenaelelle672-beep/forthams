import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalActionPanel } from '../../src/app/components/approval/ApprovalActionPanel';

describe('ApprovalActionPanel', () => {
  it('allows approving without a comment', () => {
    const onApprove = vi.fn();

    render(
      <ApprovalActionPanel
        approvalId="12"
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '通过' }));

    expect(onApprove).toHaveBeenCalledWith({ approvalId: '12', comment: '' });
  });

  it('still requires a rejection reason', () => {
    const onReject = vi.fn();

    render(
      <ApprovalActionPanel
        approvalId="12"
        onApprove={vi.fn()}
        onReject={onReject}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '驳回' }));

    expect(onReject).not.toHaveBeenCalled();
    expect(screen.getByText('请输入驳回理由后再进行操作')).toBeInTheDocument();
  });

  it('passes the comment when rejecting with a reason', () => {
    const onReject = vi.fn();

    render(
      <ApprovalActionPanel
        approvalId="12"
        onApprove={vi.fn()}
        onReject={onReject}
      />,
    );

    const textarea = screen.getByPlaceholderText('请输入审批意见...');
    fireEvent.change(textarea, { target: { value: '资产不符合要求' } });
    fireEvent.click(screen.getByRole('button', { name: '驳回' }));

    expect(onReject).toHaveBeenCalledWith({ approvalId: '12', comment: '资产不符合要求' });
  });

  it('passes the comment when approving with a comment', () => {
    const onApprove = vi.fn();

    render(
      <ApprovalActionPanel
        approvalId="12"
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );

    const textarea = screen.getByPlaceholderText('请输入审批意见...');
    fireEvent.change(textarea, { target: { value: '同意报废' } });
    fireEvent.click(screen.getByRole('button', { name: '通过' }));

    expect(onApprove).toHaveBeenCalledWith({ approvalId: '12', comment: '同意报废' });
  });

  it('disables buttons when disabled prop is true', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();

    render(
      <ApprovalActionPanel
        approvalId="12"
        disabled={true}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );

    const approveBtn = screen.getByRole('button', { name: '通过' });
    const rejectBtn = screen.getByRole('button', { name: '驳回' });

    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();

    fireEvent.click(approveBtn);
    expect(onApprove).not.toHaveBeenCalled();
  });

  it('disables buttons when loading prop is true', () => {
    const onApprove = vi.fn();

    render(
      <ApprovalActionPanel
        approvalId="12"
        loading={true}
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );

    const approveBtn = screen.getByRole('button', { name: '通过' });
    expect(approveBtn).toBeDisabled();
  });

  it('clears validation error when user types in the comment field', () => {
    const onReject = vi.fn();

    render(
      <ApprovalActionPanel
        approvalId="12"
        onApprove={vi.fn()}
        onReject={onReject}
      />,
    );

    // Trigger validation error
    fireEvent.click(screen.getByRole('button', { name: '驳回' }));
    expect(screen.getByText('请输入驳回理由后再进行操作')).toBeInTheDocument();

    // Type to clear error
    const textarea = screen.getByPlaceholderText('请输入审批意见...');
    fireEvent.change(textarea, { target: { value: 'x' } });
    expect(screen.queryByText('请输入驳回理由后再进行操作')).not.toBeInTheDocument();
  });

  it('trims whitespace from comments', () => {
    const onApprove = vi.fn();

    render(
      <ApprovalActionPanel
        approvalId="12"
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );

    const textarea = screen.getByPlaceholderText('请输入审批意见...');
    fireEvent.change(textarea, { target: { value: '  hello  ' } });
    fireEvent.click(screen.getByRole('button', { name: '通过' }));

    expect(onApprove).toHaveBeenCalledWith({ approvalId: '12', comment: 'hello' });
  });

  it('displays server error message when errorMessage prop is provided', () => {
    render(
      <ApprovalActionPanel
        approvalId="12"
        errorMessage="审批流程已通过，不可重复审批"
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText('审批流程已通过，不可重复审批')).toBeInTheDocument();
  });

  it('does not display error banner when errorMessage is not provided', () => {
    render(
      <ApprovalActionPanel
        approvalId="12"
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('approval-server-error')).not.toBeInTheDocument();
  });

  it('keeps buttons enabled when status is actionable', () => {
    const onApprove = vi.fn();

    render(
      <ApprovalActionPanel
        approvalId="12"
        disabled={false}
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );

    const approveBtn = screen.getByRole('button', { name: '通过' });
    expect(approveBtn).toBeEnabled();
  });
});
