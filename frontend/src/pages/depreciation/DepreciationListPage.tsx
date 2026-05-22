/**
 * @file pages/depreciation/DepreciationListPage.tsx
 * @description 折旧管理页（新 Design System 版本）
 *
 * API 复用 src/app/services/depreciationApi.ts（getDepreciationSchedules, batchCalculateDepreciation）
 * UI 全部按新 Design System 重写。
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingDown,
  Search,
  RefreshCw,
  Calculator,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  getDepreciationSchedules,
  batchCalculateDepreciation,
  PERIOD_REGEX,
} from '@/app/services/depreciationApi';
import type {
  DepreciationScheduleItem,
  DepreciationFilter,
} from '@/app/services/depreciationApi';

// ── Mock 数据 ─────────────────────────────────────────────────────────────────

const MOCK_SCHEDULES: DepreciationScheduleItem[] = [
  {
    id: 1,
    assetId: 101,
    assetNo: 'AST-2024-001',
    assetName: '联想 ThinkPad X1 笔记本',
    period: '2024-01',
    depreciationAmount: 708.33,
    accumulatedDepreciation: 2833.32,
    netValue: 5666.68,
    depreciationMethod: 'straight_line',
    assetStatus: 'IN_USE',
  },
  {
    id: 2,
    assetId: 102,
    assetNo: 'AST-2024-002',
    assetName: '戴尔服务器 PowerEdge R740',
    period: '2024-01',
    depreciationAmount: 1500.00,
    accumulatedDepreciation: 9000.00,
    netValue: 21000.00,
    depreciationMethod: 'double_declining',
    assetStatus: 'IN_USE',
  },
  {
    id: 3,
    assetId: 103,
    assetNo: 'AST-2024-003',
    assetName: '会议室投影仪 Epson EB-X49',
    period: '2024-01',
    depreciationAmount: 150.00,
    accumulatedDepreciation: 1800.00,
    netValue: 4200.00,
    depreciationMethod: 'straight_line',
    assetStatus: 'IDLE',
  },
  {
    id: 4,
    assetId: 104,
    assetNo: 'AST-2024-004',
    assetName: '惠普激光打印机 LaserJet Pro',
    period: '2024-01',
    depreciationAmount: 83.33,
    accumulatedDepreciation: 500.00,
    netValue: 2700.00,
    depreciationMethod: 'straight_line',
    assetStatus: 'IN_USE',
  },
  {
    id: 5,
    assetId: 105,
    assetNo: 'AST-2023-015',
    assetName: '工业数控机床 CNC-300',
    period: '2024-01',
    depreciationAmount: 5833.33,
    accumulatedDepreciation: 46666.64,
    netValue: 303333.36,
    depreciationMethod: 'double_declining',
    assetStatus: 'MAINTENANCE',
  },
];

// ── 终态资产状态集合（不可计算折旧）────────────────────────────────────────────

const TERMINAL_STATUSES = new Set(['RETIRED', 'SCRAPPED', 'DISPOSED', 'WRITTEN_OFF']);

function isTerminal(status?: string): boolean {
  return !!status && TERMINAL_STATUSES.has(status.toUpperCase());
}

// ── 工具函数 ─────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getMethodLabel(method?: string): string {
  if (!method) return '-';
  if (method === 'straight_line')    return '直线法';
  if (method === 'double_declining') return '双倍余额递减法';
  return method;
}

function getMethodBadgeVariant(method?: string): 'default' | 'purple' {
  return method === 'double_declining' ? 'purple' : 'default';
}

function getAssetStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    IN_USE:      '在用',
    IDLE:        '闲置',
    MAINTENANCE: '维修中',
    RETIRED:     '已退役',
    SCRAPPED:    '已报废',
    DISPOSED:    '已处置',
    WRITTEN_OFF: '已核销',
  };
  return map[status ?? ''] ?? (status ?? '-');
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

export default function DepreciationListPage() {
  // 筛选状态
  const [assetNoFilter, setAssetNoFilter] = useState('');
  const [periodFilter,  setPeriodFilter]  = useState('');
  const [periodError,   setPeriodError]   = useState<string | null>(null);

  // 数据状态
  const [dataSource,  setDataSource]  = useState<DepreciationScheduleItem[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const pageSize = 10;

  // 选择 & 批量
  const [selectedIds,   setSelectedIds]   = useState<number[]>([]);
  const [batchLoading,  setBatchLoading]  = useState(false);
  const [batchConfirm,  setBatchConfirm]  = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 数据加载 ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (
    p: number = 1,
    assetNo?: string,
    period?: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const filters: DepreciationFilter = { page: p, pageSize };
      if (assetNo) filters.assetNo = assetNo;
      if (period)  filters.period  = period;

      const res = await getDepreciationSchedules(filters);

      // 去重
      const seenIds = new Set<number>();
      const deduped = res.data.filter(item => {
        if (seenIds.has(item.id)) return false;
        seenIds.add(item.id);
        return true;
      });

      if (deduped.length > 0) {
        setDataSource(deduped);
      } else if (p === 1) {
        toast.warning('当前显示示例数据，API 数据不可用');
        setDataSource(MOCK_SCHEDULES);
      } else {
        setDataSource([]);
      }
      setTotal(res.total || (p === 1 ? MOCK_SCHEDULES.length : 0));
      setPage(res.page || p);
    } catch {
      // API 不通，降级 Mock
      toast.warning('当前显示示例数据，API 数据不可用');
      if (p === 1) {
        setDataSource(MOCK_SCHEDULES);
        setTotal(MOCK_SCHEDULES.length);
      } else {
        setDataSource([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(1); }, [fetchData]);

  // ── 防抖筛选 ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (periodFilter && !PERIOD_REGEX.test(periodFilter)) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSelectedIds([]);
      fetchData(1, assetNoFilter || undefined, periodFilter || undefined);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [assetNoFilter, periodFilter, fetchData]);

  // ── 搜索 ─────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(() => {
    if (periodFilter && !PERIOD_REGEX.test(periodFilter)) {
      setPeriodError('期间格式不正确，请使用 YYYY-MM 格式（如 2024-01）');
      return;
    }
    setPeriodError(null);
    setSelectedIds([]);
    fetchData(1, assetNoFilter || undefined, periodFilter || undefined);
  }, [fetchData, assetNoFilter, periodFilter]);

  const handleReset = useCallback(() => {
    setAssetNoFilter('');
    setPeriodFilter('');
    setPeriodError(null);
    setSelectedIds([]);
    fetchData(1);
  }, [fetchData]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  // ── 行选择 ───────────────────────────────────────────────────────────────

  const isAllSelected = dataSource.length > 0 && selectedIds.length === dataSource.length;

  const toggleAll = () => {
    setSelectedIds(isAllSelected ? [] : dataSource.map(r => r.id));
  };

  const toggleRow = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // ── 批量计算 ─────────────────────────────────────────────────────────────

  const handleBatchCalculate = useCallback(async () => {
    if (selectedIds.length === 0) return;

    // 终态校验
    const terminalRows = dataSource.filter(r => selectedIds.includes(r.id) && isTerminal(r.assetStatus));
    if (terminalRows.length > 0) {
      const nos = terminalRows.map(r => r.assetNo).join(', ');
      setError(`以下资产已报废/退役，不可计算折旧: ${nos}`);
      setBatchConfirm(false);
      return;
    }

    setBatchLoading(true);
    setError(null);
    try {
      const assetIds = Array.from(new Set(
        dataSource.filter(r => selectedIds.includes(r.id)).map(r => r.assetId)
      ));
      await batchCalculateDepreciation({ assetIds });
      setSelectedIds([]);
      setBatchConfirm(false);
      await fetchData(page, assetNoFilter || undefined, periodFilter || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量计算失败');
      setBatchConfirm(false);
    } finally {
      setBatchLoading(false);
    }
  }, [selectedIds, dataSource, fetchData, page, assetNoFilter, periodFilter]);

  // ── 统计 ─────────────────────────────────────────────────────────────────

  const totalDepreciation = dataSource.reduce((sum, r) => sum + r.depreciationAmount, 0);
  const pendingCount      = dataSource.filter(r => !isTerminal(r.assetStatus)).length;
  const completedCount    = dataSource.filter(r => isTerminal(r.assetStatus)).length;
  const straightCount     = dataSource.filter(r => r.depreciationMethod === 'straight_line').length;
  const doubleCount       = dataSource.filter(r => r.depreciationMethod === 'double_declining').length;

  // ── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <PageHeader
        title="折旧管理"
        subtitle="资产折旧计划管理与批量计算"
        actions={
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-600" />
          </div>
        }
      />

      {/* 统计卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: '本月折旧总额',
            value: formatAmount(totalDepreciation),
            sub: '当期汇总',
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: '待计算资产',
            value: `${pendingCount} 项`,
            sub: '可执行批量计算',
            color: 'text-orange-500',
            bg: 'bg-orange-50',
          },
          {
            label: '已完成',
            value: `${completedCount} 项`,
            sub: '终态资产',
            color: 'text-green-600',
            bg: 'bg-green-50',
          },
          {
            label: '折旧方法分布',
            value: `直线 ${straightCount} / 双倍 ${doubleCount}`,
            sub: '方法统计',
            color: 'text-purple-600',
            bg: 'bg-purple-50',
          },
        ].map(({ label, value, sub, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-xl font-semibold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-1">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* 资产编号 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">资产编号</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="输入资产编号..."
                  value={assetNoFilter}
                  onChange={e => setAssetNoFilter(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 期间 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">会计期间</label>
              <input
                type="month"
                placeholder="YYYY-MM"
                value={periodFilter}
                onChange={e => { setPeriodFilter(e.target.value); if (periodError) setPeriodError(null); }}
                onKeyDown={handleKeyDown}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {periodError && (
                <p className="text-xs text-red-500">{periodError}</p>
              )}
            </div>

            <Button variant="default" size="sm" onClick={handleSearch}>
              <Search className="w-4 h-4 mr-1" />
              查询
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="w-4 h-4 mr-1" />
              重置
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(page, assetNoFilter || undefined, periodFilter || undefined)}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* 批量操作栏 */}
      <div className="flex items-center gap-3">
        <Button
          variant="default"
          size="sm"
          disabled={selectedIds.length === 0 || batchLoading}
          onClick={() => setBatchConfirm(true)}
        >
          <Calculator className="w-4 h-4 mr-1" />
          {batchLoading ? '计算中…' : '批量计算折旧'}
        </Button>
        {selectedIds.length > 0 && (
          <span className="text-sm text-gray-500">已选 {selectedIds.length} 条</span>
        )}
      </div>

      {/* 折旧计划表格 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">资产编号</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">资产名称</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">折旧方法</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">当期折旧额</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">累计折旧</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">净值</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                      加载中…
                    </td>
                  </tr>
                ) : dataSource.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  dataSource.map(row => (
                    <tr
                      key={row.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        selectedIds.includes(row.id) ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => toggleRow(row.id)}
                          disabled={isTerminal(row.assetStatus)}
                          className="w-4 h-4 text-blue-600 rounded disabled:opacity-40"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-blue-600">{row.assetNo}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{row.assetName}</p>
                        <p className="text-xs text-gray-400">{row.period}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getMethodBadgeVariant(row.depreciationMethod)}>
                          {getMethodLabel(row.depreciationMethod)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium">
                        {formatAmount(row.depreciationAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatAmount(row.accumulatedDepreciation)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatAmount(row.netValue)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={isTerminal(row.assetStatus) ? 'gray' : 'success'}>
                          {getAssetStatusLabel(row.assetStatus)}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 分页信息 */}
          {total > pageSize && (
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
              <span>共 {total} 条记录</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => fetchData(page - 1, assetNoFilter || undefined, periodFilter || undefined)}
                >
                  上一页
                </Button>
                <span className="px-2 py-1 text-gray-600">第 {page} 页</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * pageSize >= total}
                  onClick={() => fetchData(page + 1, assetNoFilter || undefined, periodFilter || undefined)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 批量计算确认对话框 */}
      {batchConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-xl">
            <div className="px-6 py-5">
              <h3 className="text-base font-semibold text-gray-900 mb-2">确认批量计算折旧</h3>
              <p className="text-sm text-gray-600">
                将对已选择的 <span className="font-medium text-blue-600">{selectedIds.length}</span> 条记录执行折旧计算，此操作不可撤销。确认继续？
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <Button variant="outline" size="sm" onClick={() => setBatchConfirm(false)} disabled={batchLoading}>
                取消
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleBatchCalculate}
                disabled={batchLoading}
              >
                {batchLoading ? '计算中…' : '确认计算'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
