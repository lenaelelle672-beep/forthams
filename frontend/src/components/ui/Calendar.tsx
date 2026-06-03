/**
 * @file components/ui/Calendar.tsx
 * @description Calendar 日历组件 — react-day-picker + date-fns 实现
 */

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/utils/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months:        'flex flex-col sm:flex-row gap-2',
        month:         'flex flex-col gap-2',
        caption:       'flex items-center justify-between pt-1 relative',
        caption_label: 'text-sm font-medium',
        nav:           'flex items-center gap-1',
        nav_button: cn(
          'inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors',
          'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]',
        ),
        nav_button_previous: 'absolute left-1',
        nav_button_next:     'absolute right-1',
        table:        'w-full border-collapse',
        head_row:     'flex',
        head_cell:    'text-[#64748b] rounded-md w-8 h-8 text-xs font-normal',
        row:          'flex w-full mt-1',
        cell: cn(
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
          '[&:has([aria-selected])]:bg-[#eff6ff]',
          '[&:has([aria-selected].day-range-end)]:rounded-r-md',
        ),
        day: cn(
          'inline-flex items-center justify-center h-8 w-8 rounded-md text-sm',
          'text-[#0f172a] transition-colors',
          'hover:bg-[#f1f5f9]',
          'aria-selected:bg-[#3b82f6] aria-selected:text-white aria-selected:hover:bg-[#2563eb]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]',
        ),
        day_range_start: 'rounded-l-md aria-selected:bg-[#3b82f6]',
        day_range_end:   'rounded-r-md aria-selected:bg-[#3b82f6]',
        day_selected:    'bg-[#3b82f6] text-white hover:bg-[#2563eb]',
        day_today:       'bg-[#f1f5f9] font-medium',
        day_outside:     'text-[#94a3b8] opacity-50',
        day_disabled:    'text-[#cbd5e1] cursor-not-allowed',
        day_hidden:      'invisible',
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';
