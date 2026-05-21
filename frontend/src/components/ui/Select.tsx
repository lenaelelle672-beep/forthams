/**
 * @file components/ui/Select.tsx
 */
import * as React from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Select({ value, onValueChange, placeholder, label, error, children, className, disabled }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#374151]">{label}</label>}
      <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          className={cn(
            'flex items-center justify-between h-9 px-3 w-full rounded-lg border text-sm bg-white',
            'focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#3b82f6]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error ? 'border-red-300' : 'border-[#e5e7eb]',
            className,
          )}
        >
          <RadixSelect.Value placeholder={<span className="text-[#94a3b8]">{placeholder ?? '请选择'}</span>} />
          <ChevronDown className="w-3.5 h-3.5 text-[#94a3b8]" />
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content
            className="z-50 min-w-[8rem] overflow-hidden rounded-lg border border-[#e5e7eb] bg-white shadow-lg"
            position="popper"
            sideOffset={4}
          >
            <RadixSelect.Viewport className="p-1">
              {children}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function SelectItem({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RadixSelect.Item
      value={value}
      className={cn(
        'relative flex items-center px-8 py-2 text-sm text-[#374151] rounded-md cursor-pointer',
        'focus:bg-[#eff6ff] focus:text-[#1d4ed8] outline-none',
        className,
      )}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="absolute left-2">
        <Check className="w-3.5 h-3.5 text-[#3b82f6]" />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
}
