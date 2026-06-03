/**
 * @file pages/maintenance/execution/MaintenanceExecutionPage.tsx
 * @description 维保执行跟踪主页面
 *
 * 功能：
 * - 施工执行生命周期管理（开始/暂停/恢复/完成）
 * - 施工时间轴展示
 * - 施工步骤管理（添加/编辑/删除）
 * - 物料管理（添加/删除）
 * - 现场照片上传
 *
 * Pattern: useQuery + useMutation + invalidateQueries + Tabs 布局
 * Route: /maintenance/execution/:id
 */

import React, { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlayCircle, PauseCircle, RotateCcw, CheckCircle2, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { executionApi } from '@/api/maintenanceExecution';
import { ExecutionTimeline } from './components/ExecutionTimeline';
import { ExecutionStepForm } from './components/ExecutionStepForm';
import { MaterialForm } from './components/MaterialForm';
import { PhotoUpload } from './components/PhotoUpload';
import type {
  MaintenanceExecution,
  MaintenanceExecutionStep,
  MaintenanceExecutionMaterial,
} from '@/types/maintenanceExecution';

// ─── 状态常量 ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  IDLE: '待开始',
  RUNNING: '执行中',
  PAUSED: '已暂停',
  COMPLETED: '已完成',
};

const STATUS_VARIANTS: Record<string, 'info' | 'success' | 'warning' | 'gray'> = {
  IDLE: 'info',
  RUNNING: 'success',
  PAUSED: 'warning',
  COMPLETED: 'gray',
};

// ─── 主组件 ────────────────────────────────────────────────────────────────────

export function MaintenanceExecutionPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const executionId = Number(id);

  // 当前活跃 Tab
  const [activeTab, setActiveTab] = useState('timeline');

  // ── 数据加载 ────────────────────────────────────────────────────────────────

  const {
    data: execution,
    isLoading: execLoading,
    error: execError,
  } = useQuery<MaintenanceExecution>({
    queryKey: ['maintenanceExecution', executionId],
    queryFn: () => executionApi.getById(executionId),
    enabled: !!executionId,
  });

  const { data: steps = [] } = useQuery<MaintenanceExecutionStep[]>({
    queryKey: ['maintenanceExecutionSteps', executionId],
    queryFn: () => executionApi.getSteps(executionId),
    enabled: !!executionId,
  });

  const { data: materials = [] } = useQuery<MaintenanceExecutionMaterial[]>({
    queryKey: ['maintenanceExecutionMaterials', executionId],
    queryFn: () => executionApi.getMaterials(executionId),
    enabled: !!executionId,
  });

  // ── 生命周期操作 ────────────────────────────────────────────────────────────

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['maintenanceExecution', executionId] });
    queryClient.invalidateQueries({ queryKey: ['maintenanceExecutionSteps', executionId] });
    queryClient.invalidateQueries({ queryKey: ['maintenanceExecutionMaterials', executionId] });
  };

  const startMutation = useMutation({
    mutationFn: () => executionApi.start({
      maintenanceRecordId: execution!.maintenanceRecordId,
      workOrderId: execution!.workOrderId,
      assigneeId: execution!.assigneeId,
      assigneeName: execution!.assigneeName,
    }),
    onSuccess: () => {
      toast.success('施工已开始');
      invalidateAll();
    },
    onError: () => toast.error('开始施工失败'),
  });

  const pauseMutation = useMutation({
    mutationFn: () => executionApi.pause(executionId),
    onSuccess: () => {
      toast.success('施工已暂停');
      invalidateAll();
    },
    onError: () => toast.error('暂停施工失败'),
  });

  const resumeMutation = useMutation({
    mutationFn: () => executionApi.resume(executionId),
    onSuccess: () => {
      toast.success('施工已恢复');
      invalidateAll();
    },
    onError: () => toast.error('恢复施工失败'),
  });

  const completeMutation = useMutation({
    mutationFn: () => executionApi.complete(executionId),
    onSuccess: () => {
      toast.success('施工已完成');
      invalidateAll();
    },
    onError: () => toast.error('完成施工失败'),
  });

  // ── 步骤操作 ────────────────────────────────────────────────────────────────

  const addStepMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      executionApi.createStep(executionId, data as any),
    onSuccess: () => {
      toast.success('步骤已添加');
      queryClient.invalidateQueries({ queryKey: ['maintenanceExecutionSteps', executionId] });
    },
    onError: () => toast.error('添加步骤失败'),
  });

  const deleteStepMutation = useMutation({
    mutationFn: (stepId: number) => executionApi.deleteStep(executionId, stepId),
    onSuccess: () => {
      toast.success('步骤已删除');
      queryClient.invalidateQueries({ queryKey: ['maintenanceExecutionSteps', executionId] });
    },
    onError: () => toast.error('删除步骤失败'),
  });

  // ── 物料操作 ────────────────────────────────────────────────────────────────

  const addMaterialMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      executionApi.addMaterial(executionId, data as any),
    onSuccess: () => {
      toast.success('物料已添加');
      queryClient.invalidateQueries({ queryKey: ['maintenanceExecutionMaterials', executionId] });
    },
    onError: () => toast.error('添加物料失败'),
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (materialId: number) => executionApi.deleteMaterial(executionId, materialId),
    onSuccess: () => {
      toast.success('物料已删除');
      queryClient.invalidateQueries({ queryKey: ['maintenanceExecutionMaterials', executionId] });
    },
    onError: () => toast.error('删除物料失败'),
  });

  // ── 状态判断 ────────────────────────────────────────────────────────────────

  const status = execution?.status || 'IDLE';
  const isRunning = status === 'RUNNING';
  const isPaused = status === 'PAUSED';
  const isIdle = status === 'IDLE';
  const isCompleted = status === 'COMPLETED';

  // ── 加载/错误状态 ──────────────────────────────────────────────────────────

  if (execLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载执行记录...</span>
      </div>
    );
  }

  if (execError || !execution) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        执行记录不存在或加载失败
      </div>
    );
  }

  // ── 渲染 ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <PageHeader
        title={`施工执行 #${executionId}`}
        subtitle={`关联维保记录: ${execution.maintenanceRecordId} | 关联工单: ${execution.workOrderId}`}
        breadcrumbs={[
          { label: '维保管理', href: '/maintenance' },
          { label: '施工执行' },
        ]}
        actions={
          <>
            {isIdle && (
              <Button
                variant="primary"
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
              >
                <PlayCircle className="mr-1 h-4 w-4" />
                开始施工
              </Button>
            )}
            {isRunning && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => pauseMutation.mutate()}
                  disabled={pauseMutation.isPending}
                >
                  <PauseCircle className="mr-1 h-4 w-4" />
                  暂停
                </Button>
                <Button
                  variant="primary"
                  onClick={() => completeMutation.mutate()}
                  disabled={completeMutation.isPending}
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  完成施工
                </Button>
              </>
            )}
            {isPaused && (
              <Button
                variant="primary"
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
              >
                <RotateCcw className="mr-1 h-4 w-4" />
                恢复施工
              </Button>
            )}
          </>
        }
      />

      {/* 执行摘要 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">执行状态</div>
            <Badge variant={STATUS_VARIANTS[status] || 'gray'} className="mt-1">
              {STATUS_LABELS[status] || status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">执行人</div>
            <div className="mt-1 text-sm font-medium">
              {execution.assigneeName || '未指定'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">总工时</div>
            <div className="mt-1 text-sm font-medium">
              {execution.totalLaborHours != null ? `${execution.totalLaborHours}h` : '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">物料费用</div>
            <div className="mt-1 text-sm font-medium">
              {execution.totalMaterialCost != null ? `¥${execution.totalMaterialCost}` : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab 区域 */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader>
            <TabsList>
              <TabsTrigger value="timeline">施工时间轴</TabsTrigger>
              <TabsTrigger value="steps">步骤管理</TabsTrigger>
              <TabsTrigger value="materials">物料管理</TabsTrigger>
              <TabsTrigger value="photos">现场照片</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            {/* 时间轴 */}
            <TabsContent value="timeline">
              <ExecutionTimeline steps={steps} status={status} />
            </TabsContent>

            {/* 步骤管理 */}
            <TabsContent value="steps">
              <div className="space-y-6">
                {/* 步骤表单 */}
                <Card>
                  <CardHeader>
                    <CardTitle>添加施工步骤</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ExecutionStepForm
                      onSave={(data) => {
                        addStepMutation.mutate({
                          stepName: data.stepName,
                          stepOrder: data.stepOrder ? parseInt(data.stepOrder, 10) : undefined,
                          description: data.description || undefined,
                          operatorName: data.operatorName || undefined,
                          laborHours: data.laborHours ? parseFloat(data.laborHours) : undefined,
                        });
                      }}
                    />
                  </CardContent>
                </Card>

                {/* 步骤列表 */}
                {steps.length > 0 ? (
                  <div className="space-y-2">
                    {steps.map((step) => (
                      <div
                        key={step.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {step.stepOrder ? `${step.stepOrder}. ` : ''}{step.stepName}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {step.operatorName && `操作人: ${step.operatorName}`}
                            {step.laborHours != null && ` | 工时: ${step.laborHours}h`}
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => deleteStepMutation.mutate(step.id)}
                          disabled={deleteStepMutation.isPending}
                        >
                          删除
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    暂无施工步骤，请在上方添加
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 物料管理 */}
            <TabsContent value="materials">
              <div className="space-y-6">
                {/* 物料表单 */}
                <Card>
                  <CardHeader>
                    <CardTitle>添加物料/备件</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MaterialForm
                      onSave={(data) => {
                        addMaterialMutation.mutate(data as any);
                      }}
                    />
                  </CardContent>
                </Card>

                {/* 物料列表 */}
                {materials.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 font-medium">物料名称</th>
                          <th className="pb-2 font-medium">规格</th>
                          <th className="pb-2 font-medium">数量</th>
                          <th className="pb-2 font-medium">单价</th>
                          <th className="pb-2 font-medium">合计</th>
                          <th className="pb-2 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materials.map((mat) => (
                          <tr key={mat.id} className="border-b">
                            <td className="py-2">{mat.materialName}</td>
                            <td className="py-2">{mat.specification || '-'}</td>
                            <td className="py-2">{mat.quantity}</td>
                            <td className="py-2">{mat.unitPrice ? `¥${mat.unitPrice}` : '-'}</td>
                            <td className="py-2">{mat.totalPrice ? `¥${mat.totalPrice}` : '-'}</td>
                            <td className="py-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => deleteMaterialMutation.mutate(mat.id)}
                                disabled={deleteMaterialMutation.isPending}
                              >
                                删除
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    暂无物料记录，请在上方添加
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 现场照片 */}
            <TabsContent value="photos">
              <Card>
                <CardHeader>
                  <CardTitle>现场照片</CardTitle>
                </CardHeader>
                <CardContent>
                  <PhotoUpload executionId={executionId} />
                </CardContent>
              </Card>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
