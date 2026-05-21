import { useMemo, useCallback } from 'react';

const AUDITABLE_FIELDS = new Set([
  'assetName',
  'assetCode',
  'status',
  'locationId',
  'custodianId',
  'departmentId',
  'purchasePrice',
  'currentValue',
  'categoryId',
  'serialNumber',
]);

const FIELD_LABELS: Record<string, string> = {
  assetName: '资产名称',
  assetCode: '资产编码',
  status: '资产状态',
  locationId: '存放地点',
  custodianId: '保管人',
  departmentId: '所属部门',
  purchasePrice: '购置价格',
  currentValue: '当前价值',
  categoryId: '资产分类',
  serialNumber: '序列号',
  purchaseDate: '购置日期',
  manufacturer: '制造商',
  model: '型号',
  description: '描述',
};

function getAuditableHighlight(
  fieldName: string
): { isAuditable: boolean; style: React.CSSProperties; className: string } {
  const isField = AUDITABLE_FIELDS.has(fieldName);
  return {
    isAuditable: isField,
    style: isField
      ? { backgroundColor: 'rgba(250, 140, 22, 0.08)', borderLeft: '3px solid #fa8c16' }
      : {},
    className: isField ? 'auditable-field-highlight' : '',
  };
}

function getHighlightBadge(
  fieldName: string
): { text: string; color: string; visible: boolean } {
  const isField = AUDITABLE_FIELDS.has(fieldName);
  return {
    text: isField ? '@Auditable' : '',
    color: '#fa8c16',
    visible: isField,
  };
}

function getHighlightStyle(fieldName: string): React.CSSProperties | undefined {
  if (!AUDITABLE_FIELDS.has(fieldName)) return undefined;
  return {
    backgroundColor: 'rgba(250, 140, 22, 0.06)',
    borderLeft: '3px solid #fa8c16',
    paddingLeft: 8,
  };
}

function isAuditable(fieldName: string): boolean {
  return AUDITABLE_FIELDS.has(fieldName);
}

function formatFieldChange(
  fieldName: string,
  oldValue: unknown,
  newValue: unknown
): { label: string; oldDisplay: string; newDisplay: string } {
  const label = FIELD_LABELS[fieldName] || fieldName;
  const oldDisplay = oldValue != null ? String(oldValue) : '-';
  const newDisplay = newValue != null ? String(newValue) : '-';
  return { label, oldDisplay, newDisplay };
}

export function useAuditableFields() {
  const memoizedGetAuditableHighlight = useCallback(getAuditableHighlight, []);
  const memoizedGetHighlightBadge = useCallback(getHighlightBadge, []);
  const memoizedGetHighlightStyle = useCallback(getHighlightStyle, []);
  const memoizedIsAuditable = useCallback(isAuditable, []);
  const memoizedFormatFieldChange = useCallback(formatFieldChange, []);

  return useMemo(
    () => ({
      getAuditableHighlight: memoizedGetAuditableHighlight,
      getHighlightBadge: memoizedGetHighlightBadge,
      getHighlightStyle: memoizedGetHighlightStyle,
      isAuditable: memoizedIsAuditable,
      formatFieldChange: memoizedFormatFieldChange,
    }),
    [
      memoizedGetAuditableHighlight,
      memoizedGetHighlightBadge,
      memoizedGetHighlightStyle,
      memoizedIsAuditable,
      memoizedFormatFieldChange,
    ]
  );
}

export default useAuditableFields;
