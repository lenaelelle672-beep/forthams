export type AssetStatusValue =
  | "IDLE"
  | "IN_USE"
  | "MAINTENANCE"
  | "PENDING_RETIREMENT"
  | "RETIRED"
  | "SCRAPPED"
  | "CLEARED"
  | "DISPOSED"
  | "LOST"
  | "TRANSFERRED";

export interface AssetStatusMeta {
  value: AssetStatusValue;
  label: string;
  badgeClass: string;
}

export const ASSET_STATUS_OPTIONS: Array<{ value: "" | AssetStatusValue; label: string }> = [
  { value: "", label: "全部状态" },
  { value: "IN_USE", label: "在用" },
  { value: "IDLE", label: "闲置" },
  { value: "MAINTENANCE", label: "维修中" },
  { value: "PENDING_RETIREMENT", label: "退役审批中" },
  { value: "RETIRED", label: "已退役" },
  { value: "SCRAPPED", label: "已报废" },
  { value: "CLEARED", label: "已清退" },
  { value: "DISPOSED", label: "已处置" },
  { value: "LOST", label: "已丢失" },
  { value: "TRANSFERRED", label: "已转移" },
];

const STATUS_META: Record<AssetStatusValue, AssetStatusMeta> = {
  IDLE: { value: "IDLE", label: "闲置", badgeClass: "bg-yellow-100 text-yellow-800" },
  IN_USE: { value: "IN_USE", label: "在用", badgeClass: "bg-green-100 text-green-800" },
  MAINTENANCE: { value: "MAINTENANCE", label: "维修中", badgeClass: "bg-blue-100 text-blue-800" },
  PENDING_RETIREMENT: { value: "PENDING_RETIREMENT", label: "退役审批中", badgeClass: "bg-purple-100 text-purple-800" },
  RETIRED: { value: "RETIRED", label: "已退役", badgeClass: "bg-orange-100 text-orange-800" },
  SCRAPPED: { value: "SCRAPPED", label: "已报废", badgeClass: "bg-red-100 text-red-800" },
  CLEARED: { value: "CLEARED", label: "已清退", badgeClass: "bg-blue-50 text-gray-800" },
  DISPOSED: { value: "DISPOSED", label: "已处置", badgeClass: "bg-red-100 text-red-800" },
  LOST: { value: "LOST", label: "已丢失", badgeClass: "bg-purple-100 text-purple-800" },
  TRANSFERRED: { value: "TRANSFERRED", label: "已转移", badgeClass: "bg-blue-100 text-blue-800" },
};

const STATUS_ALIASES: Record<string, AssetStatusValue> = {
  ACTIVE: "IN_USE",
  NORMAL: "IN_USE",
  USING: "IN_USE",
  INACTIVE: "IDLE",
  SCRAP: "SCRAPPED",
  RETIRING: "PENDING_RETIREMENT",
  PENDING: "PENDING_RETIREMENT",
  在用: "IN_USE",
  使用中: "IN_USE",
  闲置: "IDLE",
  维修中: "MAINTENANCE",
  维保中: "MAINTENANCE",
  报废: "SCRAPPED",
  已报废: "SCRAPPED",
  已退役: "RETIRED",
  已清退: "CLEARED",
};

const GENERIC_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "在用",
  NORMAL: "正常",
  IN_USE: "在用",
  USING: "使用中",
  INACTIVE: "闲置",
  IDLE: "闲置",
  MAINTENANCE: "维修中",
  PENDING: "待处理",
  PENDING_APPROVAL: "待审批",
  PENDING_RETIREMENT: "退役审批中",
  APPROVED: "已批准",
  REJECTED: "已驳回",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  FAILED: "失败",
  SUCCESS: "成功",
  PROCESSING: "处理中",
  DRAFT: "草稿",
  UNCONFIGURED: "未配置",
  PUBLISHED: "已发布",
  DISABLED: "已停用",
  ENABLED: "已启用",
  SUBMITTED: "已提交",
  SCRAPPED: "已报废",
  RETIRED: "已退役",
  DISPOSED: "已处置",
  CLEARED: "已清退",
  LOST: "已丢失",
  TRANSFERRED: "已转移",
};

export function normalizeAssetStatus(value: unknown): AssetStatusValue | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const raw = String(value).trim();
  const upper = raw.toUpperCase();
  if (upper in STATUS_META) {
    return upper as AssetStatusValue;
  }
  return STATUS_ALIASES[raw] || STATUS_ALIASES[upper];
}

export function formatStatusLabel(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "未知";
  }
  const raw = String(value).trim();
  const upper = raw.toUpperCase();
  const normalized = normalizeAssetStatus(raw);
  if (normalized) {
    return STATUS_META[normalized].label;
  }
  if (GENERIC_STATUS_LABELS[upper]) {
    return GENERIC_STATUS_LABELS[upper];
  }
  return /[A-Za-z_]/.test(raw) ? "未知" : raw;
}

export function getAssetStatusMeta(value: unknown): AssetStatusMeta {
  const normalized = normalizeAssetStatus(value);
  if (normalized) {
    return STATUS_META[normalized];
  }
  return {
    value: "IDLE",
    label: formatStatusLabel(value),
    badgeClass: "bg-blue-50 text-gray-800",
  };
}
