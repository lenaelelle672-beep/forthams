import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getAssetList } from '@/api/asset';
import type { AssetListItem } from '@/types/asset';
import type { PageData } from '@/types/common';

interface AssetPickerModalProps {
  open: boolean;
  onClose: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export default function AssetPickerModal({ open, onClose, selectedIds, onSelectionChange }: AssetPickerModalProps) {
  const [keyword, setKeyword] = useState('');
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set(selectedIds));

  const { data: assetListData } = useQuery({
    queryKey: ['assets', 'list', { pageSize: 200 }],
    queryFn: () => getAssetList({ pageSize: 200 }),
  });

  const allAssets: AssetListItem[] = useMemo(
    () => (assetListData as PageData<AssetListItem> | undefined)?.records ?? [],
    [assetListData]
  );

  const filtered = useMemo(() => {
    if (!keyword.trim()) return allAssets;
    const q = keyword.toLowerCase();
    return allAssets.filter(
      (a) =>
        a.assetNo?.toLowerCase().includes(q) ||
        a.assetName?.toLowerCase().includes(q) ||
        a.categoryName?.toLowerCase().includes(q) ||
        a.brand?.toLowerCase().includes(q) ||
        a.model?.toLowerCase().includes(q)
    );
  }, [allAssets, keyword]);

  const toggleId = (id: string) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (filtered.every((a) => localSelected.has(String(a.id)))) {
      setLocalSelected(new Set());
    } else {
      setLocalSelected(new Set(filtered.map((a) => String(a.id))));
    }
  };

  const handleConfirm = () => {
    onSelectionChange(localSelected);
    onClose();
  };

  const handleCancel = () => {
    setLocalSelected(new Set(selectedIds));
    onClose();
  };

  const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
    IDLE: { label: '闲置', bg: 'bg-amber-50', text: 'text-amber-600' },
    IN_USE: { label: '使用中', bg: 'bg-green-50', text: 'text-green-600' },
    RUNNING: { label: '运行中', bg: 'bg-green-50', text: 'text-green-600' },
    MAINTENANCE: { label: '维修中', bg: 'bg-blue-50', text: 'text-blue-600' },
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleCancel} />
      <div className="relative mx-4 w-full max-w-4xl max-h-[80vh] rounded-xl bg-white shadow-xl flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">选择资产</h3>
          <button type="button" onClick={handleCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* 搜索 */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索资产编号、名称、分类、品牌..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 sticky top-0">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((a) => localSelected.has(String(a.id)))}
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3">资产编号</th>
                <th className="px-4 py-3">资产名称</th>
                <th className="px-4 py-3">分类</th>
                <th className="px-4 py-3">品牌/型号</th>
                <th className="px-4 py-3 text-right">原值</th>
                <th className="px-4 py-3 text-right">净值</th>
                <th className="px-4 py-3">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((asset) => {
                const st = STATUS_LABELS[asset.status ?? ''] ?? { label: asset.status ?? '—', bg: 'bg-gray-50', text: 'text-gray-500' };
                return (
                  <tr key={asset.id} className="hover:bg-blue-50/30 transition-colors cursor-pointer" onClick={() => toggleId(String(asset.id))}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={localSelected.has(String(asset.id))} onChange={() => toggleId(String(asset.id))} className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-800">{asset.assetNo}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{asset.assetName}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{asset.categoryName}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{[asset.brand, asset.model].filter(Boolean).join(' ') || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right">{asset.originalValue ? `¥${asset.originalValue.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-500">{asset.currentValue ? `¥${asset.currentValue.toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${st.bg} ${st.text}`}>{st.label}</span></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">暂无匹配资产</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <span className="text-sm text-gray-500">已选 {localSelected.size} 项</span>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={handleCancel}>取消</Button>
            <Button type="button" variant="primary" onClick={handleConfirm}>确认选择</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
