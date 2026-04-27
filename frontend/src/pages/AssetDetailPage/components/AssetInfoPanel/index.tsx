/**
 * AssetInfoPanel Component
 * 
 * Displays comprehensive asset information including metadata, properties,
 * and audit-related data for the Asset Detail Page.
 * 
 * @packageDocumentation
 * @module AssetInfoPanel
 * @version 1.0.0
 * @iteration SWARM-051
 * 
 * @example
 * ```tsx
 * <AssetInfoPanel assetId="AST-2024-001" />
 * ```
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  DollarSign, 
  User, 
  Hash,
  Activity,
  Clock
} from 'lucide-react';

// Type definitions for asset data
export interface AssetInfo {
  /** Unique asset identifier */
  assetId: string;
  /** Asset name */
  name: string;
  /** Asset category */
  category: string;
  /** Asset status */
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'SCRAPPED' | 'TRANSFERRED';
  /** Physical location of the asset */
  location: string;
  /** Department responsible for the asset */
  department: string;
  /** Purchase date */
  purchaseDate: string;
  /** Original purchase value */
  purchaseValue: number;
  /** Current depreciated value */
  currentValue: number;
  /** Asset serial number */
  serialNumber: string;
  /** Assigned user/person */
  assignedTo: string;
  /** Asset description */
  description?: string;
  /** Last updated timestamp */
  lastUpdated: string;
  /** Graphify knowledge graph node ID */
  graphifyNodeId?: string;
}

export interface AssetInfoPanelProps {
  /** Asset ID to fetch and display information for */
  assetId: string;
  /** Optional asset data if pre-fetched */
  assetData?: AssetInfo;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: Error | null;
  /** Callback when asset data is refreshed */
  onRefresh?: () => void;
  /** Whether to show audit-related information */
  showAuditInfo?: boolean;
  /** Custom CSS class */
  className?: string;
}

// Status badge variant mapping
const STATUS_VARIANTS: Record<AssetInfo['status'], 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  MAINTENANCE: 'warning',
  SCRAPPED: 'destructive',
  TRANSFERRED: 'default',
};

// Status display labels
const STATUS_LABELS: Record<AssetInfo['status'], string> = {
  ACTIVE: '使用中',
  INACTIVE: '闲置',
  MAINTENANCE: '维护中',
  SCRAPPED: '已报废',
  TRANSFERRED: '已转移',
};

/**
 * Format currency value to display format
 * 
 * @param value - Numeric value to format
 * @returns Formatted currency string with ¥ prefix
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Format date to localized display format
 * 
 * @param dateString - ISO date string
 * @returns Formatted date string in Chinese locale
 */
function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Format timestamp for audit display
 * 
 * @param timestamp - ISO timestamp string
 * @returns Formatted datetime string
 */
function formatTimestamp(timestamp: string): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

/**
 * AssetInfoPanel Component
 * 
 * Displays comprehensive information about an asset including:
 * - Basic metadata (ID, name, category, status)
 * - Location and assignment information
 * - Financial data (purchase value, current value)
 * - Audit timestamps (last updated)
 * 
 * @param props - Component props
 * @returns React component
 */
export function AssetInfoPanel({
  assetId,
  assetData,
  isLoading = false,
  error = null,
  showAuditInfo = true,
  className = '',
}: AssetInfoPanelProps) {
  // Memoize the asset info display values
  const displayData = useMemo(() => {
    if (!assetData) return null;
    
    return {
      formattedPurchaseValue: formatCurrency(assetData.purchaseValue),
      formattedCurrentValue: formatCurrency(assetData.currentValue),
      formattedPurchaseDate: formatDate(assetData.purchaseDate),
      formattedLastUpdated: formatTimestamp(assetData.lastUpdated),
      statusLabel: STATUS_LABELS[assetData.status] || assetData.status,
      statusVariant: STATUS_VARIANTS[assetData.status] || 'secondary',
      valueDepreciation: assetData.purchaseValue - assetData.currentValue,
      depreciationPercent: ((assetData.purchaseValue - assetData.currentValue) / assetData.purchaseValue * 100).toFixed(2),
    };
  }, [assetData]);

  // Render loading skeleton state
  if (isLoading) {
    return (
      <Card className={`w-full ${className}`} data-testid="asset-info-panel">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-36" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card className={`w-full ${className}`} data-testid="asset-info-panel">
        <CardHeader>
          <CardTitle className="text-red-600">加载失败</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            无法加载资产信息: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Render empty state when no data
  if (!assetData || !displayData) {
    return (
      <Card className={`w-full ${className}`} data-testid="asset-info-panel">
        <CardHeader>
          <CardTitle>资产信息</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            未找到资产信息 (ID: {assetId})
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`w-full ${className}`} 
      data-testid="asset-info-panel"
      data-asset-id={assetId}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            资产信息
          </CardTitle>
          <Badge variant={displayData.statusVariant}>
            {displayData.statusLabel}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Basic Information Section */}
        <section aria-labelledby="basic-info-heading">
          <h3 id="basic-info-heading" className="text-sm font-medium text-muted-foreground mb-3">
            基本信息
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Asset ID */}
            <div className="flex items-start gap-3">
              <Hash className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">资产编号</p>
                <p className="text-sm font-medium">{assetData.assetId}</p>
              </div>
            </div>

            {/* Asset Name */}
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">资产名称</p>
                <p className="text-sm font-medium">{assetData.name}</p>
              </div>
            </div>

            {/* Category */}
            <div className="flex items-start gap-3">
              <Activity className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">资产类别</p>
                <p className="text-sm font-medium">{assetData.category}</p>
              </div>
            </div>

            {/* Serial Number */}
            <div className="flex items-start gap-3">
              <Hash className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">序列号</p>
                <p className="text-sm font-medium">{assetData.serialNumber}</p>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Location & Assignment Section */}
        <section aria-labelledby="location-info-heading">
          <h3 id="location-info-heading" className="text-sm font-medium text-muted-foreground mb-3">
            位置与分配
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Location */}
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">存放地点</p>
                <p className="text-sm font-medium">{assetData.location}</p>
              </div>
            </div>

            {/* Department */}
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">所属部门</p>
                <p className="text-sm font-medium">{assetData.department}</p>
              </div>
            </div>

            {/* Assigned To */}
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">使用人</p>
                <p className="text-sm font-medium">{assetData.assignedTo}</p>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* Financial Information Section */}
        <section aria-labelledby="financial-info-heading">
          <h3 id="financial-info-heading" className="text-sm font-medium text-muted-foreground mb-3">
            财务信息
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Purchase Value */}
            <div className="flex items-start gap-3">
              <DollarSign className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">购置价值</p>
                <p className="text-sm font-medium">{displayData.formattedPurchaseValue}</p>
              </div>
            </div>

            {/* Current Value */}
            <div className="flex items-start gap-3">
              <DollarSign className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">当前价值</p>
                <p className="text-sm font-medium">{displayData.formattedCurrentValue}</p>
              </div>
            </div>

            {/* Purchase Date */}
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">购置日期</p>
                <p className="text-sm font-medium">{displayData.formattedPurchaseDate}</p>
              </div>
            </div>

            {/* Depreciation */}
            <div className="flex items-start gap-3">
              <Activity className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">累计折旧</p>
                <p className="text-sm font-medium">
                  {formatCurrency(displayData.valueDepreciation)} 
                  <span className="text-xs text-muted-foreground ml-1">
                    ({displayData.depreciationPercent}%)
                  </span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Audit Information Section - Conditionally Rendered */}
        {showAuditInfo && (
          <>
            <Separator />
            <section aria-labelledby="audit-info-heading">
              <h3 id="audit-info-heading" className="text-sm font-medium text-muted-foreground mb-3">
                审计信息
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Last Updated */}
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">最后更新</p>
                    <p className="text-sm font-medium">{displayData.formattedLastUpdated}</p>
                  </div>
                </div>

                {/* Graphify Node ID - If available */}
                {assetData.graphifyNodeId && (
                  <div className="flex items-start gap-3">
                    <Activity className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">知识图谱节点</p>
                      <p className="text-sm font-medium font-mono text-xs">
                        {assetData.graphifyNodeId}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* Description - If available */}
        {assetData.description && (
          <>
            <Separator />
            <section aria-labelledby="description-heading">
              <h3 id="description-heading" className="text-sm font-medium text-muted-foreground mb-3">
                资产描述
              </h3>
              <p className="text-sm text-foreground leading-relaxed">
                {assetData.description}
              </p>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Default export for AssetInfoPanel component
 * 
 * @remarks
 * This component is part of the AssetDetailPage and integrates with
 * the AuditLogPanel to provide comprehensive asset information display
 * with audit trail support.
 */
export default AssetInfoPanel;