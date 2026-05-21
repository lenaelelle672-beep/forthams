/**
 * ImportTab — 资产批量导入 & 台账导出页面容器
 *
 * 职责:
 * 1. 提供包含「批量导入」与「台账导出」两个 Tab 的切换视图。
 * 2. 实现拖拽 / 点击上传 .xlsx 文件（仅限 5MB，MIME 强校验）。
 * 3. 上传进度条 → 解析中过渡态 → 预览表格（错误行高亮 + 行内编辑 + 虚拟列表）。
 * 4. 导出筛选面板，触发 Blob 二进制流下载。
 *
 * 生命周期状态机: idle → uploading → parsing → preview → submitting
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import {
  Card,
  Button,
  Upload,
  Table,
  Tag,
  Alert,
  Form,
  Select,
  Space,
  Progress,
  Typography,
  message,
  Empty,
  Divider,
  Input,
  Tooltip,
  Spin,
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  InboxOutlined,
  ReloadOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { UploadProps, FormInstance } from 'antd';
import type { ColumnsType } from 'antd/es/table';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** 单行单元格级校验错误 */
interface CellError {
  field: string;
  message: string;
}

/** 解析预览行 */
export interface ImportPreviewRow {
  /** 行唯一标识（后端返回或前端生成） */
  key: string;
  /** 原始 Excel 行号（从 1 开始） */
  rowIndex: number;
  /** 行业务数据，字段名与模板列头对应 */
  data: Record<string, string>;
  /** 该行的校验错误列表（空数组表示通过） */
  errors: CellError[];
}

/** 导入生命周期阶段 */
type ImportPhase = 'idle' | 'uploading' | 'parsing' | 'preview' | 'submitting';

/** 导出筛选条件 */
interface ExportFilterValues {
  category?: string;
  status?: string;
  location?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** 文件大小上限 5 MB（硬限制） */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** 仅接受 .xlsx 的 MIME 类型 */
const ALLOWED_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 虚拟列表阈值 —— 超过此行数启用窗口渲染 */
const VIRTUAL_THRESHOLD = 1000;

/** 虚拟列表每行高度 (px) */
const VIRTUAL_ROW_HEIGHT = 44;

/** 虚拟列表可视区域高度 (px) */
const VIRTUAL_VIEWPORT_HEIGHT = 500;

/** 上传 & 解析接口 */
const IMPORT_PREVIEW_URL = '/api/asset/import/preview';

/** 确认入库接口 */
const IMPORT_CONFIRM_URL = '/api/asset/import/confirm';

/** 模板下载接口 */
const TEMPLATE_DOWNLOAD_URL = '/api/asset/template/download';

/** 条件导出接口 */
const EXPORT_URL = '/api/asset/export';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * 校验文件格式与大小。
 * @returns 错误消息；返回 `null` 表示校验通过。
 */
function validateFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return '仅支持 .xlsx 格式文件';
  }
  if (file.type && file.type !== ALLOWED_MIME) {
    return '仅支持 .xlsx 格式文件';
  }
  if (file.size > MAX_FILE_SIZE) {
    return '文件大小不能超过 5MB，当前 ' + (file.size / 1024 / 1024).toFixed(2) + 'MB';
  }
  return null;
}

/**
 * 使用 Blob + createObjectURL 触发浏览器下载。
 * 调用方负责在组件卸载时 revokeObjectURL。
 */
function downloadBlob(blob: Blob, filename: string): string {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return url;
}

/* ------------------------------------------------------------------ */
/*  Sub-component: VirtualPreviewTable                                 */
/* ------------------------------------------------------------------ */

interface VirtualTableProps {
  rows: ImportPreviewRow[];
  onCellChange: (rowKey: string, field: string, value: string) => void;
  columns: ColumnsType<ImportPreviewRow>;
}

/**
 * 当行数超过 VIRTUAL_THRESHOLD 时，使用自定义虚拟滚动渲染，
 * 避免一次性挂载数千 DOM 节点导致页面卡顿。
 */
const VirtualPreviewTable: React.FC<VirtualTableProps> = ({
  rows,
  onCellChange,
  columns,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = rows.length * VIRTUAL_ROW_HEIGHT;

  const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - 2);
  const visibleCount = Math.ceil(VIRTUAL_VIEWPORT_HEIGHT / VIRTUAL_ROW_HEIGHT) + 4;
  const endIndex = Math.min(rows.length, startIndex + visibleCount);
  const visibleRows = rows.slice(startIndex, endIndex);
  const offsetY = startIndex * VIRTUAL_ROW_HEIGHT;

  /** 获取某个单元格是否有错误 */
  const getCellError = useCallback(
    (rowKey: string, field: string): CellError | undefined => {
      const row = rows.find((r) => r.key === rowKey);
      return row?.errors.find((e) => e.field === field);
    },
    [rows],
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      style={{
        maxHeight: VIRTUAL_VIEWPORT_HEIGHT,
        overflowY: 'auto',
        border: '1px solid #f0f0f0',
        borderRadius: 6,
      }}
    >
      {/* 表头 */}
      <div
        className="virtual-table-header"
        style={{
          display: 'flex',
          height: VIRTUAL_ROW_HEIGHT,
          lineHeight: `${VIRTUAL_ROW_HEIGHT}px`,
          background: '#f8fafc',
          borderBottom: '1px solid #f0f0f0',
          fontWeight: 600,
          fontSize: 14,
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <div style={{ width: 60, flexShrink: 0, padding: '0 8px', textAlign: 'center' }}>行号</div>
        {columns.filter((c) => c.dataIndex !== 'rowIndex' && c.key !== 'validation').map((col) => (
          <div
            key={String(col.key || col.dataIndex)}
            style={{ flex: 1, padding: '0 8px', minWidth: 100 }}
          >
            {col.title as string}
          </div>
        ))}
        <div style={{ width: 140, flexShrink: 0, padding: '0 8px', textAlign: 'center' }}>校验结果</div>
      </div>

      {/* 虚拟滚动体 */}
      <div style={{ position: 'relative', height: totalHeight }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleRows.map((row) => {
            const hasError = row.errors.length > 0;
            return (
              <div
                key={row.key}
                className={hasError ? 'row-error' : ''}
                style={{
                  display: 'flex',
                  height: VIRTUAL_ROW_HEIGHT,
                  lineHeight: `${VIRTUAL_ROW_HEIGHT - 4}px`,
                  borderBottom: '1px solid #f0f0f0',
                  alignItems: 'center',
                  padding: '0 4px',
                  fontSize: 13,
                }}
              >
                {/* 行号 */}
                <div style={{ width: 60, flexShrink: 0, textAlign: 'center' }}>
                  {row.rowIndex}
                </div>

                {/* 数据单元格 */}
                {Object.keys(row.data).map((field) => {
                  const cellErr = getCellError(row.key, field);
                  return (
                    <div
                      key={field}
                      style={{ flex: 1, padding: '0 4px', minWidth: 100 }}
                    >
                      {cellErr ? (
                        <Tooltip title={cellErr.message}>
                          <Input
                            size="small"
                            defaultValue={row.data[field]}
                            style={{ borderColor: '#ff4d4f' }}
                            onBlur={(e) =>
                              onCellChange(row.key, field, e.target.value)
                            }
                          />
                        </Tooltip>
                      ) : (
                        <span>{row.data[field]}</span>
                      )}
                    </div>
                  );
                })}

                {/* 校验状态 */}
                <div style={{ width: 140, flexShrink: 0, textAlign: 'center' }}>
                  {hasError ? (
                    <Tag color="error" icon={<CloseCircleFilled />}>
                      {row.errors.length} 项错误
                    </Tag>
                  ) : (
                    <Tag color="success" icon={<CheckCircleFilled />}>
                      通过
                    </Tag>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Component: ImportTab                                          */
/* ------------------------------------------------------------------ */

const { Title, Text } = Typography;

const ImportTab: React.FC = () => {
  /* ======================== State ======================== */

  /** 当前 Tab */
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');

  /** 导入阶段 */
  const [phase, setPhase] = useState<ImportPhase>('idle');

  /** 上传百分比 0-100 */
  const [uploadProgress, setUploadProgress] = useState(0);

  /** 解析预览数据 */
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);

  /** 是否存在未修正的错误行 */
  const [hasErrors, setHasErrors] = useState(false);

  /** 导出加载态 */
  const [isExporting, setIsExporting] = useState(false);

  /** 导出表单引用 */
  const [exportForm] = Form.useForm<FormInstance<ExportFilterValues>>();

  /** 存储 objectURL 以便卸载时释放 */
  const objectUrlRef = useRef<string | null>(null);

  /** 存储原始文件引用，便于重新解析 */
  const fileRef = useRef<File | null>(null);

  /** 动态列定义 */
  const previewColumns = useMemo<ColumnsType<ImportPreviewRow>>(() => {
    if (previewRows.length === 0) return [];
    const dataFields = Object.keys(previewRows[0].data);
    const cols: ColumnsType<ImportPreviewRow> = [
      {
        title: '行号',
        dataIndex: 'rowIndex',
        key: 'rowIndex',
        width: 70,
        fixed: 'left',
      },
      ...dataFields.map((field) => ({
        title: field,
        dataIndex: ['data', field],
        key: field,
        width: 140,
        ellipsis: true,
        render: (_: unknown, record: ImportPreviewRow) => {
          const cellErr = record.errors.find((e) => e.field === field);
          if (!cellErr) return record.data[field];
          return (
            <Tooltip title={cellErr.message}>
              <span style={{ color: '#ff4d4f', borderBottom: '1px dashed #ff4d4f', cursor: 'help' }}>
                {record.data[field] || '(空)'}
              </span>
              <br />
              <span style={{ color: '#ff7875', fontSize: 12 }}>{cellErr.message}</span>
            </Tooltip>
          );
        },
      })),
      {
        title: '校验结果',
        key: 'validation',
        width: 140,
        fixed: 'right',
        render: (_: unknown, record: ImportPreviewRow) =>
          record.errors.length > 0 ? (
            <Tag color="error" icon={<CloseCircleFilled />}>
              {record.errors.length} 项错误
            </Tag>
          ) : (
            <Tag color="success" icon={<CheckCircleFilled />}>
              通过
            </Tag>
          ),
      },
    ];
    return cols;
  }, [previewRows]);

  /* ======================== Cleanup ======================== */

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  /* ======================== Import handlers ======================== */

  /** 读取解析结果并更新预览状态 */
  const applyParseResult = useCallback((resultRows: ImportPreviewRow[]) => {
    setPreviewRows(resultRows);
    setHasErrors(resultRows.some((r) => r.errors.length > 0));
    setPhase('preview');
  }, []);

  /**
   * 上传文件并获取解析预览结果。
   * 使用 XMLHttpRequest 而非 axios，以获得更精细的 onUploadProgress 控制。
   */
  const handleUpload = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        message.error(validationError);
        return;
      }

      // 前置校验通过，进入 uploading 阶段
      setPhase('uploading');
      setUploadProgress(0);
      fileRef.current = file;

      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', IMPORT_PREVIEW_URL);

      // 上传进度
      xhr.upload.addEventListener('progress', (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setUploadProgress(pct);
          // 到达 100% 后转入 parsing 态
          if (pct >= 100) {
            setPhase('parsing');
          }
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            // 后端返回格式: { rows: [{ rowIndex, data, errors }] }
            const rows: ImportPreviewRow[] = (json.rows || []).map(
              (r: Record<string, unknown>, idx: number) => ({
                key: String(r.id ?? idx),
                rowIndex: (r.rowIndex as number) ?? idx + 1,
                data: (r.data as Record<string, string>) ?? {},
                errors: (r.errors as CellError[]) ?? [],
              }),
            );
            applyParseResult(rows);
          } catch {
            message.error('后端返回数据解析异常，请联系管理员');
            setPhase('idle');
          }
        } else {
          message.error(`上传失败 (${xhr.status})，请检查文件格式或稍后重试`);
          setPhase('idle');
        }
      };

      xhr.onerror = () => {
        message.error('网络异常，请检查连接后重试');
        setPhase('idle');
      };

      xhr.send(formData);
    },
    [applyParseResult],
  );

  /** 单元格修正回调 —— 更新预览数据中的值并清除对应错误 */
  const handleCellChange = useCallback(
    (rowKey: string, field: string, value: string) => {
      setPreviewRows((prev) =>
        prev.map((row) => {
          if (row.key !== rowKey) return row;
          const newData = { ...row.data, [field]: value };
          const newErrors = row.errors.filter((e) => e.field !== field);
          return { ...row, data: newData, errors: newErrors };
        }),
      );
    },
    [],
  );

  // 每次修正后重新判断 hasErrors
  useEffect(() => {
    setHasErrors(previewRows.some((r) => r.errors.length > 0));
  }, [previewRows]);

  /**
   * 重新提交 —— 将修正后的预览数据发送给后端校验/入库。
   * 如果仍有错误行则禁止提交。
   */
  const handleReSubmit = useCallback(async () => {
    if (hasErrors) {
      message.warning('仍有校验错误未修正，请修正后再提交');
      return;
    }
    setPhase('submitting');
    try {
      const payload = previewRows.map((r) => ({
        rowIndex: r.rowIndex,
        data: r.data,
      }));
      const res = await fetch(IMPORT_CONFIRM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payload }),
      });
      if (res.ok) {
        message.success(`成功入库 ${previewRows.length} 条资产记录`);
        setPreviewRows([]);
        setPhase('idle');
      } else {
        // 后端可能返回新的校验结果（如业务规则校验失败）
        const json = await res.json().catch(() => null);
        if (json?.rows) {
          const refreshed: ImportPreviewRow[] = json.rows.map(
            (r: Record<string, unknown>, idx: number) => ({
              key: String(r.id ?? idx),
              rowIndex: (r.rowIndex as number) ?? idx + 1,
              data: (r.data as Record<string, string>) ?? {},
              errors: (r.errors as CellError[]) ?? [],
            }),
          );
          applyParseResult(refreshed);
          message.error('部分数据校验未通过，请根据提示修正后重试');
        } else {
          message.error('提交失败，请稍后重试');
        }
        setPhase('preview');
      }
    } catch {
      message.error('网络异常，请稍后重试');
      setPhase('preview');
    }
  }, [hasErrors, previewRows, applyParseResult]);

  /** 重置上传状态 */
  const handleReset = useCallback(() => {
    setPhase('idle');
    setUploadProgress(0);
    setPreviewRows([]);
    setHasErrors(false);
    fileRef.current = null;
  }, []);

  /* ======================== Export handlers ======================== */

  /** 下载标准导入模板（Blob 二进制流） */
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const res = await fetch(TEMPLATE_DOWNLOAD_URL, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const filename =
        res.headers
          .get('Content-Disposition')
          ?.match(/filename=(.+)/)?.[1]?.replace(/"/g, '') ?? '资产导入模板.xlsx';

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = downloadBlob(blob, decodeURIComponent(filename));
      message.success('模板下载成功');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      message.error(`模板下载失败: ${msg}`);
    }
  }, []);

  /** 条件导出台账数据（Blob 二进制流） */
  const handleExport = useCallback(async () => {
    try {
      const values = await exportForm.validateFields();
      setIsExporting(true);

      const params = new URLSearchParams();
      if (values.category) params.set('category', values.category);
      if (values.status) params.set('status', values.status);
      if (values.location) params.set('location', values.location);

      const res = await fetch(`${EXPORT_URL}?${params.toString()}`, {
        method: 'GET',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const filename =
        res.headers
          .get('Content-Disposition')
          ?.match(/filename=(.+)/)?.[1]?.replace(/"/g, '') ??
        `资产台账导出_${new Date().toISOString().slice(0, 10)}.xlsx`;

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      objectUrlRef.current = downloadBlob(blob, decodeURIComponent(filename));
      message.success('导出成功');
    } catch (err: unknown) {
      if (err instanceof Error && 'errorFields' in err) {
        // antd validateFields reject —— 表单校验失败
        return;
      }
      const msg = err instanceof Error ? err.message : '未知错误';
      message.error(`导出失败: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  }, [exportForm]);

  /* ======================== Upload config ======================== */

  const uploadProps: UploadProps = useMemo<UploadProps>(
    () => ({
      accept: '.xlsx',
      multiple: false,
      maxCount: 1,
      showUploadList: false,
      beforeUpload(file) {
        const err = validateFile(file);
        if (err) {
          message.error(err);
          return Upload.LIST_IGNORE;
        }
        return true;
      },
      customRequest({ file }) {
        handleUpload(file as File);
      },
    }),
    [handleUpload],
  );

  /* ======================== Render: Import Tab ======================== */

  const renderImportView = () => (
    <div>
      <Card
        title={
          <Space>
            <FileExcelOutlined />
            <span>资产批量导入</span>
          </Space>
        }
        extra={
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            下载标准模板
          </Button>
        }
      >
        {/* ---------- Idle / Upload ---------- */}
        {(phase === 'idle' || phase === 'uploading' || phase === 'parsing') &&
          previewRows.length === 0 && (
            <div>
              {phase === 'uploading' ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <Progress
                    type="circle"
                    percent={uploadProgress}
                    status="active"
                    strokeColor={{ '0%': '#1890ff', '100%': '#52c41a' }}
                    size={120}
                  />
                  <div style={{ marginTop: 16 }}>
                    <Text type="secondary">正在上传文件… {uploadProgress}%</Text>
                  </div>
                </div>
              ) : phase === 'parsing' ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: 16 }}>
                    <Text type="secondary">上传完成，正在解析文件内容，请稍候…</Text>
                  </div>
                </div>
              ) : (
                <Upload.Dragger {...uploadProps}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ fontSize: 56, color: '#1890ff' }} />
                  </p>
                  <p className="ant-upload-text">
                    点击或将 .xlsx 文件拖拽到此区域上传
                  </p>
                  <p className="ant-upload-hint">
                    仅支持 <Text strong>.xlsx</Text> 格式，文件大小不超过{' '}
                    <Text strong>5 MB</Text>
                  </p>
                </Upload.Dragger>
              )}
            </div>
          )}

        {/* ---------- Preview ---------- */}
        {phase === 'preview' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <Title level={5} style={{ margin: 0 }}>
                解析结果预览
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {previewRows.length} 行
                </Tag>
              </Title>

              <Space>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重新上传
                </Button>
                <Button
                  type="primary"
                  icon={<CheckCircleFilled />}
                  disabled={hasErrors}
                  loading={phase === 'submitting'}
                  onClick={handleReSubmit}
                >
                  {hasErrors ? '存在错误，禁止入库' : '确认入库'}
                </Button>
              </Space>
            </div>

            {/* 错误汇总提示 */}
            {hasErrors && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
                message="导入校验未通过"
                description={
                  <>
                    部分 {previewRows.filter((r) => r.errors.length > 0).length} 行数据存在错误，请在下方表格中直接修正标红单元格后点击「确认入库」。
                    <br />
                    错误行示例：
                    <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                      {previewRows
                        .filter((r) => r.errors.length > 0)
                        .slice(0, 5)
                        .map((row) => (
                          <li key={row.key}>
                            第 {row.rowIndex} 行：
                            {row.errors.map((e) => `[${e.field}] ${e.message}`).join('；')}
                          </li>
                        ))}
                      {previewRows.filter((r) => r.errors.length > 0).length > 5 && (
                        <li style={{ color: '#999' }}>
                          ... 还有{' '}
                          {previewRows.filter((r) => r.errors.length > 0).length - 5}{' '}
                          行存在错误
                        </li>
                      )}
                    </ul>
                  </>
                }
              />
            )}

            {/* 预览表格 / 虚拟列表 */}
            {previewRows.length === 0 ? (
              <Empty description="暂无数据" />
            ) : previewRows.length > VIRTUAL_THRESHOLD ? (
              <VirtualPreviewTable
                rows={previewRows}
                onCellChange={handleCellChange}
                columns={previewColumns}
              />
            ) : (
              <Table<ImportPreviewRow>
                dataSource={previewRows}
                columns={previewColumns}
                rowKey="key"
                size="small"
                pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'] }}
                scroll={{ x: 'max-content' }}
                rowClassName={(record) =>
                  record.errors.length > 0 ? 'row-error' : ''
                }
                expandable={{
                  expandedRowRender: (record) =>
                    record.errors.length > 0 ? (
                      <div style={{ padding: '4px 0' }}>
                        {record.errors.map((err, i) => (
                          <Tag key={i} color="volcano" style={{ marginBottom: 4 }}>
                            [{err.field}] {err.message}
                          </Tag>
                        ))}
                      </div>
                    ) : null,
                  rowExpandable: (record) => record.errors.length > 0,
                }}
              />
            )}

            {/* 底部操作栏 */}
            {hasErrors && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
                message="请修正上方表格中的错误行，修正后错误高亮将自动解除"
              />
            )}
          </div>
        )}

        {/* ---------- Submitting ---------- */}
        {phase === 'submitting' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">正在提交入库，请稍候…</Text>
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  /* ======================== Render: Export Tab ======================== */

  const renderExportView = () => (
    <div>
      <Card
        title={
          <Space>
            <DownloadOutlined />
            <span>台账数据导出</span>
          </Space>
        }
      >
        <Form
          form={exportForm}
          layout="inline"
          style={{ flexWrap: 'wrap', gap: 8 }}
        >
          <Form.Item name="category" label="资产分类">
            <Select
              placeholder="全部分类"
              allowClear
              style={{ width: 180 }}
              options={[
                { value: 'electronic', label: '电子设备' },
                { value: 'furniture', label: '办公家具' },
                { value: 'vehicle', label: '车辆设备' },
                { value: 'building', label: '建筑设施' },
                { value: 'other', label: '其他' },
              ]}
            />
          </Form.Item>

          <Form.Item name="status" label="资产状态">
            <Select
              placeholder="全部状态"
              allowClear
              style={{ width: 180 }}
              options={[
                { value: 'in_use', label: '使用中' },
                { value: 'idle', label: '闲置' },
                { value: 'maintenance', label: '维修中' },
                { value: 'retired', label: '已报废' },
              ]}
            />
          </Form.Item>

          <Form.Item name="location" label="存放位置">
            <Select
              placeholder="全部地点"
              allowClear
              style={{ width: 180 }}
              options={[
                { value: 'area_a', label: 'A区' },
                { value: 'area_b', label: 'B区' },
                { value: 'warehouse', label: '中央仓库' },
                { value: 'hq', label: '总部大楼' },
              ]}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={isExporting}
              onClick={handleExport}
            >
              导出 Excel 台账
            </Button>
          </Form.Item>
        </Form>

        <Divider />

        <div style={{ padding: 16, background: '#f6f8fa', borderRadius: 6 }}>
          <Space>
            <EditOutlined />
            <Text type="secondary">
              系统将根据上方筛选条件从数据库中提取符合条件的资产记录并生成 Excel
              文件。导出的文件包含资产编号、名称、分类、状态、存放位置、购置日期及当前价值等字段。
            </Text>
          </Space>
        </div>

        <div style={{ marginTop: 16 }}>
          <Alert
            type="info"
            showIcon
            message="导出提示"
            description="如果查询结果超过 50,000 条，系统将自动切换至后台异步生成模式，完成后可在「下载中心」获取文件。"
          />
        </div>
      </Card>
    </div>
  );

  /* ======================== Main render ======================== */

  return (
    <div className="asset-import-export-page">
      {/* Tab 切换 */}
      <div
        className="import-export-tabs"
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid #f0f0f0',
          marginBottom: 16,
          background: '#fff',
          borderRadius: '8px 8px 0 0',
          padding: '0 16px',
        }}
      >
        <button
          type="button"
          className={`import-export-tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: activeTab === 'import' ? 600 : 400,
            color: activeTab === 'import' ? '#1890ff' : '#666',
            borderBottom: activeTab === 'import' ? '2px solid #1890ff' : '2px solid transparent',
            transition: 'all 0.2s',
          }}
          data-testid="tab-import"
        >
          <UploadOutlined style={{ marginRight: 6 }} />
          批量导入
        </button>
        <button
          type="button"
          className={`import-export-tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
          style={{
            padding: '12px 24px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: activeTab === 'export' ? 600 : 400,
            color: activeTab === 'export' ? '#1890ff' : '#666',
            borderBottom: activeTab === 'export' ? '2px solid #1890ff' : '2px solid transparent',
            transition: 'all 0.2s',
          }}
          data-testid="tab-export"
        >
          <DownloadOutlined style={{ marginRight: 6 }} />
          台账导出
        </button>
      </div>

      {/* Tab 内容 */}
      <div>
        {activeTab === 'import' ? renderImportView() : renderExportView()}
      </div>

      {/* 全局样式 —— 错误行高亮 */}
      <style>{`
        .row-error {
          background-color: #3b1c1c !important;
        }
        .ant-table .row-error:hover > td {
          background-color: #fff1f0 !important;
        }
        .ant-table .row-error td {
          border-bottom-color: #7f1d1d !important;
        }
        .asset-import-export-page {
          min-height: calc(100vh - 160px);
          background: #f0f2f5;
          padding: 16px;
        }
        .asset-import-export-page .ant-card {
          border-radius: 0 0 8px 8px;
        }
      `}</style>
    </div>
  );
};

export default ImportTab;