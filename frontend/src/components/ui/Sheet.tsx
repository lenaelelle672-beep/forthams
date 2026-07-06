/**
 * @file components/ui/Sheet.tsx - 右侧抽屉
 */
import * as React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

export const Sheet = RadixDialog.Root;
export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;

export function SheetContent({
  className,
  children,
  side = 'right',
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixDialog.Content> & {
  side?: 'left' | 'right' | 'top' | 'bottom';
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
      <RadixDialog.Content
        className={cn(
          'fixed z-50 bg-white shadow-xl',
          side === 'right' && 'right-0 top-0 h-full w-[400px] max-w-full',
          side === 'left' && 'left-0 top-0 h-full w-[400px] max-w-full',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          side === 'right' && 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          side === 'left' && 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
          className,
        )}
        {...props}
      >
        {children}
        <RadixDialog.Close className="absolute top-4 right-4 text-[#94a3b8] hover:text-[#374151]">
          <X className="w-4 h-4" />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function SheetHeader({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 pt-6 pb-4 border-b border-[#e5e7eb]', className)}>
      {children}
    </div>
  );
}

export function SheetTitle({ className, children }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <RadixDialog.Title className={cn('text-base font-semibold text-[#0f172a]', className)}>
      {children}
    </RadixDialog.Title>
  );
}
