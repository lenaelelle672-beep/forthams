/**
 * @module stores/useInventoryStore
 * @description 盘点任务 UI 状态 Store
 *
 * 轻量级 selector-compatible store，无需额外依赖。
 * 服务端数据由 useInventory React Query hooks 管理。
 */
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';

// Global singleton state
let _selectedAssetKeys: string[] = [];
let _currentTaskId: string | null = null;
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((fn) => fn());
}

const store = {
  getState: () => ({
    selectedAssetKeys: _selectedAssetKeys,
    selectedAssetIds: _selectedAssetKeys,
    currentTaskId: _currentTaskId,
    setSelectedAssetKeys: (keys: string[]) => {
      _selectedAssetKeys = keys;
      notify();
    },
    clearSelection: () => {
      _selectedAssetKeys = [];
      notify();
    },
    clearSelected: () => {
      _selectedAssetKeys = [];
      notify();
    },
    setCurrentTaskId: (id: string | null) => {
      _currentTaskId = id;
      notify();
    },
  }),
  subscribe: (listener: () => void) => {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
};

/**
 * Zustand-compatible inventory store hook.
 *
 * @example
 * const selectedAssetKeys = useInventoryStore((s) => s.selectedAssetKeys);
 * const setSelectedAssetKeys = useInventoryStore((s) => s.setSelectedAssetKeys);
 */
export function useInventoryStore<T>(selector: (state: ReturnType<typeof store.getState>) => T): T {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsub = store.subscribe(() => forceUpdate((n) => n + 1));
    unsub();
  }, []);

  return selector(store.getState());
}
