/**
 * @file types/inventory.ts
 * @description 盘点管理类型 — 权威版本（从 inventory.types.ts re-export，去重）
 */

export type {
  ScopeType,
  InventoryTaskStatus,
  ActualStatus,
  InventoryTask,
  InventoryAsset,
  InventorySummary,
  InventoryDifferenceItem,
  CreateTaskPayload,
  UpdateTaskStatusPayload,
  ConfirmPayload,
  BatchConfirmPayload,
  SubmitPayload,
  TaskListQuery,
  AssetListQuery,
  ScopeSelectorValue,
  ProgressSummaryData,
} from './inventory.types';
