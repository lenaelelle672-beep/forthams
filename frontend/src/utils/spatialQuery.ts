/**
 * @file utils/spatialQuery.ts
 * @description URL Query 与空间/时间筛选上下文对象互转
 *
 * 用途：
 * - 三页（/gis、/energy、/floorplans）通过 URL Query 共享 spatial×time 状态
 * - debate 决议#1：URL Query 为真源，零 zustand 依赖
 * - 不依赖 React，可在 useEffect / 事件处理函数中直接调用
 */

/** Spatial × Time 联合查询类型 */
export interface SpatialTimeQuery {
  locationId?: number;
  buildingId?: number;
  floorId?: number;
  areaId?: number;
  selectedAssetId?: number;
  periodType?: 'day' | 'week' | 'month' | 'year' | 'custom';
  startDate?: string;
  endDate?: string;
  dimension?: 'asset' | 'area' | 'department';
  floorPlanId?: number;
}

const NUMERIC_KEYS: Array<keyof SpatialTimeQuery> = [
  'locationId',
  'buildingId',
  'floorId',
  'areaId',
  'selectedAssetId',
  'floorPlanId',
];

const STRING_KEYS: Array<keyof SpatialTimeQuery> = ['periodType', 'startDate', 'endDate', 'dimension'];

/**
 * S11 URL 注入防护：数值字段安全解析（Number 强转 + 上下界 + NaN/Infinity 兜底）
 * - Number.MAX_SAFE_INTEGER 上限：防止 9007199254740993 溢出
 * - 非有限值（NaN/Infinity）忽略
 * - 字符串里含 `+ - e` 等可疑字符：先正则校验纯整数
 */
const NUMERIC_SAFE_MAX = Number.MAX_SAFE_INTEGER; // 9007199254740991
const NUMERIC_SAFE_MIN = 1;                      // id 类最小 1（不允许 0/负数）
const NUMERIC_RE = /^-?\d+$/;

function safeParseNumber(raw: string | null): number | undefined {
  if (raw == null || raw === '') return undefined;
  // 防御：原始字符串必须匹配纯整数（拒绝 "1e10", "1.5", "+1" 等）
  if (!NUMERIC_RE.test(raw.trim())) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  if (n < NUMERIC_SAFE_MIN || n > NUMERIC_SAFE_MAX) return undefined;
  return n;
}

const PERIOD_TYPE_ALLOW: ReadonlySet<string> = new Set(['day', 'week', 'month', 'year', 'custom']);
const DIMENSION_ALLOW: ReadonlySet<string> = new Set(['asset', 'area', 'department']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 从 URLSearchParams 解析为强类型 SpatialTimeQuery 对象
 * 容错 + 注入防护：
 * - 数值字段：必须纯整数 + 在 [1, MAX_SAFE_INTEGER] 区间
 * - periodType / dimension：白名单校验（拒绝任意字符串）
 * - 日期字段：ISO YYYY-MM-DD 正则校验（拒绝 `'; DROP TABLE` 等）
 */
export function parseSpatialTime(searchParams: URLSearchParams | ReadonlyURLSearchParams): SpatialTimeQuery {
  const out: SpatialTimeQuery = {};
  const get = (k: string) => (typeof (searchParams as any).get === 'function' ? (searchParams as any).get(k) : null);

  for (const k of NUMERIC_KEYS) {
    const n = safeParseNumber(get(k as string));
    if (n !== undefined) (out as any)[k] = n;
  }
  for (const k of STRING_KEYS) {
    const raw = get(k as string);
    if (raw == null || raw === '') continue;
    if (k === 'periodType' && !PERIOD_TYPE_ALLOW.has(raw)) continue;
    if (k === 'dimension' && !DIMENSION_ALLOW.has(raw)) continue;
    if ((k === 'startDate' || k === 'endDate') && !ISO_DATE_RE.test(raw)) continue;
    (out as any)[k] = raw;
  }
  return out;
}

/**
 * 将 SpatialTimeQuery 序列化为 URLSearchParams（保留非空字段）
 * 未指定的字段不会写入 URL，避免污染
 */
export function buildSearchString(query: Partial<SpatialTimeQuery>): URLSearchParams {
  const params = new URLSearchParams();
  for (const k of NUMERIC_KEYS) {
    const v = (query as any)[k];
    if (v != null) params.set(k, String(v));
  }
  for (const k of STRING_KEYS) {
    const v = (query as any)[k];
    if (v != null && v !== '') params.set(k, String(v));
  }
  return params;
}

/**
 * 浅合并：现有 searchParams + 覆盖 patch
 * 用于 setSpatialTime 写 URL 时不丢其他参数
 */
export function mergeSearch(
  current: URLSearchParams,
  patch: Partial<SpatialTimeQuery>,
  options: { replace?: boolean } = { replace: true },
): string {
  const next = new URLSearchParams(current.toString());
  for (const k of [...NUMERIC_KEYS, ...STRING_KEYS] as string[]) {
    const v = (patch as any)[k];
    if (v === null || v === undefined || v === '') {
      next.delete(k);
    } else {
      next.set(k, String(v));
    }
  }
  const qs = next.toString();
  return qs ? `?${qs}` : '';
}

/** 简易 ReadonlyURLSearchParams 类型（兼容 react-router 7.13 useSearchParams 返回） */
export type ReadonlyURLSearchParams = {
  get(name: string): string | null;
  getAll(name: string): string[];
  has(name: string): boolean;
  toString(): string;
  forEach(cb: (value: string, key: string) => void): void;
  entries(): IterableIterator<[string, string]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
};
