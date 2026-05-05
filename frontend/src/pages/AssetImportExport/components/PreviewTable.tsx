/**
 * PreviewTable – Renders parsed Excel import data with error highlighting,
 * inline cell editing for error correction, and virtual scrolling for
 * datasets exceeding 1 000 rows.
 *
 * SPEC compliance:
 *  - Error rows carry `class="row-error"` for Playwright targeting (ATB-3).
 *  - Error cells are editable <input> elements displaying backend error messages.
 *  - Virtual list activated when row count > 1 000 (performance constraint).
 *  - "重新提交" button sends corrected data back to the backend.
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

/* ------------------------------------------------------------------ */
/*  Public type definitions                                           */
/* ------------------------------------------------------------------ */

/** A single parsed row returned by the backend parse endpoint. */
export interface ParsedRow {
  /** Zero-based row index in the original Excel sheet. */
  rowIndex: number;
  /** Field → value map, e.g. `{ name: 'Laptop', status: '在用' }`. */
  data: Record<string, string>;
}

/** A field-level validation error produced by the backend. */
export interface RowError {
  /** The field key that failed validation. */
  field: string;
  /** Human-readable error reason (shown verbatim in the cell). */
  message: string;
}

/** Error map keyed by row index (`rowIndex → RowError[]`). */
export type ErrorMap = Record<number, RowError[]>;

/** Column descriptor for the preview table. */
export interface PreviewColumn {
  /** Unique key matching a field in `ParsedRow.data`. */
  key: string;
  /** Header label displayed to the user. */
  title: string;
  /** Optional fixed column width in pixels. */
  width?: number;
}

/* ------------------------------------------------------------------ */
/*  Component props                                                   */
/* ------------------------------------------------------------------ */

interface PreviewTableProps {
  /** Parsed rows from the backend response. */
  rows: ParsedRow[];
  /** Column definitions controlling which fields are rendered. */
  columns: PreviewColumn[];
  /** Per-row field-level errors keyed by `rowIndex`. */
  errorMap: ErrorMap;
  /** Whether the table is in a loading / parsing state. */
  loading?: boolean;
  /** Fired when the user clicks "重新提交" with corrected data. */
  onResubmit: (correctedRows: ParsedRow[], updatedErrorMap: ErrorMap) => void;
  /** Optional callback to exclude / remove an error row entirely. */
  onRemoveRow?: (rowIndex: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

/** Row count above which virtual scrolling is activated (SPEC: 1 000). */
const VIRTUAL_THRESHOLD = 1000;

/** Fixed pixel height of each table row (used by virtual list math). */
const ROW_HEIGHT = 48;

/** Visible viewport height for the scroll container. */
const VIEWPORT_HEIGHT = 600;

/* ------------------------------------------------------------------ */
/*  Reusable style objects                                            */
/* ------------------------------------------------------------------ */

const thStyle: React.CSSProperties = {
  padding: '10px 8px',
  borderBottom: '2px solid #e8e8e8',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 13,
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  background: '#fafafa',
  zIndex: 2,
};

const tdStyle: React.CSSProperties = {
  padding: '8px',
  borderBottom: '1px solid #f0f0f0',
  verticalAlign: 'top',
  fontSize: 13,
};

const errorInputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #ff4d4f',
  borderRadius: 4,
  padding: '4px 8px',
  backgroundColor: '#fff',
  fontSize: 13,
  outline: 'none',
};

const alertBoxStyle: React.CSSProperties = {
  backgroundColor: '#fff7e6',
  border: '1px solid #ffd591',
  borderRadius: 4,
  padding: '10px 16px',
  marginBottom: 12,
  color: '#d46b08',
  fontSize: 14,
  lineHeight: 1.5,
};

const resubmitBtnBase: React.CSSProperties = {
  padding: '6px 20px',
  border: 'none',
  borderRadius: 4,
  fontSize: 14,
  fontWeight: 500,
  transition: 'background-color 0.2s',
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

/**
 * PreviewTable renders parsed import data with error highlighting,
 * inline editing for correction, and virtual scrolling for large datasets.
 *
 * @param props - See {@link PreviewTableProps}.
 */
const PreviewTable: React.FC<PreviewTableProps> = ({
  rows,
  columns,
  errorMap,
  loading = false,
  onResubmit,
  onRemoveRow,
}) => {
  /* ---- state ---- */
  /** Tracks user edits: `"rowIndex:field" → newValue`. */
  const [editedCells, setEditedCells] = useState<Record<string, string>>({});
  /** Current scroll offset used to compute the virtual window. */
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ---- derived values ---- */
  const useVirtual = rows.length > VIRTUAL_THRESHOLD;

  /** Count of rows that carry at least one validation error. */
  const errorRowCount = useMemo(
    () => rows.filter((r) => (errorMap[r.rowIndex] || []).length > 0).length,
    [rows, errorMap],
  );
  const hasErrors = errorRowCount > 0;

  /* ---- helpers ---- */

  /**
   * Resolve the current display value for a cell, preferring the user's
   * inline edit over the original parsed value.
   */
  const getCellValue = useCallback(
    (row: ParsedRow, field: string): string => {
      const key = `${row.rowIndex}:${field}`;
      return key in editedCells ? editedCells[key] : (row.data[field] ?? '');
    },
    [editedCells],
  );

  /** Persist an inline edit made by the user. */
  const handleCellEdit = useCallback(
    (rowIndex: number, field: string, value: string) => {
      setEditedCells((prev) => ({ ...prev, [`${rowIndex}:${field}`]: value }));
    },
    [],
  );

  /**
   * Collect all edited rows and remaining (non-edited) errors, then
   * invoke the parent's `onResubmit` callback.
   */
  const handleResubmit = useCallback(() => {
    const correctedRows: ParsedRow[] = rows.map((row) => {
      const newData = { ...row.data };
      columns.forEach((col) => {
        const editKey = `${row.rowIndex}:${col.key}`;
        if (editKey in editedCells) {
          newData[col.key] = editedCells[editKey];
        }
      });
      return { ...row, data: newData };
    });

    // Only keep errors for fields the user has NOT edited.
    const remainingErrors: ErrorMap = {};
    Object.entries(errorMap).forEach(([idx, errors]) => {
      const ri = Number(idx);
      const stillFailing = errors.filter(
        (e) => !(`${ri}:${e.field}` in editedCells),
      );
      if (stillFailing.length > 0) {
        remainingErrors[ri] = stillFailing;
      }
    });

    onResubmit(correctedRows, remainingErrors);
  }, [rows, columns, editedCells, errorMap, onResubmit]);

  /** Reset local edits when the upstream rows change. */
  useEffect(() => {
    setEditedCells({});
  }, [rows]);

  /* ---- virtual-list math ---- */
  const overscan = 5;
  const startIdx = useVirtual
    ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - overscan)
    : 0;
  const endIdx = useVirtual
    ? Math.min(
        rows.length,
        Math.floor(scrollTop / ROW_HEIGHT) +
          Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) +
          overscan,
      )
    : rows.length;
  const visibleRows = useVirtual ? rows.slice(startIdx, endIdx) : rows;
  const colSpan = columns.length + (onRemoveRow ? 2 : 1);

  /* ---- row / cell renderers ---- */

  /** Render the static table header row. */
  const renderHeader = () => (
    <tr>
      <th style={thStyle}>#</th>
      {columns.map((col) => (
        <th key={col.key} style={{ ...thStyle, width: col.width }}>
          {col.title}
        </th>
      ))}
      {onRemoveRow && <th style={thStyle}>操作</th>}
    </tr>
  );

  /**
   * Render a single data row. Error rows receive the `row-error` class
   * and their failing cells become editable `<input>` elements with the
   * backend error message displayed below.
   */
  const renderRow = (row: ParsedRow) => {
    const errors = errorMap[row.rowIndex] || [];
    const isError = errors.length > 0;

    return (
      <tr
        key={row.rowIndex}
        className={isError ? 'row-error' : undefined}
        data-row-index={row.rowIndex}
        style={{
          height: ROW_HEIGHT,
          backgroundColor: isError ? '#fff1f0' : undefined,
        }}
      >
        {/* Row number column */}
        <td style={tdStyle}>{row.rowIndex + 1}</td>

        {/* Data columns */}
        {columns.map((col) => {
          const value = getCellValue(row, col.key);
          const fieldErrs = errors.filter((e) => e.field === col.key);

          // Error cell → editable input + error message
          if (fieldErrs.length > 0) {
            return (
              <td
                key={col.key}
                className="cell-error"
                style={{ ...tdStyle, backgroundColor: '#fff1f0' }}
              >
                <input
                  type="text"
                  value={value}
                  onChange={(e) =>
                    handleCellEdit(row.rowIndex, col.key, e.target.value)
                  }
                  style={errorInputStyle}
                  data-row-index={row.rowIndex}
                  data-field={col.key}
                  aria-label={`${col.title}-row-${row.rowIndex + 1}`}
                />
                <div
                  className="error-message"
                  style={{ color: '#ff4d4f', fontSize: 12, marginTop: 2 }}
                >
                  {fieldErrs.map((e) => e.message).join('; ')}
                </div>
              </td>
            );
          }

          // Normal cell
          return <td key={col.key}>{value || '-'}</td>;
        })}

        {/* Remove-row action column */}
        {onRemoveRow && (
          <td style={{ ...tdStyle, textAlign: 'center' }}>
            {isError && (
              <button
                type="button"
                onClick={() => onRemoveRow(row.rowIndex)}
                title="剔除此行"
                aria-label={`remove-row-${row.rowIndex}`}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ff4d4f',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </td>
        )}
      </tr>
    );
  };

  /* ---- early returns ---- */

  if (loading) {
    return (
      <div
        className="preview-table-loading"
        style={{ textAlign: 'center', padding: 48 }}
      >
        <div style={{ fontSize: 16, color: '#666' }}>正在解析文件数据…</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className="preview-table-empty"
        style={{ textAlign: 'center', padding: 48, color: '#999' }}
      >
        暂无预览数据，请上传 .xlsx 文件
      </div>
    );
  }

  /* ---- main render ---- */
  return (
    <div className="preview-table-container">
      {/* ---- Stats bar ---- */}
      <div
        className="preview-stats"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div>
          <span>
            共 <strong>{rows.length}</strong> 行
          </span>
          <span style={{ marginLeft: 16, color: '#52c41a' }}>
            通过: {rows.length - errorRowCount}
          </span>
          {hasErrors && (
            <span style={{ marginLeft: 16, color: '#ff4d4f' }}>
              错误: {errorRowCount}
            </span>
          )}
        </div>

        <button
          type="button"
          className="resubmit-btn"
          onClick={handleResubmit}
          disabled={!hasErrors}
          style={{
            ...resubmitBtnBase,
            backgroundColor: hasErrors ? '#1890ff' : '#d9d9d9',
            color: hasErrors ? '#fff' : '#999',
            cursor: hasErrors ? 'pointer' : 'not-allowed',
          }}
        >
          重新提交
        </button>
      </div>

      {/* ---- Error alert banner ---- */}
      {hasErrors && (
        <div className="error-alert" role="alert" style={alertBoxStyle}>
          检测到 {errorRowCount} 行数据校验未通过，请在表格中修正后重新提交。
        </div>
      )}

      {/* ---- Scrollable table area ---- */}
      <div
        ref={scrollRef}
        onScroll={
          useVirtual
            ? (e) => setScrollTop(e.currentTarget.scrollTop)
            : undefined
        }
        style={{
          maxHeight: VIEWPORT_HEIGHT,
          overflow: 'auto',
          border: '1px solid #e8e8e8',
          borderRadius: 4,
        }}
      >
        <table
          style={{
            tableLayout: 'fixed',
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <thead>{renderHeader()}</thead>
          <tbody>
            {/* Top spacer for virtual scroll offset */}
            {useVirtual && startIdx > 0 && (
              <tr
                aria-hidden="true"
                style={{ height: startIdx * ROW_HEIGHT }}
              >
                <td colSpan={colSpan} style={{ padding: 0 }} />
              </tr>
            )}

            {/* Visible data rows */}
            {visibleRows.map(renderRow)}

            {/* Bottom spacer to preserve total scroll height */}
            {useVirtual && endIdx < rows.length && (
              <tr
                aria-hidden="true"
                style={{ height: (rows.length - endIdx) * ROW_HEIGHT }}
              >
                <td colSpan={colSpan} style={{ padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---- Scoped CSS for error highlighting ---- */}
      <style>{`
        .preview-table-container .row-error td {
          background-color: #fff1f0 !important;
        }
        .preview-table-container .cell-error {
          background-color: #fff1f0 !important;
        }
        .preview-table-container .error-input:focus {
          box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.2);
        }
      `}</style>
    </div>
  );
};

export default PreviewTable;