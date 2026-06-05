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

/* ── Mock 兜底数据（后端未就绪时展示） ───────────────────────────────────── */
const MOCK_PLANS: FloorPlan[] = [
  { id: 1, name: 'A栋1层平面图', building: 'A栋', floor: '1F', imageUrl: '', imageWidth: 800, imageHeight: 600, description: '北京总部A栋1层大厅及办公区' },
  { id: 2, name: 'A栋2层平面图', building: 'A栋', floor: '2F', imageUrl: '', imageWidth: 800, imageHeight: 600, description: '北京总部A栋2层研发区' },
  { id: 3, name: 'B栋1层平面图', building: 'B栋', floor: '1F', imageUrl: '', imageWidth: 800, imageHeight: 600, description: '北京总部B栋1层会议及接待区' },
];

const MOCK_PLAN_ASSETS: Record<number, PlanAsset[]> = {
  1: [
    { id: 1, planId: 1, assetId: 1, posX: 120, posY: 180, label: '前台电脑', assetNo: 'AST-2024-001', assetName: '前台电脑', assetStatus: 'IN_USE' },
    { id: 2, planId: 1, assetId: 6, posX: 350, posY: 100, label: '监控摄像头', assetNo: 'AST-2024-006', assetName: '监控摄像头-F10', assetStatus: 'SCRAPPED' },
    { id: 3, planId: 1, assetId: 12, posX: 600, posY: 250, label: '消防报警器', assetNo: 'AST-2024-012', assetName: '消防报警器-L08', assetStatus: 'IN_USE' },
    { id: 4, planId: 1, assetId: 15, posX: 450, posY: 400, label: '温湿度传感器', assetNo: 'AST-2024-015', assetName: '温湿度传感器-O20', assetStatus: 'IN_USE' },
  ],
  2: [
    { id: 5, planId: 2, assetId: 2, posX: 200, posY: 150, label: '交换机', assetNo: 'AST-2024-002', assetName: '交换机-B03', assetStatus: 'IN_USE' },
    { id: 6, planId: 2, assetId: 10, posX: 500, posY: 300, label: '路由器', assetNo: 'AST-2024-010', assetName: '路由器-J03', assetStatus: 'IDLE' },
    { id: 7, planId: 2, assetId: 9, posX: 300, posY: 350, label: '笔记本电脑', assetNo: 'AST-2024-009', assetName: '笔记本电脑-I15', assetStatus: 'IN_USE' },
  ],
  3: [
    { id: 8, planId: 3, assetId: 3, posX: 150, posY: 200, label: 'UPS电源', assetNo: 'AST-2024-003', assetName: 'UPS电源-C01', assetStatus: 'IDLE' },
    { id: 9, planId: 3, assetId: 8, posX: 400, posY: 180, label: '投影仪', assetNo: 'AST-2024-008', assetName: '投影仪-H02', assetStatus: 'PENDING' },
    { id: 10, planId: 3, assetId: 14, posX: 650, posY: 320, label: '门禁系统', assetNo: 'AST-2024-014', assetName: '门禁系统-N06', assetStatus: 'PENDING' },
    { id: 11, planId: 3, assetId: 11, posX: 250, posY: 450, label: '发电机组', assetNo: 'AST-2024-011', assetName: '发电机组-K01', assetStatus: 'MAINTENANCE' },
  ],
};

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
      // Mock 兜底：API 返回空时使用 mock 数据
      setPlans(records.length > 0 ? records : MOCK_PLANS);
    } catch {
      // 请求失败时也使用 mock 数据
      setPlans(MOCK_PLANS);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanAssets = async (planId: number) => {
    try {
      const list = await floorplanService.getAssets(planId);
      const result = Array.isArray(list) ? list : [];
      // Mock 兜底：API 返回空时使用 mock 数据
      setPlanAssets(result.length > 0 ? result : (MOCK_PLAN_ASSETS[planId] || []));
    } catch {
      // 请求失败时也使用 mock 数据
      setPlanAssets(MOCK_PLAN_ASSETS[planId] || []);
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
      <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

          {/* ── Compact header with stat bar ─────────────────────────────────── */}
          <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">2D/3D 平面图</h1>
                <p className="mt-1 text-sm text-slate-500">资产位置可视化 · 空间联动</p>
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
          <div className="flex gap-4">
            {/* Left: plan list */}
            <Card className="w-72 shrink-0 overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
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
            <Card className="flex-1 overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
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
                  <div className="flex items-center justify-center h-96 text-slate-400">
                    请从左侧选择一个平面图
                  </div>
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
