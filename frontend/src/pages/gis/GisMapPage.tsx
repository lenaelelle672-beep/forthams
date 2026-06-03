/**
 * @file pages/gis/GisMapPage.tsx
 * @description GIS 资产地图 — 拆分后主体版本
 *
 * 拆分（debate 决议#4）：
 * - useGisAssets：数据拉取
 * - useMapFilters：URL 同步的状态/分类/部门筛选
 * - useSpatialSelection：marker 选中态
 * - GisDetailPanel：详情卡（独立于 MapContainer 之外）
 *
 * 跨页联动：
 * - useSpatialTime() 提供 locationId，与 Energy / FloorPlan 共享 URL Query
 * - 选中资产写入 ?selectedAssetId=，并可在 Energy 页"查看资产能耗"按钮触达
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { MapContainer, TileLayer, useMap, ZoomControl, ScaleControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Card } from '@/components/ui/Card';
import { BouncePress, ScaleOnHover } from '@/components/ui/MicroInteraction';
import { PageTransition } from '@/components/ui/PageTransition';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState, SkeletonCard } from '@/components/ui';
import { Select, SelectItem } from '@/components/ui/Select';
import { TimeRangeSelector } from '@/components/shared/TimeRangeSelector';
import { LocationCascader } from '@/components/shared/LocationCascader';
import { useSpatialTime } from '@/components/shared/SpatialTimeContext';
import { useGisAssets } from './hooks/useGisAssets';
import { useMapFilters } from './hooks/useMapFilters';
import { useSpatialSelection } from './hooks/useSpatialSelection';
import { GisDetailPanel } from './components/GisDetailPanel';
import { GisMarkerLayer } from './components/GisMarkerLayer';
import type { GisAsset } from '@/services/gisService';
import { MapPin, CheckCircle2, AlertTriangle, Maximize2, RotateCcw, Crosshair, X, Search } from 'lucide-react';

// ── 常量 ──────────────────────────────────────────────────────────────────────
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
const DEFAULT_CENTER: L.LatLngExpression = [39.9042, 116.4074];
const DEFAULT_ZOOM = 12;

function MapInfoDisplay() {
  const map = useMap();
  const [center, setCenter] = useState(map.getCenter());
  const [zoom, setZoom] = useState(map.getZoom());
  useEffect(() => {
    const update = () => { setCenter(map.getCenter()); setZoom(map.getZoom()); };
    map.on('moveend zoomend', update);
    return () => { map.off('moveend zoomend', update); };
  }, [map]);
  return (
    <div className="absolute bottom-20 right-4 z-[1000] bg-white/90 backdrop-blur rounded-lg px-3 py-2 text-xs text-gray-600 shadow-md border border-gray-200 select-none pointer-events-none">
      中心：{center.lat.toFixed(4)}, {center.lng.toFixed(4)} | 缩放：{zoom}
    </div>
  );
}

function MapSearchOverlay({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="absolute top-3 left-3 z-[1000]">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text" value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="搜索资产名称/编号"
          className="w-44 sm:w-56 h-9 pl-8 pr-8 rounded-lg bg-white/90 backdrop-blur shadow-md border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-300 transition-all"
        />
        {value && (
          <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" title="清除搜索">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function MapToolbarOverlay({ allAssets }: { allAssets: GisAsset[] }) {
  const map = useMap();
  const handleFitAll = () => {
    if (allAssets.length === 0) return;
    const bounds = L.latLngBounds(allAssets.map((a) => [Number(a.locationLat), Number(a.locationLng)] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  };
  const handleReset = () => map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  const handleLocate = () => map.locate({ setView: true, maxZoom: 15 });
  return (
    <div className="absolute top-[52px] left-3 z-[1000] flex flex-col gap-1.5 sm:gap-2">
      <BouncePress scale={0.92}><button title="适配所有资产" onClick={handleFitAll} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur shadow-md border border-gray-200 text-gray-600 hover:text-blue-600 hover:bg-white hover:shadow-lg transition-all"><Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" /></button></BouncePress>
      <BouncePress scale={0.92}><button title="重置视图" onClick={handleReset} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur shadow-md border border-gray-200 text-gray-600 hover:text-blue-600 hover:bg-white hover:shadow-lg transition-all"><RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" /></button></BouncePress>
      <BouncePress scale={0.92}><button title="定位当前位置" onClick={handleLocate} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur shadow-md border border-gray-200 text-gray-600 hover:text-blue-600 hover:bg-white hover:shadow-lg transition-all"><Crosshair className="w-4 h-4 sm:w-5 sm:h-5" /></button></BouncePress>
    </div>
  );
}

function MapLayerFilterOverlay({ visibleStatuses, onToggle }: { visibleStatuses: Set<string>; onToggle: (status: string) => void }) {
  return (
    <div className="absolute top-3 right-3 z-[1000] flex flex-wrap gap-1.5 justify-end max-w-[260px] sm:max-w-none">
      {Object.entries(STATUS_LABEL).map(([status, label]) => {
        const active = visibleStatuses.has(status);
        const color = STATUS_MARKER_COLORS[status];
        return (
          <BouncePress key={status} scale={0.95}>
            <ScaleOnHover scale={1.05}>
              <button title={`${label}图层${active ? '（可见）' : '（已隐藏）'}`} onClick={() => onToggle(status)} className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all border ${active ? 'bg-white/90 backdrop-blur shadow-md border-gray-200 text-gray-700' : 'bg-white/50 backdrop-blur border-gray-100 text-gray-400 line-through'}`}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? color : '#9ca3af' }} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            </ScaleOnHover>
          </BouncePress>
        );
      })}
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
const GisMapPage: React.FC = () => {
  const navigate = useNavigate();
  const { query, setSpatialTime } = useSpatialTime();
  const { filters, setStatus } = useMapFilters();
  const { selectedAssetId, setSelectedAssetId } = useSpatialSelection();

  const [visibleStatuses, setVisibleStatuses] = useState<Set<string>>(
    () => new Set(Object.keys(STATUS_LABEL)),
  );
  const [searchQuery, setSearchQuery] = useState('');

  // 数据拉取（SpatialTimeContext.locationId + useMapFilters 三参数）
  const { data: assets = [], isLoading, isError, error, refetch } = useGisAssets({
    status: filters.status,
    locationId: query.locationId,
  });

  const selectedAsset = useMemo(
    () => (selectedAssetId != null ? assets.find((a) => a.id === selectedAssetId) ?? null : null),
    [assets, selectedAssetId],
  );

  const displayAssets = useMemo(() => {
    return assets.filter((a) => {
      if (!visibleStatuses.has(a.status)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return a.assetName.toLowerCase().includes(q) || a.assetNo.toLowerCase().includes(q);
      }
      return true;
    });
  }, [assets, visibleStatuses, searchQuery]);

  const handleToggleStatus = useCallback((status: string) => {
    setVisibleStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  }, []);

  const handleAssetSelect = useCallback(
    (asset: GisAsset) => {
      setSelectedAssetId(asset.id);
    },
    [setSelectedAssetId],
  );

  const handleViewEnergy = useCallback(
    (asset: GisAsset) => {
      // 跨页联动：写入 locationId + selectedAssetId，导航到 /energy
      setSpatialTime({ locationId: asset.locationId ?? null, selectedAssetId: asset.id });
      navigate('/energy');
    },
    [navigate, setSpatialTime],
  );

  // ── Stat bar data ────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: assets.length,
    inUse: assets.filter((a) => a.status === 'IN_USE').length,
    idle: assets.filter((a) => a.status === 'IDLE').length,
    maintenance: assets.filter((a) => a.status === 'MAINTENANCE').length,
    scrapped: assets.filter((a) => a.status === 'SCRAPPED').length,
  }), [assets]);

  // 错误态
  if (isError) {
    return (
      <PageTransition>
        <ErrorState
          title="加载失败"
          description={error instanceof Error ? error.message : '加载资产位置数据失败'}
          onRetry={() => refetch()}
        />
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
                <h1 className="text-xl font-bold tracking-tight text-slate-900">GIS 资产地图</h1>
                <p className="mt-1 text-sm text-slate-500">资产地理位置分布可视化</p>
              </div>
            </div>

            {/* Stat bar */}
            {!isLoading && assets.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-50">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{stats.total}</span>
                    <span className="text-xs text-slate-400">定位资产总数</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-sm font-semibold text-slate-700">{stats.inUse}</span>
                    <span className="text-xs text-slate-400">在用</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
                    <span className="text-sm font-semibold text-slate-700">{stats.idle}</span>
                    <span className="text-xs text-slate-400">闲置</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-green-50">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    </span>
                    <span className="text-xs text-slate-400">需维护</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
                    <span className="text-sm font-semibold text-slate-700">{stats.maintenance}</span>
                    <span className="text-xs text-slate-400">维修中</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                    <span className="text-sm font-semibold text-slate-700">{stats.scrapped}</span>
                    <span className="text-xs text-slate-400">已报废</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ── Spatial + Time controls ──────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3">
            <LocationCascader />
            <TimeRangeSelector />
          </div>

          {/* ── Map Card ─────────────────────────────────────────────────────── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">
                资产分布{assets.length > 0 ? ` (${displayAssets.length}/${assets.length} 个定位资产)` : ''}
              </h3>
              <Select
                value={filters.status ?? 'ALL'}
                onValueChange={(v) => setStatus(v === 'ALL' ? undefined : v)}
                placeholder="状态筛选"
                className="w-[140px]"
              >
                <SelectItem value="ALL">全部状态</SelectItem>
                <SelectItem value="IN_USE">在用</SelectItem>
                <SelectItem value="IDLE">闲置</SelectItem>
                <SelectItem value="MAINTENANCE">维修中</SelectItem>
                <SelectItem value="SCRAPPED">已报废</SelectItem>
                <SelectItem value="PENDING">待处理</SelectItem>
              </Select>
            </div>

            <div className="p-0">
              {isLoading ? (
                <SkeletonCard className="h-[70vh] rounded-none" />
              ) : assets.length === 0 ? (
                <div className="flex items-center justify-center h-[70vh]">
                  <EmptyState title="暂无资产定位数据" description="没有已定位的资产可在地图上显示" />
                </div>
              ) : (
                <div style={{ height: '70vh' }}>
                  <MapContainer
                    center={DEFAULT_CENTER}
                    zoom={DEFAULT_ZOOM}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <ZoomControl position="bottomright" />
                    <ScaleControl position="bottomleft" imperial={false} />
                    <GisMarkerLayer assets={displayAssets} onAssetSelect={handleAssetSelect} />
                    <MapInfoDisplay />
                    <MapSearchOverlay value={searchQuery} onChange={setSearchQuery} />
                    <MapToolbarOverlay allAssets={displayAssets} />
                    <MapLayerFilterOverlay visibleStatuses={visibleStatuses} onToggle={handleToggleStatus} />
                    <GisDetailPanel
                      asset={selectedAsset}
                      onClose={() => setSelectedAssetId(undefined)}
                      onViewEnergy={handleViewEnergy}
                    />
                  </MapContainer>
                </div>
              )}
            </div>
          </Card>

        </div>
      </div>
    </PageTransition>
  );
};

export default GisMapPage;
