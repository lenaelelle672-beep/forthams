import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserMentionAutocomplete from './UserMentionAutocomplete';
import http from '@/utils/http';

vi.mock('@/utils/http', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: ({
    onValueChange,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { onValueChange?: (value: string) => void }) => (
    <input {...props} readOnly />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
  }) => <button type="button" onClick={onSelect}>{children}</button>,
}));

describe('UserMentionAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('uses the shared http client for mention user search', async () => {
    vi.mocked(http.get).mockResolvedValue([
      { id: 1, username: 'zhangsan', realName: '张三' },
    ]);
    const onChange = vi.fn();

    render(
      <UserMentionAutocomplete
        value=""
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('输入评论内容，使用 @用户名 提及他人'), {
      target: { value: '@zh', selectionStart: 3 },
    });

    await waitFor(() => {
      expect(http.get).toHaveBeenCalledWith('/users/mentions/search', {
        params: { keyword: 'zh' },
      });
    });
    expect(await screen.findByText('@zhangsan')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
  });
});
