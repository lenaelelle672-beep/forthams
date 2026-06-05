/**
 * @file pages/depreciation/DepreciationComparisonPage.tsx
 * @description 折旧对比报表页 — 同一资产不同折旧方法的对比分析
 *
 * 功能：
 * - 选择资产（输入资产编号或名称）
 * - 显示该资产使用不同折旧方法的折旧额对比
 * - 可以按期间筛选
 * - 以表格形式展示对比数据
 *
 * @since T4.4
 */

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ArrowLeft,
  Calculator,
  TrendingDown,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  getDepreciationMethods,
  type DepreciationMethod,
} from '@/api/depreciation';
import http from '@/utils/http';

// ── 类型定义 ─────────────────────────────────────────────────────────────

/**
 * 折旧对比数据项
 */
interface ComparisonItem {
  /** 折旧方法代码 */
  method: string;
  /** 折旧方法名称 */
  methodName: string;
  /** 本期折旧额 */
  depreciationAmount: number;
  /** 累计折旧 */
  accumulatedDepreciation: number;
  /** 净值 */
  netValue: number;
  /** 折旧率 */
  depreciationRate?: number;
}

/**
 * 资产基本信息
 */
interface AssetBasicInfo {
  id: number;
  assetNo: string;
  assetName: string;
  originalValue: number;
  purchaseDate: string;
  depreciationMethod?: string;
  depreciationRate?: number;
  totalExpectedUnits?: number;
  actualUnits?: number;
}

/**
 * 对比响应数据
 */
interface ComparisonResponse {
  asset: AssetBasicInfo;
  comparisons: ComparisonItem[];
}

// ── 工具函数 ─────────────────────────────────────────────────────────────

/**
 * 格式化金额，保留两位小数并添加人民币符号
 */
function formatAmount(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * 格式化折旧率百分比
 */
function formatRate(rate: number | undefined): string {
  if (rate === undefined || rate === null) return '-';
  return `${(rate * 100).toFixed(2)}%`;
}

/**
 * 获取折旧方法的显示名称
 */
function getMethodLabel(method: string): string {
  const map: Record<string, string> = {
    'STRAIGHT_LINE': '直线法',
    'straight_line': '直线法',
    'DOUBLE_DECLINING': '双倍余额递减法',
    'double_declining': '双倍余额递减法',
    'SYD': '年数总和法',
    'syd': '年数总和法',
    'UOP': '工作量法',
    'uop': '工作量法',
  };
  return map[method] ?? method;
}

/**
 * 获取折旧方法的 Badge 样式
 */
function getMethodBadgeVariant(method: string): 'default' | 'purple' | 'blue' {
  if (method === 'DOUBLE_DECLINING' || method === 'double_declining') return 'purple';
  if (method === 'SYD' || method === 'syd') return 'blue';
  if (method === 'UOP' || method === 'uop') return 'blue';
  return 'default';
}

// ── API 函数 ─────────────────────────────────────────────────────────────

/**
 * 获取资产折旧对比数据
 */
async function getDepreciationComparison(assetId: number, period?: string): Promise<ComparisonResponse> {
  const params: Record<string, string | number> = {};
  if (period) params.period = period;
  return http.get<ComparisonResponse>(`/depreciation/comparison/${assetId}`, { params });
}

/**
 * 搜索资产
 */
async function searchAssets(keyword: string): Promise<AssetBasicInfo[]> {
  if (!keyword || keyword.length < 2) return [];
  return http.get<AssetBasicInfo[]>('/assets/search', { params: { keyword } });
}

// ── 主组件 ───────────────────────────────────────────────────────────────

export default function DepreciationComparisonPage() {
  const navigate = useNavigate();

  // 筛选状态
  const [keyword, setKeyword] = useState('');
  const [period, setPeriod] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<AssetBasicInfo | null>(null);
  const [searchResults, setSearchResults] = useState<AssetBasicInfo[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // 折旧方法列表
  const { data: methods = [] } = useQuery({
    queryKey: ['depreciation-methods'],
    queryFn: getDepreciationMethods,
    staleTime: 1000 * 60 * 10,
  });

  // 获取对比数据
  const {
    data: comparisonData,
    isLoading: loading,
    error: fetchError,
  } = useQuery({
    queryKey: ['depreciation-comparison', selectedAsset?.id, period],
    queryFn: () => getDepreciationComparison(selectedAsset!.id, period),
    enabled: !!selectedAsset,
    retry: false,
  });

  // ── 事件处理 ───────────────────────────────────────────────────────────

  /**
   * 搜索资产
   */
  const handleSearch = useCallback(async () => {
    if (!keyword || keyword.length < 2) {
      toast.error('请输入至少2个字符进行搜索');
      return;
    }
    try {
      const results = await searchAssets(keyword);
      setSearchResults(results);
      setShowSearchResults(results.length > 0);
    } catch (err) {
      toast.error('搜索失败：' + (err instanceof Error ? err.message : '未知错误'));
    }
  }, [keyword]);

  /**
   * 选择资产
   */
  const handleSelectAsset = useCallback((asset: AssetBasicInfo) => {
    setSelectedAsset(asset);
    setShowSearchResults(false);
    setKeyword('');
    setSearchResults([]);
  }, []);

  /**
   * 重置筛选
   */
  const handleReset = useCallback(() => {
    setKeyword('');
    setPeriod('');
    setSelectedAsset(null);
    setSearchResults([]);
    setShowSearchResults(false);
  }, []);

  /**
   * 键盘事件
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  // ── 渲染 ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <PageHeader
        title="折旧对比报表"
        subtitle="同一资产不同折旧方法的对比分析"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
        }
      />

      {/* 筛选栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* 资产搜索 */}
            <div className="flex flex-col gap-1 relative">
              <label className="text-xs font-medium text-gray-600">选择资产</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="输入资产编号或名称..."
                  value={keyword}
                  onChange={e => {
                    setKeyword(e.target.value);
                    setShowSearchResults(false);
                  }}
                  onKeyDown={handleKeyDown}
                  className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* 搜索结果下拉 */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                  {searchResults.map(asset => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => handleSelectAsset(asset)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                    >
                      <div className="font-medium text-gray-900">{asset.assetName}</div>
                      <div className="text-xs text-gray-500">{asset.assetNo} · {formatAmount(asset.originalValue)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 期间 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">会计期间</label>
              <input
                type="month"
                placeholder="YYYY-MM"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Button variant="primary" size="sm" onClick={handleSearch} disabled={!keyword || keyword.length < 2}>
              <Search className="w-4 h-4 mr-1" />
              搜索
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 已选资产信息 */}
      {selectedAsset && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedAsset.assetName}</h3>
                <p className="text-sm text-gray-500">
                  {selectedAsset.assetNo} · 原值: {formatAmount(selectedAsset.originalValue)}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="text-gray-500">当前方法</p>
                <Badge variant={getMethodBadgeVariant(selectedAsset.depreciationMethod || '')}>
                  {getMethodLabel(selectedAsset.depreciationMethod || '')}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="text-center py-12 text-gray-400">
          正在加载对比数据...
        </div>
      )}

      {/* 错误提示 */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {fetchError instanceof Error ? fetchError.message : '加载对比数据失败'}
        </div>
      )}

      {/* 对比结果表格 */}
      {comparisonData && !loading && !fetchError && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      折旧方法
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                      本期折旧额
                      <span className="font-normal text-gray-400 ml-0.5">(¥)</span>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                      累计折旧
                      <span className="font-normal text-gray-400 ml-0.5">(¥)</span>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                      净值
                      <span className="font-normal text-gray-400 ml-0.5">(¥)</span>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                      折旧率
                      <span className="font-normal text-gray-400 ml-0.5">(%)</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {comparisonData.comparisons.map((item, index) => (
                    <tr
                      key={item.method}
                      className={`hover:bg-gray-50 transition-colors ${
                        item.method === comparisonData.asset.depreciationMethod ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Badge variant={getMethodBadgeVariant(item.method)}>
                          {item.methodName}
                          {item.method === comparisonData.asset.depreciationMethod && (
                            <span className="ml-1 text-xs text-gray-500">(当前)</span>
                          )}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-blue-700 font-semibold tabular-nums">
                        {formatAmount(item.depreciationAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600 tabular-nums">
                        {formatAmount(item.accumulatedDepreciation)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-900 font-semibold tabular-nums">
                        {formatAmount(item.netValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700 tabular-nums">
                        {formatRate(item.depreciationRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 空状态 */}
      {!selectedAsset && !loading && !fetchError && (
        <div className="text-center py-12 text-gray-400">
          <Calculator className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>请选择资产以查看折旧对比分析</p>
        </div>
      )}
    </div>
  );
}