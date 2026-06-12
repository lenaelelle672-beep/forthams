import { useSyncExternalStore } from 'react';

interface InventorySelectionState {
  selectedAssetIds: string[];
  selectedAssetKeys: string[];
  setSelectedAssetIds: (ids: string[]) => void;
  setSelectedAssetKeys: (keys: string[]) => void;
  clearSelected: () => void;
  clearSelection: () => void;
}

type Listener = () => void;

const listeners = new Set<Listener>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const setState = (partial: Pick<InventorySelectionState, 'selectedAssetIds' | 'selectedAssetKeys'>) => {
  state = { ...state, ...partial };
  notify();
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

let state: InventorySelectionState = {
  selectedAssetIds: [],
  selectedAssetKeys: [],
  setSelectedAssetIds: (ids) => setState({ selectedAssetIds: ids, selectedAssetKeys: ids }),
  setSelectedAssetKeys: (keys) => setState({ selectedAssetIds: keys, selectedAssetKeys: keys }),
  clearSelected: () => setState({ selectedAssetIds: [], selectedAssetKeys: [] }),
  clearSelection: () => setState({ selectedAssetIds: [], selectedAssetKeys: [] }),
};

export function useInventoryStore<T = InventorySelectionState>(
  selector: (snapshot: InventorySelectionState) => T = (snapshot) => snapshot as T,
): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}
