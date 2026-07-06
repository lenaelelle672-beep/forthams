/**
 * @file components/ui/Dialog.tsx
 */
import * as React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogDescription({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixDialog.Description>) {
  return (
    <RadixDialog.Description
      className={cn('text-sm text-[#64748b]', className)}
      {...props}
    >
      {children}
    </RadixDialog.Description>
  );
}

export function DialogContent({
  className,
  children,
  title,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixDialog.Content> & { title?: string }) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 bg-black/40 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <RadixDialog.Content
        className={cn(
          'fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50',
          'bg-white rounded-[10px] shadow-xl w-full max-w-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
          'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          className,
        )}
        {...props}
      >
        {children}
        <RadixDialog.Close className="absolute top-4 right-4 text-[#94a3b8] hover:text-[#374151] transition-colors">
          <X className="w-4 h-4" />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function DialogHeader({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 pt-6 pb-4 border-b border-[#e5e7eb]', className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ className, children }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <RadixDialog.Title className={cn('text-lg font-semibold text-[#0f172a]', className)}>
      {children}
    </RadixDialog.Title>
  );
}

export function DialogFooter({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 py-4 border-t border-[#e5e7eb] flex items-center justify-end gap-2', className)}>
      {children}
    </div>
  );
}
