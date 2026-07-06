import { useState, useEffect, useCallback } from "react";
import { assetService, type AssetRecord, type PagedResult } from "../../services/assetService";

export interface AssetDisposalPickerProps {
  /** Called when user selects an asset from the picker */
  onSelect: (asset: AssetRecord) => void;
  /** Currently selected asset ID (for highlighting) */
  selectedAssetId?: string | null;
  /** Accessible label for the picker */
  label?: string;
}

export interface AssetDisposalPickerModalProps extends AssetDisposalPickerProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
}

const PAGE_SIZE = 20;

/**
 * AssetDisposalPicker — reusable asset selector component for disposal forms.
 *
 * Fetches assets from `/assets/list` with keyword + page + pageSize pagination.
 * Displays loading / error / empty states and never synthesizes asset rows.
 */
export function AssetDisposalPicker({ onSelect, selectedAssetId, label = "选择资产" }: AssetDisposalPickerProps) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchAssets = useCallback(async (searchKeyword: string, searchPage: number) => {
    try {
      setLoading(true);
      setError(null);
      const result = await assetService.list({
        keyword: searchKeyword || undefined,
        page: searchPage,
        pageSize: PAGE_SIZE,
      }) as PagedResult<AssetRecord>;
      setAssets(result.records ?? []);
      setTotal(result.total ?? 0);
      if ((result.records ?? []).length === 0 && searchPage === 1) {
        setError("未查询到可选资产");
      }
    } catch {
      setError("资产列表加载失败，请稍后重试");
      setAssets([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Load first page on mount */
  useEffect(() => {
    void fetchAssets("", 1);
  }, [fetchAssets]);

  const handleSearch = () => {
    setPage(1);
    void fetchAssets(keyword, 1);
  };

  const handlePrevPage = () => {
    const prev = Math.max(1, page - 1);
    setPage(prev);
    void fetchAssets(keyword, prev);
  };

  const handleNextPage = () => {
    const next = Math.min(totalPages, page + 1);
    setPage(next);
    void fetchAssets(keyword, next);
  };

  const handleSelect = (asset: AssetRecord) => {
    onSelect(asset);
  };

  const getAssetId = (asset: AssetRecord): string => {
    for (const key of ["id", "assetId", "asset_id"]) {
      const value = asset[key];
      if (value !== undefined && value !== null && value !== "") {
        return String(value);
      }
    }
    return "";
  };

  const getAssetName = (asset: AssetRecord): string => {
    for (const key of ["assetName", "name", "asset_name", "title"]) {
      const value = asset[key];
      if (value !== undefined && value !== null && value !== "") {
        return String(value);
      }
    }
    return "未命名资产";
  };

  return (
    <div className="space-y-3" data-testid="asset-disposal-picker">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          placeholder="输入关键词搜索资产..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          data-testid="asset-search-input"
          aria-label={label}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          data-testid="asset-search-btn"
        >
          {loading ? "搜索中..." : "搜索"}
        </button>
      </div>

      {/* Error / Empty state */}
      {error && !loading && (
        <p className="text-xs text-amber-600" data-testid="asset-picker-message">{error}</p>
      )}

      {/* Asset list */}
      {assets.length > 0 && (
        <div className="border border-gray-200 rounded-md max-h-60 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">选择</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">资产ID</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">资产名称</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">分类</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">部门</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">状态</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const id = getAssetId(asset);
                const isSelected = id === selectedAssetId;
                return (
                  <tr
                    key={id}
                    className={`border-t border-gray-200 cursor-pointer hover:bg-blue-50 ${isSelected ? "bg-blue-100" : ""}`}
                    onClick={() => handleSelect(asset)}
                    data-testid={`asset-row-${id}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="radio"
                        name="asset-picker-radio"
                        checked={isSelected}
                        onChange={() => handleSelect(asset)}
                        className="text-blue-600 focus:ring-blue-500"
                        data-testid={`asset-radio-${id}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-900">{id}</td>
                    <td className="px-3 py-2 text-gray-900">{getAssetName(asset)}</td>
                    <td className="px-3 py-2 text-gray-500">{asset.categoryName ?? ""}</td>
                    <td className="px-3 py-2 text-gray-500">{asset.departmentName ?? ""}</td>
                    <td className="px-3 py-2 text-gray-500">{asset.status ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span data-testid="asset-picker-page-info">
            第 {page} / {totalPages} 页，共 {total} 条
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={page <= 1 || loading}
              className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="asset-picker-prev"
            >
              上一页
            </button>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={page >= totalPages || loading}
              className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="asset-picker-next"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AssetDisposalPickerModal({
  open,
  title,
  description = "请从资产台账分页检索并选择资产，选择后自动回填申请表。",
  onClose,
  ...pickerProps
}: AssetDisposalPickerModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50/25 backdrop-blur-[1px] p-4" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-400">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="text-xl leading-none text-gray-400 hover:text-gray-500" aria-label="关闭资产选择弹窗">
            ×
          </button>
        </div>
        <div className="p-6">
          <AssetDisposalPicker {...pickerProps} />
        </div>
      </div>
    </div>
  );
}
