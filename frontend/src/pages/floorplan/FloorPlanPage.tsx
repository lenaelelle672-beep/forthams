/**
 * @file pages/floorplan/FloorPlanPage.tsx
 * @description 2D/3D 平面图 — gai2 W23 拆分精简版（目标 < 250 行 / AR-5）。
 *
 * 拆分：
 * - FloorPlanCreateDialog：新建表单（./components/FloorPlanCreateDialog.tsx）
 * - FloorPlanCanvas：SVG 画布 + 资产标记（./components/FloorPlanCanvas.tsx）
 * - 主体：本文件只保留列表 + 选中 + 跨页导航 + 服务层调用
 *
 * 联动：
 * - 顶部 LocationCascader 共享 SpatialTimeContext（与 /gis、/energy 三页联动）
 * - 「前往 GIS 地图」按钮跳转 /gis?locationId=…
 * - 数据走 floorplanService（R14 修复：去除 res.data||res 反模式）
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageTransition, ErrorState, EmptyState, SkeletonCard } from '@/components/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LocationCascader } from '@/components/shared/LocationCascader';
import { useSpatialTime } from '@/components/shared/SpatialTimeContext';
import floorplanService, { type FloorPlan, type PlanAsset } from '@/services/floorplanService';
import { FloorPlanCreateDialog } from './components/FloorPlanCreateDialog';
import { FloorPlanCanvas } from './components/FloorPlanCanvas';
import { ExternalLink, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';

const FloorPlanPage: React.FC = () => {
  const navigate = useNavigate();
  const { query, setSpatialTime } = useSpatialTime();

  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<FloorPlan | null>(null);
  const [planAssets, setPlanAssets] = useState<PlanAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await floorplanService.list({ pageSize: 100 });
      const records = data.records || [];
      setPlans(records);
      if (records.length === 0) {
        setSelectedPlan(null);
        setPlanAssets([]);
      } else if (!selectedPlan) {
        setSelectedPlan(records[0]);
        fetchPlanAssets(records[0].id);
      }
    } catch (err) {
      setPlans([]);
      setSelectedPlan(null);
      setPlanAssets([]);
      setError(err instanceof Error ? err.message : '加载平面图失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanAssets = async (planId: number) => {
    try {
      const list = await floorplanService.getAssets(planId);
      const result = Array.isArray(list) ? list : [];
      setPlanAssets(result);
    } catch {
      setPlanAssets([]);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  // URL ?floorPlanId= 反向跳转：进入页面时若 URL 指定了 planId，自动选中
  useEffect(() => {
    if (query.floorPlanId && plans.length > 0 && !selectedPlan) {
      const target = plans.find((p) => p.id === query.floorPlanId);
      if (target) {
        handleSelectPlan(target);
      }
    }
  }, [plans, query.floorPlanId, selectedPlan]);

  const handleSelectPlan = (plan: FloorPlan) => {
    setSelectedPlan(plan);
    fetchPlanAssets(plan.id);
  };

  const handleNavigateToGis = () => {
    setSpatialTime({ locationId: query.locationId });
    navigate(`/gis${query.locationId ? `?locationId=${query.locationId}` : ''}`);
  };

  if (error) {
    return (
      <PageTransition>
        <ErrorState title="加载失败" description={error} onRetry={fetchPlans} />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-full overflow-x-auto bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full min-w-[980px] max-w-[1480px] flex-col gap-6">

          {/* ── Compact header with stat bar ─────────────────────────────────── */}
          <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">2D/3D 平面图</h1>
                <h3 className="mt-1 text-sm font-medium text-slate-500">资产位置可视化 · 空间联动</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNavigateToGis}
                disabled={plans.length === 0}
                className="inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                前往 GIS 地图
              </Button>
            </div>
          </section>

          {/* ── Spatial controls ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3">
            <LocationCascader />
          </div>

          {/* ── Two-column layout ────────────────────────────────────────────── */}
          <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
            {/* Left: plan list */}
            <Card className="w-full overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-white to-slate-50/70">
                <div className="flex justify-between items-center w-full">
                  <CardTitle className="text-sm">平面图列表</CardTitle>
                  <Button size="sm" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    新建
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {loading && plans.length === 0 ? (
                  <div className="space-y-2 py-4">
                    <SkeletonCard className="h-16" />
                    <SkeletonCard className="h-16" />
                  </div>
                ) : plans.length === 0 ? (
                  <EmptyState title="暂无平面图" description="请新建平面图" className="py-4" />
                ) : (
                  plans.map((p) => (
                    <div
                      key={p.id}
                      className={cn(
                        'p-3 rounded-lg cursor-pointer border transition-colors',
                        selectedPlan?.id === p.id
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                          : 'border-slate-200 hover:bg-slate-50',
                      )}
                      onClick={() => handleSelectPlan(p)}
                    >
                      <div className="font-medium text-sm text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {p.building} {p.floor}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Right: plan canvas */}
            <Card className="min-w-0 overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-white to-slate-50/70">
                <div>
                  <CardTitle>{selectedPlan?.name || '请选择平面图'}</CardTitle>
                  {selectedPlan && (
                    <p className="text-sm text-slate-500 mt-1">点击平面图空白处可标记资产位置</p>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!selectedPlan ? (
                  <h3 className="flex items-center justify-center h-96 text-slate-400 font-medium">
                    请从左侧选择一个平面图
                  </h3>
                ) : (
                  <FloorPlanCanvas plan={selectedPlan} assets={planAssets} onAssetAdded={() => fetchPlanAssets(selectedPlan.id)} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Create dialog (already extracted) ───────────────────────────── */}
          <FloorPlanCreateDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={fetchPlans}
          />

        </div>
      </div>
    </PageTransition>
  );
};

export default FloorPlanPage;
