/**
 * @file components/ui/index.ts
 * @description forthAMS UI 基础组件库统一导出
 * 所有组件基于 Radix UI primitives + Tailwind CSS 4 + forthAMS Design Tokens
 */

export { Button, buttonVariants } from './Button';
export { Input } from './Input';
export { Badge, StatusBadge } from './Badge';
export { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from './Card';
export { DataTable } from './DataTable';
export { PageHeader } from './PageHeader';
export { KpiCard } from './KpiCard';
export { Skeleton, SkeletonCard, SkeletonTable } from './Skeleton';
export { EmptyState } from './EmptyState';
export { Select, SelectItem } from './Select';
export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './Dialog';
export { Sheet, SheetContent, SheetHeader, SheetTitle } from './Sheet';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './DropdownMenu';
export { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './Tooltip';
export { FilterBar } from './FilterBar';
export { ApprovalTimeline } from './ApprovalTimeline';
export { PageTransition } from './PageTransition';
export { ErrorState } from './ErrorState';
export { PermissionTree } from './PermissionTree';

/* ── Magic UI 特效组件 ── */
export { MagicCard } from './MagicCard';
export type { MagicCardProps } from './MagicCard';
export { GlowEffect, GlowBorder } from './GlowEffect';
export type { GlowEffectProps, GlowBorderProps } from './GlowEffect';
export {
  MagneticWrapper,
  BouncePress,
  SpringReveal,
  ParallaxFloat,
  ScaleOnHover,
} from './MicroInteraction';
export type {
  MagneticWrapperProps,
  BouncePressProps,
  SpringRevealProps,
  ParallaxFloatProps,
  ScaleOnHoverProps,
} from './MicroInteraction';
