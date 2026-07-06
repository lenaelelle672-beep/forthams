/**
 * @file pages/gis/components/GisMarkerLayer
 * @description GIS 资产 MarkerCluster 渲染层 — 必须是 MapContainer 直接子组件
 *
 * R7 硬约束：
 * - react-leaflet 4.2.1 useMap 上下文约束，禁止跨 MapContainer 边界
 * - 此组件必须在 <MapContainer> 内部直接使用 <GisMarkerLayer assets onSelect />
 * - 不要包裹 HOC / Fragment / 任何会改变 React 父层级的元素
 */
import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { GisAsset } from '@/services/gisService';

// ── 状态颜色 / 字母 / 中文标签（与 GisMapPage 顶部常量保持一致） ──────────────
const STATUS_MARKER_COLORS: Record<string, string> = {
  IN_USE: '#22c55e',
  IDLE: '#eab308',
  MAINTENANCE: '#3b82f6',
  SCRAPPED: '#ef4444',
  PENDING: '#f97316',
};
const STATUS_LETTER: Record<string, string> = {
  IN_USE: 'U', IDLE: 'I', MAINTENANCE: 'M', SCRAPPED: 'S', PENDING: 'P',
};
const STATUS_LABEL: Record<string, string> = {
  IN_USE: '在用', IDLE: '闲置', MAINTENANCE: '维修中', SCRAPPED: '已报废', PENDING: '待处理',
};

// ── Leaflet 自定义图标工厂 ──────────────────────────────────────────────────────
function createStatusIcon(status: string): L.DivIcon {
  const color = STATUS_MARKER_COLORS[status] || '#6b7280';
  const letter = STATUS_LETTER[status] || '?';
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25)">${letter}</div>`,
    iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15], tooltipAnchor: [0, -20],
  });
}

function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count < 10 ? 40 : count < 100 ? 50 : 60;
  const fontSize = count < 100 ? 14 : 12;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#3b82f6;display:flex;align-items:center;justify-content:center;color:#fff;font-size:${fontSize}px;font-weight:700;border:3px solid rgba(255,255,255,.8);box-shadow:0 2px 8px rgba(59,130,246,.5)">${count}</div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2],
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

export interface GisMarkerLayerProps {
  assets: GisAsset[];
  onAssetSelect?: (asset: GisAsset) => void;
  /** 资产变化时是否自动 fitBounds 到全部资产（默认 true） */
  fitBounds?: boolean;
}

/**
 * GIS MarkerCluster 渲染层
 *
 * - 必须作为 <MapContainer> 的直接子组件使用
 * - 内部用 L.markerClusterGroup 做聚合 + chunkedLoading
 * - 单个 marker click 触发 onAssetSelect（供上层写入 URL ?selectedAssetId=）
 * - cleanup 移除 layer，避免 React 18 StrictMode 双调用导致重复添加
 */
export const GisMarkerLayer: React.FC<GisMarkerLayerProps> = ({
  assets,
  onAssetSelect,
  fitBounds = true,
}) => {
  const map = useMap();
  const onSelectRef = useRef(onAssetSelect);
  onSelectRef.current = onAssetSelect;

  useEffect(() => {
    if (assets.length === 0) return;
    const mcg = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 16,
      chunkedLoading: true,
      chunkInterval: 100,
      polygonOptions: { color: '#3b82f6', weight: 1, opacity: 0.5, fillOpacity: 0.1 },
      iconCreateFunction: (cluster) => createClusterIcon(cluster),
    });
    const markers = assets.map((asset) => {
      const color = STATUS_MARKER_COLORS[asset.status] || '#6b7280';
      const label = STATUS_LABEL[asset.status] || asset.status;
      const marker = L.marker([Number(asset.locationLat), Number(asset.locationLng)], {
        icon: createStatusIcon(asset.status),
      });
      marker.bindPopup(`
        <div style="min-width:200px">
          <h3 style="font-weight:700;font-size:16px;margin:0 0 4px">${escapeHtml(asset.assetName)}</h3>
          <p style="font-size:13px;color:#666;margin:0 0 2px">编号：${escapeHtml(asset.assetNo)}</p>
          <p style="font-size:13px;margin:4px 0 2px">状态：<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:4px;vertical-align:middle"></span>${label}</p>
          <p style="font-size:12px;color:#999;margin:4px 0 0">坐标：${Number(asset.locationLat).toFixed(4)}, ${Number(asset.locationLng).toFixed(4)}</p>
        </div>`);
      marker.bindTooltip(
        `<div style="text-align:center"><strong>${escapeHtml(asset.assetName)}</strong><br/><span style="font-size:12px;color:#666">${escapeHtml(asset.assetNo)}</span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-left:4px;vertical-align:middle"></span></div>`,
        { direction: 'top', offset: L.point(0, -18), opacity: 0.92 },
      );
      marker.on('click', () => onSelectRef.current?.(asset));
      return marker;
    });
    mcg.addLayers(markers);
    map.addLayer(mcg);
    if (fitBounds) {
      const bounds = L.latLngBounds(
        assets.map((a) => [Number(a.locationLat), Number(a.locationLng)] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
    return () => {
      map.removeLayer(mcg);
    };
  }, [map, assets, fitBounds]);

  return null;
};

export default GisMarkerLayer;
