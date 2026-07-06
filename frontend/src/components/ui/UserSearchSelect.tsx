/**
 * @file components/ui/UserSearchSelect.tsx
 * @description 可复用用户搜索选择器组件
 *
 * 提供搜索式下拉选择器，通过后端 API 按关键词搜索用户。
 * 用于部门领导、秘书等用户选择场景。
 *
 * @example
 * ```tsx
 * <UserSearchSelect
 *   value={form.leaderId}
 *   onChange={(val) => setForm(p => ({ ...p, leaderId: val }))}
 *   label="部门领导"
 *   placeholder="搜索用户..."
 * />
 * ```
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, Search, X, Loader2 } from 'lucide-react';
import { searchUsers, getUserDetail } from '@/api/base';
import type { UserItem } from '@/api/base';

export interface UserSearchSelectProps {
  /** 当前选中用户ID（字符串），如 '' 表示未选 */
  value: string;
  /** 选中值变化回调 */
  onChange: (value: string) => void;
  /** 标签文本 */
  label?: string;
  /** 占位文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 错误提示 */
  error?: string;
}

/** 防抖 Hook：延迟更新值，用于输入防抖 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export const UserSearchSelect: React.FC<UserSearchSelectProps> = ({
  value,
  onChange,
  label,
  placeholder = '搜索用户...',
  disabled = false,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  /** 缓存已选用户的显示名，关闭下拉后仍可显示 */
  const [cachedName, setCachedName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedKeyword = useDebounce(searchTerm, 300);

  // 确定最终显示名：缓存名 > 结果中查找 > 空
  const displayName = cachedName ||
    results.find((u) => String(u.id) === value)?.realName ||
    results.find((u) => String(u.id) === value)?.username ||
    '';

  // 防抖搜索
  useEffect(() => {
    if (!debouncedKeyword.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchUsers(debouncedKeyword.trim())
      .then((data) => {
        if (!cancelled) {
          setResults(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedKeyword]);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 编辑模式回填：当 value 非空且 cachedName 为空时，调用 getUserDetail 获取用户名
  useEffect(() => {
    if (value && !cachedName) {
      getUserDetail(Number(value))
        .then((user: any) => {
          if (user?.realName || user?.username) {
            setCachedName(user.realName || user.username);
          }
        })
        .catch(() => {
          // 回填失败时保持 'ID: xxx' 显示，不阻断交互
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleSelect = useCallback(
    (user: UserItem) => {
      onChange(String(user.id));
      setCachedName(user.realName || user.username);
      setIsOpen(false);
      setSearchTerm('');
    },
    [onChange],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
      setCachedName('');
      setSearchTerm('');
    },
    [onChange],
  );

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      if (!isOpen) {
        setSearchTerm('');
      }
    }
  }, [disabled, isOpen]);

  // 打开时自动聚焦输入框
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && <label className="text-sm font-medium text-[#374151]">{label}</label>}
      <div className="relative">
        {/* 触发器按钮 */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={`
            flex items-center justify-between w-full h-9 px-3 rounded-lg border text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-300' : 'border-[#e5e7eb]'}
            ${isOpen ? 'ring-2 ring-blue-200 border-[#3b82f6]' : ''}
          `}
        >
          <span className={`truncate ${value ? 'text-[#0f172a]' : 'text-[#94a3b8]'}`}>
            {value ? displayName || `ID: ${value}` : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {value && (
              <span
                onClick={handleClear}
                className="p-0.5 hover:bg-gray-100 rounded"
                role="button"
                tabIndex={-1}
              >
                <X className="w-3.5 h-3.5 text-[#94a3b8]" />
              </span>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#94a3b8] transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {/* 下拉面板 */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-[#e5e7eb] rounded-lg shadow-lg">
            {/* 搜索输入 */}
            <div className="p-2 border-b border-[#e5e7eb]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="输入姓名或用户名搜索..."
                  className="w-full h-8 pl-8 pr-3 text-sm border border-[#e5e7eb] rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-[#3b82f6]"
                />
              </div>
            </div>

            {/* 结果列表 */}
            <div className="max-h-60 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6 text-sm text-[#94a3b8]">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  搜索中...
                </div>
              ) : results.length > 0 ? (
                results.map((user) => (
                  <div
                    key={user.id}
                    className={`px-3 py-2.5 cursor-pointer text-sm transition-colors flex items-center justify-between
                      ${String(user.id) === value ? 'bg-blue-50 text-[#1d4ed8]' : 'text-[#374151] hover:bg-[#f8fafc]'}
                      border-b border-[#f1f5f9] last:border-b-0`}
                    onClick={() => handleSelect(user)}
                    role="option"
                    aria-selected={String(user.id) === value}
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{user.realName || user.username}</span>
                      {user.realName && user.username !== user.realName && (
                        <span className="text-[#94a3b8] ml-2 text-xs">@{user.username}</span>
                      )}
                    </div>
                    {user.deptName && (
                      <span className="text-xs text-[#94a3b8] truncate ml-2 max-w-[120px] shrink-0">
                        {user.deptName}
                      </span>
                    )}
                  </div>
                ))
              ) : searchTerm.trim() ? (
                <div className="py-6 text-center text-sm text-[#94a3b8]">
                  未找到匹配用户
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-[#94a3b8]">
                  输入关键词搜索用户
                </div>
              )}
            </div>

            {/* 结果计数 */}
            {!loading && results.length > 0 && (
              <div className="px-3 py-1.5 border-t border-[#e5e7eb] bg-gray-50 text-xs text-[#94a3b8]">
                共 {results.length} 条结果
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      </div>
    </div>
  );
};

export default UserSearchSelect;
