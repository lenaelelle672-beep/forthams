/**
 * DragUploadArea — 资产批量导入导出页面主组件
 *
 * 职责：
 * 1. 提供"导入"与"导出"双 Tab 切换视图
 * 2. 导入 Tab：支持 .xlsx 拖拽/点击上传，进度条，解析预览表格（含 row-error 高亮）
 * 3. 导出 Tab：按资产分类/状态/存放位置筛选，Blob 流下载
 * 4. 模板下载：Blob + URL.createObjectURL 触发浏览器保存
 *
 * 约束：
 * - 仅接受 .xlsx (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
 * - 单文件最大 5MB
 * - 预览超过 1000 行启用虚拟列表渲染
 * - 存在校验失败行时禁止提交入库
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type DragEvent,
  type ChangeEvent,
} from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  RotateCcw,
  Loader2,
  Filter,
  Trash2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** 单次上传文件大小上限 (5 MB) */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** 仅接受 .xlsx 的 MIME 类型 */
const ACCEPTED_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 文件扩展名白名单 */
const ACCEPTED_EXTENSIONS = ['.xlsx'];

/** 超过此行数启用虚拟列表 */
const VIRTUALIZATION_THRESHOLD = 1000;

/** 虚拟列表行高 (px) */
const ROW_HEIGHT = 44;

/** 虚拟列表上下缓冲行数 */
const BUFFER_ROWS = 8;

/** 导入生命周期阶段 */
type ImportPhase =
  | 'idle'
  | 'uploading'
  | 'parsing'
  | 'preview'
  | 'submitting'
  | 'success'
  | 'error';

/** 解析后的单行数据 */
interface ParsedRow {
  /** 唯一标识 */
  id: string;
  /** Excel 中的行号 (1-based) */
  rowIndex: number;
  /** 各字段键值 */
  data: Record<string, string>;
  /** 该行是否通过校验 */
  isValid: boolean;
  /** 字段级错误信息: fieldName → 错误原因 */
  errors: Record<string, string>;
}

/** 导出筛选条件 */
interface ExportFilters {
  category: string;
  status: string;
  location: string;
}

/** 预览表格列定义 */
interface PreviewColumn {
  key: string;
  label: string;
}

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * 校验上传文件的格式与大小。
 * @param file - 用户选择的文件对象
 * @returns 错误提示文案，校验通过返回 null
 */
function validateFile(file: File): string | null {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return '仅支持 .xlsx 格式文件';
  }
  if (
    file.type &&
    file.type !== ACCEPTED_MIME_TYPE
  ) {
    return '仅支持 .xlsx 格式文件';
  }
  if (file.size > MAX_FILE_SIZE) {
    return '文件大小不能超过 5MB';
  }
  return null;
}

/**
 * 使用 Blob + URL.createObjectURL 触发浏览器文件下载。
 * 下载完成后立即释放 Object URL 以避免内存泄漏。
 * @param blob - 二进制 Blob 数据
 * @param filename - 保存的文件名
 */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * 发起文件上传请求并追踪上传进度。
 * @param file - 待上传文件
 * @param onProgress - 进度回调 (0-100)
 * @returns 后端解析结果
 */
async function uploadAndParse(
  file: File,
  onProgress: (percent: number) => void,
): Promise<ParsedRow[]> {
  const formData = new FormData();
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/asset/import/upload');

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resp = JSON.parse(xhr.responseText);
          resolve(resp.data?.rows ?? resp.rows ?? []);
        } catch {
          reject(new Error('解析响应失败'));
        }
      } else {
        reject(new Error(`上传失败: HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('网络错误')));
    xhr.addEventListener('abort', () => reject(new Error('上传已取消')));
    xhr.send(formData);
  });
}

/**
 * 发起 Blob 流下载请求 (模板下载 / 条件导出)。
 * @param url - 请求地址
 * @param filename - 回退文件名
 * @param init - 可选 fetch 参数
 */
async function fetchAndDownloadBlob(
  url: string,
  filename: string,
  init?: RequestInit,
): Promise<void> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`下载失败: HTTP ${response.status}`);
  }
  const blob = await response.blob();
  triggerBlobDownload(blob, filename);
}

/* ------------------------------------------------------------------ */
/*  VirtualList sub-component                                          */
/* ------------------------------------------------------------------ */

interface VirtualListProps {
  rows: ParsedRow[];
  columns: PreviewColumn[];
  visibleHeight: number;
  /** 当前编辑中的单元格: `${rowId}-${fieldKey}` → 编辑值 */
  editingCell: string | null;
  editValue: string;
  onEditStart: (cellKey: string, currentValue: string) => void;
  onEditCommit: (rowId: string, fieldKey: string, newValue: string) => void;
  onEditCancel: () => void;
}

/**
 * 虚拟列表渲染组件，仅渲染可视区域内的行以减少 DOM 节点。
 * @param props - VirtualListProps
 */
function VirtualList({
  rows,
  columns,
  visibleHeight,
  editingCell,
  editValue,
  onEditStart,
  onEditCommit,
  onEditCancel,
}: VirtualListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  /** 监听滚动事件以更新可见范围 */
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  const totalHeight = rows.length * ROW_HEIGHT;

  /** 计算可见行范围 */
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  const endIdx = Math.min(
    rows.length,
    Math.ceil((scrollTop + visibleHeight) / ROW_HEIGHT) + BUFFER_ROWS,
  );
  const visibleRows = rows.slice(startIdx, endIdx);
  const offsetY = startIdx * ROW_HEIGHT;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height: visibleHeight, overflowY: 'auto' }}
    >
      <table className="w-full text-sm border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-muted/80 sticky top-0 z-10">
            <th className="p-3 text-left font-medium border-b w-16 text-xs">#</th>
            {columns.map((col) => (
              <th key={col.key} className="p-3 text-left font-medium border-b text-xs">
                {col.label}
              </th>
            ))}
            <th className="p-3 text-left font-medium border-b w-24 text-xs">状态</th>
          </tr>
        </thead>
        <tbody>
          {/* 上方留白 */}
          {startIdx > 0 && (
            <tr>
              <td colSpan={columns.length + 2} style={{ height: offsetY }} />
            </tr>
          )}
          {visibleRows.map((row) => {
            const cellKeyPrefix = row.id;
            const errorCount = Object.keys(row.errors).length;
            return (
              <tr
                key={row.id}
                className={`hover:bg-muted/40 transition-colors ${
                  !row.isValid ? 'row-error bg-destructive/5' : ''
                }`}
                style={{ height: ROW_HEIGHT }}
              >
                <td className="p-3 border-b text-muted-foreground font-mono text-xs">
                  {row.rowIndex}
                </td>
                {columns.map((col) => {
                  const cellKey = `${cellKeyPrefix}-${col.key}`;
                  const hasError = col.key in row.errors;
                  const isEditing = editingCell === cellKey;
                  return (
                    <td
                      key={col.key}
                      className={`p-3 border-b relative text-sm ${
                        hasError ? 'text-destructive font-medium' : ''
                      }`}
                      onDoubleClick={() =>
                        onEditStart(cellKey, row.data[col.key] ?? '')
                      }
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          className="w-full border border-primary rounded px-1 py-0.5 text-sm bg-background"
                          value={editValue}
                          onChange={(e) => {
                            /* editValue is lifted — see onEditCommit */
                          }}
                          onBlur={() => onEditCommit(row.id, col.key, editValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onEditCommit(row.id, col.key, editValue);
                            if (e.key === 'Escape') onEditCancel();
                          }}
                        />
                      ) : (
                        <span className="block truncate">
                          {row.data[col.key] || <em className="opacity-40">空</em>}
                        </span>
                      )}
                      {hasError && (
                        <span className="absolute top-1 right-1 text-[10px] text-destructive leading-none">
                          ⚠
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="p-3 border-b">
                  {row.isValid ? (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> 通过
                    </Badge>
                  ) : (
                    <TooltipMessage messages={Object.values(row.errors)} />
                  )}
                </td>
              </tr>
            );
          })}
          {/* 下方留白 */}
          {endIdx < rows.length && (
            <tr>
              <td
                colSpan={columns.length + 2}
                style={{ height: totalHeight - endIdx * ROW_HEIGHT }}
              />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TooltipMessage helper                                              */
/* ------------------------------------------------------------------ */

/**
 * 在行尾展示简要错误提示。
 * @param messages - 错误文案数组
 */
function TooltipMessage({ messages }: { messages: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (messages.length === 0) return null;
  return (
    <div className="relative">
      <button
        type="button"
        className="text-destructive text-xs flex items-center gap-1 hover:underline"
        onClick={() => setExpanded(!expanded)}
      >
        <AlertCircle className="w-3 h-3" />
        {messages.length} 个错误
      </button>
      {expanded && (
        <div className="absolute right-0 top-6 z-50 bg-card border rounded shadow-lg p-2 min-w-[200px] text-xs space-y-1">
          {messages.map((msg, i) => (
            <div key={i} className="text-destructive">
              • {msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component: DragUploadArea                                     */
/* ------------------------------------------------------------------ */

/** 预览表格列定义 */
const PREVIEW_COLUMNS: PreviewColumn[] = [
  { key: 'assetName', label: '资产名称' },
  { key: 'assetCode', label: '资产编号' },
  { key: 'category', label: '资产分类' },
  { key: 'status', label: '资产状态' },
  { key: 'location', label: '存放位置' },
  { key: 'purchaseDate', label: '购入日期' },
  { key: 'originalValue', label: '原值(元)' },
];

/** 导出筛选可选项 */
const CATEGORY_OPTIONS = ['电子设备', '办公家具', '交通工具', '生产设备', '其他'];
const STATUS_OPTIONS = ['在库', '在用', '闲置', '维修中', '报废'];
const LOCATION_OPTIONS = ['A区', 'B区', 'C区', 'D区', '仓库'];

export default function DragUploadArea() {
  /* ---------- Import state ---------- */
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');

  /** 编辑态 */
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  /** 拖拽视觉状态 */
  const [isDragOver, setIsDragOver] = useState(false);

  /* ---------- Export state ---------- */
  const [exportFilters, setExportFilters] = useState<ExportFilters>({
    category: '',
    status: '',
    location: '',
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  /* ---------- Refs ---------- */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- Derived ---------- */
  /** 错误行数量 */
  const errorCount = useMemo(
    () => parsedRows.filter((r) => !r.isValid).length,
    [parsedRows],
  );

  /** 是否需要虚拟列表 */
  const needsVirtualization = parsedRows.length > VIRTUALIZATION_THRESHOLD;

  /* ---------------------------------------------------------------- */
  /*  File handling                                                    */
  /* ---------------------------------------------------------------- */

  /**
   * 处理文件选择/拖拽后的校验与上传逻辑。
   * @param file - 用户选择的 File 对象
   */
  const processFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setFileName(file.name);
    setPhase('uploading');
    setUploadProgress(0);

    try {
      // Phase: uploading → progress drives via XHR
      const rows = await uploadAndParse(file, (pct) => {
        setUploadProgress(pct);
      });

      // Transition to parsing phase briefly, then preview
      setUploadProgress(100);
      setPhase('parsing');

      // Small delay to show "parsing" state
      await new Promise((r) => setTimeout(r, 600));

      setParsedRows(rows);
      setPhase('preview');

      if (rows.length === 0) {
        toast.info('文件已解析，但未发现有效数据行');
      }
    } catch (err: any) {
      toast.error(err?.message ?? '文件上传或解析失败');
      setPhase('error');
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Drag & Drop handlers                                             */
  /* ---------------------------------------------------------------- */

  /**
   * 阻止浏览器默认拖拽行为。
   * @param e - DragEvent
   */
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  /**
   * 拖拽进入时设置视觉状态。
   * @param e - DragEvent
   */
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  /**
   * 拖拽离开时移除视觉状态。
   * @param e - DragEvent
   */
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  /**
   * 处理文件拖放事件，提取第一个文件并执行校验+上传。
   * @param e - DragEvent
   */
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      processFile(files[0]);
    },
    [processFile],
  );

  /**
   * 处理 <input type="file"> 的 change 事件。
   * @param e - ChangeEvent
   */
  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      processFile(files[0]);
      // 重置 input 以允许选择同一文件
      e.target.value = '';
    },
    [processFile],
  );

  /* ---------------------------------------------------------------- */
  /*  Cell editing                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * 开始编辑某个单元格。
   * @param cellKey - `${rowId}-${fieldKey}`
   * @param currentValue - 当前值
   */
  const handleEditStart = useCallback((cellKey: string, currentValue: string) => {
    setEditingCell(cellKey);
    setEditValue(currentValue);
  }, []);

  /**
   * 提交编辑，更新行数据并清除该字段的错误。
   * @param rowId - 行 ID
   * @param fieldKey - 字段名
   * @param newValue - 新值
   */
  const handleEditCommit = useCallback(
    (rowId: string, fieldKey: string, newValue: string) => {
      setEditingCell(null);
      setParsedRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const newErrors = { ...row.errors };
          // 清除该字段的错误（用户已修正）
          delete newErrors[fieldKey];
          const isValid = Object.keys(newErrors).length === 0;
          return {
            ...row,
            data: { ...row.data, [fieldKey]: newValue },
            errors: newErrors,
            isValid,
          };
        }),
      );
    },
    [],
  );

  /** 取消编辑操作 */
  const handleEditCancel = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Submit corrected data                                            */
  /* ---------------------------------------------------------------- */

  /**
   * 将修正后的数据重新提交到后端进行校验/入库。
   */
  const handleSubmit = useCallback(async () => {
    setPhase('submitting');
    try {
      const response = await fetch('/api/asset/import/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows }),
      });
      if (!response.ok) throw new Error(`提交失败: HTTP ${response.status}`);
      const result = await response.json();
      toast.success(`资产导入成功！共处理 ${parsedRows.length} 条记录`);
      setPhase('success');
    } catch (err: any) {
      toast.error(err?.message ?? '提交失败，请重试');
      setPhase('preview');
    }
  }, [parsedRows]);

  /* ---------------------------------------------------------------- */
  /*  Reset                                                            */
  /* ---------------------------------------------------------------- */

  /** 重置导入状态回到初始界面 */
  const handleReset = useCallback(() => {
    setPhase('idle');
    setUploadProgress(0);
    setParsedRows([]);
    setFileName('');
    setEditingCell(null);
    setEditValue('');
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Export actions                                                   */
  /* ---------------------------------------------------------------- */

  /**
   * 下载标准导入模板 (.xlsx)。
   * 使用 Blob 流方式，前端通过 URL.createObjectURL 触发下载。
   */
  const handleDownloadTemplate = useCallback(async () => {
    setIsDownloadingTemplate(true);
    try {
      await fetchAndDownloadBlob(
        '/api/asset/template/download',
        'template.xlsx',
      );
      toast.success('模板下载成功');
    } catch (err: any) {
      toast.error(err?.message ?? '模板下载失败');
    } finally {
      setIsDownloadingTemplate(false);
    }
  }, []);

  /**
   * 按筛选条件导出资产台账。
   * 使用 Blob 流方式下载。
   */
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (exportFilters.category) params.set('category', exportFilters.category);
      if (exportFilters.status) params.set('status', exportFilters.status);
      if (exportFilters.location) params.set('location', exportFilters.location);

      const dateStr = new Date().toISOString().split('T')[0];
      await fetchAndDownloadBlob(
        `/api/asset/export?${params.toString()}`,
        `资产导出_${dateStr}.xlsx`,
      );
      toast.success('数据导出成功');
    } catch (err: any) {
      toast.error(err?.message ?? '导出失败');
    } finally {
      setIsExporting(false);
    }
  }, [exportFilters]);

  /** 重置导出筛选条件 */
  const handleResetFilters = useCallback(() => {
    setExportFilters({ category: '', status: '', location: '' });
  }, []);

  /* ================================================================== */
  /*  RENDER                                                            */
  /* ================================================================== */

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">资产批量导入导出</h1>
          <p className="text-muted-foreground text-sm mt-1">
            通过 Excel 文件与系统进行大批量的资产数据交互
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          disabled={isDownloadingTemplate}
        >
          {isDownloadingTemplate ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          下载模板
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={phase === 'idle' || phase === 'error' ? 'import' : undefined} defaultValue="import">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="import">
            <Upload className="w-4 h-4 mr-2" />
            导入
          </TabsTrigger>
          <TabsTrigger value="export">
            <Download className="w-4 h-4 mr-2" />
            导出
          </TabsTrigger>
        </TabsList>

        {/* ==================== IMPORT TAB ==================== */}
        <TabsContent value="import" className="mt-6 space-y-4">
          {renderImportContent()}
        </TabsContent>

        {/* ==================== EXPORT TAB ==================== */}
        <TabsContent value="export" className="mt-6">
          {renderExportContent()}
        </TabsContent>
      </Tabs>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Import content renderer                                          */
  /* ---------------------------------------------------------------- */

  /**
   * 根据当前 phase 渲染导入区域的不同状态视图。
   */
  function renderImportContent(): React.ReactNode {
    switch (phase) {
      case 'idle':
      case 'error':
        return renderDropZone();

      case 'uploading':
        return renderUploading();

      case 'parsing':
        return renderParsing();

      case 'preview':
      case 'submitting':
      case 'success':
        return renderPreview();

      default:
        return renderDropZone();
    }
  }

  /**
   * 渲染拖拽上传区域（idle / error 状态）。
   */
  function renderDropZone(): React.ReactNode {
    return (
      <div
        role="button"
        tabIndex={0}
        className={`
          relative flex flex-col items-center justify-center
          h-[360px] border-2 border-dashed rounded-xl cursor-pointer
          transition-all duration-200
          ${isDragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-muted-foreground/25 bg-muted/20 hover:bg-accent/50'}
        `}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".xlsx"
          onChange={handleFileInputChange}
        />

        <div
          className={`p-5 rounded-full mb-4 transition-colors ${
            isDragOver ? 'bg-primary/20' : 'bg-primary/10'
          }`}
        >
          <Upload
            className={`w-8 h-8 transition-colors ${
              isDragOver ? 'text-primary' : 'text-primary/70'
            }`}
          />
        </div>

        <h3 className="text-lg font-medium mb-2">
          {isDragOver ? '松开以上传文件' : '拖拽文件到此处，或点击选择文件'}
        </h3>
        <p className="text-muted-foreground text-sm">
          仅支持 <span className="font-medium">.xlsx</span> 格式，单次最大{' '}
          <span className="font-medium">5MB</span>
        </p>

        {phase === 'error' && (
          <Alert variant="destructive" className="mt-4 max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>上传失败</AlertTitle>
            <AlertDescription>请检查文件格式后重试</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  /**
   * 渲染上传进度状态视图。
   */
  function renderUploading(): React.ReactNode {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {fileName}
          </CardTitle>
          <CardDescription>文件上传中...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={uploadProgress} className="h-3" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>上传进度</span>
            <span className="font-mono">{uploadProgress}%</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  /**
   * 渲染解析中状态视图（上传进度 100% 后、后端解析未返回结果前）。
   */
  function renderParsing(): React.ReactNode {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            数据解析中
          </CardTitle>
          <CardDescription>
            文件已上传完成，系统正在解析并校验数据，请稍候...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Progress value={100} className="h-3 flex-1" />
            <span className="font-mono">100%</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  /**
   * 渲染解析预览表格视图（含错误高亮、编辑、提交）。
   */
  function renderPreview(): React.ReactNode {
    const currentErrorCount = parsedRows.filter((r) => !r.isValid).length;

    return (
      <div className="space-y-4">
        {/* Summary bar */}
        <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg border">
          <div className="flex gap-6 text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              共 {parsedRows.length} 行数据
            </span>
            {currentErrorCount > 0 ? (
              <span className="text-destructive font-medium flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {currentErrorCount} 行包含错误（红色高亮行）
              </span>
            ) : (
              <span className="text-green-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                所有数据校验通过
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              重新上传
            </Button>
            <Button
              size="sm"
              disabled={currentErrorCount > 0 || phase === 'submitting'}
              onClick={handleSubmit}
            >
              {phase === 'submitting' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : phase === 'success' ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  导入完成
                </>
              ) : (
                '确认导入数据'
              )}
            </Button>
          </div>
        </div>

        {/* Error hint */}
        {currentErrorCount > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>存在校验失败行</AlertTitle>
            <AlertDescription>
              请双击红色高亮行中的错误单元格进行修正，所有错误修正后方可提交入库。
            </AlertDescription>
          </Alert>
        )}

        {/* Preview table */}
        <div className="border rounded-lg overflow-hidden bg-card">
          {needsVirtualization ? (
            <VirtualList
              rows={parsedRows}
              columns={PREVIEW_COLUMNS}
              visibleHeight={520}
              editingCell={editingCell}
              editValue={editValue}
              onEditStart={handleEditStart}
              onEditCommit={handleEditCommit}
              onEditCancel={handleEditCancel}
            />
          ) : (
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              <table className="w-full text-sm border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-muted/80 sticky top-0 z-10">
                    <th className="p-3 text-left font-medium border-b w-16 text-xs">#</th>
                    {PREVIEW_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="p-3 text-left font-medium border-b text-xs"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="p-3 text-left font-medium border-b w-24 text-xs">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row) => {
                    const errCount = Object.keys(row.errors).length;
                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-muted/40 transition-colors ${
                          !row.isValid ? 'row-error bg-destructive/5' : ''
                        }`}
                      >
                        <td className="p-3 border-b text-muted-foreground font-mono text-xs">
                          {row.rowIndex}
                        </td>
                        {PREVIEW_COLUMNS.map((col) => {
                          const cellKey = `${row.id}-${col.key}`;
                          const hasError = col.key in row.errors;
                          const isEditing = editingCell === cellKey;
                          return (
                            <td
                              key={col.key}
                              className={`p-3 border-b relative text-sm ${
                                hasError ? 'text-destructive font-medium' : ''
                              }`}
                              onDoubleClick={() =>
                                handleEditStart(cellKey, row.data[col.key] ?? '')
                              }
                            >
                              {isEditing ? (
                                <input
                                  autoFocus
                                  className="w-full border border-primary rounded px-1 py-0.5 text-sm bg-background"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() =>
                                    handleEditCommit(row.id, col.key, editValue)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter')
                                      handleEditCommit(row.id, col.key, editValue);
                                    if (e.key === 'Escape') handleEditCancel();
                                  }}
                                />
                              ) : (
                                <span className="block truncate">
                                  {row.data[col.key] || (
                                    <em className="opacity-40">空</em>
                                  )}
                                </span>
                              )}
                              {hasError && (
                                <span className="absolute top-1 right-1 text-[10px] text-destructive leading-none">
                                  ⚠
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-3 border-b">
                          {row.isValid ? (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> 通过
                            </Badge>
                          ) : (
                            <TooltipMessage messages={Object.values(row.errors)} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Success message */}
        {phase === 'success' && (
          <div className="flex items-center gap-2 text-green-600 bg-green-950 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">
              导入成功！共处理 {parsedRows.length} 条资产记录。
            </span>
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Export content renderer                                          */
  /* ---------------------------------------------------------------- */

  /**
   * 渲染导出 Tab 内容，包含筛选表单和导出按钮。
   */
  function renderExportContent(): React.ReactNode {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              导出筛选条件
            </CardTitle>
            <CardDescription>
              选择需要导出的资产范围，不选则导出全部数据
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 资产分类 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">资产分类</label>
                <Select
                  value={exportFilters.category}
                  onValueChange={(val) =>
                    setExportFilters((prev) => ({
                      ...prev,
                      category: val === '__all__' ? '' : val,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部分类</SelectItem>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 资产状态 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">资产状态</label>
                <Select
                  value={exportFilters.status}
                  onValueChange={(val) =>
                    setExportFilters((prev) => ({
                      ...prev,
                      status: val === '__all__' ? '' : val,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部状态</SelectItem>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 存放位置 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">存放位置</label>
                <Select
                  value={exportFilters.location}
                  onValueChange={(val) =>
                    setExportFilters((prev) => ({
                      ...prev,
                      location: val === '__all__' ? '' : val,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部位置" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部位置</SelectItem>
                    {LOCATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <div className="flex items-center justify-between px-6 pb-6">
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              <Trash2 className="mr-2 h-4 w-4" />
              重置筛选
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  导出 Excel
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Export info */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-4 space-y-1">
          <p>• 导出文件格式为 <span className="font-medium">.xlsx</span>，通过浏览器直接下载。</p>
          <p>• 所有文件下载均采用二进制流方式（Blob + URL.createObjectURL），不经过服务端静态文件重定向。</p>
          <p>• 导出数据量较大时请耐心等待，下载完成后浏览器会弹出保存提示。</p>
        </div>
      </div>
    );
  }
}
