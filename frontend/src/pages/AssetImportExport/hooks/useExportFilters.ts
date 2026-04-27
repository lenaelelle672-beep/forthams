import { useState, useCallback, useEffect } from 'react';
import axios from '@/utils/http';

/**
 * 资产状态多选选项（硬编码，spec ATB-014）
 * 选项：在用、闲置、维修中、报废
 */
export const ASSET_STATUS_OPTIONS = [
  { label: '在用', value: 'in_use' },
  { label: '闲置', value: 'idle' },
  { label: '维修中', value: 'under_repair' },
  { label: '报废', value: 'scrapped' },
] as const;

/**
 * 导出筛选条件状态
 * Spec: { categoryCodes: string[], statusCodes: string[], locationCodes: string[] }
 */
export interface ExportFilterState {
  /** 资产分类编码列表（树形多选） */
  categoryCodes: string[];
  /** 资产状态编码列表（多选） */
  statusCodes: string[];
  /** 存放位置编码列表（级联多选） */
  locationCodes: string[];
}

/**
 * 分类树节点结构（TreeSelect 数据源）
 */
export interface CategoryTreeNode {
  title: string;
  value: string;
  key: string;
  children?: CategoryTreeNode[];
}

/**
 * 位置级联选项结构（Cascader 数据源）
 */
export interface LocationCascaderOption {
  label: string;
  value: string;
  children?: LocationCascaderOption[];
}

/** 默认空筛选条件 */
const DEFAULT_FILTERS: ExportFilterState = {
  categoryCodes: [],
  statusCodes: [],
  locationCodes: [],
};

/**
 * useExportFilters — 管理导出面板的筛选条件状态与数据源
 *
 * 职责：
 * - 管理 categoryCodes / statusCodes / locationCodes 三维筛选状态
 * - 从后端获取分类树（GET /api/v1/asset-categories/tree）
 * - 从后端获取位置级联数据（GET /api/v1/asset-locations/cascade）
 * - 提供重置与空条件判断
 *
 * 不负责：实际导出下载（由 useAssetExport 处理）
 */
export function useExportFilters() {
  const [filters, setFilters] = useState<ExportFilterState>({ ...DEFAULT_FILTERS });
  const [categoryTree, setCategoryTree] = useState<CategoryTreeNode[]>([]);
  const [locationCascade, setLocationCascade] = useState<LocationCascaderOption[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);

  /**
   * 获取分类树数据
   * API: GET /api/v1/asset-categories/tree
   */
  const fetchCategoryTree = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const response = await axios.get('/api/v1/asset-categories/tree');
      const data = response.data?.data ?? response.data ?? [];
      setCategoryTree(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取分类树失败:', error);
      setCategoryTree([]);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  /**
   * 获取位置级联数据
   * API: GET /api/v1/asset-locations/cascade
   */
  const fetchLocationCascade = useCallback(async () => {
    setLoadingLocations(true);
    try {
      const response = await axios.get('/api/v1/asset-locations/cascade');
      const data = response.data?.data ?? response.data ?? [];
      setLocationCascade(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取位置级联数据失败:', error);
      setLocationCascade([]);
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  /** 组件挂载时自动加载筛选数据源 */
  useEffect(() => {
    fetchCategoryTree();
    fetchLocationCascade();
  }, [fetchCategoryTree, fetchLocationCascade]);

  /** 更新资产分类筛选 */
  const updateCategoryCodes = useCallback((codes: string[]) => {
    setFilters((prev) => ({ ...prev, categoryCodes: codes }));
  }, []);

  /** 更新资产状态筛选 */
  const updateStatusCodes = useCallback((codes: string[]) => {
    setFilters((prev) => ({ ...prev, statusCodes: codes }));
  }, []);

  /** 更新存放位置筛选 */
  const updateLocationCodes = useCallback((codes: string[]) => {
    setFilters((prev) => ({ ...prev, locationCodes: codes }));
  }, []);

  /** 重置所有筛选条件为默认空值 */
  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  /** 判断当前筛选条件是否全部为空 */
  const isEmpty: boolean =
    filters.categoryCodes.length === 0 &&
    filters.statusCodes.length === 0 &&
    filters.locationCodes.length === 0;

  return {
    /** 当前筛选条件 */
    filters,
    /** 分类树数据源（TreeSelect） */
    categoryTree,
    /** 位置级联数据源（Cascader） */
    locationCascade,
    /** 分类树加载中 */
    loadingCategories,
    /** 位置级联加载中 */
    loadingLocations,
    /** 更新分类筛选 */
    updateCategoryCodes,
    /** 更新状态筛选 */
    updateStatusCodes,
    /** 更新位置筛选 */
    updateLocationCodes,
    /** 重置所有筛选 */
    resetFilters,
    /** 是否所有筛选条件均为空 */
    isEmpty,
    /** 硬编码的资产状态选项 */
    statusOptions: ASSET_STATUS_OPTIONS,
  };
}

export default useExportFilters;