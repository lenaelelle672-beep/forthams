/**
 * @file pages/gis/components/GisDetailPanel
 * @description GIS 选中资产详情卡 — 独立于 MapContainer 之外的纯展示组件
 *
 * 设计：放 MapContainer 外部，避免 useMap 约束
 * - 可被 GisMapPage / EnergyDashboardPage 复用
 */
import React from 'react';
import { X } from 'lucide-react';
import type { GisAsset } from '@/services/gisService';
import { cn } from '@/utils/cn';

const STATUS_MARKER_COLORS: Record<string, string> = {
  IN_USE: '#22c55e',
  IDLE: '#eab308',
  MAINTENANCE: '#3b82f6',
  SCRAPPED: '#ef4444',
  PENDING: '#f97316',
};

const STATUS_LABEL: Record<string, string> = {
  IN_USE: '在用',
  IDLE: '闲置',
  MAINTENANCE: '维修中',
  SCRAPPED: '已报废',
  PENDING: '待处理',
};

export interface GisDetailPanelProps {
  asset: GisAsset | null;
  onClose?: () => void;
  className?: string;
  /** 是否显示跳转到能耗页按钮 */
  onViewEnergy?: (asset: GisAsset) => void;
}

export const GisDetailPanel: React.FC<GisDetailPanelProps> = ({
  asset,
  onClose,
  className,
  onViewEnergy,
}) => {
  if (!asset) return null;

  const color = STATUS_MARKER_COLORS[asset.status] || '#6b7280';
  const label = STATUS_LABEL[asset.status] || asset.status;

  return (
    <div
      className={cn(
        'absolute top-14 right-3 z-[1000] w-64 sm:w-72 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 overflow-hidden',
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-800 truncate mr-2">{asset.assetName}</h4>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            title="关闭详情"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">资产编号</span>
          <span className="text-sm font-medium text-gray-700 font-mono">{asset.assetNo}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">状态</span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            {label}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">经度</span>
          <span className="text-sm text-gray-600 font-mono">
            {asset.locationLng != null ? Number(asset.locationLng).toFixed(6) : '-'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">纬度</span>
          <span className="text-sm text-gray-600 font-mono">
            {asset.locationLat != null ? Number(asset.locationLat).toFixed(6) : '-'}
          </span>
        </div>
      </div>
      {onViewEnergy && (
        <div className="px-4 py-2.5 border-t border-gray-100">
          <button
            type="button"
            onClick={() => onViewEnergy(asset)}
            className="w-full text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-md py-1.5 transition-colors"
          >
            查看此资产能耗 →
          </button>
        </div>
      )}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
        <span className="text-[10px] text-gray-400">ID: {asset.id}</span>
      </div>
    </div>
  );
};

export default GisDetailPanel;
