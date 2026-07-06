import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition } from '@/components/ui/PageTransition';
import { SkeletonCard } from '@/components/ui';

interface ModuleResult {
  name: string;
  type: 'backend' | 'frontend';
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  executionTime: number;
  status: 'pass' | 'fail' | 'partial';
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  executionTime: number;
  timestamp: string;
}

interface TestResultsData {
  summary: TestSummary;
  modules: ModuleResult[];
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pass: { label: '通过', className: 'bg-green-100 text-green-700 border-green-200' },
  fail: { label: '失败', className: 'bg-red-100 text-red-700 border-red-200' },
  partial: { label: '部分通过', className: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const ModuleRow: React.FC<{ mod: ModuleResult }> = ({ mod }) => {
  const passRate = mod.total > 0 ? Math.round((mod.passed / mod.total) * 100) : 0;
  const badge = STATUS_BADGE[mod.status];

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      <td className="py-3 px-4">
        <span className="text-sm font-medium text-gray-800">{mod.name}</span>
      </td>
      <td className="py-3 px-4">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          mod.type === 'backend' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
        }`}>
          {mod.type === 'backend' ? '后端' : '前端'}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-gray-600 tabular-nums">{mod.total}</td>
      <td className="py-3 px-4 text-sm text-green-600 tabular-nums">{mod.passed}</td>
      <td className="py-3 px-4 text-sm text-red-600 tabular-nums">{mod.failed}</td>
      <td className="py-3 px-4 text-sm text-gray-400 tabular-nums">{mod.skipped}</td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                passRate >= 90 ? 'bg-green-500' : passRate >= 70 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${passRate}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 font-medium w-9 text-right tabular-nums">{passRate}%</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${badge.className}`}>
          {badge.label}
        </span>
      </td>
    </tr>
  );
};

const TestResultsPage: React.FC = () => {
  const [data, setData] = useState<TestResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/test-reports/data.json')
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { setError(err?.message || '加载失败'); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <PageTransition>
        <div className="p-6 space-y-4">
          <SkeletonCard className="h-32" />
          <SkeletonCard className="h-64" />
        </div>
      </PageTransition>
    );
  }

  if (error || !data) {
    return (
      <PageTransition>
        <div className="p-6">
          <Card>
            <CardContent className="flex items-center justify-center py-12 text-gray-500">
              加载测试结果失败：{error || '未知错误'}
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    );
  }

  const { summary, modules } = data;
  const passRate = summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0;

  return (
    <PageTransition>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <PageHeader title="测试结果" subtitle="模块级测试覆盖与执行状态概览" />

        {/* 统计概览 */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
            <p className="text-xs text-gray-500 mt-1">总用例</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{summary.passed}</p>
            <p className="text-xs text-gray-500 mt-1">通过</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{summary.failed}</p>
            <p className="text-xs text-gray-500 mt-1">失败</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-400">{summary.skipped}</p>
            <p className="text-xs text-gray-500 mt-1">跳过</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{passRate}%</p>
            <p className="text-xs text-gray-500 mt-1">通过率</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-sm font-bold text-gray-700">{(summary.executionTime / 1000).toFixed(1)}s</p>
            <p className="text-xs text-gray-500 mt-1">执行时间</p>
          </CardContent></Card>
        </div>

        {/* 模块表格 */}
        <Card>
          <CardHeader><CardTitle className="text-sm">模块详情</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">模块</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">类型</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">总数</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">通过</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">失败</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">跳过</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">通过率</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m, i) => <ModuleRow key={i} mod={m} />)}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
};

export default TestResultsPage;
