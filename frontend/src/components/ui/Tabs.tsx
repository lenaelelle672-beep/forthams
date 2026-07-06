/**
 * @file components/ui/Tabs.tsx
 */
import * as RadixTabs from '@radix-ui/react-tabs';
import { cn } from '@/utils/cn';

export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn('flex border-b border-[#e5e7eb]', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'px-4 py-2.5 text-sm font-medium text-[#64748b] border-b-2 border-transparent',
        'transition-colors hover:text-[#374151]',
        'data-[state=active]:border-[#3b82f6] data-[state=active]:text-[#3b82f6]',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof RadixTabs.Content>) {
  return <RadixTabs.Content className={cn('mt-4', className)} {...props} />;
}
