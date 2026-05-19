/**
 * AssetRetirementPage — Form page for submitting an asset retirement application.
 *
 * SWARM-038: Users can fill in the retirement reason and submit the application.
 * Upon success, the page redirects to the retirement detail page showing the
 * generated processNo. Cross-tenant errors are intercepted and displayed as
 * error toasts.
 *
 * SWARM-062: Refactored to use RetirementRequestForm and RetirementHistoryList
 * components for improved reusability and maintainability.
 *
 * @module pages/assets/AssetRetirementPage
 * @since SWARM-038, SWARM-062
 */

import React, { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Card,
  CardContent,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  ArrowLeft,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import {
  useSubmitRetirement,
  isTerminalAssetStatus,
} from '../../hooks/useRetirement';
import { assetService, type AssetRecord } from '../../services/assetService';
import { RetirementRequestForm } from '../../components/retirement/RetirementRequestForm';
import { RetirementHistoryList } from '../../components/retirement/RetirementHistoryList';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AssetRetirementPage component
 *
 * Provides a form for submitting asset retirement applications.
 * The asset ID is read from the URL search params (e.g., ?assetId=123).
 * On successful submission, navigates to the retirement detail page.
 *
 * @returns The retirement application form page JSX
 */
export const AssetRetirementPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assetId = searchParams.get('assetId') ?? '';

  // -- Asset state --------------------------------------------------------------
  const [assetInfo, setAssetInfo] = useState<AssetRecord | null>(null);
  const [assetLoading, setAssetLoading] = useState(true);
  const [assetError, setAssetError] = useState<string | null>(null);

  // -- Submission hook ---------------------------------------------------------
  const { submitting, error: submitError, submitRetirement } = useSubmitRetirement();

  /**
   * Load asset information on mount.
   */
  React.useEffect(() => {
    if (!assetId) {
      setAssetLoading(false);
      setAssetError('缺少资产ID参数');
      return;
    }

    const loadAsset = async () => {
      setAssetLoading(true);
      try {
        const record = await assetService.getById(assetId);
        setAssetInfo(record);

        // Check terminal status
        if (isTerminalAssetStatus(record?.status)) {
          setAssetError('该资产已处于终结状态，无法申请退役');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '获取资产信息失败';
        setAssetError(message);
      } finally {
        setAssetLoading(false);
      }
    };

    loadAsset();
  }, [assetId]);

  /**
   * Handle form submission from RetirementRequestForm.
   *
   * Delegates to the submitRetirement hook and navigates to the
   * retirement detail page on success.
   *
   * @param values - Form values from RetirementRequestForm
   */
  const handleFormSubmit = useCallback(
    async (values: { reason: string; description: string; expectedDate: string }) => {
      const result = await submitRetirement({
        assetId,
        reason: values.reason,
        expectedDate: values.expectedDate || undefined,
      });

      if (result) {
        // Navigate to the retirement detail page
        navigate(`/retirement/${result.id}`);
      }
    },
    [assetId, submitRetirement, navigate]
  );

  /**
   * Handle form cancellation.
   */
  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // ---- Loading state --------------------------------------------------------
  if (assetLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-12" data-testid="retirement-page-loading">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-gray-100 rounded-lg animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-56 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-40 bg-gray-50 rounded animate-pulse" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 w-full bg-gray-100 rounded animate-pulse" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error state (no asset / terminal asset) ------------------------------
  if (assetError && !assetInfo) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-12" data-testid="retirement-page-error">
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <AlertTriangle className="h-10 w-10 text-yellow-500 mb-3" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">申请退役</h2>
            <p className="text-muted-foreground">{assetError}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate(-1)}
            >
              返回
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Main form render -----------------------------------------------------
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12" data-testid="retirement-page">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            data-testid="retirement-back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <div className="p-2 bg-orange-50 rounded-lg">
            <FileText className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">申请退役</h2>
            <p className="text-sm text-gray-500 mt-1">
              填写退役原因并提交审批申请
            </p>
          </div>
        </div>
      </div>

      {/* Asset info card */}
      {assetInfo && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">资产信息</p>
                <p className="text-lg font-medium">
                  {assetInfo.assetName ?? assetInfo.assetCode ?? `资产 #${assetId}`}
                </p>
                <p className="text-sm text-gray-500">
                  编号：{assetInfo.assetCode ?? '-'}
                </p>
              </div>
              <Badge
                variant={isTerminalAssetStatus(assetInfo.status) ? 'destructive' : 'secondary'}
                data-testid="asset-status"
              >
                {assetInfo.status ?? '-'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Terminal state warning */}
      {assetError && assetInfo && (
        <div
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm"
          data-testid="terminal-warning"
        >
          <AlertTriangle className="w-4 h-4 inline-block mr-2" />
          {assetError}
        </div>
      )}

      {/* SWARM-062: Extracted form component */}
      <RetirementRequestForm
        submitting={submitting}
        submitError={submitError}
        assetError={assetError}
        onSubmit={handleFormSubmit}
        onCancel={handleCancel}
      />

      {/* SWARM-062: Retirement history for this asset */}
      {assetId && (
        <RetirementHistoryList assetId={assetId} />
      )}
    </div>
  );
};

export default AssetRetirementPage;
