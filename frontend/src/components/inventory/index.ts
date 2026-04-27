/**
 * @fileoverview 盘点管理模块组件统一导出入口 (Barrel Export)
 * @description Re-exports all inventory management UI components as defined
 *   in SWARM-P3-010-FE spec. Consumers should import from this barrel file
 *   rather than individual component modules to keep import paths clean and
 *   decoupled from internal file structure.
 *
 * Component layout:
 *   InventoryPage
 *   ├── TaskList
 *   │   └── TaskListItem × N
 *   └── TaskDetailPage
 *       ├── ProgressSummary
 *       ├── AssetTable (react-window virtualized)
 *       │   └── AssetTableToolbar
 *       └── DifferenceSummaryPanel
 *           └── ConfirmDialog (shared)
 *
 *   CreateTaskModal
 *   └── ScopeSelector
 *
 * @module components/inventory
 */

// ---------------------------------------------------------------------------
// Task list components — P3-010-A
// ---------------------------------------------------------------------------

export { default as TaskList } from './TaskList';
export type { TaskListProps } from './TaskList';

export { default as TaskListItem } from './TaskListItem';

// ---------------------------------------------------------------------------
// Create task modal & scope selector — P3-010-B
// ---------------------------------------------------------------------------

export { default as CreateTaskModal } from './CreateTaskModal';
export type { CreateTaskModalProps } from './CreateTaskModal';

export { default as ScopeSelector } from './ScopeSelector';
export type { ScopeSelectorProps } from './ScopeSelector';

// ---------------------------------------------------------------------------
// Task detail page — P3-010-C / D / E
// ---------------------------------------------------------------------------

export { default as TaskDetailPage } from './TaskDetailPage';

// ---------------------------------------------------------------------------
// Progress summary — P3-010-C
// ---------------------------------------------------------------------------

export { default as ProgressSummary } from './ProgressSummary';
export type { ProgressSummaryProps } from './ProgressSummary';

// ---------------------------------------------------------------------------
// Asset table & toolbar — P3-010-D
// ---------------------------------------------------------------------------

export { default as AssetTable } from './AssetTable';
export type { AssetTableProps } from './AssetTable';

export { default as AssetTableToolbar } from './AssetTableToolbar';

// ---------------------------------------------------------------------------
// Shared confirm dialog (batch confirm / submit approval)
// ---------------------------------------------------------------------------

export { default as ConfirmDialog } from './ConfirmDialog';

// ---------------------------------------------------------------------------
// Difference summary panel — P3-010-E
// ---------------------------------------------------------------------------

export { default as DifferenceSummaryPanel } from './DifferenceSummaryPanel';
export type { DifferenceSummaryPanelProps } from './DifferenceSummaryPanel';