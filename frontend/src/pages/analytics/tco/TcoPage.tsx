/**
 * @file pages/analytics/tco/TcoPage.tsx
 * @description TCO 全生命周期成本总览页
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart3, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { getAssetTco, getDepartmentTco, getCategoryTco, getTcoTrend } from '@/api/tco';

const COLORS = ['#004ac6', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#6b7280'];

function formatAmount(n: number | undefined | null): string {
  if (n == null) return '-';
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

const COST_LABELS: Record<string, string> = {
  purchaseCost: '采购成本',
  maintenanceCost: '维保成本',
  workOrderCost: '工单成本',
  energyCost: '能耗成本',
  insuranceCost: '保险成本',
  currentValue: '当前净值',
};

export default function TcoPage() {
  const [assetId, setAssetId] = useState('');
  const [deptId, setDeptId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const { data: assetTco, isLoading: assetLoading } = useQuery({
    queryKey: ['tco-asset', assetId],
    queryFn: () => getAssetTco(Number(assetId)),
    enabled: !!assetId && !isNaN(Number(assetId)),
  });

  const { data: deptTco } = useQuery({
    queryKey: ['tco-dept', deptId],
    queryFn: () => getDepartmentTco(Number(deptId)),
    enabled: !!deptId && !isNaN(Number(deptId)),
  });

  const { data: catTco } = useQuery({
    queryKey: ['tco-cat', categoryId],
    queryFn: () => getCategoryTco(Number(categoryId)),
    enabled: !!categoryId && !isNaN(Number(categoryId)),
  });

  const { data: trend } = useQuery({
    queryKey: ['tco-trend', assetId],
    queryFn: () => getTcoTrend(Number(assetId), 12),
    enabled: !!assetId && !isNaN(Number(assetId)),
  });

  // 饼图数据
  const pieData = assetTco
    ? [
        { name: '采购成本', value: assetTco.purchaseCost || 0 },
        { name: '维保成本', value: assetTco.maintenanceCost || 0 },
        { name: '工单成本', value: assetTco.workOrderCost || 0 },
        { name: '能耗成本', value: assetTco.energyCost || 0 },
        { name: '保险成本', value: assetTco.insuranceCost || 0 },
      ].filter(d => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="TCO 全生命周期成本"
        subtitle="全生命周期成本总览与分析"
        actions={<BarChart3 className="w-5 h-5 text-blue-600" />}
      />

      {/* 查询栏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">资产ID</label>
              <input type="number" placeholder="输入资产ID" value={assetId}
                onChange={e => setAssetId(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-32" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">部门ID</label>
              <input type="number" placeholder="输入部门ID" value={deptId}
                onChange={e => setDeptId(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-32" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">分类ID</label>
              <input type="number" placeholder="输入分类ID" value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-32" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-5">
        {/* 资产 TCO 详情 */}
        <Card className="col-span-6">
          <CardContent className="p-6">
            <h3 className="text-base font-bold mb-4">资产 TCO 构成</h3>
            {assetLoading && <p className="text-gray-400 text-sm">加载中...</p>}
            {!assetId && <p className="text-gray-400 text-sm">请输入资产ID查询</p>}
            {assetTco && !assetLoading && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">{formatAmount(assetTco.totalCost)}</p>
                  <p className="text-xs text-gray-500 mt-1">TCO 总成本</p>
                </div>
                {pieData.length > 0 && (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatAmount(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(COST_LABELS).map(([key, label]) => {
                    const val = (assetTco as any)[key] ?? 0;
                    return (
                      <div key={key} className="flex justify-between px-3 py-2 bg-gray-50 rounded-lg">
                        <span className="text-gray-600">{label}</span>
                        <span className="font-semibold">{formatAmount(val)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TCO 趋势 */}
        <Card className="col-span-6">
          <CardContent className="p-6">
            <h3 className="text-base font-bold mb-4">TCO 趋势 (近12个月)</h3>
            {trend && trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trend}>
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatAmount(v)} />
                  <Line type="monotone" dataKey="totalCost" stroke="#004ac6" strokeWidth={2} name="TCO总成本" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
                {assetId ? '暂无趋势数据' : '请先查询资产'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 部门 TCO 排行 */}
        <Card className="col-span-6">
          <CardContent className="p-6">
            <h3 className="text-base font-bold mb-4">部门 TCO 排行</h3>
            {deptTco && deptTco.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={deptTco.map(d => ({ name: d.assetName, cost: d.totalCost }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatAmount(v)} />
                  <Bar dataKey="cost" fill="#004ac6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">
                {deptId ? '暂无数据' : '请输入部门ID查询'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 分类 TCO 排行 */}
        <Card className="col-span-6">
          <CardContent className="p-6">
            <h3 className="text-base font-bold mb-4">分类 TCO 排行</h3>
            {catTco && catTco.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={catTco.map(d => ({ name: d.assetName, cost: d.totalCost }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatAmount(v)} />
                  <Bar dataKey="cost" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-gray-400 text-sm">
                {categoryId ? '暂无数据' : '请输入分类ID查询'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
