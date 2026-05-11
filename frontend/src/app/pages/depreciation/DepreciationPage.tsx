/**
 * DepreciationPage — Top-level page orchestration for depreciation module.
 *
 * Manages the current asset ID, delegates rendering to:
 * - DepreciationScheduleTable (Level 3) — paginated schedule display
 * - DepreciationRunTrigger (Level 2) — manual calculation trigger
 * - Inline method selector (Level 2) — dynamic method switching
 *
 * All state flows from this page down to child components.
 *
 * @module pages/depreciation/DepreciationPage
 * @since SWARM-042
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  TrendingDown,
  Search,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { updateMethod } from '../../services/depreciationService';
import type { DepreciationMethodKey } from '../../services/depreciationService';
import { DepreciationScheduleTable } from '../../components/depreciation/DepreciationScheduleTable';
import { DepreciationRunTrigger } from '../../components/depreciation/DepreciationRunTrigger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Available depreciation method options for the selector.
 */
const METHOD_OPTIONS: { value: DepreciationMethodKey; label: string }[] = [
  { value: 'straight_line', label: '直线法' },
  { value: 'double_declining', label: '双倍余额递减法' },
];

/**
 * Method label lookup for display.
 */
const METHOD_LABELS: Record<string, string> = {
  straight_line: '直线法',
  double_declining: '双倍余额递减法',
  double_declining_balance: '双倍余额递减法',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DepreciationPage component
 *
 * Acts as the top-level container for the depreciation module. Manages:
 * - Current asset ID (user input)
 * - Current depreciation method (selectable)
 * - Refresh triggers from child components
 *
 * @returns The depreciation page JSX
 */
export const DepreciationPage: React.FC = () => {
  // -- Asset ID state -------------------------------------------------------
  const [assetIdInput, setAssetIdInput] = useState('');
  const [activeAssetId, setActiveAssetId] = useState<string>('');

  // -- Method selector state ------------------------------------------------
  const [currentMethod, setCurrentMethod] = useState<DepreciationMethodKey>('straight_line');
  const [methodLoading, setMethodLoading] = useState(false);

  // -- Refresh key (incremented to force table re-fetch) --------------------
  const [refreshKey, setRefreshKey] = useState(0);

  /**
   * Activate an asset ID — triggers the schedule table to load data.
   */
  const handleActivateAsset = useCallback(() => {
    const trimmed = assetIdInput.trim();
    if (!trimmed) {
      toast.error('请输入资产 ID');
      return;
    }
    setActiveAssetId(trimmed);
    setRefreshKey((k) => k + 1);
  }, [assetIdInput]);

  /**
   * Handle depreciation method change.
   *
   * Calls PUT /api/assets/{id}/depreciation-method and updates local state.
   *
   * @param newMethod - The selected method key
   */
  const handleMethodChange = useCallback(
    async (newMethod: DepreciationMethodKey) => {
      if (!activeAssetId) {
        toast.error('请先选择资产');
        return;
      }

      setMethodLoading(true);

      try {
        await updateMethod(activeAssetId, { method: newMethod });
        setCurrentMethod(newMethod);
        toast.success(`折旧方法已切换为${METHOD_LABELS[newMethod] || newMethod}`);
        // Trigger schedule refresh after method change
        setRefreshKey((k) => k + 1);
      } catch (err) {
        const message = err instanceof Error ? err.message : '更新折旧方法失败';
        toast.error(message);
      } finally {
        setMethodLoading(false);
      }
    },
    [activeAssetId],
  );

  /**
   * Callback after a successful run trigger — refresh the table.
   */
  const handleRunSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  /**
   * Callback when table page changes.
   *
   * @param _page - The new page number
   */
  const handlePageChange = useCallback((_page: number) => {
    // Page state is managed internally by DepreciationScheduleTable
    // This callback is available for future orchestration needs
  }, []);

  // ---- Render -------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12" data-testid="depreciation-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-50 rounded-lg">
            <TrendingDown className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">折旧计算</h2>
            <p className="text-sm text-gray-500 mt-1">
              查看折旧明细表、切换折旧方法、手动触发折旧计算
            </p>
          </div>
        </div>
      </div>

      {/* Asset ID input + controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">选择资产</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                placeholder="输入资产 ID..."
                value={assetIdInput}
                onChange={(e) => setAssetIdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleActivateAsset();
                }}
                className="max-w-xs"
                data-testid="asset-id-input"
              />
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleActivateAsset}
              data-testid="asset-id-submit"
            >
              <Search className="w-4 h-4 mr-1" />
              查询
            </Button>
            {activeAssetId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefreshKey((k) => k + 1)}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                刷新
              </Button>
            )}
          </div>

          {activeAssetId && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <span>当前资产：</span>
              <Badge variant="outline">{activeAssetId}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Method selector + Run trigger (only shown when asset is active) */}
      {activeAssetId && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Method selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">折旧方法：</span>
                <Select
                  value={currentMethod}
                  onValueChange={(value) =>
                    handleMethodChange(value as DepreciationMethodKey)
                  }
                  disabled={methodLoading}
                >
                  <SelectTrigger
                    className="w-[180px]"
                    data-testid="depreciation-method-selector"
                  >
                    <SelectValue placeholder="选择折旧方法" />
                  </SelectTrigger>
                  <SelectContent>
                    {METHOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {methodLoading && (
                  <span className="text-sm text-gray-400">切换中...</span>
                )}
              </div>

              {/* Divider */}
              <div className="h-6 w-px bg-gray-200" />

              {/* Run trigger */}
              <DepreciationRunTrigger
                assetIds={[activeAssetId]}
                onSuccess={handleRunSuccess}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Depreciation schedule table */}
      {activeAssetId && (
        <DepreciationScheduleTable
          key={refreshKey}
          assetId={activeAssetId}
          pageSize={10}
          onPageChange={handlePageChange}
        />
      )}

      {/* Empty state when no asset is selected */}
      {!activeAssetId && (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <TrendingDown className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg font-medium">请输入资产 ID 开始查询</p>
            <p className="text-gray-400 text-sm mt-1">
              输入资产编号后点击查询，查看折旧明细、切换方法或触发计算
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DepreciationPage;
