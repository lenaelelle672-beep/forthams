/**
 * AssetDetailPage — Unified asset detail page with retirement integration.
 *
 * SWARM-038: Displays asset details with a dynamic "Apply for Retirement" button
 * that respects terminal state constraints. Uses real API via useAssetById hook
 * and useAssetRetirementStatus hook for retirement eligibility checks.
 *
 * ATB-05: Terminal-state assets (SCRAPPED/RETIRED/DISPOSED) have the retirement
 * button physically disabled with both `disabled` and `aria-disabled` attributes.
 *
 * @module pages/assets/AssetDetailPage
 * @since SWARM-015, SWARM-033, SWARM-038
 */

import React, { useState, useCallback, useEffect } from 'react';
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
import {
  ArrowLeft,
  Package,
  RefreshCw,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { assetService, type AssetRecord } from '../../services/assetService';
import {
  useAssetRetirementStatus,
  isTerminalAssetStatus,
} from '../../hooks/useRetirement';
import { ASSET_STATUS_CONFIG } from '../../types/asset.types';

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
 * @returns The asset detail page JSX
 */
export const AssetDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: assetId } = useParams<{ id: string }>();

  // -- Asset data state -------------------------------------------------------
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // -- Retirement status hook -------------------------------------------------
  const {
    isTerminal,
    retirementDisabled,
  } = useAssetRetirementStatus(assetId ?? null);

  /**
   * Fetch asset data from the real API.
   */
  const fetchAsset = useCallback(async () => {
    if (!assetId) {
      setLoading(false);
      setError('缺少资产ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const record = await assetService.getById(assetId);
      setAsset(record);
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取资产详情失败';
      setError(message);
      setAsset(null);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchAsset();
  }, [fetchAsset]);

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
              <Button variant="outline" onClick={fetchAsset}>
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
          <Button variant="ghost" size="sm" onClick={fetchAsset}>
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
    </div>
  );
};

export default AssetDetailPage;
