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
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
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
import { updateAssetLocation } from '@/services/gisService';
import { getAssetList } from '@/api/asset';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, CheckCircle2, Maximize2, RotateCcw, Crosshair, X, Search, Plus, Info, Link2, MapPinned } from 'lucide-react';

// ── 常量 ──────────────────────────────────────────────────────────────────────
const STATUS_MARKER_COLORS: Record<string, string> = {
  IN_USE: '#22c55e',
  IDLE: '#eab308',
  MAINTENANCE: '#3b82f6',
  SCRAPPED: '#ef4444',
  PENDING: '#f97316',
};
const STATUS_LABEL: Record<string, string> = {
  IN_USE: '在用', IDLE: '闲置', MAINTENANCE: '维修中', SCRAPPED: '已报废', PENDING: '待处理',
};
const DEFAULT_CENTER: L.LatLngExpression = [35.8617, 104.1954]; // Center of China
const DEFAULT_ZOOM = 5; // Show all of China

const PROVINCES = [
  { name: '全国', center: [35.8617, 104.1954] as L.LatLngExpression, zoom: 5 },
  { name: '北京', center: [39.9042, 116.4074] as L.LatLngExpression, zoom: 10 },
  { name: '上海', center: [31.2304, 121.4737] as L.LatLngExpression, zoom: 10 },
  { name: '广东', center: [23.1291, 113.2644] as L.LatLngExpression, zoom: 8 },
  { name: '浙江', center: [30.2741, 120.1551] as L.LatLngExpression, zoom: 8 },
  { name: '江苏', center: [32.0603, 118.7969] as L.LatLngExpression, zoom: 8 },
  { name: '四川', center: [30.5728, 104.0668] as L.LatLngExpression, zoom: 8 },
  { name: '湖北', center: [30.5928, 114.3055] as L.LatLngExpression, zoom: 8 },
  { name: '山东', center: [36.6683, 116.9972] as L.LatLngExpression, zoom: 8 },
  { name: '福建', center: [26.0745, 119.2965] as L.LatLngExpression, zoom: 8 },
  { name: '重庆', center: [29.5630, 106.5516] as L.LatLngExpression, zoom: 8 },
  { name: '天津', center: [39.3434, 117.3616] as L.LatLngExpression, zoom: 10 },
];

const ASSET_CATEGORIES = ['全部', 'IT设备', '办公设备', '生产设备', '交通工具', '家具'];

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

function MapProvinceControl({ selectedProvince, onProvinceChange }: { selectedProvince: string; onProvinceChange: (name: string) => void }) {
  const map = useMap();
  const handleChange = (provinceName: string) => {
    onProvinceChange(provinceName);
    const province = PROVINCES.find((p) => p.name === provinceName);
    if (province) {
      map.flyTo(province.center, province.zoom, { duration: 1.2 });
    }
  };
  return (
    <div className="absolute top-3 left-[250px] z-[1000]">
      <Select value={selectedProvince} onValueChange={handleChange} className="w-[100px] h-9 bg-white/90 backdrop-blur shadow-md border-gray-200">
        {PROVINCES.map((p) => (
          <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
        ))}
      </Select>
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
  const queryClient = useQueryClient();
  const { query, setSpatialTime } = useSpatialTime();
  const { filters, setStatus } = useMapFilters();
  const { selectedAssetId, setSelectedAssetId } = useSpatialSelection();

  const [visibleStatuses, setVisibleStatuses] = useState<Set<string>>(
    () => new Set(Object.keys(STATUS_LABEL)),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('全国');
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [localAssets, setLocalAssets] = useState<GisAsset[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // 新建定位对话框模式：'link' = 关联已有资产, 'new' = 新建资产
  const [createMode, setCreateMode] = useState<'link' | 'new'>('link');
  // 关联已有资产模式的状态
  const [linkAssetSearch, setLinkAssetSearch] = useState('');
  const [linkAssetId, setLinkAssetId] = useState<number | null>(null);
  const [linkLat, setLinkLat] = useState('');
  const [linkLng, setLinkLng] = useState('');
  const [linkLocation, setLinkLocation] = useState('');

  // 新建资产表单状态
  const [newAsset, setNewAsset] = useState({
    assetName: '',
    assetNo: '',
    locationLat: '',
    locationLng: '',
    status: 'IN_USE',
    location: '',
  });

  // 数据拉取（SpatialTimeContext.locationId + useMapFilters 三参数）
  const { data: assets = [], isLoading, isError, error, refetch } = useGisAssets({
    status: filters.status,
    locationId: query.locationId,
  });

  const effectiveAssets = useMemo(
    () => [...assets, ...localAssets],
    [assets, localAssets],
  );

  const selectedAsset = useMemo(
    () => (selectedAssetId != null ? effectiveAssets.find((a) => a.id === selectedAssetId) ?? null : null),
    [effectiveAssets, selectedAssetId],
  );

  const displayAssets = useMemo(() => {
    return effectiveAssets.filter((a) => {
      if (!visibleStatuses.has(a.status)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return a.assetName.toLowerCase().includes(q) || a.assetNo.toLowerCase().includes(q);
      }
      return true;
    });
  }, [effectiveAssets, visibleStatuses, searchQuery]);

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

  // 查看资产详情：跳转到资产详情页
  const handleViewAsset = useCallback(
    (asset: GisAsset) => {
      navigate(`/assets/${asset.id}`);
    },
    [navigate],
  );

  // 查询资产列表（用于"关联已有资产"模式的选择列表）
  const { data: linkableAssets = [] } = useQuery({
    queryKey: ['gis-linkable-assets', linkAssetSearch],
    queryFn: async () => {
      const res = await getAssetList({ keyword: linkAssetSearch || undefined, pageSize: 50 });
      const items = (res as any)?.items ?? (res as any)?.records ?? [];
      return items as Array<{ id: number; assetNo: string; assetName: string; status: string; location?: string }>;
    },
    enabled: createDialogOpen && createMode === 'link',
    staleTime: 30_000,
  });

  // 更新资产坐标 mutation
  const updateLocationMutation = useMutation({
    mutationFn: ({ id, lat, lng }: { id: number; lat: number; lng: number }) =>
      updateAssetLocation(id, lat, lng),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gis-assets'] });
    },
  });

  // 关联已有资产提交
  const handleLinkAsset = useCallback(async () => {
    const lat = parseFloat(linkLat);
    const lng = parseFloat(linkLng);
    if (linkAssetId == null || isNaN(lat) || isNaN(lng)) return;

    try {
      await updateLocationMutation.mutateAsync({ id: linkAssetId, lat, lng });
      setCreateDialogOpen(false);
      setLinkAssetId(null);
      setLinkLat('');
      setLinkLng('');
      setLinkLocation('');
      setLinkAssetSearch('');
    } catch {
      // 如果后端 API 尚未就绪，回退到本地模式
      const selectedAsset = linkableAssets.find(a => a.id === linkAssetId);
      if (selectedAsset) {
        const localAsset: GisAsset = {
          id: selectedAsset.id,
          assetName: selectedAsset.assetName,
          assetNo: selectedAsset.assetNo,
          status: selectedAsset.status || 'IN_USE',
          locationLat: lat,
          locationLng: lng,
          location: linkLocation || '未指定位置',
        };
        setLocalAssets(prev => [...prev, localAsset]);
      }
      setCreateDialogOpen(false);
      setLinkAssetId(null);
      setLinkLat('');
      setLinkLng('');
      setLinkLocation('');
      setLinkAssetSearch('');
    }
  }, [linkAssetId, linkLat, linkLng, linkLocation, linkableAssets, updateLocationMutation]);

  // 新建资产提交
  const handleCreateAsset = useCallback(() => {
    const lat = parseFloat(newAsset.locationLat);
    const lng = parseFloat(newAsset.locationLng);
    if (!newAsset.assetName || !newAsset.assetNo || isNaN(lat) || isNaN(lng)) return;

    const created: GisAsset = {
      id: Date.now(), // 使用时间戳作为临时ID
      assetName: newAsset.assetName,
      assetNo: newAsset.assetNo,
      status: newAsset.status,
      locationLat: lat,
      locationLng: lng,
      location: newAsset.location || '未指定位置',
    };
    setLocalAssets((prev) => [...prev, created]);
    setCreateDialogOpen(false);
    setNewAsset({ assetName: '', assetNo: '', locationLat: '', locationLng: '', status: 'IN_USE', location: '' });
  }, [newAsset]);

  // ── Stat bar data ────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: effectiveAssets.length,
    inUse: effectiveAssets.filter((a) => a.status === 'IN_USE').length,
    idle: effectiveAssets.filter((a) => a.status === 'IDLE').length,
    maintenance: effectiveAssets.filter((a) => a.status === 'MAINTENANCE').length,
    scrapped: effectiveAssets.filter((a) => a.status === 'SCRAPPED').length,
  }), [effectiveAssets]);

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
              <Button variant="primary" size="md" onClick={() => setCreateDialogOpen(true)}>
                <MapPinned className="w-4 h-4" />
                资产定位管理
              </Button>
            </div>

            {/* Data source info banner */}
            <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>GIS 定位数据来源于资产台账，通过"关联已有资产"为资产标注坐标，或在资产表单中直接填写经纬度。点击地图标记可跳转资产详情。</span>
            </div>

            {/* Stat bar */}
            {!isLoading && effectiveAssets.length > 0 && (
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

          {/* ── Spatial + Time + Filters controls ──────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3">
            <LocationCascader />
            <TimeRangeSelector />
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
              className="w-[120px]"
            >
              {ASSET_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </Select>
          </div>

          {/* ── Map Card ─────────────────────────────────────────────────────── */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">
                资产分布{effectiveAssets.length > 0 ? ` (${displayAssets.length}/${effectiveAssets.length} 个定位资产)` : ''}
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
              ) : effectiveAssets.length === 0 ? (
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
                    <MapProvinceControl selectedProvince={selectedProvince} onProvinceChange={setSelectedProvince} />
                    <MapToolbarOverlay allAssets={displayAssets} />
                    <MapLayerFilterOverlay visibleStatuses={visibleStatuses} onToggle={handleToggleStatus} />
                    <GisDetailPanel
                      asset={selectedAsset}
                      onClose={() => setSelectedAssetId(undefined)}
                      onViewEnergy={handleViewEnergy}
                      onViewAsset={handleViewAsset}
                    />
                  </MapContainer>
                </div>
              )}
            </div>
          </Card>

          {/* ── Create / Link Asset Dialog ────────────────────────────────────────── */}
          <Dialog open={createDialogOpen} onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) {
              setLinkAssetId(null); setLinkLat(''); setLinkLng(''); setLinkLocation(''); setLinkAssetSearch('');
              setNewAsset({ assetName: '', assetNo: '', locationLat: '', locationLng: '', status: 'IN_USE', location: '' });
            }
          }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>资产定位管理</DialogTitle>
              </DialogHeader>

              {/* 模式切换 Tab */}
              <div className="px-6 pt-2">
                <div className="flex rounded-lg bg-gray-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setCreateMode('link')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
                      createMode === 'link' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    关联已有资产
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode('new')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
                      createMode === 'new' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新建资产定位
                  </button>
                </div>
              </div>

              {createMode === 'link' ? (
                /* ── 关联已有资产模式 ──────────────────────────────────────────── */
                <div className="px-6 py-4 space-y-4">
                  <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>从资产台账中选择已有资产，为其标注 GIS 地理坐标。</span>
                  </div>

                  {/* 资产搜索 */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={linkAssetSearch}
                      onChange={(e) => setLinkAssetSearch(e.target.value)}
                      placeholder="搜索资产名称或编号..."
                      className="w-full h-9 pl-8 pr-3 rounded-lg border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-300 transition-all"
                    />
                  </div>

                  {/* 资产选择列表 */}
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {linkableAssets.length === 0 ? (
                      <div className="flex items-center justify-center py-4 text-xs text-gray-400">
                        暂无可关联的资产
                      </div>
                    ) : (
                      linkableAssets.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            setLinkAssetId(a.id);
                            if (a.location) setLinkLocation(a.location);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                            linkAssetId === a.id
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{a.assetName}</div>
                            <div className="text-xs text-gray-400 font-mono">{a.assetNo}</div>
                          </div>
                          {linkAssetId === a.id && (
                            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {/* 坐标输入 */}
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="纬度 (-90~90)"
                      type="number"
                      step="0.0001"
                      placeholder="如：39.9042"
                      value={linkLat}
                      onChange={(e) => setLinkLat(e.target.value)}
                    />
                    <Input
                      label="经度 (-180~180)"
                      type="number"
                      step="0.0001"
                      placeholder="如：116.4074"
                      value={linkLng}
                      onChange={(e) => setLinkLng(e.target.value)}
                    />
                  </div>
                  <Input
                    label="位置描述"
                    placeholder="如：北京总部A栋1层"
                    value={linkLocation}
                    onChange={(e) => setLinkLocation(e.target.value)}
                  />
                </div>
              ) : (
                /* ── 新建资产定位模式 ──────────────────────────────────────────── */
                <div className="px-6 py-4 space-y-4">
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>创建一条仅含位置信息的资产记录（临时数据，需后续在资产台账中完善）。</span>
                  </div>
                  <Input
                    label="资产名称"
                    placeholder="如：服务器-A01"
                    value={newAsset.assetName}
                    onChange={(e) => setNewAsset({ ...newAsset, assetName: e.target.value })}
                  />
                  <Input
                    label="资产编号"
                    placeholder="如：AST-2024-XXX"
                    value={newAsset.assetNo}
                    onChange={(e) => setNewAsset({ ...newAsset, assetNo: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="纬度"
                      type="number"
                      step="0.0001"
                      placeholder="如：39.9042"
                      value={newAsset.locationLat}
                      onChange={(e) => setNewAsset({ ...newAsset, locationLat: e.target.value })}
                    />
                    <Input
                      label="经度"
                      type="number"
                      step="0.0001"
                      placeholder="如：116.4074"
                      value={newAsset.locationLng}
                      onChange={(e) => setNewAsset({ ...newAsset, locationLng: e.target.value })}
                    />
                  </div>
                  <Select
                    label="状态"
                    value={newAsset.status}
                    onValueChange={(v) => setNewAsset({ ...newAsset, status: v })}
                  >
                    <SelectItem value="IN_USE">在用</SelectItem>
                    <SelectItem value="IDLE">闲置</SelectItem>
                    <SelectItem value="MAINTENANCE">维修中</SelectItem>
                    <SelectItem value="SCRAPPED">已报废</SelectItem>
                    <SelectItem value="PENDING">待处理</SelectItem>
                  </Select>
                  <Input
                    label="位置描述"
                    placeholder="如：北京总部A栋1层"
                    value={newAsset.location}
                    onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })}
                  />
                </div>
              )}

              <DialogFooter>
                <Button variant="secondary" onClick={() => setCreateDialogOpen(false)}>取消</Button>
                {createMode === 'link' ? (
                  <Button
                    variant="primary"
                    onClick={handleLinkAsset}
                    disabled={linkAssetId == null || !linkLat || !linkLng}
                  >
                    <MapPinned className="w-4 h-4" />
                    标注坐标
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleCreateAsset}
                    disabled={!newAsset.assetName || !newAsset.assetNo || !newAsset.locationLat || !newAsset.locationLng}
                  >
                    确认创建
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </div>
    </PageTransition>
  );
};

export default GisMapPage;
