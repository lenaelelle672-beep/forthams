/**
 * AssetDetailPage — Unified asset detail page with retirement integration.
 *
 * SWARM-038: Displays asset details with a dynamic "Apply for Retirement" button
 * that respects terminal state constraints. Uses real API via useAssetDetail hook
 * and useAssetRetirementStatus hook for retirement eligibility checks.
 *
 * SWARM-049: Enhanced with edit/delete navigation buttons and useAssetDetail
 * hook integration for real API data fetching.
 *
 * SWARM-057: Added "折旧历史" and "相关工单" tabs for viewing depreciation
 * schedule and associated work order history inline.
 *
 * SWARM-069: Added "生命周期" tab with AssetLifecycleTimeline and
 * AssetRelatedWorkOrders components, powered by the assetDetailApi aggregated
 * data layer. Cross-tenant 403 errors are intercepted at the page level and
 * rendered as a "无权访问该资产" forbidden state instead of raw error codes.
 *
 * ATB-05: Terminal-state assets (SCRAPPED/RETIRED/DISPOSED) have the retirement
 * button physically disabled with both `disabled` and `aria-disabled` attributes.
 *
 * @module pages/assets/AssetDetailPage
 * @since SWARM-015, SWARM-033, SWARM-038, SWARM-049, SWARM-057, SWARM-069
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import {
  ArrowLeft,
  Package,
  RefreshCw,
  FileText,
  AlertTriangle,
  Pencil,
  ShieldAlert,
} from 'lucide-react';
import { useAssetDetail } from '../../hooks/useAssets';
import {
  useAssetRetirementStatus,
  isTerminalAssetStatus,
} from '../../hooks/useRetirement';
import { ASSET_STATUS_CONFIG } from '../../types/asset.types';
import { AssetDepreciationTab } from './tabs/AssetDepreciationTab';
import { AssetWorkOrdersTab } from './tabs/AssetWorkOrdersTab';
import { RetirementHistoryList } from '../../components/retirement/RetirementHistoryList';
import { AssetLifecycleTimeline } from './AssetLifecycleTimeline';
import { AssetRelatedWorkOrders } from './AssetRelatedWorkOrders';
import {
  fetchAssetLifecycle,
  fetchAssetWorkOrders,
  AssetDetailApiError,
  type LifecycleNode,
  type RelatedWorkOrderItem,
} from '../../services/assetDetailApi';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get a display label for an asset status value.
 *
 * @param status - Asset status string from backend
 * @returns Chinese display label
 */
function getAssetStatusLabel(status: string | undefined): string {
  if (!status) return '-';
  const config = ASSET_STATUS_CONFIG[status as keyof typeof ASSET_STATUS_CONFIG];
  return config?.label ?? status;
}

/**
 * Format a date string for display.
 *
 * @param value - ISO date string or undefined
 * @returns Formatted date string
 */
function formatDate(value: string | undefined | null): string {
  if (!value) return '-';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetDetailPage component
 *
 * Renders the full asset detail view including basic info, status badge,
 * and a retirement action button. The button is disabled for terminal-state
 * assets (SCRAPPED, RETIRED, DISPOSED).
 *
 * Uses the useAssetDetail hook for real API data fetching with auto-fetch
 * when assetId is available from URL params.
 *
 * SWARM-069: Additionally loads lifecycle timeline and related work orders
 * from assetDetailApi, intercepting cross-tenant 403 errors at the page level.
 *
 * @returns The asset detail page JSX
 */
export const AssetDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: assetId } = useParams<{ id: string }>();

  // -- Asset detail hook (auto-fetches by assetId) ----------------------------
  const { asset, loading, error, refresh } = useAssetDetail(assetId);

  // -- Retirement status hook -------------------------------------------------
  const { retirementDisabled } = useAssetRetirementStatus(assetId ?? null);

  // -- SWARM-069: Lifecycle & work orders from aggregated API ----------------
  const [lifecycleNodes, setLifecycleNodes] = useState<LifecycleNode[]>([]);
  const [relatedWorkOrders, setRelatedWorkOrders] = useState<RelatedWorkOrderItem[]>([]);
  const [relatedWorkOrdersTotal, setRelatedWorkOrdersTotal] = useState(0);
  const [forbidden, setForbidden] = useState(false);

  /**
   * Load SWARM-069 lifecycle and work order data in parallel.
   * Intercepts 403 cross-tenant errors to show forbidden state.
   */
  const loadAggregatedData = useCallback(async () => {
    if (!assetId) return;

    setForbidden(false);

    try {
      const [lifecycleResult, workOrdersResult] = await Promise.all([
        fetchAssetLifecycle(assetId).catch((err) => {
          if (err instanceof AssetDetailApiError && err.isForbidden) {
            throw err;
          }
          return { assetId, nodes: [] } as { assetId: string; nodes: LifecycleNode[] };
        }),
        fetchAssetWorkOrders(assetId).catch((err) => {
          if (err instanceof AssetDetailApiError && err.isForbidden) {
            throw err;
          }
          return { records: [], total: 0 } as { records: RelatedWorkOrderItem[]; total: number };
        }),
      ]);

      setLifecycleNodes(lifecycleResult.nodes);
      setRelatedWorkOrders(workOrdersResult.records);
      setRelatedWorkOrdersTotal(workOrdersResult.total);
    } catch (err) {
      if (err instanceof AssetDetailApiError && err.isForbidden) {
        setForbidden(true);
      }
      // Non-critical: lifecycle/work orders may fail silently
    }
  }, [assetId]);

  useEffect(() => {
    loadAggregatedData();
  }, [loadAggregatedData]);

  /**
   * Navigate to the retirement application page for this asset.
   */
  const handleApplyRetirement = useCallback(() => {
    if (!assetId || retirementDisabled) return;
    navigate(`/retirement/new?assetId=${assetId}`);
  }, [assetId, retirementDisabled, navigate]);

  // ---- Loading skeleton -----------------------------------------------------
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12" data-testid="asset-detail-loading">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-gray-100 rounded-lg animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-56 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-40 bg-gray-50 rounded animate-pulse" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- SWARM-069: Cross-tenant forbidden state -----------------------------
  if (forbidden) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12" data-testid="asset-detail-forbidden">
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <ShieldAlert className="h-10 w-10 text-red-500 mb-3" />
            <p className="text-muted-foreground mb-4">
              无权访问该资产
            </p>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error state ----------------------------------------------------------
  if (error || !asset) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-12" data-testid="asset-detail-error">
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <AlertTriangle className="h-10 w-10 text-yellow-500 mb-3" />
            <p className="text-muted-foreground mb-4">
              {error ?? '未找到资产信息'}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回
              </Button>
              <Button variant="outline" onClick={refresh}>
                <RefreshCw className="w-4 h-4 mr-1" />
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const terminalState = isTerminalAssetStatus(asset.status);

  // ---- Main render ----------------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12" data-testid="asset-detail-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/assets')}
            data-testid="asset-back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <div className="p-2 bg-blue-50 rounded-lg">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {asset.assetName ?? `资产 #${assetId}`}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              资产编号：{asset.assetCode ?? '-'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/assets/${assetId}/edit`)}
            data-testid="btn-edit-asset" title="编辑资产"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={refresh} data-testid="btn-refresh-asset">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Asset info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-gray-500">资产状态</p>
              <Badge
                variant={terminalState ? 'destructive' : 'secondary'}
                className="text-sm px-3 py-1"
                data-testid="asset-status"
              >
                {getAssetStatusLabel(asset.status)}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">资产名称：</span>
              <span className="font-medium">{asset.assetName ?? '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">资产编号：</span>
              <span className="font-medium font-mono">{asset.assetCode ?? '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">分类：</span>
              <span className="font-medium">{asset.categoryName ?? '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">位置：</span>
              <span className="font-medium">{asset.locationName ?? '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">部门：</span>
              <span className="font-medium">{asset.departmentName ?? '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">购置日期：</span>
              <span className="font-medium">{formatDate(asset.purchaseDate)}</span>
            </div>
            {asset.purchasePrice != null && (
              <div>
                <span className="text-gray-500">采购价格：</span>
                <span className="font-medium">
                  ¥{asset.purchasePrice.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div>
              <span className="text-gray-500">创建时间：</span>
              <span className="font-medium">{formatDate(asset.createdAt as string)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retirement action */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-orange-500" />
              <div>
                <p className="font-medium text-sm">资产退役</p>
                <p className="text-xs text-gray-500">
                  {terminalState
                    ? '该资产已处于终结状态，无法申请退役'
                    : '发起退役申请，提交审批流程'}
                </p>
              </div>
            </div>
            <Button
              onClick={handleApplyRetirement}
              disabled={retirementDisabled}
              aria-disabled={retirementDisabled || undefined}
              data-testid="apply-retirement-btn"
              variant={terminalState ? 'outline' : 'default'}
            >
              {terminalState ? '不可操作' : '申请退役'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SWARM-057: Depreciation History & Related Work Orders Tabs */}
      {/* SWARM-062: Added retirement history tab */}
      {/* SWARM-069: Added lifecycle timeline & aggregated work orders tab */}
      {assetId && (
        <Tabs defaultValue="depreciation" className="w-full">
          <TabsList>
            <TabsTrigger value="depreciation">折旧历史</TabsTrigger>
            <TabsTrigger value="work-orders">相关工单</TabsTrigger>
            <TabsTrigger value="lifecycle">生命周期</TabsTrigger>
            <TabsTrigger value="retirement-history">退役历史</TabsTrigger>
          </TabsList>
          <TabsContent value="depreciation">
            <AssetDepreciationTab
              assetId={assetId}
              isTerminal={terminalState}
            />
          </TabsContent>
          <TabsContent value="work-orders">
            <AssetWorkOrdersTab
              assetId={assetId}
              isTerminal={terminalState}
            />
          </TabsContent>
          <TabsContent value="lifecycle">
            <div className="space-y-6">
              {/* SWARM-069: Lifecycle timeline from aggregated API */}
              <AssetLifecycleTimeline nodes={lifecycleNodes} />
              {/* SWARM-069: Related work orders from aggregated API */}
              <AssetRelatedWorkOrders
                workOrders={relatedWorkOrders}
                total={relatedWorkOrdersTotal}
              />
            </div>
          </TabsContent>
          <TabsContent value="retirement-history">
            <RetirementHistoryList assetId={assetId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default AssetDetailPage;
