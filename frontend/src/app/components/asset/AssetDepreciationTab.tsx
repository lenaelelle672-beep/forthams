/**
 * AssetDepreciationTab Component
 *
 * 资产详情页 - 折旧计划标签页
 * 展示资产折旧方法参数、逐期折旧明细时间线及汇总统计。
 *
 * @module components/asset/AssetDepreciationTab
 * @since SWARM-015
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { TrendingDown, Info } from 'lucide-react';
import { fetchDepreciationSchedule } from '../../services/assetDetailService';
import type { DepreciationScheduleDTO, DepreciationDetailItem } from '../../services/assetApi';

/**
 * Component props
 */
interface AssetDepreciationTabProps {
  /** 资产 ID */
  assetId: string;
}

/**
 * 格式化金额为中文货币格式
 *
 * @param value - 数值金额
 * @returns 格式化后的货币字符串，如 "¥12,345.00"
 */
const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '-';
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * 格式化百分比率
 *
 * @param rate - 比率值（如 0.15 表示 15%）
 * @returns 格式化后的百分比字符串
 */
const formatRate = (rate: number | undefined): string => {
  if (rate === undefined || rate === null) return '-';
  return `${(rate * 100).toFixed(2)}%`;
};

/**
 * 折旧方法中文映射
 */
const METHOD_LABELS: Record<string, string> = {
  straight_line: '直线法',
  double_declining_balance: '双倍余额递减法',
};

/**
 * 资产折旧计划标签页组件
 *
 * 该组件从后端获取指定资产的折旧计划数据并渲染：
 * - 折旧方法与参数概览卡片
 * - 逐期折旧明细表格
 * - 累计折旧统计
 *
 * @param props - 组件属性
 * @returns 折旧计划标签页 JSX
 */
export const AssetDepreciationTab: React.FC<AssetDepreciationTabProps> = ({ assetId }) => {
  const [schedule, setSchedule] = useState<DepreciationScheduleDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取折旧计划数据
   */
  const loadSchedule = useCallback(async () => {
    if (!assetId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchDepreciationSchedule(assetId);
      setSchedule(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取折旧计划失败';
      setError(message);
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="space-y-4" data-testid="depreciation-tab-loading">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="depreciation-tab-error">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center py-8">
            <Info className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">加载折旧计划失败：{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- No depreciation data (e.g. land assets) ----
  if (!schedule) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="depreciation-tab-empty">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center py-8">
            <TrendingDown className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">该资产暂无折旧数据</p>
            <p className="text-sm text-muted-foreground mt-1">
              土地类资产或未配置折旧参数的资产不会产生折旧记录
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Summary statistics ----
  const finalAccumulated = schedule.details.length > 0
    ? schedule.details[schedule.details.length - 1].accumulatedDepreciation
    : 0;
  const finalNetValue = schedule.details.length > 0
    ? schedule.details[schedule.details.length - 1].netValue
    : schedule.originalValue;

  return (
    <div className="space-y-4" data-testid="depreciation-tab">
      {/* ---- Parameter overview card ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            折旧参数概览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">折旧方法</p>
              <Badge variant="outline">{METHOD_LABELS[schedule.method] || schedule.methodName}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">资产原值</p>
              <p className="font-semibold">{formatCurrency(schedule.originalValue)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">预计残值</p>
              <p className="font-semibold">{formatCurrency(schedule.salvageValue)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">折旧年限</p>
              <p className="font-semibold">{schedule.usefulLifeYears} 年</p>
            </div>
            {schedule.salvageRate !== undefined && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">残值率</p>
                <p className="font-semibold">{formatRate(schedule.salvageRate)}</p>
              </div>
            )}
            {schedule.startDate && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">折旧开始日期</p>
                <p className="font-semibold">{schedule.startDate}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">累计折旧总额</p>
              <p className="font-semibold text-orange-600">{formatCurrency(finalAccumulated)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">当前账面净值</p>
              <p className="font-semibold">{formatCurrency(finalNetValue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Depreciation detail table ---- */}
      {schedule.details.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              逐期折旧明细
              <Badge variant="secondary" className="ml-2">
                {schedule.details.length} 期
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">期间</TableHead>
                    <TableHead className="text-right">本期折旧额</TableHead>
                    <TableHead className="text-right">累计折旧</TableHead>
                    <TableHead className="text-right">账面净值</TableHead>
                    {schedule.details.some(d => d.depreciationRate !== undefined) && (
                      <TableHead className="text-right">折旧率</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.details.map((item: DepreciationDetailItem) => (
                    <TableRow key={item.id || item.period}>
                      <TableCell className="font-mono">{item.period}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.depreciationAmount)}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {formatCurrency(item.accumulatedDepreciation)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.netValue)}
                      </TableCell>
                      {schedule.details.some(d => d.depreciationRate !== undefined) && (
                        <TableCell className="text-right">
                          {formatRate(item.depreciationRate)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AssetDepreciationTab;
