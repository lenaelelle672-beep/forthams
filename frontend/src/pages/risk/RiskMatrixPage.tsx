/**
 * @file pages/risk/RiskMatrixPage.tsx
 * @description 风险矩阵页面 — Design System 重构版
 *
 * 功能：5x5 风险矩阵热力图、风险评估记录列表、单元格详情弹窗
 * API: riskApi (list, getMatrix, listByMatrixCell, delete)
 */

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { riskApi } from '../../api/risk';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Eye, X, Grid3X3, ShieldAlert, AlertTriangle, CheckCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/Dialog';
import { PageTransition } from '@/components/ui';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const RISK_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  CRITICAL: { label: '重大', color: '#fff', bg: '#dc2626' },
  HIGH:     { label: '高危', color: '#fff', bg: '#ea580c' },
  MEDIUM:   { label: '中危', color: '#fff', bg: '#eab308' },
  LOW:      { label: '低危', color: '#fff', bg: '#22c55e' },
};

const PROB_LABELS = ['极低', '低', '中等', '高', '极高'];
const IMPACT_LABELS = ['极小', '小', '中等', '大', '极大'];

const RISK_FILTER_OPTIONS = [
  { value: 'ALL',      label: '全部' },
  { value: 'CRITICAL', label: '重大' },
  { value: 'HIGH',     label: '高危' },
  { value: 'MEDIUM',   label: '中危' },
  { value: 'LOW',      label: '低危' },
] as const;

const PAGE_SIZE = 10;

// ─── 辅助函数 ────────────────────────────────────────────────────────────────

function getBgColor(probability: number, impact: number): string {
  const score = probability * impact;
  if (score >= 20) return '#dc2626';
  if (score >= 10) return '#ea580c';
  if (score >= 4) return '#eab308';
  return '#22c55e';
}

function getTextColor(bg: string): string {
  return ['#dc2626', '#ea580c'].includes(bg) ? '#fff' : '#000';
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function RiskLevelBadge({ level }: { level: string }) {
  const info = RISK_LABELS[level] || { label: level, color: '#6b7280', bg: '#f3f4f6' };
  const dotBg =
    level === 'CRITICAL' ? 'bg-red-600' :
    level === 'HIGH'     ? 'bg-orange-500' :
    level === 'MEDIUM'   ? 'bg-yellow-500' :
    level === 'LOW'      ? 'bg-green-500' : 'bg-gray-400';
  const ringClass =
    level === 'CRITICAL' ? 'ring-red-200 border-red-200 text-red-700' :
    level === 'HIGH'     ? 'ring-orange-200 border-orange-200 text-orange-700' :
    level === 'MEDIUM'   ? 'ring-yellow-200 border-yellow-200 text-yellow-700' :
    level === 'LOW'      ? 'ring-green-200 border-green-200 text-green-700' : 'ring-gray-200 border-gray-200 text-gray-600';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${ringClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotBg}`} />
      {info.label}
    </span>
  );
}

// ─── 单元格详情 Dialog ───────────────────────────────────────────────────────

interface CellDetailDialogProps {
  open: boolean;
  selectedCell: { probability: number; impact: number } | null;
  cellAssessments: any[];
  cellLoading: boolean;
  columns: Column<any>[];
  onClose: () => void;
  onAddNew: () => void;
}

function CellDetailDialog({
  open, selectedCell, cellAssessments, cellLoading, columns, onClose, onAddNew,
}: CellDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            风险评估详情 — {selectedCell
              ? `可能性：${PROB_LABELS[selectedCell.probability - 1]}，影响：${IMPACT_LABELS[selectedCell.impact - 1]}`
              : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6">
          <DataTable
            columns={columns}
            data={cellAssessments}
            rowKey="id"
            loading={cellLoading}
            compact
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>关闭</Button>
          <Button variant="primary" onClick={onAddNew}>
            <Plus className="w-4 h-4" />
            新增评估
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 删除确认 Dialog ─────────────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  open: boolean;
  assessment: any | null;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({ open, assessment, deleting, onClose, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open && !!assessment} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="确认删除">
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>此操作不可撤销，请确认操作。</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4">
          <p className="text-sm text-[#64748b]">
            确定要删除此风险评估记录吗？此操作不可撤销。
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={deleting}>
            取消
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} loading={deleting}>
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

const RiskMatrixPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 弹窗状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ probability: number; impact: number } | null>(null);

  // 删除确认弹窗
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<any>(null);

  // 快速过滤
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [assessPage, setAssessPage] = useState(1);

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['riskAssessments'],
    queryFn: () => riskApi.list({ pageNum: 1, pageSize: 100 }),
  });

  const { data: heatmapData } = useQuery({
    queryKey: ['riskMatrix'],
    queryFn: () => riskApi.getMatrix(),
  });

  // 查询特定单元格的风险评估
  const { data: cellData, isLoading: cellLoading } = useQuery({
    queryKey: ['riskCellData', selectedCell],
    queryFn: () => {
      if (selectedCell) {
        return riskApi.listByMatrixCell(selectedCell.probability, selectedCell.impact, { pageNum: 1, pageSize: 100 });
      }
      return null;
    },
    enabled: !!selectedCell,
  });

  const deleteMutation = useMutation({
    mutationFn: riskApi.delete,
    onSuccess: () => {
      toast.success('评估记录已删除');
      queryClient.invalidateQueries({ queryKey: ['riskAssessments'] });
      queryClient.invalidateQueries({ queryKey: ['riskMatrix'] });
      if (selectedCell) {
        queryClient.invalidateQueries({ queryKey: ['riskCellData', selectedCell] });
      }
      setDeleteOpen(false);
      setDeletingRecord(null);
    },
  });

  // ── 数据提取 ──────────────────────────────────────────────────────────────

  const riskAssessments = useMemo(() => {
    return (listData as any)?.records || (listData as any)?.list || [];
  }, [listData]);

  const cellAssessments = useMemo(() => {
    return (cellData as any)?.records || (cellData as any)?.list || [];
  }, [cellData]);

  // ── 统计 ──────────────────────────────────────────────────────────────────

  const totalCount = riskAssessments.length;
  const criticalCount = riskAssessments.filter((r: any) => r.riskLevel === 'CRITICAL').length;
  const highCount = riskAssessments.filter((r: any) => r.riskLevel === 'HIGH').length;
  const medLowCount = riskAssessments.filter((r: any) => r.riskLevel === 'MEDIUM' || r.riskLevel === 'LOW').length;

  // ── 构建 5x5 矩阵数据 ────────────────────────────────────────────────────

  const matrix = useMemo(() => {
    const grid: Record<string, { probability: number; impact: number; count: number; riskLevel: string }> = {};
    for (let p = 1; p <= 5; p++) {
      for (let i = 1; i <= 5; i++) {
        const score = p * i;
        let level = 'LOW';
        if (score >= 20) level = 'CRITICAL';
        else if (score >= 10) level = 'HIGH';
        else if (score >= 4) level = 'MEDIUM';
        grid[`${p}-${i}`] = { probability: p, impact: i, count: 0, riskLevel: level };
      }
    }
    if (heatmapData) {
      const data = heatmapData as any[];
      data.forEach((item: any) => {
        const key = `${item.probability}-${item.impact}`;
        if (grid[key]) {
          grid[key].count = Number(item.cnt || 0);
        }
      });
    }
    return grid;
  }, [heatmapData]);

  // ── 过滤 & 分页 ──────────────────────────────────────────────────────────

  const filteredAssessments = useMemo(() => {
    if (riskFilter === 'ALL') return riskAssessments;
    return riskAssessments.filter((r: any) => r.riskLevel === riskFilter);
  }, [riskAssessments, riskFilter]);

  const assessTotal = filteredAssessments.length;
  const pagedAssessments = useMemo(() => {
    const start = (assessPage - 1) * PAGE_SIZE;
    return filteredAssessments.slice(start, start + PAGE_SIZE);
  }, [filteredAssessments, assessPage]);

  // ── 处理函数 ──────────────────────────────────────────────────────────────

  const handleCellClick = (probability: number, impact: number) => {
    setSelectedCell({ probability, impact });
    setIsModalOpen(true);
  };

  // ── DataTable 列定义 ──────────────────────────────────────────────────────

  const columns: Column<any>[] = [
    { key: 'assetId', title: '资产ID', width: 100 },
    {
      key: 'probability',
      title: '可能性',
      width: 130,
      render: (v) => {
        const val = v as number;
        return `${val} - ${PROB_LABELS[val - 1] || val}`;
      },
    },
    {
      key: 'impact',
      title: '影响程度',
      width: 130,
      render: (v) => {
        const val = v as number;
        return `${val} - ${IMPACT_LABELS[val - 1] || val}`;
      },
    },
    {
      key: 'riskLevel',
      title: '风险等级',
      width: 110,
      render: (v) => <RiskLevelBadge level={v as string} />,
    },
    { key: 'mitigationMeasures', title: '缓解措施', width: 200 },
    { key: 'reviewDate', title: '评审日期', width: 120 },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      align: 'center',
      render: (_v, row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/risk-assessments/${row.id}/edit`); }}
            className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors"
            title="编辑"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeletingRecord(row); setDeleteOpen(true); }}
            className="p-1.5 rounded-lg text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageTransition>
      <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

          {/* ── 页头 + 统计栏 ────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
            <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--surface-heading)]">
                  风险矩阵
                </h1>
                <p className="mt-1 text-sm text-[var(--surface-muted-text)]">
                  5x5 风险评估热力图与评估记录管理
                </p>
              </div>
              <Button variant="primary" onClick={() => navigate('/risk-assessments/new')}>
                <Plus className="w-4 h-4" />
                新增评估
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500">
                  <Grid3X3 className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">全部评估</p>
                  <p className="text-lg font-bold text-slate-900">{totalCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-500">
                  <ShieldAlert className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">重大风险</p>
                  <p className="text-lg font-bold text-red-600">{criticalCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-400">
                  <AlertTriangle className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">高危风险</p>
                  <p className="text-lg font-bold text-orange-600">{highCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400">
                  <CheckCircle className="h-4.5 w-4.5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">中/低危</p>
                  <p className="text-lg font-bold text-slate-900">{medLowCount}</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── 风险矩阵 (5x5) ──────────────────────────────────────────── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle>风险矩阵（5x5）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="border-collapse mx-auto">
                  <thead>
                    <tr>
                      <th className="p-2 text-sm font-semibold text-slate-500" style={{ width: 80 }}>
                        影响\概率
                      </th>
                      {PROB_LABELS.map((label, i) => (
                        <th key={i} className="p-2 text-sm text-center font-semibold text-slate-600" style={{ width: 100 }}>
                          {label}
                          <br />
                          <span className="text-xs text-slate-400 font-normal">({i + 1})</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[5, 4, 3, 2, 1].map((impact) => (
                      <tr key={impact}>
                        <td className="p-2 text-sm text-center font-semibold text-slate-600">
                          {IMPACT_LABELS[impact - 1]}
                          <br />
                          <span className="text-xs text-slate-400 font-normal">({impact})</span>
                        </td>
                        {[1, 2, 3, 4, 5].map((probability) => {
                          const cell = matrix[`${probability}-${impact}`];
                          if (!cell) return <td key={probability} className="border p-2" />;
                          return (
                            <td
                              key={probability}
                              className="border border-white/30 p-2 text-center cursor-pointer hover:opacity-80 transition-opacity rounded-sm"
                              style={{
                                backgroundColor: getBgColor(probability, impact),
                                color: getTextColor(getBgColor(probability, impact)),
                              }}
                              onClick={() => handleCellClick(probability, impact)}
                            >
                              <div className="font-bold text-lg">{cell.count || 0}</div>
                              <div className="text-xs opacity-75">项评估</div>
                              {cell.count > 0 && (
                                <div className="mt-1 text-xs inline-flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  点击查看
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-center gap-6 mt-5">
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((level) => {
                  const info = RISK_LABELS[level];
                  return (
                    <div key={level} className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: info.bg }} />
                      <span className="text-xs font-medium text-slate-600">{info.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ── 评估记录列表 ────────────────────────────────────────────── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle>风险评估记录</CardTitle>
            </CardHeader>
            <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2 flex-wrap">
              {RISK_FILTER_OPTIONS.map((opt) => {
                const active = riskFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setRiskFilter(opt.value); setAssessPage(1); }}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="p-5">
              <DataTable<any>
                columns={columns}
                data={pagedAssessments}
                rowKey="id"
                loading={listLoading}
                pagination={{
                  page: assessPage,
                  pageSize: PAGE_SIZE,
                  total: assessTotal,
                  onChange: (p) => setAssessPage(p),
                }}
              />
            </div>
          </Card>

          {/* ── 单元格详情弹窗 ──────────────────────────────────────────── */}
          <CellDetailDialog
            open={isModalOpen}
            selectedCell={selectedCell}
            cellAssessments={cellAssessments}
            cellLoading={cellLoading}
            columns={columns}
            onClose={() => setIsModalOpen(false)}
            onAddNew={() => {
              setIsModalOpen(false);
              navigate('/risk-assessments/new');
            }}
          />

          {/* ── 删除确认弹窗 ────────────────────────────────────────────── */}
          <DeleteConfirmDialog
            open={deleteOpen}
            assessment={deletingRecord}
            deleting={deleteMutation.isPending}
            onClose={() => { setDeleteOpen(false); setDeletingRecord(null); }}
            onConfirm={() => {
              if (deletingRecord?.id) deleteMutation.mutate(deletingRecord.id);
            }}
          />
        </div>
      </div>
    </PageTransition>
  );
};

export default RiskMatrixPage;
