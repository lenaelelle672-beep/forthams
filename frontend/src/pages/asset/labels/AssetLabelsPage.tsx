import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, QrCode, Printer, Search, X, CheckSquare, Square,
} from 'lucide-react';
import { getAssetList } from '@/api/asset';
import { getAssetLabel, type AssetLabel } from '@/api/barcode';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import type { AssetListItem } from '@/types/asset';

export default function AssetLabelsPage() {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [labels, setLabels] = useState<Map<number, AssetLabel>>(new Map());
  const [loadingLabels, setLoadingLabels] = useState(false);

  const { data: assetListRes } = useQuery({
    queryKey: ['assets', 'labels', keyword],
    queryFn: () => getAssetList({ keyword: keyword || undefined, page: 1, pageSize: 50 }),
  });

  const assets: AssetListItem[] = (assetListRes as unknown as { records?: AssetListItem[] })?.records ?? [];

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(assets.map((a) => a.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const loadLabels = async () => {
    if (selectedIds.size === 0) {
      toast.warning('请先选择资产');
      return;
    }
    setLoadingLabels(true);
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map(async (id) => {
          try {
            const res = await getAssetLabel(id);
            const label = (res as unknown as { data: AssetLabel }).data;
            return [id, label] as const;
          } catch {
            return null;
          }
        }),
      );
      const newLabels = new Map<number, AssetLabel>();
      for (const r of results) {
        if (r) newLabels.set(r[0], r[1]);
      }
      setLabels(newLabels);
      if (newLabels.size > 0) {
        toast.success(`已加载 ${newLabels.size} 个标签`);
      } else {
        toast.error('加载标签失败');
      }
    } catch {
      toast.error('加载标签失败');
    } finally {
      setLoadingLabels(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            className="p-2 hover:bg-[#f1f5f9] rounded-full transition-colors"
            onClick={() => navigate('/assets')}
          >
            <ArrowLeft className="w-5 h-5 text-[#0f172a]" />
          </button>
          <h1 className="text-xl font-semibold text-[#0f172a]">资产标签打印</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setLabels(new Map()); setSelectedIds(new Set()); }}
          >
            <X className="w-4 h-4" />
            清除
          </Button>
          <Button size="sm" onClick={loadLabels} disabled={loadingLabels || selectedIds.size === 0}>
            {loadingLabels ? '加载中...' : '预览标签'}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={labels.size === 0}>
            <Printer className="w-4 h-4" />
            打印
          </Button>
        </div>
      </div>

      <div className="flex gap-5">
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-xl border border-[#e5e7eb] shadow-sm">
            <div className="p-4 border-b border-[#e5e7eb]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <input
                  className="w-full pl-9 pr-3 py-2 text-sm border border-[#e5e7eb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#004ac6]/20 focus:border-[#004ac6]"
                  placeholder="搜索资产..."
                  value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setSelectedIds(new Set()); }}
                />
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-[#64748b]">{assets.length} 项</span>
                <div className="flex gap-2">
                  <button className="text-xs text-[#004ac6] hover:underline" onClick={selectAll}>全选</button>
                  <button className="text-xs text-[#64748b] hover:underline" onClick={deselectAll}>取消</button>
                </div>
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#f8fafc] transition-colors border-b border-[#e5e7eb]/60 last:border-0 ${
                    selectedIds.has(asset.id) ? 'bg-[#eef2ff]' : ''
                  }`}
                  onClick={() => toggleSelect(asset.id)}
                >
                  {selectedIds.has(asset.id) ? (
                    <CheckSquare className="w-4 h-4 text-[#004ac6] flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-[#94a3b8] flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#0f172a] truncate">{asset.assetName}</p>
                    <p className="text-xs text-[#64748b]">{asset.assetNo}</p>
                  </div>
                  <QrCode className="w-4 h-4 text-[#004ac6] flex-shrink-0" />
                </button>
              ))}
              {assets.length === 0 && (
                <div className="p-8 text-center text-sm text-[#94a3b8]">
                  未找到资产
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-xl border border-[#e5e7eb] shadow-sm p-6" ref={printRef}>
          {labels.size > 0 ? (
            <div className="label-grid">
              {Array.from(labels.entries()).map(([id, label]) => (
                <div key={id} className="label-card">
                  <img
                    src={`data:image/png;base64,${label.qrBase64}`}
                    alt="QR"
                    className="w-24 h-24"
                  />
                  <div className="label-info">
                    <p className="label-name">{label.assetInfo.assetName}</p>
                    <p className="label-no">{label.assetInfo.assetNo}</p>
                    {label.assetInfo.model && (
                      <p className="label-detail">{label.assetInfo.brand} {label.assetInfo.model}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-[#94a3b8] gap-3">
              <QrCode className="w-12 h-12" />
              <p className="text-sm">从左侧选择资产后点击"预览标签"</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .label-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        .label-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          background: #fff;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .label-info {
          text-align: center;
        }
        .label-name {
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
          line-height: 1.3;
        }
        .label-no {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        .label-detail {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 1px;
        }
        @media print {
          body { margin: 0; padding: 0; }
          .label-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            padding: 20px;
          }
          .label-card {
            border: 1px solid #ccc;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
}
