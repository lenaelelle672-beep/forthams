/**
 * @file CommentSection.test.tsx
 * @description 评论组件单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CommentSection from '@/components/comment/CommentSection';
import type { BusinessComment } from '@/types/comment';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock cmdk components
vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: any) => <div data-testid="command">{children}</div>,
  CommandInput: ({ ...props }: any) => <input data-testid="command-input" {...props} />,
  CommandList: ({ children }: any) => <div data-testid="command-list">{children}</div>,
  CommandEmpty: ({ children }: any) => <div data-testid="command-empty">{children}</div>,
  CommandGroup: ({ children }: any) => <div data-testid="command-group">{children}</div>,
  CommandItem: ({ children, onSelect, ...props }: any) => (
    <div data-testid="command-item" onClick={onSelect} {...props}>{children}</div>
  ),
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      userId: 1,
      username: 'testuser',
      realName: '测试用户',
    },
  })),
}));

vi.mock('@/api/comment', () => ({
  getComments: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
}));

import { getComments, createComment, deleteComment } from '@/api/comment';

const mockComments: BusinessComment[] = [
  {
    id: 1,
    businessType: 'ASSET',
    businessId: 100,
    userId: 1,
    userName: '测试用户',
    content: '这是一条测试评论',
    parentCommentId: null,
    tenantId: 'test-tenant',
    createTime: '2024-01-01T10:00:00',
  },
  {
    id: 2,
    businessType: 'ASSET',
    businessId: 100,
    userId: 2,
    userName: '另一个用户',
    content: '这是另一条评论 @testuser',
    parentCommentId: null,
    tenantId: 'test-tenant',
    createTime: '2024-01-01T11:00:00',
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('CommentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该渲染评论列表', async () => {
    (getComments as any).mockResolvedValue({
      records: mockComments,
      total: 2,
    });

    render(
      <CommentSection businessType="ASSET" businessId={100} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('测试用户')).toBeInTheDocument();
      expect(screen.getByText('另一条评论 @testuser')).toBeInTheDocument();
    });
  });

  it('应该显示空状态当没有评论时', async () => {
    (getComments as any).mockResolvedValue({
      records: [],
      total: 0,
    });

    render(
      <CommentSection businessType="ASSET" businessId={100} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('暂无评论，来发表第一条评论吧')).toBeInTheDocument();
    });
  });

  it('应该能够展开和折叠评论区域', async () => {
    (getComments as any).mockResolvedValue({
      records: mockComments,
      total: 2,
    });

    render(
      <CommentSection businessType="ASSET" businessId={100} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('测试用户')).toBeInTheDocument();
    });

    // 点击折叠按钮
    const collapseButton = screen.getByRole('button');
    fireEvent.click(collapseButton);

    await waitFor(() => {
      expect(screen.queryByText('测试用户')).not.toBeInTheDocument();
    });

    // 再次点击展开
    fireEvent.click(collapseButton);

    await waitFor(() => {
      expect(screen.getByText('测试用户')).toBeInTheDocument();
    });
  });

  it('应该能够发表新评论', async () => {
    (getComments as any).mockResolvedValue({
      records: [],
      total: 0,
    });

    (createComment as any).mockResolvedValue({
      id: 3,
      content: '新评论',
      userName: '测试用户',
    });

    render(
      <CommentSection businessType="ASSET" businessId={100} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(
        '输入评论内容，使用 @用户名 提及他人'
      );
      fireEvent.change(textarea, { target: { value: '新评论' } });
    });

    const submitButton = screen.getByText('发表评论');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(createComment).toHaveBeenCalledWith({
        businessType: 'ASSET',
        businessId: 100,
        content: '新评论',
        parentCommentId: null,
        userId: 1,
        userName: '测试用户',
      });
    });
  });

  it('应该阻止发表空评论', async () => {
    (getComments as any).mockResolvedValue({
      records: [],
      total: 0,
    });

    render(
      <CommentSection businessType="ASSET" businessId={100} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const submitButton = screen.getByText('发表评论');
      fireEvent.click(submitButton);
    });

    // 应该显示警告提示
    expect(require('sonner').toast.warning).toHaveBeenCalledWith('请输入评论内容');
  });

  it('应该能够删除自己的评论', async () => {
    (getComments as any).mockResolvedValue({
      records: [mockComments[0]], // 测试用户的评论
      total: 1,
    });

    (deleteComment as any).mockResolvedValue(undefined);

    render(
      <CommentSection businessType="ASSET" businessId={100} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('测试用户')).toBeInTheDocument();
    });

    // 找到删除按钮（用户ID为1，评论的userId也为1）
    const deleteButton = screen.getByRole('button', { name: /删除/ });
    fireEvent.click(deleteButton);

    // 确认对话框
    window.confirm = vi.fn(() => true);

    await waitFor(() => {
      expect(deleteComment).toHaveBeenCalledWith(1);
    });
  });

  it('不应该显示其他用户的删除按钮', async () => {
    (getComments as any).mockResolvedValue({
      records: [mockComments[1]], // 另一个用户的评论
      total: 1,
    });

    render(
      <CommentSection businessType="ASSET" businessId={100} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('另一个用户')).toBeInTheDocument();
    });

    // 不应该显示删除按钮
    expect(screen.queryByRole('button', { name: /删除/ })).not.toBeInTheDocument();
  });

  it('应该能够回复评论', async () => {
    (getComments as any).mockResolvedValue({
      records: mockComments,
      total: 2,
    });

    render(
      <CommentSection businessType="ASSET" businessId={100} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('测试用户')).toBeInTheDocument();
    });

    // 点击回复按钮
    const replyButtons = screen.getAllByText('回复');
    fireEvent.click(replyButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('回复 @测试用户')).toBeInTheDocument();
      expect(screen.getByText('取消回复')).toBeInTheDocument();
    });
  });

  it('应该能够取消回复', async () => {
    (getComments as any).mockResolvedValue({
      records: mockComments,
      total: 2,
    });

    render(
      <CommentSection businessType="ASSET" businessId={100} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('测试用户')).toBeInTheDocument();
    });

    // 点击回复按钮
    const replyButtons = screen.getAllByText('回复');
    fireEvent.click(replyButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('取消回复')).toBeInTheDocument();
    });

    // 点击取消回复
    const cancelButton = screen.getByText('取消回复');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('回复 @测试用户')).not.toBeInTheDocument();
    });
  });

  it('应该显示 @mention 高亮', async () => {
    (getComments as any).mockResolvedValue({
      records: [mockComments[1]],
      total: 1,
    });

    render(
      <CommentSection businessType="ASSET" businessId={100} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const mention = screen.getByText('@testuser');
      expect(mention).toBeInTheDocument();
    });
  });
});