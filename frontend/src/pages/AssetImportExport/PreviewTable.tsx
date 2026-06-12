/**
 * PreviewTable – 解析预览表格组件
 *
 * 职责：
 * 1. 渲染后端返回的 Excel 解析结果预览表格
 * 2. 对校验失败的行添加 `row-error` 样式类并高亮
 * 3. 支持错误单元格的内联编辑（修正后可重新提交）
 * 4. 数据量超过 1000 行时自动切换为虚拟列表渲染（react-window）
 * 5. 提供重新提交与删除错误行操作
 */
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Table, Button, Tag, Space, Tooltip, Popconfirm, Input, Typography, Statistic, Row, Col, Card } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  WarningOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { FixedSizeList as FixedList } from 'react-window';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 单行错误信息 */
export interface CellError {
  /** 出错字段名（对应 data 中 key） */
  field: string;
  /** 后端返回的具体错误原因文本 */
  message: string;
}

/** 单行数据（通用 map 结构） */
export type PreviewRow = Record<string, unknown> & { _rowKey: string };

/** 错误映射：key → 该行所有字段错误 */
export type ErrorMap = Record<string, CellError[]>;

/** 组件 Props */
export interface PreviewTableProps {
  /** 解析后的行数据 */
  data: PreviewRow[];
  /** 列定义（与 antd Table Column 一致，额外支持 editable 标记） */
  columns: PreviewColumn[];
  /** 行级错误映射 */
  errors: ErrorMap;
  /** 总行数 */
  totalRows: number;
  /** 合法行数 */
  validCount: number;
  /** 非法行数 */
  invalidCount: number;
  /** 是否正在提交 */
  submitting?: boolean;
  /** 行内修正回调 → 返回更新后的完整 data 数组 */
  onFieldChange?: (rowKey: string, field: string, value: string) => void;
  /** 重新提交回调（传入修正后的数据） */
  onResubmit?: (correctedData: PreviewRow[]) => void;
  /** 删除行回调 */
  onRemoveRow?: (rowKey: string) => void;
  /** 全部清空回调 */
  onClear?: () => void;
}

/** 扩展列定义 */
export interface PreviewColumn {
  title: string;
  dataIndex: string;
  key?: string;
  width?: number | string;
  editable?: boolean;
  render?: (value: unknown, record: PreviewRow, index: number) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 超过此阈值启用虚拟列表 */
const VIRTUAL_LIST_THRESHOLD = 1000;

/** 虚拟列表行高 (px) */
const VIRTUAL_ROW_HEIGHT = 48;

/** 虚拟列表可视区高度 (px) */
const VIRTUAL_LIST_HEIGHT = 600;

// ---------------------------------------------------------------------------
// EditableCell – 可编辑单元格（用于修正错误值）
// ---------------------------------------------------------------------------

interface EditableCellProps {
  /** 当前值 */
  value: string;
  /** 所属行 key */
  rowKey: string;
  /** 字段名 */
  field: string;
  /** 是否有错误 */
  hasError: boolean;
  /** 错误信息 */
  errorMessage?: string;
  /** 值变更回调 */
  onChange: (rowKey: string, field: string, value: string) => void;
}

/**
 * 可编辑单元格组件，支持点击进入编辑态、输入修正值、失焦或回车确认。
 */
const EditableCell: React.FC<EditableCellProps> = ({
  value,
  rowKey,
  field,
  hasError,
  errorMessage,
  onChange,
}) => {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  /** 进入编辑态时自动聚焦 */
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  /** 同步外部 value 变化（如父组件刷新数据） */
  useEffect(() => {
    setInputValue(String(value ?? ''));
  }, [value]);

  const confirm = useCallback(() => {
    setEditing(false);
    if (inputValue !== String(value ?? '')) {
      onChange(rowKey, field, inputValue);
    }
  }, [inputValue, onChange, rowKey, field, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        confirm();
      } else if (e.key === 'Escape') {
        setInputValue(String(value ?? ''));
        setEditing(false);
      }
    },
    [confirm, value],
  );

  if (editing) {
    return (
      <Input
        ref={inputRef as any}
        size="small"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={confirm}
        onKeyDown={handleKeyDown}
        style={{ width: '100%' }}
        status={hasError ? 'error' : undefined}
        aria-label={`编辑 ${field}`}
      />
    );
  }

  return (
    <Tooltip title={hasError ? errorMessage : '点击编辑'}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setEditing(true);
        }}
        style={{
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          minHeight: 24,
          padding: '0 4px',
          borderRadius: 4,
          border: hasError ? '1px solid #ff4d4f' : '1px solid transparent',
          backgroundColor: hasError ? '#fff1f0' : 'transparent',
        }}
      >
        {hasError && <WarningOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />}
        <span style={{ color: hasError ? '#ff4d4f' : undefined, fontSize: 13 }}>
          {value != null && value !== '' ? String(value) : <em style={{ color: '#bfbfbf' }}>空</em>}
        </span>
        <EditOutlined style={{ fontSize: 10, color: '#999', marginLeft: 'auto' }} />
      </div>
    </Tooltip>
  );
};

// ---------------------------------------------------------------------------
// VirtualPreviewList – 虚拟列表渲染（>1000 行时使用）
// ---------------------------------------------------------------------------

interface VirtualPreviewListProps {
  data: PreviewRow[];
  columns: PreviewColumn[];
  errors: ErrorMap;
  onFieldChange?: (rowKey: string, field: string, value: string) => void;
  onRemoveRow?: (rowKey: string) => void;
  rowHeight?: number;
  listHeight?: number;
}

/**
 * 虚拟滚动预览列表，使用 react-window 的 FixedSizeList 进行渲染。
 * 仅渲染可视区内的行，保证大数据量下的流畅交互。
 */
const VirtualPreviewList: React.FC<VirtualPreviewListProps> = ({
  data,
  columns,
  errors,
  onFieldChange,
  onRemoveRow,
  rowHeight = VIRTUAL_ROW_HEIGHT,
  listHeight = VIRTUAL_LIST_HEIGHT,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** 计算每列像素宽度（无 width 的列均分剩余空间） */
  const colWidths = useMemo(() => {
    const specified = columns.filter((c) => c.width != null);
    const unspecified = columns.filter((c) => c.width == null);
    const specifiedTotal = specified.reduce((acc, c) => acc + Number(c.width), 0);
    const remaining = Math.max(containerWidth - specifiedTotal - 60, unspecified.length * 120); // 60 for row-key col
    const perUnspecified = unspecified.length > 0 ? remaining / unspecified.length : 120;
    return columns.map((c) => (c.width != null ? Number(c.width) : perUnspecified));
  }, [columns, containerWidth]);

  const rowKeyWidth = 60;
  const totalWidth = rowKeyWidth + colWidths.reduce((a, b) => a + b, 0);

  /**
   * 渲染虚拟列表中的单行。
   * 错误行通过 className="row-error" 标记（满足 ATB 验收条件）。
   */
  const RowRenderer = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const row = data[index];
      if (!row) return null;
      const rowKey = row._rowKey;
      const rowErrors = errors[rowKey] ?? [];
      const isError = rowErrors.length > 0;

      return (
        <div
          style={{ ...style, display: 'flex', alignItems: 'center' }}
          className={isError ? 'row-error' : undefined}
          data-row-key={rowKey}
          data-row-index={index}
        >
          {/* 序号列 */}
          <div
            style={{
              width: rowKeyWidth,
              minWidth: rowKeyWidth,
              padding: '0 8px',
              textAlign: 'center',
              fontSize: 12,
              color: '#666',
              borderRight: '1px solid #f0f0f0',
              flexShrink: 0,
            }}
          >
            {isError ? (
              <Tooltip title={rowErrors.map((e) => e.message).join('; ')}>
                <WarningOutlined style={{ color: '#ff4d4f' }} />
              </Tooltip>
            ) : (
              index + 2
            )}
          </div>

          {/* 数据列 */}
          {columns.map((col, colIdx) => {
            const cellError = rowErrors.find((e) => e.field === col.dataIndex);
            const cellValue = row[col.dataIndex];
            return (
              <div
                key={col.dataIndex}
                style={{
                  width: colWidths[colIdx],
                  minWidth: colWidths[colIdx],
                  padding: '0 8px',
                  fontSize: 13,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  borderRight: colIdx < columns.length - 1 ? '1px solid #f0f0f0' : undefined,
                  backgroundColor: cellError ? '#fff1f0' : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
                title={cellError?.message ?? String(cellValue ?? '')}
              >
                {col.editable && onFieldChange ? (
                  <EditableCell
                    value={String(cellValue ?? '')}
                    rowKey={rowKey}
                    field={col.dataIndex}
                    hasError={!!cellError}
                    errorMessage={cellError?.message}
                    onChange={onFieldChange}
                  />
                ) : (
                  <>
                    {cellError && (
                      <Tooltip title={cellError.message}>
                        <WarningOutlined style={{ color: '#ff4d4f', marginRight: 4, fontSize: 12 }} />
                      </Tooltip>
                    )}
                    {col.render
                      ? col.render(cellValue, row, index)
                      : cellValue != null
                        ? String(cellValue)
                        : '-'}
                  </>
                )}
              </div>
            );
          })}

          {/* 操作列 */}
          {onRemoveRow && isError && (
            <div style={{ width: 50, minWidth: 50, textAlign: 'center', flexShrink: 0 }}>
              <Popconfirm
                title="确认删除此行？"
                onConfirm={() => onRemoveRow(rowKey)}
                okText="删除"
                cancelText="取消"
              >
                <Button type="link" danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            </div>
          )}
        </div>
      );
    },
    [data, columns, colWidths, errors, onFieldChange, onRemoveRow, rowKeyWidth],
  );

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {/* 表头 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          borderBottom: '2px solid #e8e8e8',
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        <div
          style={{
            width: rowKeyWidth,
            minWidth: rowKeyWidth,
            padding: '10px 8px',
            textAlign: 'center',
            borderRight: '1px solid #f0f0f0',
            flexShrink: 0,
          }}
        >
          行号
        </div>
        {columns.map((col, idx) => (
          <div
            key={col.dataIndex}
            style={{
              width: colWidths[idx],
              minWidth: colWidths[idx],
              padding: '10px 8px',
              borderRight: idx < columns.length - 1 ? '1px solid #f0f0f0' : undefined,
              flexShrink: 0,
            }}
          >
            {col.title}
          </div>
        ))}
        {onRemoveRow && (
          <div style={{ width: 50, minWidth: 50, textAlign: 'center', flexShrink: 0 }}>
            操作
          </div>
        )}
      </div>

      {/* 虚拟列表主体 */}
      <FixedList
        height={listHeight}
        itemCount={data.length}
        itemSize={rowHeight}
        width={totalWidth}
        overscanCount={5}
      >
        {RowRenderer}
      </FixedList>
    </div>
  );
};

// ---------------------------------------------------------------------------
// PreviewTable 主组件
// ---------------------------------------------------------------------------

/**
 * 资产导入解析预览表格。
 *
 * - 渲染后端解析结果，对错误行添加 `row-error` CSS 类名高亮。
 * - 错误单元格可内联编辑，修正后触发 `onFieldChange` 回调。
 * - 数据量超过 1000 行时自动切换虚拟列表渲染，防止 DOM 节点爆炸。
 * - 提供重新提交与删除错误行的操作入口。
 */
const PreviewTable: React.FC<PreviewTableProps> = ({
  data,
  columns,
  errors,
  totalRows,
  validCount,
  invalidCount,
  submitting = false,
  onFieldChange,
  onResubmit,
  onRemoveRow,
  onClear,
}) => {
  const useVirtual = data.length > VIRTUAL_LIST_THRESHOLD;

  /** 是否还有未修正的错误行 */
  const hasErrors = invalidCount > 0;

  // -----------------------------------------------------------------------
  // antd Table 列定义（含错误高亮 + 内联编辑）
  // -----------------------------------------------------------------------

  const tableColumns: ColumnsType<PreviewRow> = useMemo(() => {
    const base: ColumnsType<PreviewRow> = [
      {
        title: '行号',
        key: '_rowIndex',
        width: 70,
        align: 'center',
        render: (_: unknown, __: PreviewRow, idx: number) => idx + 2, // Excel 行号（含表头）
      },
      ...columns.map((col) => ({
        title: col.title,
        dataIndex: col.dataIndex,
        key: col.key ?? col.dataIndex,
        width: col.width,
        render: (value: unknown, record: PreviewRow, idx: number) => {
          const rowErrors = errors[record._rowKey] ?? [];
          const cellError = rowErrors.find((e) => e.field === col.dataIndex);

          if (col.editable && onFieldChange) {
            return (
              <EditableCell
                value={String(value ?? '')}
                rowKey={record._rowKey}
                field={col.dataIndex}
                hasError={!!cellError}
                errorMessage={cellError?.message}
                onChange={onFieldChange}
              />
            );
          }

          return (
            <span>
              {cellError && (
                <Tooltip title={cellError.message}>
                  <WarningOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
                </Tooltip>
              )}
              {col.render ? col.render(value, record, idx) : value != null ? String(value) : '-'}
            </span>
          );
        },
      })),
    ];

    if (onRemoveRow) {
      base.push({
        title: '操作',
        key: '_actions',
        width: 80,
        align: 'center',
        render: (_: unknown, record: PreviewRow) => {
          const rowErrors = errors[record._rowKey] ?? [];
          if (rowErrors.length === 0) return null;
          return (
            <Popconfirm
              title="确认删除此错误行？"
              onConfirm={() => onRemoveRow(record._rowKey)}
              okText="删除"
              cancelText="取消"
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          );
        },
      });
    }

    return base;
  }, [columns, errors, onFieldChange, onRemoveRow]);

  // -----------------------------------------------------------------------
  // antd Table rowClassName – 为错误行添加 `row-error` 类名
  // -----------------------------------------------------------------------

  const getRowClassName = useCallback(
    (record: PreviewRow): string => {
      const rowErrors = errors[record._rowKey];
      return rowErrors && rowErrors.length > 0 ? 'row-error' : '';
    },
    [errors],
  );

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  /** 重新提交（将当前 data 数组传回父组件） */
  const handleResubmit = useCallback(() => {
    if (onResubmit) {
      onResubmit(data);
    }
  }, [onResubmit, data]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="preview-table-container" data-testid="preview-table">
      {/* ---- 统计摘要 ---- */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Statistic
              title="总行数"
              value={totalRows}
              prefix={<Typography.Text type="secondary">共</Typography.Text>}
              suffix="行"
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="合法行"
              value={validCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
              suffix="行"
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="错误行"
              value={invalidCount}
              valueStyle={{ color: hasErrors ? '#ff4d4f' : '#52c41a' }}
              prefix={hasErrors ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              suffix="行"
            />
          </Col>
        </Row>
      </Card>

      {/* ---- 操作栏 ---- */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          {hasErrors && (
            <Tag color="error" data-testid="error-badge">
              <WarningOutlined /> {invalidCount} 行存在错误，请修正后重新提交
            </Tag>
          )}
          {!hasErrors && validCount > 0 && (
            <Tag color="success" data-testid="success-badge">
              <CheckCircleOutlined /> 所有数据校验通过
            </Tag>
          )}
          {useVirtual && (
            <Tag color="blue" data-testid="virtual-mode-tag">
              虚拟列表模式（{data.length} 行）
            </Tag>
          )}
        </Space>
        <Space>
          {onClear && (
            <Button icon={<UndoOutlined />} onClick={onClear} disabled={submitting}>
              清空预览
            </Button>
          )}
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={submitting}
            disabled={hasErrors || submitting || data.length === 0}
            onClick={handleResubmit}
            data-testid="resubmit-btn"
          >
            {hasErrors ? `修正 ${invalidCount} 行错误后提交` : `确认提交 ${validCount} 条数据`}
          </Button>
        </Space>
      </div>

      {/* ---- 表格主体 ---- */}
      {useVirtual ? (
        <VirtualPreviewList
          data={data}
          columns={columns}
          errors={errors}
          onFieldChange={onFieldChange}
          onRemoveRow={onRemoveRow}
        />
      ) : (
        <Table<PreviewRow>
          dataSource={data}
          columns={tableColumns}
          rowKey="_rowKey"
          rowClassName={getRowClassName}
          pagination={
            data.length > 50
              ? {
                  pageSize: 50,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 行`,
                  pageSizeOptions: ['50', '100', '200'],
                }
              : false
          }
          scroll={{ x: 'max-content', y: 480 }}
          bordered
          size="small"
          loading={submitting}
          locale={{ emptyText: '暂无预览数据' }}
        />
      )}

      {/* ---- 底部错误详情汇总 ---- */}
      {hasErrors && (
        <Card
          size="small"
          title={
            <span style={{ color: '#ff4d4f' }}>
              <WarningOutlined /> 错误详情
            </span>
          }
          style={{ marginTop: 16 }}
        >
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {Object.entries(errors).map(([rowKey, cellErrors]) => {
              const rowIndex = data.findIndex((r) => r._rowKey === rowKey);
              return (
                <li key={rowKey} style={{ marginBottom: 4 }}>
                  <Typography.Text strong style={{ color: '#ff4d4f' }}>
                    第 {rowIndex + 2} 行：
                  </Typography.Text>
                  {cellErrors.map((ce, i) => (
                    <Typography.Text key={i} type="secondary" style={{ marginLeft: 8 }}>
                      [{ce.field}] {ce.message}
                    </Typography.Text>
                  ))}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
};

export default PreviewTable;
