/**
 * AssetSelector Component
 * 
 * Asset selection component for retirement application form.
 * Provides searchable dropdown to select assets eligible for retirement.
 * 
 * @description
 * This component allows users to select an asset from a filtered list
 * of assets that are in IN_USE status and eligible for retirement.
 * 
 * @example
 * ```tsx
 * <AssetSelector
 *   value={selectedAssetId}
 *   onChange={setSelectedAssetId}
 *   error={errors.assetId}
 * />
 * ```
 * 
 * @module retirement/components
 */

import React, { useState, useMemo, useCallback } from 'react';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';
import { useAssetList } from '@/hooks/asset/useAssets';
import {
  ASSET_STATUS_CONFIG,
  AssetStatus,
  type AssetListItem,
  type AssetListQuery,
} from '@/types/asset';

export interface AssetSelectorProps {
  /** Currently selected asset ID */
  value: string | null;
  /** Callback when asset selection changes */
  onChange: (assetId: string | null) => void;
  /** Error message to display */
  error?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * AssetSelector Component
 * 
 * Provides a searchable dropdown for selecting assets eligible for retirement.
 * Only assets with IN_USE status are shown.
 * 
 * @param props - Component props
 * @returns Asset selector JSX element
 */
export const AssetSelector: React.FC<AssetSelectorProps> = ({
  value,
  onChange,
  error,
  disabled = false,
  placeholder = '请选择要报废的资产',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const assetListQuery = useMemo<AssetListQuery>(() => ({
    page: 1,
    pageSize: 500,
    status: AssetStatus.IN_USE,
  }), []);
  
  // Fetch all assets
  const { data: assetsResponse, isLoading, error: fetchError } = useAssetList(assetListQuery);
  const assets = useMemo(
    () => assetsResponse?.data?.records ?? [],
    [assetsResponse],
  );
  
  // Filter assets to show only IN_USE status (BC-003)
  const eligibleAssets = useMemo(() => {
    return assets.filter((asset) => asset.status === AssetStatus.IN_USE);
  }, [assets]);
  
  // Filter by search term
  const filteredAssets = useMemo(() => {
    if (!searchTerm.trim()) return eligibleAssets;
    
    const term = searchTerm.toLowerCase();
    return eligibleAssets.filter(
      (asset) =>
        asset.assetNo.toLowerCase().includes(term) ||
        asset.assetName.toLowerCase().includes(term) ||
        (asset.categoryName && asset.categoryName.toLowerCase().includes(term))
    );
  }, [eligibleAssets, searchTerm]);
  
  // Find selected asset details
  const selectedAsset = useMemo(() => {
    if (!value) return null;
    return assets.find((asset) => String(asset.id) === value) ?? null;
  }, [value, assets]);
  
  /**
   * Handle selection of an asset
   * @param asset - Selected asset object
   */
  const handleSelect = useCallback((asset: AssetListItem) => {
    onChange(String(asset.id));
    setIsOpen(false);
    setSearchTerm('');
  }, [onChange]);
  
  /**
   * Clear the current selection
   */
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  }, [onChange]);
  
  /**
   * Toggle dropdown open/close state
   */
  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      setSearchTerm('');
    }
  }, [disabled]);
  
  /**
   * Handle click outside to close dropdown
   */
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Delay to allow click events on dropdown items
    setTimeout(() => {
      setIsOpen(false);
    }, 200);
  }, []);
  
  /**
   * Render asset option in dropdown
   */
  const renderAssetOption = (asset: AssetListItem) => (
    <div
      key={asset.id}
      className="px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-gray-200 last:border-b-0 transition-colors"
      onClick={() => handleSelect(asset)}
      role="option"
      aria-selected={value === String(asset.id)}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-gray-900">{asset.assetName}</div>
          <div className="text-sm text-gray-400">
            {asset.assetNo}
            {asset.categoryName && ` · ${asset.categoryName}`}
          </div>
        </div>
        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
          {ASSET_STATUS_CONFIG[asset.status]?.label ?? asset.status}
        </span>
      </div>
      {asset.location && (
        <div className="text-xs text-gray-400 mt-1">{asset.location}</div>
      )}
    </div>
  );
  
  // Loading state
  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <div className="h-10 px-3 flex items-center border border-gray-200 rounded-md bg-gray-50">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-400 text-sm">加载资产中...</span>
        </div>
      </div>
    );
  }
  
  // Error state
  if (fetchError) {
    return (
      <div className={`relative ${className}`}>
        <div className="h-10 px-3 flex items-center border border-red-300 rounded-md bg-red-50">
          <span className="text-red-600 text-sm">加载资产失败，请重试</span>
        </div>
      </div>
    );
  }
  
  // Empty eligible assets state
  if (eligibleAssets.length === 0) {
    return (
      <div className={`relative ${className}`}>
        <div className="h-10 px-3 flex items-center border border-gray-200 rounded-md bg-gray-50">
          <span className="text-gray-400 text-sm">暂无可报废的资产</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`relative ${className}`}>
      {/* Selector trigger */}
      <button
        type="button"
        onClick={toggleDropdown}
        onBlur={handleBlur}
        disabled={disabled}
        className={`
          w-full h-10 px-3 flex items-center justify-between
          border rounded-md bg-white text-left
          transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
          ${disabled ? 'bg-blue-50 cursor-not-allowed opacity-60' : 'hover:border-gray-400'}
          ${error ? 'border-red-500' : 'border-gray-200'}
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex-1 min-w-0">
          {selectedAsset ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {selectedAsset.assetName}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {selectedAsset.assetNo}
                </div>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="ml-2 p-1 hover:bg-blue-50 rounded-full"
                tabIndex={-1}
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 ml-2 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索资产编码或名称..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>
          
          {/* Options list */}
          <div
            className="max-h-60 overflow-y-auto"
            role="listbox"
          >
            {filteredAssets.length > 0 ? (
              filteredAssets.map(renderAssetOption)
            ) : (
              <div className="px-3 py-4 text-center text-gray-400 text-sm">
                未找到匹配的资产
              </div>
            )}
          </div>
          
          {/* Footer with count */}
          <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-400">
            共 {filteredAssets.length} 项可选资产
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      
      {/* Helper text */}
      {!error && (
        <p className="mt-1 text-sm text-gray-400">
          仅显示状态为“在用”的资产
        </p>
      )}
    </div>
  );
};

export default AssetSelector;
