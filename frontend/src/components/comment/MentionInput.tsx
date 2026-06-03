/**
 * @file components/comment/MentionInput.tsx
 * @description @mention 输入框组件 — 支持 @用户名 标记
 */

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  onKeyEnter?: () => void;
}

export default function MentionInput({
  value,
  onChange,
  placeholder = '输入评论内容，使用 @用户名 提及他人',
  maxLength = 1000,
  disabled = false,
  onKeyEnter,
}: MentionInputProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      if (val.length <= maxLength) {
        onChange(val);
      }
    },
    [onChange, maxLength],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onKeyEnter?.();
      }
    },
    [onKeyEnter],
  );

  // 高亮显示 @mention（仅预览用，textarea 本身不支持富文本）
  const mentionCount = (value.match(/@(\S+)/g) || []).length;

  return (
    <div className="relative">
      <textarea
        ref={textRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        rows={3}
        className="w-full resize-none rounded-xl border border-[var(--surface-border)] bg-[var(--input-background)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--surface-muted-text)] transition focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
      />
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
