/**
 * ParsePreviewTable — 解析结果预览表格组件
 *
 * 对应 spec [SWARM-P2-006-FE] FE-5（解析结果预览表格）+ FE-6（行级校验高亮与修正）
 * Layer 2.4 + Layer 2.5
 *
 * 功能特性：
 * - 展示 Excel 解析后的资产数据（Ant Design Table）
 * - 校验失败行背景色 #FFF2F0，校验通过行背景色 #F6FFED
 * - 仅校验失败行的字段可编辑（蓝色下划线标识）
 * - 编辑后实时移除该单元格错误提示
 * - 已修正行标记为橙色「已修正」Tag
 * - 默认每页 20 行，支持分页
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Table, Input, InputNumber, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';

/* ------------------------------------------------------------------ */
/*  类型定义（对齐 spec 数据约束）                                      */
/* ------------------------------------------------------------------ */

/** 资产行数据，对应 spec AssetRow 结构 */
export interface AssetRow {
  rowNumber: number;
  name: string;
  categoryCode: string;
  statusCode: string;
  locationCode: string;
  purchaseDate: string;
  originalValue: number;
  [key: string]: unknown;
}

/** 行级校验错误，对应 spec RowError 结构 */
export interface RowError {
  rowNumber: number;
  field: string;
  message: string;
}

/** ParsePreviewTable 组件属性 */
export interface ParsePreviewTableProps {
  /** 解析返回的行数据 */
  rows: AssetRow[];
  /** 解析返回的校验错误列表 */
  errors: RowError[];
  /** 是否加载中 */
  loading?: boolean;
  /** 数据变更回调，返回修正后的全部行数据和剩余错误 */
  onDataChange?: (updatedRows: AssetRow[], remainingErrors: RowError[]) => void;
}

/* ------------------------------------------------------------------ */
/*  字段类型映射（用于选择正确的编辑控件）                                */
/* ------------------------------------------------------------------ */

type FieldType = 'text' | 'number';

const FIELD_TYPE_MAP: Record<string, FieldType> = {
  name: 'text',
  categoryCode: 'text',
  statusCode: 'text',
  locationCode: 'text',
  purchaseDate: 'text',
  originalValue: 'number',
};

/* ------------------------------------------------------------------ */
/*  表格列定义                                                         */
/* ------------------------------------------------------------------ */

const TABLE_COLUMNS_CONFIG: ReadonlyArray<{
  title: string;
  dataIndex: string;
  key: string;
  width: number;
}> = [
  { title: '序号', dataIndex: 'rowNumber', key: 'rowNumber', width: 70 },
  { title: '资产名称', dataIndex: 'name', key: 'name', width: 160 },
  { title: '分类', dataIndex: 'categoryCode', key: 'categoryCode', width: 120 },
  { title: '状态', dataIndex: 'statusCode', key: 'statusCode', width: 100 },
  { title: '位置', dataIndex: 'locationCode', key: 'locationCode', width: 120 },
  { title: '购置日期', dataIndex: 'purchaseDate', key: 'purchaseDate', width: 130 },
  { title: '原值', dataIndex: 'originalValue', key: 'originalValue', width: 120 },
];

/* ------------------------------------------------------------------ */
/*  EditableCell — 可编辑单元格组件                                     */
/*  仅校验失败行的单元格可编辑，点击后切换为 Input，失焦确认编辑          */
/* ------------------------------------------------------------------ */

interface EditableCellProps {
  /** 当前单元格值 */
  value: unknown;
  /** 字段类型，决定使用 Input 还是 InputNumber */
  fieldType: FieldType;
  /** 是否可编辑（仅校验失败行为 true） */
  editable: boolean;
  /** 错误提示文案 */
  error?: string;
  /** 值变更回调 */
  onChange: (value: unknown) => void;
}

const EditableCell: React.FC<EditableCellProps> = React.memo(
  ({ value, fieldType, editable, error, onChange }) => {
    const [editing, setEditing] = useState(false);
    const [inputValue, setInputValue] = useState<string>(
      value != null ? String(value) : ''
    );

    /** 进入编辑模式 */
    const startEditing = useCallback(() => {
      if (!editable) return;
      setEditing(true);
      setInputValue(value != null ? String(value) : '');
    }, [editable, value]);

    /** 确认编辑，将值写回 */
    const confirmEdit = useCallback(() => {
      setEditing(false);
      const finalValue: unknown =
        fieldType === 'number'
          ? inputValue === ''
            ? 0
            : Number(inputValue)
          : inputValue;
      onChange(finalValue);
    }, [inputValue, fieldType, onChange]);

    /* ---- 非编辑模式 ---- */
    if (!editing) {
      return (
        <div>
          {editable ? (
            <span
              role="button"
              tabIndex={0}
              onClick={startEditing}
              onKeyDown={(e) => {
                if (e.key === 'Enter') startEditing();
              }}
              style={{
                borderBottom: '1px solid #1677ff',
                cursor: 'pointer',
                padding: '1px 2px',
                display: 'inline-block',
                minWidth: 40,
                outline: 'none',
              }}
            >
              {value != null ? String(value) : '-'}
            </span>
          ) : (
            <span>{value != null ? String(value) : '-'}</span>
          )}
          {error && (
            <div
              style={{
                color: '#ff4d4f',
                fontSize: 12,
                lineHeight: '18px',
                marginTop: 2,
              }}
            >
              {error}
            </div>
          )}
        </div>
      );
    }

    /* ---- 编辑模式 ---- */
    return (
      <div>
        {fieldType === 'number' ? (
          <InputNumber
            size="small"
            value={inputValue === '' ? undefined : Number(inputValue)}
            onChange={(val) => setInputValue(val != null ? String(val) : '')}
            onBlur={confirmEdit}
            onPressEnter={confirmEdit}
            autoFocus
            style={{ width: '100%' }}
            status={error ? 'error' : undefined}
          />
        ) : (
          <Input
            size="small"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={confirmEdit}
            onPressEnter={confirmEdit}
            autoFocus
            style={{ width: '100%' }}
            status={error ? 'error' : undefined}
          />
        )}
        {error && (
          <div
            style={{
              color: '#ff4d4f',
              fontSize: 12,
              lineHeight: '18px',
              marginTop: 2,
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  },
);

EditableCell.displayName = 'EditableCell';

/* ------------------------------------------------------------------ */
/*  ParsePreviewTable — 主组件                                         */
/* ------------------------------------------------------------------ */

const ParsePreviewTable: React.FC<ParsePreviewTableProps> = ({
  rows,
  errors,
  loading = false,
  onDataChange,
}) => {
  /* ---- 内部编辑状态 ---- */

  /** 编辑后的行数据快照：rowNumber → AssetRow */
  const [editedRows, setEditedRows] = useState<Record<number, AssetRow>>({});

  /** 已被用户修正而清除的错误 key 集合：`${rowNumber}-${field}` → true */
  const [clearedErrors, setClearedErrors] = useState<Record<string, boolean>>({});

  /** 标记为「已修正」的行：rowNumber → true */
  const [correctedRows, setCorrectedRows] = useState<Record<number, boolean>>({});

  /* ---- 派生查询 ---- */

  /** 某行是否曾有过校验错误（决定该行单元格是否可编辑） */
  const rowHasOriginalErrors = useCallback(
    (rowNumber: number): boolean =>
      errors.some((e) => e.rowNumber === rowNumber),
    [errors],
  );

  /** 获取某行当前尚未清除的错误列表 */
  const getActiveRowErrors = useCallback(
    (rowNumber: number): RowError[] =>
      errors.filter(
        (e) =>
          e.rowNumber === rowNumber &&
          !clearedErrors[`${rowNumber}-${e.field}`],
      ),
    [errors, clearedErrors],
  );

  /** 获取某行的最新数据（合并用户编辑） */
  const getRowData = useCallback(
    (row: AssetRow): AssetRow => editedRows[row.rowNumber] ?? row,
    [editedRows],
  );

  /* ---- 事件处理 ---- */

  /** 单元格值变更处理 */
  const handleCellChange = useCallback(
    (rowNumber: number, field: string, value: unknown) => {
      const originalRow = rows.find((r) => r.rowNumber === rowNumber);
      if (!originalRow) return;

      const currentRowData = editedRows[rowNumber] ?? { ...originalRow };
      const updatedRow: AssetRow = { ...currentRowData, [field]: value };

      // 更新编辑快照
      setEditedRows((prev) => ({ ...prev, [rowNumber]: updatedRow }));

      // 清除该字段的错误标记
      const errorKey = `${rowNumber}-${field}`;
      setClearedErrors((prev) => ({ ...prev, [errorKey]: true }));

      // 标记该行为「已修正」
      setCorrectedRows((prev) => ({ ...prev, [rowNumber]: true }));

      // 通知父组件最新的全量数据
      if (onDataChange) {
        const allUpdatedRows = rows.map((r) => {
          if (r.rowNumber === rowNumber) return updatedRow;
          return editedRows[r.rowNumber] ?? r;
        });
        const remainingErrors = errors.filter(
          (e) =>
            !clearedErrors[`${e.rowNumber}-${e.field}`] &&
            !(e.rowNumber === rowNumber && e.field === field),
        );
        onDataChange(allUpdatedRows, remainingErrors);
      }
    },
    [rows, errors, editedRows, clearedErrors, onDataChange],
  );

  /* ---- 列定义 ---- */

  const columns: ColumnsType<AssetRow> = useMemo(
    () => [
      ...TABLE_COLUMNS_CONFIG.map((col) => ({
        title: col.title,
        dataIndex: col.dataIndex as keyof AssetRow,
        key: col.key,
        width: col.width,
        render: (_: unknown, record: AssetRow) => {
          const rowData = getRowData(record);
          const cellValue = rowData[col.dataIndex];
          const activeErrors = getActiveRowErrors(record.rowNumber);
          const fieldError = activeErrors.find((e) => e.field === col.dataIndex);
          const hadErrors = rowHasOriginalErrors(record.rowNumber);
          const isEditable = col.dataIndex !== 'rowNumber' && hadErrors;
          const fieldType: FieldType =
            FIELD_TYPE_MAP[col.dataIndex] ?? 'text';

          return (
            <EditableCell
              value={cellValue}
              fieldType={fieldType}
              editable={isEditable}
              error={fieldError?.message}
              onChange={(val: unknown) =>
                handleCellChange(record.rowNumber, col.dataIndex, val)
              }
            />
          );
        },
      })),
      {
        title: '校验状态',
        key: '__validation_status__',
        width: 100,
        fixed: 'right' as const,
        render: (_: unknown, record: AssetRow) => {
          const activeErrors = getActiveRowErrors(record.rowNumber);
          const hadErrors = rowHasOriginalErrors(record.rowNumber);
          const isCorrected = correctedRows[record.rowNumber];

          if (hadErrors && activeErrors.length > 0) {
            return <Tag color="error">校验失败</Tag>;
          }
          if (isCorrected) {
            return <Tag color="warning">已修正</Tag>;
          }
          return <Tag color="success">通过</Tag>;
        },
      },
    ],
    [
      getRowData,
      getActiveRowErrors,
      rowHasOriginalErrors,
      correctedRows,
      handleCellChange,
    ],
  );

  /* ---- 行样式（根据校验状态设置背景色） ---- */

  const onRow = useCallback(
    (record: AssetRow) => {
      const activeErrors = getActiveRowErrors(record.rowNumber);
      const hadErrors = rowHasOriginalErrors(record.rowNumber);
      const isCorrected = correctedRows[record.rowNumber];

      let backgroundColor: string;
      if (hadErrors && activeErrors.length > 0) {
        backgroundColor = '#FFF2F0'; // 校验失败行（spec ATB-009）
      } else if (isCorrected) {
        backgroundColor = '#FFF7E6'; // 已修正行（橙色标记，spec ATB-010）
      } else {
        backgroundColor = '#F6FFED'; // 校验通过行（spec ATB-009）
      }

      return { style: { backgroundColor } };
    },
    [getActiveRowErrors, rowHasOriginalErrors, correctedRows],
  );

  /* ---- 渲染 ---- */

  return (
    <Table<AssetRow>
      dataSource={rows}
      columns={columns}
      loading={loading}
      rowKey="rowNumber"
      pagination={{
        pageSize: 20,
        showTotal: (total: number) => `共 ${total} 条`,
        showSizeChanger: false,
      }}
      onRow={onRow}
      scroll={{ x: 940 }}
      size="small"
      bordered
    />
  );
};

export default ParsePreviewTable;