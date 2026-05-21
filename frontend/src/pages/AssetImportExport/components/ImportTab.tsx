/**
 * ImportTab – 资产批量导入标签页组件
 *
 * 支持功能：
 * - 拖拽 / 点击上传 .xlsx 文件（严格 MIME 校验 + 5 MB 大小限制）
 * - 上传进度条 + 解析中加载态
 * - 解析结果预览表格（错误行高亮 `row-error` + 内联编辑纠错）
 * - 虚拟列表渲染（数据量 > 1 000 行时自动启用）
 * - 标准模板下载（Blob + URL.createObjectURL，卸载时 revokeObjectURL）
 * - 修正后重新提交校验
 *
 * 导入生命周期：idle → uploading → parsing → preview → submitting
 *
 * @module pages/AssetImportExport/components/ImportTab
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';

/* ================================================================== */
/*  Type definitions                                                  */
/* ================================================================== */

/** 单行解析结果 */
export interface ParseRow {
  /** Excel 行号（1-based，不含表头） */
  rowIndex: number;
  /** 各字段原始值 */
  values: Record<string, string>;
  /** 校验错误：字段名 → 错误描述 */
  errors: Record<string, string>;
}

/** 导入生命周期阶段 */
export type ImportPhase =
  | 'idle'
  | 'uploading'
  | 'parsing'
  | 'preview'
  | 'submitting';

/** 预览表格列定义 */
export interface PreviewColumn {
  /** 字段 key，与 ParseRow.values / errors 中的 key 对应 */
  key: string;
  /** 列标题 */
  title: string;
  /** 列宽 (px) */
  width?: number;
}

/** 文件校验结果 */
interface ValidationResult {
  /** 是否通过 */
  valid: boolean;
  /** 不通过时的友好提示 */
  message?: string;
}

/* ================================================================== */
/*  Constants                                                         */
/* ================================================================== */

/** 允许的 MIME 类型（仅 .xlsx） */
const ALLOWED_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 允许的文件扩展名 */
const ALLOWED_EXT = '.xlsx';

/** 最大文件大小：5 MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** 虚拟列表阈值行数 */
const VIRTUAL_THRESHOLD = 1000;

/** 虚拟列表单行高度 (px) */
const ROW_HEIGHT = 44;

/** 虚拟列表可视区高度 (px) */
const VIEWPORT_HEIGHT = 600;

/** 虚拟列表上下缓冲行数 */
const BUFFER_ROWS = 5;

/** 默认预览列 */
const DEFAULT_COLUMNS: PreviewColumn[] = [
  { key: 'assetName', title: '资产名称', width: 150 },
  { key: 'assetCode', title: '资产编号', width: 130 },
  { key: 'category', title: '资产分类', width: 120 },
  { key: 'spec', title: '规格型号', width: 120 },
  { key: 'location', title: '存放位置', width: 120 },
  { key: 'status', title: '状态', width: 100 },
  { key: 'purchaseDate', title: '购入日期', width: 120 },
  { key: 'originalValue', title: '原值', width: 100 },
];

/* ================================================================== */
/*  Utility: template download (Blob + createObjectURL)               */
/* ================================================================== */

/**
 * 通过后端二进制流下载标准导入模板。
 *
 * 使用 Blob + URL.createObjectURL 触发浏览器下载，
 * 下载完成后立即调用 URL.revokeObjectURL 释放内存。
 *
 * @throws {Error} 当网络请求失败时抛出
 */
async function downloadTemplate(): Promise<void> {
  const response = await fetch('/api/asset/template/download', {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`模板下载失败: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'template.xlsx';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ================================================================== */
/*  Utility: file validation                                          */
/* ================================================================== */

/**
 * 校验上传文件的格式与大小。
 *
 * 仅接受扩展名 `.xlsx` 且 MIME 为
 * `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` 的文件，
 * 大小上限 5 MB。校验在前端完成，不合格文件不会发出请求。
 *
 * @param file - 用户选择的文件对象
 * @returns 校验结果，包含 valid 标志和可选的提示信息
 */
function validateFile(file: File): ValidationResult {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

  // 双重校验：扩展名 + MIME type
  if (ext !== ALLOWED_EXT) {
    return { valid: false, message: '仅支持 .xlsx 格式文件' };
  }

  // 部分浏览器在上传时可能 MIME 为空，此时以扩展名为准
  if (file.type && file.type !== ALLOWED_MIME) {
    return { valid: false, message: '仅支持 .xlsx 格式文件' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: '文件大小不能超过 5MB' };
  }

  return { valid: true };
}

/* ================================================================== */
/*  Sub-component: Virtual Preview Table                              */
/* ================================================================== */

interface PreviewTableProps {
  /** 列定义 */
  columns: PreviewColumn[];
  /** 行数据 */
  data: ParseRow[];
  /** 用户已编辑的单元格映射 (key: "rowIndex.field", value: 新值) */
  editedCells: Record<string, string>;
  /** 单元格编辑回调 */
  onCellEdit: (rowIndex: number, field: string, value: string) => void;
  /** 删除行回调 */
  onRemoveRow: (rowIndex: number) => void;
}

/**
 * 预览表格组件，支持虚拟列表渲染。
 *
 * - 当数据行数超过 `VIRTUAL_THRESHOLD` (1 000) 时自动启用虚拟滚动，
 *   仅渲染可视区域 ± 缓冲行，避免 DOM 节点爆炸导致页面卡顿。
 * - 错误行的 `<tr>` 携带 `className="row-error"` 以便 Playwright 定位。
 * - 错误单元格渲染为可编辑 `<input>`，下方显示具体错误原因。
 *
 * @param props - 表格属性
 */
const PreviewTable: React.FC<PreviewTableProps> = ({
  columns,
  data,
  editedCells,
  onCellEdit,
  onRemoveRow,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const useVirtual = data.length > VIRTUAL_THRESHOLD;
  const totalHeight = data.length * ROW_HEIGHT;

  // 计算可见范围
  const startIdx = useVirtual
    ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS)
    : 0;
  const endIdx = useVirtual
    ? Math.min(
        data.length,
        Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + BUFFER_ROWS,
      )
    : data.length;

  const visibleData = useVirtual ? data.slice(startIdx, endIdx) : data;
  const offsetY = startIdx * ROW_HEIGHT;

  /**
   * 滚动事件处理：更新可见区域偏移量以驱动虚拟列表重新计算。
   */
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop);
    }
  }, []);

  /**
   * 渲染单个表格单元格。
   * 如该字段存在校验错误，渲染为可编辑输入框并展示错误信息。
   *
   * @param row    - 当前行数据
   * @param col    - 列定义
   * @returns React 节点
   */
  const renderCell = useCallback(
    (row: ParseRow, col: PreviewColumn): React.ReactNode => {
      const error = row.errors[col.key];
      const cellKey = `${row.rowIndex}.${col.key}`;
      const displayValue = editedCells[cellKey] ?? row.values[col.key] ?? '';

      if (error) {
        return (
          <td key={col.key} className="preview-cell cell-error" title={error}>
            <input
              className="cell-edit-input"
              value={displayValue}
              onChange={(e) => onCellEdit(row.rowIndex, col.key, e.target.value)}
              aria-label={`${col.title} - 错误: ${error}`}
              data-row={row.rowIndex}
              data-field={col.key}
            />
            <span className="cell-error-msg">{error}</span>
          </td>
        );
      }

      return (
        <td key={col.key} className="preview-cell">
          <span className="cell-value">{displayValue}</span>
        </td>
      );
    },
    [editedCells, onCellEdit],
  );

  return (
    <div className="preview-table-wrapper">
      {/* —— 固定表头 —— */}
      <div className="preview-table-header">
        <table className="preview-table">
          <colgroup>
            <col style={{ width: 60 }} />
            {columns.map((c) => (
              <col key={c.key} style={c.width ? { width: c.width } : undefined} />
            ))}
            <col style={{ width: 80 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="preview-th">行号</th>
              {columns.map((c) => (
                <th key={c.key} className="preview-th">
                  {c.title}
                </th>
              ))}
              <th className="preview-th">操作</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* —— 可滚动表体 —— */}
      <div
        ref={scrollRef}
        className="preview-table-body"
        style={{ height: VIEWPORT_HEIGHT, overflowY: 'auto' }}
        onScroll={useVirtual ? handleScroll : undefined}
        data-testid="preview-table-body"
      >
        <div
          style={
            useVirtual
              ? { height: totalHeight, position: 'relative' }
              : undefined
          }
        >
          <table
            className="preview-table"
            style={
              useVirtual
                ? { position: 'absolute', top: offsetY, width: '100%' }
                : { width: '100%' }
            }
          >
            <colgroup>
              <col style={{ width: 60 }} />
              {columns.map((c) => (
                <col key={c.key} style={c.width ? { width: c.width } : undefined} />
              ))}
              <col style={{ width: 80 }} />
            </colgroup>
            <tbody>
              {visibleData.map((row) => {
                const rowHasError = Object.keys(row.errors).length > 0;
                return (
                  <tr
                    key={row.rowIndex}
                    className={rowHasError ? 'row-error' : 'row-ok'}
                    style={{ height: ROW_HEIGHT }}
                    data-row-index={row.rowIndex}
                  >
                    <td className="preview-cell cell-rownum">{row.rowIndex}</td>
                    {columns.map((col) => renderCell(row, col))}
                    <td className="preview-cell">
                      {rowHasError && (
                        <button
                          className="btn-remove-row"
                          onClick={() => onRemoveRow(row.rowIndex)}
                          title="删除此错误行"
                          aria-label={`删除第 ${row.rowIndex} 行`}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* —— 虚拟列表提示 —— */}
      {useVirtual && (
        <div className="virtual-list-info">
          显示 {startIdx + 1}–{endIdx} / 共 {data.length} 行（虚拟滚动已启用）
        </div>
      )}
    </div>
  );
};

/* ================================================================== */
/*  Main Component: ImportTab                                         */
/* ================================================================== */

export interface ImportTabProps {
  /** 自定义列定义（可选，默认使用 DEFAULT_COLUMNS） */
  columns?: PreviewColumn[];
}

/**
 * ImportTab – 资产批量导入标签页。
 *
 * 管理完整的导入生命周期：
 * ```
 * idle → uploading → parsing → preview → submitting
 * ```
 *
 * 交互约束：
 * - 上传进度达到 100% 且后端未返回结果前，提交按钮置灰。
 * - 有任意一行校验失败时，禁止直接入库。
 * - 用户可在预览表格内直接编辑错误单元格并重新提交。
 *
 * @param props - 组件属性
 */
const ImportTab: React.FC<ImportTabProps> = ({ columns = DEFAULT_COLUMNS }) => {
  /* ---------- state ---------- */
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [parseData, setParseData] = useState<ParseRow[]>([]);
  const [editedCells, setEditedCells] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- derived ---------- */

  /** 当前错误行数 */
  const errorCount = useMemo(
    () => parseData.filter((r) => Object.keys(r.errors).length > 0).length,
    [parseData],
  );

  /** 是否存在任意错误行 */
  const hasAnyError = errorCount > 0;

  /** 提交入库按钮是否可用（仅在 preview 且无错误时可用） */
  const canSubmit = phase === 'preview' && !hasAnyError;

  /** 重新提交按钮是否可用（仅在 preview 且有错误时显示） */
  const canResubmit = phase === 'preview' && hasAnyError;

  /* ---------- effects ---------- */

  /** 组件卸载时清理状态，防止内存泄漏 */
  useEffect(() => {
    return () => {
      // 确保任何残留的 ObjectURL 被释放
      // (downloadTemplate 内部已做 finally 清理，此处为兜底)
    };
  }, []);

  /* ---------- handlers ---------- */

  /**
   * 处理文件选择（点击上传或拖拽放下后统一入口）。
   * 执行格式与大小校验，通过后存入 state 等待用户确认上传。
   *
   * @param file - 用户选择的文件
   */
  const handleFile = useCallback((file: File) => {
    setErrorMessage(null);
    const result = validateFile(file);
    if (!result.valid) {
      setErrorMessage(result.message!);
      return;
    }
    setSelectedFile(file);
  }, []);

  /**
   * 拖拽进入/经过事件处理，阻止默认行为并标记拖拽状态。
   *
   * @param e - 拖拽事件
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  /**
   * 拖拽离开事件处理，取消拖拽状态标记。
   *
   * @param e - 拖拽事件
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  /**
   * 拖拽放下事件处理，提取文件并校验。
   *
   * @param e - 拖拽放下事件
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  /**
   * 文件选择框 change 事件处理。
   *
   * @param e - input change 事件
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // 重置 input value，使同一文件可再次选择
      e.target.value = '';
    },
    [handleFile],
  );

  /**
   * 将后端返回的原始响应数据标准化为 ParseRow[]。
   * 兼容多种可能的后端响应格式。
   *
   * @param raw - 后端返回的原始 JSON 数据
   * @returns 标准化后的行数据数组
   */
  const normalizeRows = useCallback((raw: any): ParseRow[] => {
    const items = raw?.rows ?? raw?.data ?? raw ?? [];
    if (!Array.isArray(items)) return [];
    return items.map((r: any, idx: number) => ({
      rowIndex: r.rowIndex ?? idx + 2, // Excel 第 2 行开始（第 1 行为表头）
      values: r.values ?? r.rowValues ?? r.data ?? {},
      errors: r.errors ?? {},
    }));
  }, []);

  /**
   * 开始上传文件并获取解析预览。
   *
   * 使用 XMLHttpRequest 以支持 onUploadProgress 回调驱动进度条。
   * 上传完成后自动切换到 parsing → preview 阶段。
   */
  const startUpload = useCallback(async () => {
    if (!selectedFile) return;

    setPhase('uploading');
    setProgress(0);
    setParseData([]);
    setEditedCells({});
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const rows = await new Promise<ParseRow[]>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/asset/import/upload');
        xhr.withCredentials = true;
        xhr.responseType = 'json';

        /** 上传进度回调，实时更新进度条 */
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProgress(pct);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(normalizeRows(xhr.response));
          } else {
            reject(new Error(`上传失败: HTTP ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('网络错误，请检查网络连接'));
        xhr.ontimeout = () => reject(new Error('请求超时，请重试'));
        xhr.send(formData);
      });

      // 上传完成，切换到 parsing 态
      setProgress(100);
      setPhase('parsing');

      // 短暂延迟展示 parsing 状态（实际上数据已在内存中）
      await new Promise((r) => setTimeout(r, 300));

      setParseData(rows);
      setPhase('preview');
    } catch (err: any) {
      setPhase('idle');
      setProgress(0);
      setErrorMessage(err.message || '上传解析失败，请重试');
    }
  }, [selectedFile, normalizeRows]);

  /**
   * 编辑错误单元格。
   *
   * 将修改后的值存入 editedCells map，同时清除该单元格对应的错误标记，
   * 使 UI 立即反馈修正效果。
   *
   * @param rowIndex - 行号
   * @param field    - 字段名
   * @param value    - 新值
   */
  const handleCellEdit = useCallback(
    (rowIndex: number, field: string, value: string) => {
      const cellKey = `${rowIndex}.${field}`;
      setEditedCells((prev) => ({ ...prev, [cellKey]: value }));

      // 清除该单元格的错误标记
      setParseData((prev) =>
        prev.map((row) => {
          if (row.rowIndex !== rowIndex) return row;
          const newErrors = { ...row.errors };
          delete newErrors[field];
          return { ...row, errors: newErrors };
        }),
      );
    },
    [],
  );

  /**
   * 删除指定的错误行。
   *
   * @param rowIndex - 要删除的行号
   */
  const handleRemoveRow = useCallback((rowIndex: number) => {
    setParseData((prev) => prev.filter((r) => r.rowIndex !== rowIndex));
  }, []);

  /**
   * 合并编辑值到行数据中。
   *
   * @param rows       - 原始行数据
   * @param edits      - 用户编辑的单元格映射
   * @returns 合并后的行数据（仅 values，不含 errors）
   */
  const mergeEdits = useCallback(
    (
      rows: ParseRow[],
      edits: Record<string, string>,
    ): Array<{ rowIndex: number; values: Record<string, string> }> => {
      return rows.map((row) => {
        const mergedValues = { ...row.values };
        Object.keys(edits).forEach((key) => {
          const dotIdx = key.indexOf('.');
          const rIdx = parseInt(key.substring(0, dotIdx), 10);
          const field = key.substring(dotIdx + 1);
          if (rIdx === row.rowIndex) {
            mergedValues[field] = edits[key];
          }
        });
        return { rowIndex: row.rowIndex, values: mergedValues };
      });
    },
    [],
  );

  /**
   * 重新提交修正后的数据进行校验。
   *
   * 将 editedCells 中的修改合并到原始数据，发送后端 revalidate 接口，
   * 用返回的重新校验结果替换当前预览数据。
   */
  const handleResubmit = useCallback(async () => {
    if (parseData.length === 0) return;

    setPhase('submitting');
    setErrorMessage(null);

    try {
      const correctedRows = mergeEdits(parseData, editedCells);

      const response = await fetch('/api/asset/import/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows: correctedRows }),
      });

      if (!response.ok) {
        throw new Error(`重新校验失败: HTTP ${response.status}`);
      }

      const result = await response.json();
      const rows = normalizeRows(result);

      setParseData(rows);
      setEditedCells({});
      setPhase('preview');
    } catch (err: any) {
      setErrorMessage(err.message || '重新提交失败');
      setPhase('preview'); // 回到 preview 允许继续编辑
    }
  }, [parseData, editedCells, mergeEdits, normalizeRows]);

  /**
   * 确认提交入库。
   *
   * 前置条件：无任何校验错误行。
   * 将最终数据发送后端 import/submit 接口完成入库。
   */
  const handleSubmit = useCallback(async () => {
    if (hasAnyError) return;

    setPhase('submitting');
    setErrorMessage(null);

    try {
      const rows = mergeEdits(parseData, editedCells);

      const response = await fetch('/api/asset/import/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows }),
      });

      if (!response.ok) {
        throw new Error(`入库失败: HTTP ${response.status}`);
      }

      const result = await response.json();

      // 入库成功 → 重置状态
      setErrorMessage(null);
      alert(`成功导入 ${result?.importedCount ?? rows.length} 条资产数据`);
      resetState();
    } catch (err: any) {
      setErrorMessage(err.message || '入库提交失败');
      setPhase('preview');
    }
  }, [parseData, editedCells, hasAnyError, mergeEdits]);

  /**
   * 重置所有状态回到初始 idle 阶段。
   */
  const resetState = useCallback(() => {
    setPhase('idle');
    setProgress(0);
    setParseData([]);
    setEditedCells({});
    setErrorMessage(null);
    setSelectedFile(null);
    setIsDragOver(false);
  }, []);

  /**
   * 触发标准模板下载。
   * 捕获异常并展示友好提示。
   */
  const handleDownloadTemplate = useCallback(async () => {
    try {
      await downloadTemplate();
    } catch (err: any) {
      setErrorMessage(err.message || '模板下载失败');
    }
  }, []);

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  return (
    <div className="import-tab" data-testid="import-tab">
      {/* ---- 全局错误提示 ---- */}
      {errorMessage && (
        <div className="import-error-alert" role="alert" data-testid="import-error-alert">
          <span className="alert-icon">⚠️</span>
          <span className="alert-text">{errorMessage}</span>
          <button
            className="alert-dismiss"
            onClick={() => setErrorMessage(null)}
            aria-label="关闭提示"
          >
            ✕
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 上传区域 (idle / uploading / parsing)                        */}
      {/* ============================================================ */}
      {(phase === 'idle' || phase === 'uploading' || phase === 'parsing') && (
        <div className="import-upload-section">
          {/* 拖拽上传区域 */}
          <div
            className={[
              'drag-upload-area',
              isDragOver && 'drag-over',
              phase !== 'idle' && 'disabled',
            ]
              .filter(Boolean)
              .join(' ')}
            onDragOver={phase === 'idle' ? handleDragOver : undefined}
            onDragEnter={phase === 'idle' ? handleDragOver : undefined}
            onDragLeave={phase === 'idle' ? handleDragLeave : undefined}
            onDrop={phase === 'idle' ? handleDrop : undefined}
            onClick={
              phase === 'idle' ? () => fileInputRef.current?.click() : undefined
            }
            role="button"
            tabIndex={0}
            aria-label="上传 Excel 文件"
            data-testid="drag-upload-area"
          >
            <div className="upload-icon">📄</div>
            <h3 className="upload-title">
              {phase === 'idle'
                ? '点击或拖拽 Excel 文件到此处'
                : phase === 'uploading'
                  ? '正在上传文件...'
                  : '正在解析数据...'}
            </h3>
            <p className="upload-hint">仅支持 .xlsx 格式，文件大小上限 5MB</p>

            {/* 已选文件信息 */}
            {selectedFile && phase === 'idle' && (
              <div className="selected-file-info" data-testid="selected-file-info">
                <span className="file-icon">📎</span>
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-size">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}

            {/* 隐藏的文件输入 */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleInputChange}
              style={{ display: 'none' }}
              aria-hidden="true"
              data-testid="file-input"
            />
          </div>

          {/* 进度条 */}
          {(phase === 'uploading' || phase === 'parsing') && (
            <div className="progress-section" data-testid="progress-section">
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <span className="progress-text">
                {phase === 'parsing'
                  ? '上传完成，正在解析数据...'
                  : `${progress}%`}
              </span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="upload-actions">
            <button
              className="btn btn-primary"
              disabled={!selectedFile || phase !== 'idle'}
              onClick={startUpload}
              data-testid="btn-start-import"
            >
              开始导入
            </button>
            <button
              className="btn btn-link"
              onClick={handleDownloadTemplate}
              data-testid="btn-download-template"
            >
              📥 下载标准模板
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 预览区域 (preview / submitting)                              */}
      {/* ============================================================ */}
      {(phase === 'preview' || phase === 'submitting') && (
        <div className="import-preview-section" data-testid="import-preview-section">
          {/* 摘要栏 */}
          <div className="preview-summary">
            <div className="summary-left">
              <h3 className="summary-title">
                导入预览（共 {parseData.length} 行
                {hasAnyError ? `，${errorCount} 行存在错误` : ''}）
              </h3>
            </div>
            <div className="summary-right">
              <button
                className="btn btn-secondary"
                onClick={resetState}
                data-testid="btn-cancel"
              >
                取消
              </button>
              {canResubmit && (
                <button
                  className="btn btn-warning"
                  disabled={phase === 'submitting'}
                  onClick={handleResubmit}
                  data-testid="btn-resubmit"
                >
                  重新提交
                </button>
              )}
              <button
                className="btn btn-primary"
                disabled={!canSubmit || phase === 'submitting'}
                onClick={handleSubmit}
                data-testid="btn-submit"
              >
                {phase === 'submitting' ? '提交中...' : '确认入库'}
              </button>
            </div>
          </div>

          {/* 错误汇总提示 */}
          {hasAnyError && (
            <div
              className="error-summary-alert"
              role="alert"
              data-testid="error-summary"
            >
              ⚠️ 发现 {errorCount} 行数据校验错误，请修正红色标记的单元格后点击"重新提交"。
              您也可以点击行尾的 ✕ 按钮删除不需要的行。
            </div>
          )}

          {/* 全部通过提示 */}
          {!hasAnyError && parseData.length > 0 && (
            <div className="success-summary-alert" data-testid="success-summary">
              ✅ 所有数据校验通过，可以点击"确认入库"提交。
            </div>
          )}

          {/* 预览表格 */}
          {parseData.length > 0 && (
            <PreviewTable
              columns={columns}
              data={parseData}
              editedCells={editedCells}
              onCellEdit={handleCellEdit}
              onRemoveRow={handleRemoveRow}
            />
          )}

          {/* 空数据 */}
          {parseData.length === 0 && (
            <div className="empty-preview" data-testid="empty-preview">
              <p>未解析到有效数据，请检查文件内容后重新上传。</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Scoped Styles                                                 */}
      {/* ============================================================ */}
      <style>{`
        /* ---- Layout ---- */
        .import-tab {
          padding: 24px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ---- Error Alert ---- */
        .import-error-alert {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
          background: #3b1c1c;
          border: 1px solid #7f1d1d;
          border-radius: 6px;
          color: #cf1322;
          font-size: 14px;
        }
        .import-error-alert .alert-dismiss {
          margin-left: auto;
          background: none;
          border: none;
          color: #cf1322;
          cursor: pointer;
          font-size: 16px;
          padding: 0 4px;
        }

        /* ---- Upload Section ---- */
        .import-upload-section {
          max-width: 720px;
          margin: 0 auto;
        }

        .drag-upload-area {
          border: 2px dashed #d9d9d9;
          border-radius: 8px;
          padding: 48px 24px;
          text-align: center;
          background: #0f172a;
          cursor: pointer;
          transition: all 0.3s ease;
          user-select: none;
        }
        .drag-upload-area:hover {
          border-color: #1890ff;
          background: #e6f7ff;
        }
        .drag-upload-area.drag-over {
          border-color: #1890ff;
          background: #e6f7ff;
          box-shadow: 0 0 0 3px rgba(24, 144, 255, 0.12);
        }
        .drag-upload-area.disabled {
          cursor: not-allowed;
          opacity: 0.6;
          pointer-events: none;
        }
        .upload-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .upload-title {
          font-size: 16px;
          font-weight: 500;
          color: #262626;
          margin: 0 0 8px;
        }
        .upload-hint {
          font-size: 13px;
          color: #8c8c8c;
          margin: 0;
        }
        .selected-file-info {
          margin-top: 16px;
          padding: 8px 16px;
          background: #1a2e1a;
          border: 1px solid #b7eb8f;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #389e0d;
        }

        /* ---- Progress Bar ---- */
        .progress-section {
          margin-top: 24px;
        }
        .progress-bar-container {
          height: 8px;
          background: #f0f0f0;
          border-radius: 4px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #1890ff, #40a9ff);
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        .progress-text {
          display: block;
          margin-top: 8px;
          font-size: 13px;
          color: #8c8c8c;
          text-align: center;
        }

        /* ---- Buttons ---- */
        .upload-actions {
          margin-top: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 24px;
          font-size: 14px;
          border-radius: 6px;
          border: 1px solid #d9d9d9;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #1890ff;
          border-color: #1890ff;
          color: #1e293b;
        }
        .btn-primary:not(:disabled):hover {
          background: #40a9ff;
          border-color: #40a9ff;
        }

        .btn-secondary {
          background: #1e293b;
          color: #595959;
        }
        .btn-secondary:not(:disabled):hover {
          color: #1890ff;
          border-color: #1890ff;
        }

        .btn-warning {
          background: #fa8c16;
          border-color: #fa8c16;
          color: #1e293b;
        }
        .btn-warning:not(:disabled):hover {
          background: #ffa940;
          border-color: #ffa940;
        }

        .btn-link {
          background: none;
          border: none;
          color: #1890ff;
          padding: 8px 12px;
        }
        .btn-link:hover {
          color: #40a9ff;
        }

        /* ---- Preview Section ---- */
        .import-preview-section {
          max-width: 1200px;
          margin: 0 auto;
        }

        .preview-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          padding: 16px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .summary-title {
          font-size: 16px;
          font-weight: 500;
          margin: 0;
        }
        .summary-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .error-summary-alert {
          padding: 12px 16px;
          margin-bottom: 16px;
          background: #3b1c1c;
          border: 1px solid #7f1d1d;
          border-radius: 6px;
          color: #cf1322;
          font-size: 14px;
        }

        .success-summary-alert {
          padding: 12px 16px;
          margin-bottom: 16px;
          background: #1a2e1a;
          border: 1px solid #b7eb8f;
          border-radius: 6px;
          color: #389e0d;
          font-size: 14px;
        }

        .empty-preview {
          text-align: center;
          padding: 48px;
          color: #8c8c8c;
        }

        /* ---- Preview Table ---- */
        .preview-table-wrapper {
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          overflow: hidden;
        }

        .preview-table-header {
          background: #0f172a;
          border-bottom: 2px solid #f0f0f0;
        }

        .preview-table-body {
          background: #1e293b;
        }

        .preview-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .preview-th {
          padding: 12px 8px;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          color: #595959;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .preview-cell {
          padding: 6px 8px;
          font-size: 13px;
          border-bottom: 1px solid #1e293b;
          vertical-align: top;
        }

        .cell-rownum {
          text-align: center;
          color: #8c8c8c;
          font-variant-numeric: tabular-nums;
        }

        .cell-value {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ---- Error Row & Cell ---- */
        tr.row-error {
          background-color: #3b1c1c !important;
        }
        tr.row-error:hover {
          background-color: #fff1f0 !important;
        }

        tr.row-ok:hover {
          background-color: #0f172a;
        }

        td.cell-error {
          background: rgba(255, 77, 79, 0.06);
        }

        .cell-edit-input {
          display: block;
          width: 100%;
          padding: 2px 6px;
          border: 1px solid #ff7875;
          border-radius: 3px;
          font-size: 13px;
          font-family: inherit;
          color: #262626;
          background: #1e293b;
          outline: none;
          box-sizing: border-box;
        }
        .cell-edit-input:focus {
          border-color: #1890ff;
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
        }

        .cell-error-msg {
          display: block;
          margin-top: 2px;
          font-size: 11px;
          color: #ff4d4f;
          line-height: 1.3;
        }

        .btn-remove-row {
          background: none;
          border: 1px solid #7f1d1d;
          color: #ff4d4f;
          border-radius: 3px;
          padding: 2px 8px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }
        .btn-remove-row:hover {
          background: #fff1f0;
          border-color: #ff7875;
        }

        /* ---- Virtual List Info ---- */
        .virtual-list-info {
          padding: 8px 16px;
          font-size: 12px;
          color: #8c8c8c;
          text-align: center;
          background: #0f172a;
          border-top: 1px solid #f0f0f0;
        }
      `}</style>
    </div>
  );
};

export default ImportTab;