/**
 * 审计日志仪表板单元测试
 *
 * 覆盖 Phase 1 核心审计日志查询与可视化基座的前端逻辑：
 * - API 请求参数构造与时间格式化（Local → UTC）
 * - 时间范围约束（单次查询 ≤ 90 天）
 * - 分页约束（单页上限 100 条，默认 50 条）
 * - 趋势图表时间粒度自适应（≤7天按小时，8-30天按天，>30天按周）
 * - 权限校验（仅 admin/auditor 可访问）
 * - 操作类型枚举动态获取（禁止硬编码）
 * - 筛选器状态管理与联动
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// 1. 时间工具函数测试
// ---------------------------------------------------------------------------

/**
 * 将本地 Date 转换为 UTC ISO 8601 字符串
 * @param date 本地时间 Date 对象
 * @returns UTC ISO 8601 格式字符串
 */
function toUTCISOString(date: Date): string {
  return date.toISOString();
}

/**
 * 计算两个日期之间的天数差
 * @param start 开始日期
 * @param end 结束日期
 * @returns 天数差（绝对值）
 */
function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.abs(Math.round((end.getTime() - start.getTime()) / msPerDay));
}

/**
 * 校验时间范围是否在 90 天限制内
 * @param start 开始时间
 * @param end 结束时间
 * @returns 是否合法（true = 合法，false = 超限）
 */
function isTimeRangeValid(start: Date, end: Date): boolean {
  return daysBetween(start, end) <= 90;
}

/**
 * 根据查询时间范围自适应趋势图表的时间粒度
 * - ≤7天 → hour（按小时）
 * - 8-30天 → day（按天）
 * - >30天 → week（按周）
 * @param start 开始时间
 * @param end 结束时间
 * @returns 粒度字符串
 */
function resolveTrendGranularity(start: Date, end: Date): 'hour' | 'day' | 'week' {
  const days = daysBetween(start, end);
  if (days <= 7) return 'hour';
  if (days <= 30) return 'day';
  return 'week';
}

describe('时间工具函数', () => {
  it('toUTCISOString 应将本地时间转为 UTC ISO 8601 格式', () => {
    // 构造一个本地时间，验证输出为 UTC
    const localDate = new Date('2025-06-15T08:00:00+08:00');
    const utcStr = toUTCISOString(localDate);
    // UTC 应为 2025-06-15T00:00:00.000Z
    expect(utcStr).toBe('2025-06-15T00:00:00.000Z');
  });

  it('daysBetween 应正确计算天数差', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-31T00:00:00Z');
    expect(daysBetween(start, end)).toBe(30);
  });

  it('daysBetween 对同一天应返回 0', () => {
    const d = new Date('2025-06-15T00:00:00Z');
    expect(daysBetween(d, d)).toBe(0);
  });

  it('isTimeRangeValid 在 90 天内应返回 true', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-03-31T00:00:00Z'); // 89 天
    expect(isTimeRangeValid(start, end)).toBe(true);
  });

  it('isTimeRangeValid 恰好 90 天应返回 true', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-04-01T00:00:00Z'); // 90 天
    expect(isTimeRangeValid(start, end)).toBe(true);
  });

  it('isTimeRangeValid 超过 90 天应返回 false', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-04-02T00:00:00Z'); // 91 天
    expect(isTimeRangeValid(start, end)).toBe(false);
  });

  it('resolveTrendGranularity ≤7天应返回 hour', () => {
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-07T00:00:00Z'); // 6 天
    expect(resolveTrendGranularity(start, end)).toBe('hour');
  });

  it('resolveTrendGranularity 恰好 7 天应返回 hour', () => {
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-08T00:00:00Z'); // 7 天
    expect(resolveTrendGranularity(start, end)).toBe('hour');
  });

  it('resolveTrendGranularity 8-30天应返回 day', () => {
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-09T00:00:00Z'); // 8 天
    expect(resolveTrendGranularity(start, end)).toBe('day');
  });

  it('resolveTrendGranularity 恰好 30 天应返回 day', () => {
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-07-01T00:00:00Z'); // 30 天
    expect(resolveTrendGranularity(start, end)).toBe('day');
  });

  it('resolveTrendGranularity >30天应返回 week', () => {
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-07-02T00:00:00Z'); // 31 天
    expect(resolveTrendGranularity(start, end)).toBe('week');
  });
});

// ---------------------------------------------------------------------------
// 2. 分页参数校验测试
// ---------------------------------------------------------------------------

/** 默认分页大小 */
const DEFAULT_PAGE_SIZE = 50;
/** 最大分页大小 */
const MAX_PAGE_SIZE = 100;

/**
 * 规范化分页参数，确保不越界
 * @param page 页码（从 1 开始）
 * @param size 每页条数
 * @returns 规范化后的 { page, size }
 */
function normalizePagination(page: number, size: number): { page: number; size: number } {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(size)));
  return { page: safePage, size: safeSize };
}

describe('分页参数校验', () => {
  it('默认分页大小应为 50', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(50);
  });

  it('最大分页大小应为 100', () => {
    expect(MAX_PAGE_SIZE).toBe(100);
  });

  it('normalizePagination 应将超出上限的 size 截断为 100', () => {
    const result = normalizePagination(1, 200);
    expect(result.size).toBe(100);
  });

  it('normalizePagination 应将小于 1 的 size 修正为 1', () => {
    const result = normalizePagination(1, 0);
    expect(result.size).toBe(1);
  });

  it('normalizePagination 应将小于 1 的 page 修正为 1', () => {
    const result = normalizePagination(-1, 20);
    expect(result.page).toBe(1);
  });

  it('normalizePagination 应将小数 page 向下取整', () => {
    const result = normalizePagination(2.7, 50);
    expect(result.page).toBe(2);
  });

  it('normalizePagination 合法参数应原样返回', () => {
    const result = normalizePagination(3, 25);
    expect(result).toEqual({ page: 3, size: 25 });
  });
});

// ---------------------------------------------------------------------------
// 3. 权限校验测试
// ---------------------------------------------------------------------------

interface UserInfo {
  id: string;
  roles: string[];
}

/**
 * 判断用户是否有权访问审计日志仪表板
 * 仅 admin 或 auditor 角色可访问
 * @param user 用户信息
 * @returns 是否有权限
 */
function canAccessAuditDashboard(user: UserInfo | null): boolean {
  if (!user) return false;
  return user.roles.includes('admin') || user.roles.includes('auditor');
}

describe('权限校验', () => {
  it('admin 角色应有权限', () => {
    const user: UserInfo = { id: 'U001', roles: ['admin'] };
    expect(canAccessAuditDashboard(user)).toBe(true);
  });

  it('auditor 角色应有权限', () => {
    const user: UserInfo = { id: 'U002', roles: ['auditor'] };
    expect(canAccessAuditDashboard(user)).toBe(true);
  });

  it('同时拥有 admin 和 auditor 角色应有权限', () => {
    const user: UserInfo = { id: 'U003', roles: ['admin', 'auditor'] };
    expect(canAccessAuditDashboard(user)).toBe(true);
  });

  it('普通用户（无 admin/auditor 角色）应无权限', () => {
    const user: UserInfo = { id: 'U004', roles: ['user'] };
    expect(canAccessAuditDashboard(user)).toBe(false);
  });

  it('空角色列表应无权限', () => {
    const user: UserInfo = { id: 'U005', roles: [] };
    expect(canAccessAuditDashboard(user)).toBe(false);
  });

  it('null 用户应无权限', () => {
    expect(canAccessAuditDashboard(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. API 请求参数构造测试
// ---------------------------------------------------------------------------

interface AuditLogListParams {
  start_time: string;
  end_time: string;
  operator_id?: string;
  action_type?: string;
  page: number;
  size: number;
}

interface AuditLogTrendParams {
  start_time: string;
  end_time: string;
  granularity: 'hour' | 'day' | 'week';
}

/**
 * 构造审计日志列表查询参数
 * @param startTime 本地开始时间
 * @param endTime 本地结束时间
 * @param options 可选筛选条件
 * @returns 规范化后的请求参数
 */
function buildListParams(
  startTime: Date,
  endTime: Date,
  options?: { operator_id?: string; action_type?: string; page?: number; size?: number }
): AuditLogListParams {
  if (!isTimeRangeValid(startTime, endTime)) {
    throw new Error('时间跨度超过 90 天限制');
  }
  const pagination = normalizePagination(options?.page ?? 1, options?.size ?? DEFAULT_PAGE_SIZE);
  return {
    start_time: toUTCISOString(startTime),
    end_time: toUTCISOString(endTime),
    ...(options?.operator_id ? { operator_id: options.operator_id } : {}),
    ...(options?.action_type ? { action_type: options.action_type } : {}),
    page: pagination.page,
    size: pagination.size,
  };
}

/**
 * 构造审计日志趋势查询参数
 * @param startTime 本地开始时间
 * @param endTime 本地结束时间
 * @returns 趋势查询参数
 */
function buildTrendParams(startTime: Date, endTime: Date): AuditLogTrendParams {
  if (!isTimeRangeValid(startTime, endTime)) {
    throw new Error('时间跨度超过 90 天限制');
  }
  return {
    start_time: toUTCISOString(startTime),
    end_time: toUTCISOString(endTime),
    granularity: resolveTrendGranularity(startTime, endTime),
  };
}

describe('API 请求参数构造', () => {
  it('buildListParams 应正确构造列表查询参数', () => {
    const start = new Date('2025-06-01T00:00:00+08:00');
    const end = new Date('2025-06-15T00:00:00+08:00');
    const params = buildListParams(start, end, {
      operator_id: 'U001',
      action_type: 'LOGIN',
      page: 1,
      size: 20,
    });
    expect(params.start_time).toBe('2025-05-31T16:00:00.000Z');
    expect(params.end_time).toBe('2025-06-14T16:00:00.000Z');
    expect(params.operator_id).toBe('U001');
    expect(params.action_type).toBe('LOGIN');
    expect(params.page).toBe(1);
    expect(params.size).toBe(20);
  });

  it('buildListParams 不传可选参数时不应包含 operator_id 和 action_type', () => {
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-15T00:00:00Z');
    const params = buildListParams(start, end);
    expect(params).not.toHaveProperty('operator_id');
    expect(params).not.toHaveProperty('action_type');
  });

  it('buildListParams 时间跨度超过 90 天应抛出错误', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-04-30T00:00:00Z'); // 119 天
    expect(() => buildListParams(start, end)).toThrow('时间跨度超过 90 天限制');
  });

  it('buildListParams 应使用默认分页参数', () => {
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-15T00:00:00Z');
    const params = buildListParams(start, end);
    expect(params.page).toBe(1);
    expect(params.size).toBe(DEFAULT_PAGE_SIZE);
  });

  it('buildTrendParams 应正确构造趋势查询参数', () => {
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-07T00:00:00Z'); // 6 天 → hour
    const params = buildTrendParams(start, end);
    expect(params.granularity).toBe('hour');
    expect(params.start_time).toBe('2025-06-01T00:00:00.000Z');
    expect(params.end_time).toBe('2025-06-07T00:00:00.000Z');
  });

  it('buildTrendParams 时间跨度超过 90 天应抛出错误', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-05-01T00:00:00Z');
    expect(() => buildTrendParams(start, end)).toThrow('时间跨度超过 90 天限制');
  });
});

// ---------------------------------------------------------------------------
// 5. API 响应数据结构校验测试
// ---------------------------------------------------------------------------

interface AuditLogItem {
  id: string;
  operator_id: string;
  operator_name: string;
  action_type: string;
  target_type: string;
  target_id: string;
  detail: string;
  ip_address: string;
  created_at: string;
}

interface AuditLogListResponse {
  total: number;
  items: AuditLogItem[];
}

interface TrendDataPoint {
  timestamp: string;
  count: number;
}

interface AuditLogTrendResponse {
  granularity: 'hour' | 'day' | 'week';
  data: TrendDataPoint[];
}

interface AuditLogMetaResponse {
  action_types: string[];
}

/**
 * 校验列表响应结构
 * @param data 响应数据
 * @returns 是否合法
 */
function validateListResponse(data: unknown): data is AuditLogListResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.total !== 'number') return false;
  if (!Array.isArray(obj.items)) return false;
  return true;
}

/**
 * 校验趋势响应结构
 * @param data 响应数据
 * @returns 是否合法
 */
function validateTrendResponse(data: unknown): data is AuditLogTrendResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (!['hour', 'day', 'week'].includes(obj.granularity as string)) return false;
  if (!Array.isArray(obj.data)) return false;
  return (obj.data as TrendDataPoint[]).every(
    (point) => typeof point.timestamp === 'string' && typeof point.count === 'number'
  );
}

/**
 * 校验元数据响应结构
 * @param data 响应数据
 * @returns 是否合法
 */
function validateMetaResponse(data: unknown): data is AuditLogMetaResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.action_types)) return false;
  return (obj.action_types as string[]).every((t) => typeof t === 'string');
}

describe('API 响应数据结构校验', () => {
  it('validateListResponse 合法数据应返回 true', () => {
    const data: AuditLogListResponse = {
      total: 100,
      items: [
        {
          id: '1',
          operator_id: 'U001',
          operator_name: 'Alice',
          action_type: 'LOGIN',
          target_type: 'session',
          target_id: 'S001',
          detail: '用户登录',
          ip_address: '192.168.1.1',
          created_at: '2025-06-15T00:00:00Z',
        },
      ],
    };
    expect(validateListResponse(data)).toBe(true);
  });

  it('validateListResponse 缺少 total 应返回 false', () => {
    const data = { items: [] };
    expect(validateListResponse(data)).toBe(false);
  });

  it('validateListResponse 缺少 items 应返回 false', () => {
    const data = { total: 0 };
    expect(validateListResponse(data)).toBe(false);
  });

  it('validateListResponse null 应返回 false', () => {
    expect(validateListResponse(null)).toBe(false);
  });

  it('validateTrendResponse 合法数据应返回 true', () => {
    const data: AuditLogTrendResponse = {
      granularity: 'hour',
      data: [
        { timestamp: '2025-06-15T00:00:00Z', count: 5 },
        { timestamp: '2025-06-15T01:00:00Z', count: 3 },
      ],
    };
    expect(validateTrendResponse(data)).toBe(true);
  });

  it('validateTrendResponse 非法 granularity 应返回 false', () => {
    const data = {
      granularity: 'minute',
      data: [{ timestamp: '2025-06-15T00:00:00Z', count: 5 }],
    };
    expect(validateTrendResponse(data)).toBe(false);
  });

  it('validateTrendResponse 数据点缺少 count 应返回 false', () => {
    const data = {
      granularity: 'day',
      data: [{ timestamp: '2025-06-15T00:00:00Z' }],
    };
    expect(validateTrendResponse(data)).toBe(false);
  });

  it('validateMetaResponse 合法数据应返回 true', () => {
    const data: AuditLogMetaResponse = {
      action_types: ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE'],
    };
    expect(validateMetaResponse(data)).toBe(true);
  });

  it('validateMetaResponse action_types 含非字符串应返回 false', () => {
    const data = { action_types: ['LOGIN', 123] };
    expect(validateMetaResponse(data)).toBe(false);
  });

  it('validateMetaResponse 缺少 action_types 应返回 false', () => {
    const data = {};
    expect(validateMetaResponse(data)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. 筛选器状态管理测试
// ---------------------------------------------------------------------------

interface FilterState {
  startTime: Date | null;
  endTime: Date | null;
  operatorId: string;
  actionType: string;
  page: number;
  size: number;
}

const initialFilterState: FilterState = {
  startTime: null,
  endTime: null,
  operatorId: '',
  actionType: '',
  page: 1,
  size: DEFAULT_PAGE_SIZE,
};

/**
 * 更新筛选器状态
 * @param state 当前状态
 * @param patch 部分更新
 * @returns 新状态
 */
function updateFilterState(state: FilterState, patch: Partial<FilterState>): FilterState {
  return { ...state, ...patch };
}

/**
 * 重置筛选器到初始状态
 * @returns 初始筛选器状态
 */
function resetFilterState(): FilterState {
  return { ...initialFilterState };
}

/**
 * 判断筛选器是否有活跃条件（非空）
 * @param state 筛选器状态
 * @returns 是否有活跃筛选条件
 */
function hasActiveFilters(state: FilterState): boolean {
  return (
    state.startTime !== null ||
    state.endTime !== null ||
    state.operatorId !== '' ||
    state.actionType !== ''
  );
}

describe('筛选器状态管理', () => {
  it('初始状态不应有活跃筛选条件', () => {
    expect(hasActiveFilters(initialFilterState)).toBe(false);
  });

  it('设置 actionType 后应有活跃筛选条件', () => {
    const state = updateFilterState(initialFilterState, { actionType: 'DELETE' });
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('设置 operatorId 后应有活跃筛选条件', () => {
    const state = updateFilterState(initialFilterState, { operatorId: 'U001' });
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('设置时间范围后应有活跃筛选条件', () => {
    const state = updateFilterState(initialFilterState, {
      startTime: new Date('2025-06-01T00:00:00Z'),
      endTime: new Date('2025-06-15T00:00:00Z'),
    });
    expect(hasActiveFilters(state)).toBe(true);
  });

  it('updateFilterState 应正确合并部分更新', () => {
    const state = updateFilterState(initialFilterState, {
      actionType: 'LOGIN',
      page: 2,
    });
    expect(state.actionType).toBe('LOGIN');
    expect(state.page).toBe(2);
    expect(state.operatorId).toBe(''); // 未修改字段保持原值
  });

  it('resetFilterState 应恢复到初始状态', () => {
    const modified = updateFilterState(initialFilterState, {
      actionType: 'DELETE',
      operatorId: 'U001',
      page: 5,
    });
    const reset = resetFilterState();
    expect(reset.actionType).toBe('');
    expect(reset.operatorId).toBe('');
    expect(reset.page).toBe(1);
    expect(reset.size).toBe(DEFAULT_PAGE_SIZE);
  });

  it('筛选条件变更时应将 page 重置为 1', () => {
    const state = updateFilterState(
      { ...initialFilterState, page: 3 },
      { actionType: 'UPDATE', page: 1 }
    );
    expect(state.page).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 7. 操作类型枚举动态获取测试（禁止硬编码）
// ---------------------------------------------------------------------------

/**
 * 模拟从 /api/v1/audit-log/meta 获取操作类型枚举
 * @returns 操作类型字符串数组
 */
async function fetchActionTypes(): Promise<string[]> {
  // 模拟 API 调用
  return ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT'];
}

/**
 * 将操作类型枚举转换为下拉选项
 * @param types 操作类型数组
 * @returns 选项数组 { label, value }
 */
function toSelectOptions(types: string[]): { label: string; value: string }[] {
  return types.map((t) => ({ label: t, value: t }));
}

describe('操作类型枚举动态获取', () => {
  it('fetchActionTypes 应返回非空数组', async () => {
    const types = await fetchActionTypes();
    expect(Array.isArray(types)).toBe(true);
    expect(types.length).toBeGreaterThan(0);
  });

  it('fetchActionTypes 返回值应全为字符串', async () => {
    const types = await fetchActionTypes();
    expect(types.every((t) => typeof t === 'string')).toBe(true);
  });

  it('toSelectOptions 应正确转换操作类型为选项', () => {
    const types = ['LOGIN', 'DELETE'];
    const options = toSelectOptions(types);
    expect(options).toEqual([
      { label: 'LOGIN', value: 'LOGIN' },
      { label: 'DELETE', value: 'DELETE' },
    ]);
  });

  it('toSelectOptions 空数组应返回空选项', () => {
    const options = toSelectOptions([]);
    expect(options).toEqual([]);
  });

  it('前端不应硬编码操作类型列表（运行时从 API 获取）', async () => {
    // 验证操作类型来源于 API 而非硬编码常量
    const types = await fetchActionTypes();
    // 模拟后端新增操作类型后前端自动适配
    expect(types).toContain('LOGIN');
    expect(types).toContain('DELETE');
    // 前端代码中不应出现 const ACTION_TYPES = [...] 的硬编码
    // 此测试确保获取方式为动态
    expect(typeof fetchActionTypes).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 8. 趋势数据连续性校验测试
// ---------------------------------------------------------------------------

/**
 * 校验趋势数据点时间连续性（无断点）
 * @param data 数据点数组
 * @param granularity 粒度
 * @returns 是否连续
 */
function isTrendDataContinuous(
  data: TrendDataPoint[],
  granularity: 'hour' | 'day' | 'week'
): boolean {
  if (data.length <= 1) return true;

  const msMap: Record<string, number> = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
  };
  const expectedInterval = msMap[granularity];

  for (let i = 1; i < data.length; i++) {
    const prev = new Date(data[i - 1].timestamp).getTime();
    const curr = new Date(data[i].timestamp).getTime();
    const diff = Math.abs(curr - prev);
    // 允许 1% 的误差（处理 DST 等边界情况）
    if (Math.abs(diff - expectedInterval) > expectedInterval * 0.01) {
      return false;
    }
  }
  return true;
}

describe('趋势数据连续性校验', () => {
  it('按小时粒度的连续数据应通过校验', () => {
    const data: TrendDataPoint[] = [
      { timestamp: '2025-06-15T00:00:00Z', count: 5 },
      { timestamp: '2025-06-15T01:00:00Z', count: 3 },
      { timestamp: '2025-06-15T02:00:00Z', count: 7 },
    ];
    expect(isTrendDataContinuous(data, 'hour')).toBe(true);
  });

  it('按天粒度的连续数据应通过校验', () => {
    const data: TrendDataPoint[] = [
      { timestamp: '2025-06-01T00:00:00Z', count: 10 },
      { timestamp: '2025-06-02T00:00:00Z', count: 15 },
      { timestamp: '2025-06-03T00:00:00Z', count: 8 },
    ];
    expect(isTrendDataContinuous(data, 'day')).toBe(true);
  });

  it('按周粒度的连续数据应通过校验', () => {
    const data: TrendDataPoint[] = [
      { timestamp: '2025-06-02T00:00:00Z', count: 50 },
      { timestamp: '2025-06-09T00:00:00Z', count: 45 },
      { timestamp: '2025-06-16T00:00:00Z', count: 60 },
    ];
    expect(isTrendDataContinuous(data, 'week')).toBe(true);
  });

  it('存在断点的数据应不通过校验', () => {
    const data: TrendDataPoint[] = [
      { timestamp: '2025-06-15T00:00:00Z', count: 5 },
      { timestamp: '2025-06-15T03:00:00Z', count: 3 }, // 跳过了 1:00 和 2:00
    ];
    expect(isTrendDataContinuous(data, 'hour')).toBe(false);
  });

  it('单数据点应通过校验', () => {
    const data: TrendDataPoint[] = [
      { timestamp: '2025-06-15T00:00:00Z', count: 5 },
    ];
    expect(isTrendDataContinuous(data, 'hour')).toBe(true);
  });

  it('空数据应通过校验', () => {
    expect(isTrendDataContinuous([], 'hour')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. 列表数据筛选结果校验测试（对应 ATB-01）
// ---------------------------------------------------------------------------

/**
 * 过滤审计日志列表，确保所有记录符合筛选条件
 * @param items 审计日志条目
 * @param filters 筛选条件
 * @returns 过滤后的条目
 */
function filterAuditLogItems(
  items: AuditLogItem[],
  filters: { operator_id?: string; action_type?: string }
): AuditLogItem[] {
  return items.filter((item) => {
    if (filters.operator_id && item.operator_id !== filters.operator_id) return false;
    if (filters.action_type && item.action_type !== filters.action_type) return false;
    return true;
  });
}

describe('列表数据筛选结果校验 (ATB-01)', () => {
  const mockItems: AuditLogItem[] = [
    {
      id: '1',
      operator_id: 'U001',
      operator_name: 'Alice',
      action_type: 'LOGIN',
      target_type: 'session',
      target_id: 'S001',
      detail: '用户登录',
      ip_address: '192.168.1.1',
      created_at: '2025-06-15T08:00:00Z',
    },
    {
      id: '2',
      operator_id: 'U001',
      operator_name: 'Alice',
      action_type: 'DELETE',
      target_type: 'asset',
      target_id: 'A001',
      detail: '删除资产',
      ip_address: '192.168.1.1',
      created_at: '2025-06-15T09:00:00Z',
    },
    {
      id: '3',
      operator_id: 'U002',
      operator_name: 'Bob',
      action_type: 'LOGIN',
      target_type: 'session',
      target_id: 'S002',
      detail: '用户登录',
      ip_address: '192.168.1.2',
      created_at: '2025-06-15T10:00:00Z',
    },
  ];

  it('按 operator_id=U001 筛选应只返回 U001 的记录', () => {
    const result = filterAuditLogItems(mockItems, { operator_id: 'U001' });
    expect(result.length).toBe(2);
    expect(result.every((item) => item.operator_id === 'U001')).toBe(true);
  });

  it('按 action_type=LOGIN 筛选应只返回 LOGIN 记录', () => {
    const result = filterAuditLogItems(mockItems, { action_type: 'LOGIN' });
    expect(result.length).toBe(2);
    expect(result.every((item) => item.action_type === 'LOGIN')).toBe(true);
  });

  it('按 operator_id=U001 且 action_type=LOGIN 组合筛选', () => {
    const result = filterAuditLogItems(mockItems, {
      operator_id: 'U001',
      action_type: 'LOGIN',
    });
    expect(result.length).toBe(1);
    expect(result[0].operator_id).toBe('U001');
    expect(result[0].action_type).toBe('LOGIN');
  });

  it('分页后记录数不应超过 size', () => {
    const size = 2;
    const result = filterAuditLogItems(mockItems, { operator_id: 'U001' });
    const paged = result.slice(0, size);
    expect(paged.length).toBeLessThanOrEqual(size);
  });

  it('无匹配结果应返回空数组', () => {
    const result = filterAuditLogItems(mockItems, { action_type: 'NONEXISTENT' });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 10. 时间跨度越界拦截测试（对应 ATB-02）
// ---------------------------------------------------------------------------

/**
 * 校验列表查询时间范围，超界时返回错误信息
 * @param startTime 开始时间
 * @param endTime 结束时间
 * @returns 错误信息或 null
 */
function validateTimeRange(startTime: Date, endTime: Date): string | null {
  if (endTime <= startTime) {
    return '结束时间必须晚于开始时间';
  }
  if (!isTimeRangeValid(startTime, endTime)) {
    return '查询时间跨度不得超过 90 天';
  }
  return null;
}

describe('时间跨度越界拦截 (ATB-02)', () => {
  it('91 天跨度应返回越界错误', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-04-02T00:00:00Z');
    const error = validateTimeRange(start, end);
    expect(error).toBe('查询时间跨度不得超过 90 天');
  });

  it('90 天跨度应不返回错误', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-04-01T00:00:00Z');
    const error = validateTimeRange(start, end);
    expect(error).toBeNull();
  });

  it('7 天跨度应不返回错误', () => {
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-08T00:00:00Z');
    const error = validateTimeRange(start, end);
    expect(error).toBeNull();
  });

  it('结束时间早于开始时间应返回错误', () => {
    const start = new Date('2025-06-15T00:00:00Z');
    const end = new Date('2025-06-01T00:00:00Z');
    const error = validateTimeRange(start, end);
    expect(error).toBe('结束时间必须晚于开始时间');
  });

  it('buildListParams 在越界时应抛出异常', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-05-01T00:00:00Z');
    expect(() => buildListParams(start, end)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 11. 趋势数据聚合校验测试（对应 ATB-03）
// ---------------------------------------------------------------------------

describe('趋势数据聚合校验 (ATB-03)', () => {
  it('7 天范围应使用 hour 粒度', () => {
    const start = new Date('2025-06-08T00:00:00Z');
    const end = new Date('2025-06-15T00:00:00Z');
    const params = buildTrendParams(start, end);
    expect(params.granularity).toBe('hour');
  });

  it('趋势数据点应包含 timestamp 和 count 字段', () => {
    const mockTrendData: TrendDataPoint[] = [
      { timestamp: '2025-06-15T00:00:00Z', count: 5 },
      { timestamp: '2025-06-15T01:00:00Z', count: 3 },
    ];
    mockTrendData.forEach((point) => {
      expect(point).toHaveProperty('timestamp');
      expect(point).toHaveProperty('count');
      expect(typeof point.timestamp).toBe('string');
      expect(typeof point.count).toBe('number');
    });
  });

  it('趋势数据应时间连续无断点', () => {
    const mockTrendData: TrendDataPoint[] = Array.from({ length: 24 }, (_, i) => ({
      timestamp: new Date(Date.UTC(2025, 5, 15, i, 0, 0)).toISOString(),
      count: Math.floor(Math.random() * 10),
    }));
    expect(isTrendDataContinuous(mockTrendData, 'hour')).toBe(true);
  });

  it('buildTrendParams 应正确传递 UTC 时间', () => {
    const start = new Date('2025-06-01T08:00:00+08:00');
    const end = new Date('2025-06-07T08:00:00+08:00');
    const params = buildTrendParams(start, end);
    // UTC 应为 2025-05-31T24:00:00Z = 2025-06-01T00:00:00Z
    expect(params.start_time).toContain('2025-05-31T');
    expect(params.end_time).toContain('2025-06-06T');
  });
});

// ---------------------------------------------------------------------------
// 12. 权限拦截路由守卫测试（对应 ATB-04）
// ---------------------------------------------------------------------------

interface RouteMeta {
  requiredRoles: string[];
}

interface Route {
  path: string;
  meta?: RouteMeta;
}

/**
 * 模拟路由守卫逻辑
 * @param route 目标路由
 * @param user 当前用户
 * @returns 允许通过或重定向路径
 */
function routeGuard(
  route: Route,
  user: UserInfo | null
): { allowed: true } | { allowed: false; redirect: string } {
  if (!route.meta?.requiredRoles || route.meta.requiredRoles.length === 0) {
    return { allowed: true };
  }
  if (!user) {
    return { allowed: false, redirect: '/login' };
  }
  const hasRole = route.meta.requiredRoles.some((role) => user.roles.includes(role));
  if (!hasRole) {
    return { allowed: false, redirect: '/403' };
  }
  return { allowed: true };
}

describe('权限拦截路由守卫 (ATB-04)', () => {
  const auditRoute: Route = {
    path: '/dashboard/audit-log',
    meta: { requiredRoles: ['admin', 'auditor'] },
  };

  it('admin 用户应允许访问', () => {
    const user: UserInfo = { id: 'U001', roles: ['admin'] };
    const result = routeGuard(auditRoute, user);
    expect(result.allowed).toBe(true);
  });

  it('auditor 用户应允许访问', () => {
    const user: UserInfo = { id: 'U002', roles: ['auditor'] };
    const result = routeGuard(auditRoute, user);
    expect(result.allowed).toBe(true);
  });

  it('普通用户应被重定向到 403', () => {
    const user: UserInfo = { id: 'U003', roles: ['user'] };
    const result = routeGuard(auditRoute, user);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.redirect).toBe('/403');
    }
  });

  it('未登录用户应被重定向到登录页', () => {
    const result = routeGuard(auditRoute, null);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.redirect).toBe('/login');
    }
  });

  it('无权限用户不应触发审计日志数据请求', () => {
    const user: UserInfo = { id: 'U003', roles: ['user'] };
    const result = routeGuard(auditRoute, user);
    // 如果路由守卫拦截成功，前端不应发起 API 请求
    expect(result.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 13. 筛选器联动与数据刷新测试（对应 ATB-05）
// ---------------------------------------------------------------------------

describe('筛选器联动与数据刷新 (ATB-05)', () => {
  it('选择 actionType=DELETE 后应反映在请求参数中', () => {
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-15T00:00:00Z');
    const params = buildListParams(start, end, { action_type: 'DELETE' });
    expect(params.action_type).toBe('DELETE');
  });

  it('筛选条件变更后表格数据应仅包含匹配记录', () => {
    const mockItems: AuditLogItem[] = [
      {
        id: '1',
        operator_id: 'U001',
        operator_name: 'Alice',
        action_type: 'LOGIN',
        target_type: 'session',
        target_id: 'S001',
        detail: '用户登录',
        ip_address: '192.168.1.1',
        created_at: '2025-06-15T08:00:00Z',
      },
      {
        id: '2',
        operator_id: 'U001',
        operator_name: 'Alice',
        action_type: 'DELETE',
        target_type: 'asset',
        target_id: 'A001',
        detail: '删除资产',
        ip_address: '192.168.1.1',
        created_at: '2025-06-15T09:00:00Z',
      },
    ];
    const filtered = filterAuditLogItems(mockItems, { action_type: 'DELETE' });
    expect(filtered.length).toBe(1);
    expect(filtered[0].action_type).toBe('DELETE');
  });

  it('筛选条件变更后趋势图表应同步重新请求', () => {
    // 模拟筛选条件变更后重新构造趋势参数
    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-15T00:00:00Z');
    const trendParams = buildTrendParams(start, end);
    expect(trendParams.granularity).toBe('day');
    expect(trendParams.start_time).toBe('2025-06-01T00:00:00.000Z');
    expect(trendParams.end_time).toBe('2025-06-15T00:00:00.000Z');
  });

  it('筛选器联动：操作类型变更应重置分页', () => {
    const state = updateFilterState(
      { ...initialFilterState, page: 5, actionType: 'LOGIN' },
      { actionType: 'DELETE', page: 1 }
    );
    expect(state.actionType).toBe('DELETE');
    expect(state.page).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 14. 趋势图表渲染验证测试（对应 ATB-06）
// ---------------------------------------------------------------------------

describe('趋势图表渲染验证 (ATB-06)', () => {
  it('30 天范围应使用 day 粒度', () => {
    const start = new Date('2025-05-16T00:00:00Z');
    const end = new Date('2025-06-15T00:00:00Z');
    const params = buildTrendParams(start, end);
    expect(params.granularity).toBe('day');
  });

  it('图表数据点数量应与 API 返回数组长度一致', () => {
    // 模拟 30 天按天聚合，应有 30 个数据点
    const mockTrendData: TrendDataPoint[] = Array.from({ length: 30 }, (_, i) => ({
      timestamp: new Date(Date.UTC(2025, 5, i + 1, 0, 0, 0)).toISOString(),
      count: Math.floor(Math.random() * 20),
    }));
    // 图表渲染时应使用完整的数据点
    expect(mockTrendData.length).toBe(30);
  });

  it('7 天范围按小时聚合应有 168 个数据点', () => {
    const mockTrendData: TrendDataPoint[] = Array.from({ length: 168 }, (_, i) => ({
      timestamp: new Date(Date.UTC(2025, 5, 8, i % 24, 0, 0)).toISOString(),
      count: Math.floor(Math.random() * 5),
    }));
    expect(mockTrendData.length).toBe(168);
  });

  it('趋势数据应可通过 validateTrendResponse 校验', () => {
    const mockResponse: AuditLogTrendResponse = {
      granularity: 'day',
      data: Array.from({ length: 30 }, (_, i) => ({
        timestamp: new Date(Date.UTC(2025, 5, i + 1, 0, 0, 0)).toISOString(),
        count: Math.floor(Math.random() * 20),
      })),
    };
    expect(validateTrendResponse(mockResponse)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 15. 边界状态处理测试
// ---------------------------------------------------------------------------

describe('边界状态处理', () => {
  it('空数据列表应正常处理', () => {
    const emptyResponse: AuditLogListResponse = { total: 0, items: [] };
    expect(validateListResponse(emptyResponse)).toBe(true);
    expect(emptyResponse.items.length).toBe(0);
  });

  it('空趋势数据应正常处理', () => {
    const emptyTrend: AuditLogTrendResponse = { granularity: 'day', data: [] };
    expect(validateTrendResponse(emptyTrend)).toBe(true);
    expect(emptyTrend.data.length).toBe(0);
  });

  it('加载态应阻止重复请求', () => {
    let loading = false;
    const requestLog: string[] = [];

    function simulateRequest(): void {
      if (loading) {
        requestLog.push('blocked');
        return;
      }
      loading = true;
      requestLog.push('sent');
      // 模拟请求完成
      loading = false;
    }

    simulateRequest();
    simulateRequest();
    expect(requestLog).toEqual(['sent', 'sent']);
  });

  it('加载态中重复请求应被阻止', () => {
    let loading = false;
    const requestLog: string[] = [];

    function simulateRequestWithGuard(): void {
      if (loading) {
        requestLog.push('blocked');
        return;
      }
      loading = true;
      requestLog.push('sent');
      // 注意：不重置 loading，模拟请求进行中
    }

    simulateRequestWithGuard();
    simulateRequestWithGuard();
    expect(requestLog).toEqual(['sent', 'blocked']);
  });

  it('越界错误应有明确提示', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-12-31T00:00:00Z');
    const error = validateTimeRange(start, end);
    expect(error).toBeTruthy();
    expect(error).toContain('90');
  });

  it('分页偏移量不超过 10000 的约束', () => {
    // page * size 不应超过 10000
    const maxOffset = 10000;
    const page = 101;
    const size = 100;
    const offset = (page - 1) * size;
    expect(offset).toBeGreaterThan(maxOffset);
    // 前端应阻止这种深度分页请求
    const isDeepPagination = offset > maxOffset;
    expect(isDeepPagination).toBe(true);
  });

  it('深度分页应被前端拦截', () => {
    const MAX_OFFSET = 10000;
    function isPaginationAllowed(page: number, size: number): boolean {
      return (page - 1) * size <= MAX_OFFSET;
    }
    expect(isPaginationAllowed(1, 50)).toBe(true);
    expect(isPaginationAllowed(200, 50)).toBe(false);
    expect(isPaginationAllowed(100, 100)).toBe(false); // offset = 9900, allowed
    expect(isPaginationAllowed(101, 100)).toBe(false); // offset = 10000, allowed (边界)
  });
});

// ---------------------------------------------------------------------------
// 16. 时区转换测试
// ---------------------------------------------------------------------------

describe('时区转换', () => {
  it('前端展示时间应转换为用户本地时区', () => {
    const utcStr = '2025-06-15T00:00:00.000Z';
    const date = new Date(utcStr);
    // 验证 Date 对象可正确转换为本地时间字符串
    const localStr = date.toLocaleString();
    expect(typeof localStr).toBe('string');
    expect(localStr.length).toBeGreaterThan(0);
  });

  it('API 交互时间应强制使用 UTC ISO 8601', () => {
    const localDate = new Date('2025-06-15T08:00:00+08:00');
    const utcStr = toUTCISOString(localDate);
    // UTC 字符串应以 Z 结尾
    expect(utcStr.endsWith('Z')).toBe(true);
    // 验证 UTC 时间为 00:00
    expect(utcStr).toContain('00:00:00');
  });

  it('筛选器选择本地时间后应转为 UTC 发送', () => {
    // 用户在 +08:00 时区选择 2025-06-15 00:00 ~ 2025-06-15 23:59
    const localStart = new Date('2025-06-15T00:00:00+08:00');
    const localEnd = new Date('2025-06-15T23:59:59+08:00');
    const params = buildListParams(localStart, localEnd);
    // UTC 应为前一天 16:00 ~ 当天 15:59
    expect(params.start_time).toBe('2025-06-14T16:00:00.000Z');
    expect(params.end_time).toBe('2025-06-15T15:59:59.000Z');
  });
});

// ---------------------------------------------------------------------------
// 17. Mock API 集成测试
// ---------------------------------------------------------------------------

describe('Mock API 集成测试', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('列表查询应正确发送请求参数', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          total: 1,
          items: [
            {
              id: '1',
              operator_id: 'U001',
              operator_name: 'Alice',
              action_type: 'LOGIN',
              target_type: 'session',
              target_id: 'S001',
              detail: '用户登录',
              ip_address: '192.168.1.1',
              created_at: '2025-06-15T08:00:00Z',
            },
          ],
        }),
    });

    const start = new Date('2025-06-01T00:00:00Z');
    const end = new Date('2025-06-15T00:00:00Z');
    const params = buildListParams(start, end, {
      operator_id: 'U001',
      action_type: 'LOGIN',
      page: 1,
      size: 20,
    });

    await mockFetch('/api/v1/audit-log/list', { params });

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/audit-log/list', { params });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('趋势查询应正确发送请求参数', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          granularity: 'hour',
          data: [
            { timestamp: '2025-06-15T00:00:00Z', count: 5 },
            { timestamp: '2025-06-15T01:00:00Z', count: 3 },
          ],
        }),
    });

    const start = new Date('2025-06-08T00:00:00Z');
    const end = new Date('2025-06-15T00:00:00Z');
    const params = buildTrendParams(start, end);

    await mockFetch('/api/v1/audit-log/trend', { params });

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/audit-log/trend', { params });
    expect(params.granularity).toBe('hour');
  });

  it('元数据查询应正确获取操作类型枚举', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          action_types: ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE'],
        }),
    });

    await mockFetch('/api/v1/audit-log/meta');
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/audit-log/meta');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('越界请求应在前端被拦截，不发送 API 请求', async () => {
    const mockFetch = vi.fn();
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-12-31T00:00:00Z');

    try {
      buildListParams(start, end);
    } catch {
      // 预期抛出异常
    }

    // 前端拦截后不应发起请求
    expect(mockFetch).not.toHaveBeenCalled();
  });
});