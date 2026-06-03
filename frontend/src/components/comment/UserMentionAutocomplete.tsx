/**
 * @file components/comment/UserMentionAutocomplete.tsx
 * @description @mention 自动补全组件 — 使用 cmdk 实现快速用户搜索
 */

import { useState, useEffect, useRef, type KeyboardEvent, type ChangeEvent } from 'react';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Search, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UserMentionAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  onKeyEnter?: () => void;
}

interface UserInfo {
  id: number;
  username: string;
  realName?: string;
  email?: string;
  phone?: string;
}

export default function UserMentionAutocomplete({
  value,
  onChange,
  placeholder = '输入评论内容，使用 @用户名 提及他人',
  maxLength = 1000,
  disabled = false,
  onKeyEnter,
}: UserMentionAutocompleteProps) {
  const [keyword, setKeyword] = useState('');
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCommand, setShowCommand] = useState(false);
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 防抖搜索用户
  useEffect(() => {
    if (!keyword) {
      setUsers([]);
      return;
    }

    const timer = setTimeout(() => {
      searchUsers(keyword);
    }, 300);

    return () => clearTimeout(timer);
  }, [keyword]);

  // 搜索用户
  const searchUsers = async (searchKeyword: string) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/users/search?keyword=${encodeURIComponent(searchKeyword)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('搜索用户失败');
      }

      const data = await response.json();
      if (data.code === 200 && data.data) {
        setUsers(data.data);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('搜索用户失败:', error);
      toast.error('搜索用户失败');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 检测输入 @ 符号
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= maxLength) {
      onChange(val);

      // 检测是否在输入 @mention
      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = val.substring(0, cursorPos);

      // 查找最后一个 @ 符号的位置
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1) {
        // 检查 @ 后面是否有空格或换行
        const afterAt = textBeforeCursor.substring(lastAtIndex + 1);
        if (afterAt && !/\s/.test(afterAt)) {
          // 正在输入 @mention
          setMentionStartPos(lastAtIndex);
          setKeyword(afterAt);
          setShowCommand(true);
        } else {
          // @mention 后有空格，结束输入
          setMentionStartPos(null);
          setKeyword('');
          setShowCommand(false);
        }
      } else {
        setMentionStartPos(null);
        setKeyword('');
        setShowCommand(false);
      }
    }
  };

  // 选择用户
  const selectUser = (user: UserInfo) => {
    if (mentionStartPos === null) return;

    // 替换 @mention 部分
    const beforeMention = value.substring(0, mentionStartPos);
    const afterMention = value.substring(textareaRef.current?.selectionStart || 0);
    const newValue = beforeMention + '@' + user.username + ' ' + afterMention;

    onChange(newValue);
    setMentionStartPos(null);
    setKeyword('');
    setShowCommand(false);

    // 聚焦到文本框
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  // 键盘事件处理
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (showCommand && users.length > 0) {
        // 在命令面板中，使用上下箭头选择
        e.preventDefault();
      } else {
        e.preventDefault();
        onKeyEnter?.();
      }
    }
  };

  // 高亮显示 @mention（仅预览用，textarea 本身不支持富文本）
  const mentionCount = (value.match(/@(\S+)/g) || []).length;

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        rows={3}
        className="w-full resize-none rounded-xl border border-[var(--surface-border)] bg-[var(--input-background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--surface-muted-text)] transition focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
      />

      {/* @mention 自动补全面板 */}
      {showCommand && (
        <div className="absolute z-50 mt-2 w-full max-w-sm rounded-lg border border-[var(--surface-border)] bg-[var(--surface-card)] shadow-lg">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b border-[var(--surface-border-subtle)] px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="搜索用户..."
                value={keyword}
                onValueChange={setKeyword}
                className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--surface-muted-text)]" />
                </div>
              ) : users.length === 0 ? (
                <CommandEmpty>未找到用户</CommandEmpty>
              ) : (
                <CommandGroup>
                  {users.map((user) => (
                    <CommandItem
                      key={user.id}
                      onSelect={() => selectUser(user)}
                      className="cursor-pointer"
                    >
                      <User className="mr-2 h-4 w-4" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {user.realName || user.username}
                        </span>
                        <span className="text-xs text-[var(--surface-muted-text)]">
                          @{user.username}
                          {user.email && ` · ${user.email}`}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      )}

      <div className="mt-1 flex items-center justify-between text-xs text-[var(--surface-muted-text)]">
        <span>
          {mentionCount > 0 && (
            <span className="text-[var(--brand-primary)]">
              {mentionCount} 个提及
            </span>
          )}
        </span>
        <span>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}