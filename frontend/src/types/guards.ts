/**
 * @file types/guards.ts
 * @description 前端类型守卫模块 — R1 BigDecimal 精度保护 + 后端字段漂移兜底
 *
 * 关键作用：
 * - BigDecimal 序列化为 String 后，前端按 string 接收；展示前用 toSafeNumber() 转 number
 * - amount > Number.MAX_SAFE_INTEGER 时强制保留 string 形式（避免精度丢失）
 * - 各 service 返回值的最小化类型校验（避免后端字段漂移导致运行时崩溃）
 */

import type { EnergyDashboardData } from '@/services/energyService';

/** Number.MAX_SAFE_INTEGER = 2^53-1 = 9007199254740991（约 9.007e15） */
export const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

/**
 * 把任意后端数值字段安全转 number。
 * - 已是 number → 直接返回
 * - 字符串可解析且 |value| <= MAX_SAFE_INTEGER → 转 number
 * - 字符串 |value| > MAX_SAFE_INTEGER → 返回原 string（不丢精度）
 * - 其它（null/undefined/NaN）→ 返回 0
 */
export function toSafeNumber(value: unknown): number | string {
  if (value == null) return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return 0;
    // 极大值检测：> 1e15 视为可能溢出安全整数范围
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return value;
    if (Math.abs(num) > MAX_SAFE_INTEGER) {
      // 精度临界点：保留 string 形式
      return value;
    }
    return num;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return 0;
}

/**
 * 与 toSafeNumber 类似，但永远返回 number（截断精度临界值用 0 兜底）
 * 适用于：分桶/趋势等允许少量精度损失的展示场景
 */
export function toNumberSafe(value: unknown): number {
  const result = toSafeNumber(value);
  return typeof result === 'number' ? result : 0;
}

/**
 * 严格保留 string 形式（用于金额/资产排名等关键展示）
 */
export function asString(value: unknown): string {
  if (value == null) return '0';
  return String(value);
}

/**
 * 类型守卫：检查对象是否具有 R1 关心的能耗 dashboard 必填字段
 * 任何字段缺失都返回 false，让调用方走 EmptyState 而非崩溃
 */
export function isEnergyDashboard(d: unknown): d is EnergyDashboardData {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  // 关键：byType / trend / assetRanking 必须存在且类型正确
  if (o.byType != null && typeof o.byType !== 'object') return false;
  if (o.trend != null && typeof o.trend !== 'object') return false;
  if (o.assetRanking != null && !Array.isArray(o.assetRanking)) return false;
  return true;
}

/**
 * 类型守卫：检查对象是否具有 GIS asset 必填字段
 */
export function isGisAsset(d: unknown): boolean {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  return (
    typeof o.id === 'number' &&
    typeof o.assetNo === 'string' &&
    typeof o.status === 'string' &&
    (typeof o.locationLat === 'number' || typeof o.locationLat === 'string') &&
    (typeof o.locationLng === 'number' || typeof o.locationLng === 'string')
  );
}

/**
 * 类型守卫：能耗记录行
 */
export function isConsumptionRow(d: unknown): boolean {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  return (
    (typeof o.consumption === 'number' || typeof o.consumption === 'string') &&
    typeof o.periodType === 'string'
  );
}

/**
 * 工具：把 byType / trend 这种 Record<string, BigDecimal-as-string> 安全转换为 Record<string, number>
 * - 任何字段精度溢出保持 string（统一由调用方决定 toLocaleString / parseFloat）
 */
export function normalizeRecord(
  input: Record<string, unknown> | undefined | null,
): Record<string, number | string> {
  if (!input) return {};
  const out: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = toSafeNumber(v);
  }
  return out;
}

/**
 * 工具：把 assetRanking 数组安全 normalize（consumption 字段）
 */
export interface RankingItem {
  assetId: number;
  consumption: number | string;
}
export function normalizeRanking(
  input: Array<{ assetId: number; consumption: unknown }> | undefined | null,
): RankingItem[] {
  if (!input) return [];
  return input
    .filter((r) => r && typeof r.assetId === 'number')
    .map((r) => ({ assetId: r.assetId, consumption: toSafeNumber(r.consumption) }));
}

/**
 * R10 配套：缺失字段 optional 化（占位类型，返回 true 表示对象至少是合法 record）
 */
export function isRecord(d: unknown): d is Record<string, unknown> {
  return d != null && typeof d === 'object' && !Array.isArray(d);
}

/**
 * 数字大数断言：用于 R1 精度演示（amount > Number.MAX_SAFE_INTEGER 仍保留 string）
 */
export function isHighPrecision(value: unknown): boolean {
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) && Math.abs(n) > MAX_SAFE_INTEGER;
  }
  return false;
}
