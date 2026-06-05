/**
 * @file pages/floorplan/components/FloorPlanCanvas.tsx
 * @description 平面图 SVG 画布 + 资产标记组件（gai2 W23 拆分 — FloorPlanPage 从 334 行精简到 < 250）。
 *
 * 职责：SVG 渲染、点击位置换算、资产标记弹窗。
 * 父组件 FloorPlanPage 负责 selectedPlan 状态 + planAssets 数据 + 提交标记后 refetch。
 */
import React, { useRef } from 'react';
import floorplanService from '@/services/floorplanService';
import { message } from 'antd';
import type { FloorPlan, PlanAsset } from '@/services/floorplanService';

const STATUS_COLORS: Record<string, string> = {
  IN_USE: '#22c55e',
  IDLE: '#eab308',
  MAINTENANCE: '#3b82f6',
  SCRAPPED: '#ef4444',
};

export interface FloorPlanCanvasProps {
  plan: FloorPlan;
  assets: PlanAsset[];
  onAssetAdded: () => void;
}

export const FloorPlanCanvas: React.FC<FloorPlanCanvasProps> = ({ plan, assets, onAssetAdded }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleSvgClick = async (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Number(((e.clientX - rect.left) / rect.width * 100).toFixed(2));
    const y = Number(((e.clientY - rect.top) / rect.height * 100).toFixed(2));

    const assetIdStr = window.prompt('请输入要标记的资产ID');
    if (!assetIdStr) return;
    const assetId = Number(assetIdStr);
    if (!Number.isFinite(assetId) || assetId <= 0) {
      message.warning('资产ID 不合法');
      return;
    }

    try {
      await floorplanService.addAsset(plan.id, {
        assetId,
        posX: x,
        posY: y,
        label: `Asset-${assetId}`,
      });
      onAssetAdded();
      message.success('标记成功');
    } catch {
      message.error('标记失败');
    }
  };

  return (
    <div
      className="relative w-full border border-[#e5e7eb] rounded-lg overflow-hidden bg-[#f9fafb]"
      style={{ height: 500 }}
    >
      <svg ref={svgRef} width="100%" height="100%" onClick={handleSvgClick}>
        {plan.imageUrl && (
          <image href={plan.imageUrl} x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />
        )}
        {assets.map((pa) => (
          <g key={pa.id} transform={`translate(${pa.posX}%, ${pa.posY}%)`}>
            <circle
              r="12"
              fill={STATUS_COLORS[pa.assetStatus || 'IN_USE'] || '#6b7280'}
              stroke="#fff"
              strokeWidth="2"
              className="cursor-pointer hover:r-14 transition-all"
            >
              <title>
                {pa.assetName || pa.label || `#${pa.assetId}`}（{pa.assetStatus || 'IN_USE'}）
              </title>
            </circle>
            <text
              x="16"
              y="4"
              fontSize="11"
              fill="#374151"
              fontWeight="bold"
              style={{ pointerEvents: 'none' }}
            >
              {pa.assetName || pa.label || `#${pa.assetId}`}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default FloorPlanCanvas;
