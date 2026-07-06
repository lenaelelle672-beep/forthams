import type { UserItem } from '@/api/base';
import type { AssetListItem } from '@/types/asset';
import type {
  CreateWorkOrderRequest,
  WorkOrder,
  WorkOrderPriority,
  WorkOrderType,
} from '@/types/workorder';

export interface WorkOrderFormValues {
  title: string;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  description?: string;
  estimatedCost?: number;
  dueDate?: string;
  assignee?: string;
}

export interface SelectedWorkOrderAsset {
  id: number;
  assetName: string;
  assetNo: string;
}

interface BuildPayloadContext {
  selectedAsset: SelectedWorkOrderAsset | null;
  assigneeUsers: UserItem[];
  collaborators: string[];
  attachments: string[];
  faultCodeId?: number;
}

export function toBackendDateTime(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.includes('T')) {
    return value.length === 16 ? `${value}:00` : value;
  }
  return `${value}T23:59:00`;
}

export function toDateInputValue(value?: string): string {
  return value ? value.slice(0, 10) : '';
}

export function buildWorkOrderPayload(
  values: WorkOrderFormValues,
  context: BuildPayloadContext,
): CreateWorkOrderRequest {
  const assigneeId = values.assignee ? Number(values.assignee) : undefined;
  const assigneeUser = assigneeId
    ? context.assigneeUsers.find((user) => user.id === assigneeId)
    : undefined;
  const estimatedCost = Number.isFinite(values.estimatedCost) ? values.estimatedCost : undefined;
  const assetId = context.selectedAsset && context.selectedAsset.id > 0
    ? context.selectedAsset.id
    : undefined;

  return {
    title: values.title,
    description: values.description,
    type: values.type,
    priority: values.priority,
    assetId,
    assetName: context.selectedAsset?.assetName,
    assetCode: context.selectedAsset?.assetNo,
    assigneeId,
    assigneeName: assigneeUser?.realName ?? assigneeUser?.username,
    plannedEndDate: toBackendDateTime(values.dueDate),
    estimatedCost,
    collaborators: context.collaborators,
    attachments: context.attachments,
    faultCodeId: values.type === 'REPAIR' ? context.faultCodeId : undefined,
  };
}

export function getWorkOrderFormDefaults(workOrder: WorkOrder): Partial<WorkOrderFormValues> {
  return {
    title: workOrder.title ?? '',
    type: (workOrder.type as WorkOrderType | undefined) ?? 'REPAIR',
    priority: workOrder.priority ?? 'MEDIUM',
    description: workOrder.description ?? '',
    estimatedCost: workOrder.estimatedCost,
    dueDate: toDateInputValue(workOrder.plannedEndDate),
    assignee: workOrder.assigneeId ? String(workOrder.assigneeId) : '',
  };
}

export function getSelectedAssetFromWorkOrder(workOrder: WorkOrder): SelectedWorkOrderAsset | null {
  if (!workOrder.assetId) return null;
  return {
    id: workOrder.assetId,
    assetName: workOrder.assetName ?? '',
    assetNo: workOrder.assetCode ?? '',
  };
}

export function getSelectedAssetFromListItem(asset: AssetListItem): SelectedWorkOrderAsset {
  return {
    id: asset.id,
    assetName: asset.assetName ?? '',
    assetNo: asset.assetNo ?? '',
  };
}
