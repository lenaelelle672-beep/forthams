import { createContext, type ReactNode, useContext, useMemo } from 'react';

type SystemInspectorSlotState = {
  activeMenu: string;
  activeMenuLabel: string;
  runtime: 'workbench-v3';
};

const SystemInspectorSlotContext = createContext<SystemInspectorSlotState | null>(null);

type SystemInspectorSlotProviderProps = {
  activeMenu: string;
  activeMenuLabel: string;
  children: ReactNode;
};

export function SystemInspectorSlotProvider({
  activeMenu,
  activeMenuLabel,
  children,
}: SystemInspectorSlotProviderProps) {
  const value = useMemo<SystemInspectorSlotState>(
    () => ({ activeMenu, activeMenuLabel, runtime: 'workbench-v3' }),
    [activeMenu, activeMenuLabel],
  );

  return (
    <SystemInspectorSlotContext.Provider value={value}>
      {children}
    </SystemInspectorSlotContext.Provider>
  );
}

export function useSystemInspectorSlot() {
  return useContext(SystemInspectorSlotContext);
}
