/**
 * @file utils/cn.ts
 * @description Tailwind CSS 类名合并工具
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
