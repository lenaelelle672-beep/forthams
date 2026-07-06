import * as React from 'react';

import { cn } from '@/utils/cn';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full resize-none rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] placeholder:text-[#94a3b8] transition-all focus:border-[#3b82f6] focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
