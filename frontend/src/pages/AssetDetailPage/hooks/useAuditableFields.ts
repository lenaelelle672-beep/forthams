import { useState, useMemo, useCallback, useEffect } from 'react';

interface AuditableFieldItem {
  fieldName: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  isAuditable: boolean;
}

interface FieldChange {
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp?: number;
}

const FIELD_CONFIG: Record<string, { label: string; type: AuditableFieldItem['type'] }> = {
  assetName: { label: '资产名称', type: 'text' },
  assetCode: { label: '资产编码', type: 'text' },
  categoryId: { label: '资产分类', type: 'select' },
  locationId: { label: '存放地点', type: 'select' },
  custodianId: { label: '保管人', type: 'select' },
  status: { label: '资产状态', type: 'select' },
  purchaseDate: { label: '购置日期', type: 'date' },
  purchasePrice: { label: '购置价格', type: 'number' },
  currentValue: { label: '当前价值', type: 'number' },
  serialNumber: { label: '序列号', type: 'text' },
  departmentId: { label: '所属部门', type: 'select' },
  description: { label: '描述', type: 'text' },
};

function getFieldDisplayName(
  fieldMap: Record<string, { label?: string }> | undefined | null,
  fieldName: string
): string {
  if (fieldMap?.[fieldName]?.label) return fieldMap[fieldName].label;
  return FIELD_CONFIG[fieldName]?.label || fieldName;
}

function getDiffStrategy(
  fieldMap: Record<string, { diffStrategy?: string }> | undefined | null,
  fieldName: string
): string {
  return fieldMap?.[fieldName]?.diffStrategy || 'text';
}

type UseAuditableFieldsOverload = {
  (fieldMap: Record<string, unknown>): {
    getFieldDisplayName: (fieldName: string) => string;
    getDiffStrategy: (fieldName: string) => string;
  };
  (asset: unknown): {
    fields: AuditableFieldItem[];
    getFieldChanges: (fieldName: string) => FieldChange[];
    isFieldAuditable: (fieldName: string) => boolean;
    loading: boolean;
  };
};

export function useAuditableFields(
  arg: Record<string, unknown> | unknown | null
):
  | { getFieldDisplayName: (fieldName: string) => string; getDiffStrategy: (fieldName: string) => string }
  | { fields: AuditableFieldItem[]; getFieldChanges: (fieldName: string) => FieldChange[]; isFieldAuditable: (fieldName: string) => boolean; loading: boolean } {
  const isRecord = arg != null && typeof arg === 'object' && !Array.isArray(arg);

  const fields = useMemo<AuditableFieldItem[]>(() => {
    if (!isRecord) return [];
    const map = arg as Record<string, unknown>;
    if (Object.keys(map).length === 0) {
      return Object.entries(FIELD_CONFIG).map(([key, cfg]) => ({
        fieldName: key,
        label: cfg.label,
        type: cfg.type,
        isAuditable: true,
      }));
    }
    return Object.entries(map).map(([key, val]) => {
      const cfg = FIELD_CONFIG[key];
      const v = val as Record<string, unknown> | undefined;
      return {
        fieldName: key,
        label: (v?.label as string) || cfg?.label || key,
        type: (v?.type as AuditableFieldItem['type']) || cfg?.type || 'text',
        isAuditable: true,
      };
    });
  }, [arg, isRecord]);

  const isFieldAuditable = useCallback((fieldName: string) => {
    return fieldName in FIELD_CONFIG;
  }, []);

  const getFieldChanges = useCallback((_fieldName: string): FieldChange[] => {
    return [];
  }, []);

  if (isRecord) {
    const map = arg as Record<string, unknown>;
    const firstValue = Object.values(map)[0];
    if (firstValue && typeof firstValue === 'object' && ('label' in (firstValue as object) || 'diffStrategy' in (firstValue as object))) {
      return {
        getFieldDisplayName: (fn: string) => getFieldDisplayName(map as Record<string, { label?: string }>, fn),
        getDiffStrategy: (fn: string) => getDiffStrategy(map as Record<string, { diffStrategy?: string }>, fn),
      };
    }
  }

  return {
    fields,
    getFieldChanges,
    isFieldAuditable,
    loading: false,
  };
}

export default useAuditableFields;
