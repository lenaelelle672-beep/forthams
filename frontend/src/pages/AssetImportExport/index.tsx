import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Tabs,
  Button,
  Upload,
  message,
  Card,
  Table,
  Tag,
  Space,
  Input,
  Select,
  Modal,
  Progress,
  Alert,
  TreeSelect,
  Cascader,
  Badge,
  Typography,
  InputNumber,
  Divider,
} from 'antd';
import {
  DownloadOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';

/* ==================== Types ==================== */

/** 解析返回的资产行数据 */
interface AssetRow {
  rowNumber: number;
  name: string;
  categoryCode: string;
  statusCode: string;
  locationCode: string;
  purchaseDate: string;
  originalValue: number;
  [key: string]: any;
}

/** 行级校验错误 */
interface RowError {
  rowNumber: number;
  field: string;
  message: string;
}

/** 解析接口响应 */
interface ParseResponse {
  parseId: string;
  rows: AssetRow[];
  errors: RowError[];
}

/** 提交接口响应 */
interface CommitResponse {
  success: boolean;
  importedCount: number;
  failedCount: number;
}

/** 分类树节点 */
interface CategoryTreeNode {
  value: string;
  title: string;
  children?: CategoryTreeNode[];
}

/** 位置级联选项 */
interface LocationCascadeOption {
  value: string;
  label: string;
  children?: LocationCascadeOption[];
}

/* ==================== Constants ==================== */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const PAGE_SIZE = 20;

/** 资产状态选项（硬编码） */
const STATUS_OPTIONS = [
  { value: 'in_use', label: '在用' },
  { value: 'idle', label: '闲置' },
  { value: 'maintenance', label: '维修中' },
  { value: 'scrapped', label: '报废' },
];

/** 导入流程阶段 */
type ImportPhase = 'idle' | 'uploading' | 'parsing' | 'preview' | 'failed' | 'complete';

/* ==================== Utility Functions ==================== */

/**
 * Blob 下载工具函数
 * 创建临时 <a> 链接触发浏览器下载，下载完成后立即调用 URL.revokeObjectURL 释放内存
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 文件上传前校验
 * 校验文件扩展名（仅允许 .xlsx）和文件大小（≤ 10MB）
 */
function validateUploadFile(file: File): { valid: boolean; message?: string } {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (ext !== '.xlsx') {
    return { valid: false, message: '仅支持 .xlsx 格式文件' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: '文件大小不能超过 10MB' };
  }
  return { valid: true };
}

/**
 * 从 Content-Disposition 响应头解析文件名
 * 支持 filename 和 filename* 两种格式
 */
function parseFilenameFromHeader(
  disposition: string | undefined,
  fallback: string,
): string {
  if (!disposition) return fallback;
  const utf8Match = disposition.match(/filename\*?=(?:UTF-8'')?([^;\n]+)/i);
  if (utf8Match) {
    return decodeURIComponent(utf8Match[1].replace(/["']/g, ''));
  }
  const asciiMatch = disposition.match(/filename="?([^";\n]+)"?/i);
  if (asciiMatch) {
    return asciiMatch[1].replace(/["']/g, '');
  }
  return fallback;
}

/**
 * 生成导出文件名
 * 格式：资产台账_YYYYMMDD_HHmmss.xlsx，时间戳取前端当前时间
 */
function generateExportFilename(): string {
  const now = dayjs();
  return `资产台账_${now.format('YYYYMMDD')}_${now.format('HHmmss')}.xlsx`;
}

/**
 * 将后端返回的 RowError 数组转换为按行号索引的 Map
 * 键为 rowNumber，值为 { [field]: message } 的错误字段映射
 */
function buildErrorMap(
  errors: RowError[],
): Map<number, Record<string, string>> {
  const map = new Map<number, Record<string, string>>();
  for (const err of errors) {
    const existing = map.get(err.rowNumber) || {};
    existing[err.field] = err.message;
    map.set(err.rowNumber, existing);
  }
  return map;
}

/* ==================== Main Page Component ==================== */

/**
 * 资产批量导入导出页面
 * 路由: /assets/import-export
 * 包含「导入」和「导出」两个 Tab 面板
 */
export default function AssetImportExportPage() {
  const [activeTab, setActiveTab] = useState<string>('import');

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <Typography.Title level={3} style={{ marginBottom: 24 }}>
        资产批量导入导出
      </Typography.Title>
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'import', label: '导入', children: <ImportPanel /> },
            { key: 'export', label: '导出', children: <ExportPanel /> },
          ]}
        />
      </Card>
    </div>
  );
}

/* ==================== Import Panel ==================== */

/**
 * 导入面板
 * 完整流程：下载模板 → 拖拽/点击上传 → 进度条 → 解析预览 → 行级错误修正 → 确认提交
 */
function ImportPanel() {
  /* --- State --- */
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseId, setParseId] = useState('');
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [errorMap, setErrorMap] = useState<Map<number, Record<string, string>>>(
    new Map(),
  );
  const [modifiedRows, setModifiedRows] = useState<Set<number>>(new Set());
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  /* --- Derived state --- */

  /** 存在校验错误的行号集合 */
  const errorRowNumbers = useMemo(
    () => new Set(errorMap.keys()),
    [errorMap],
  );

  /** 是否存在至少一行有效数据（用于控制提交按钮可用性） */
  const hasValidRows = useMemo(() => {
    return rows.length > 0 && rows.some((r) => !errorRowNumbers.has(r.rowNumber));
  }, [rows, errorRowNumbers]);

  /* --- 模板下载 --- */
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const response = await axios.get('/api/v1/assets/import/template', {
        responseType: 'blob',
      });
      const filename = parseFilenameFromHeader(
        response.headers['content-disposition'],
        'asset_import_template.xlsx',
      );
      downloadBlob(new Blob([response.data]), filename);
    } catch (err: any) {
      if (err.response?.status === 401) {
        message.error('登录已过期');
        window.location.href = '/login';
        return;
      }
      message.error('模板下载失败，请稍后重试');
    }
  }, []);

  /* --- 上传并解析文件 --- */
  const doUpload = useCallback(async (file: File) => {
    setCurrentFile(file);
    setPhase('uploading');
    setUploadProgress(0);
    setParseId('');
    setRows([]);
    setErrorMap(new Map());
    setModifiedRows(new Set());
    setCommitResult(null);
    setCommitting(false);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post<ParseResponse>(
        '/api/v1/assets/import/parse',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (evt) => {
            if (evt.total) {
              const pct = Math.round((evt.loaded * 100) / evt.total);
              setUploadProgress(pct);
              if (pct >= 100) {
                setPhase('parsing');
              }
            }
          },
        },
      );

      const data = response.data;
      setParseId(data.parseId);
      setRows(data.rows);
      setErrorMap(buildErrorMap(data.errors));
      setPhase('preview');
    } catch (err: any) {
      if (err.response?.status === 401) {
        message.error('登录已过期');
        window.location.href = '/login';
        return;
      }
      setPhase('failed');
    }
  }, []);

  /** Upload beforeUpload 钩子：校验 + 并发防护 */
  const handleBeforeUpload = useCallback(
    (file: File) => {
      // 并发上传防护（ATB-019）
      if (phase === 'uploading' || phase === 'parsing') {
        message.warning('当前有文件正在上传，请等待完成');
        return Upload.LIST_IGNORE;
      }
      // 文件校验
      const validation = validateUploadFile(file);
      if (!validation.valid) {
        message.error(validation.message);
        return Upload.LIST_IGNORE;
      }
      // 校验通过，执行自定义上传逻辑
      doUpload(file);
      return Upload.LIST_IGNORE; // 阻止 Ant Design 默认上传行为
    },
    [phase, doUpload],
  );

  /* --- 重试上传 --- */
  const handleRetry = useCallback(() => {
    if (currentFile) {
      doUpload(currentFile);
    }
  }, [currentFile, doUpload]);

  /* --- 单元格编辑（仅校验失败行可编辑） --- */
  const handleCellEdit = useCallback(
    (rowNumber: number, field: string, value: any) => {
      // 更新行数据
      setRows((prev) =>
        prev.map((row) =>
          row.rowNumber === rowNumber ? { ...row, [field]: value } : row,
        ),
      );
      // 移除该字段的错误标记
      setErrorMap((prev) => {
        const next = new Map(prev);
        const rowErrors = next.get(rowNumber);
        if (rowErrors && field in rowErrors) {
          const updated = { ...rowErrors };
          delete updated[field];
          if (Object.keys(updated).length === 0) {
            next.delete(rowNumber);
          } else {
            next.set(rowNumber, updated);
          }
        }
        return next;
      });
      // 标记该行为「已修正」
      setModifiedRows((prev) => new Set(prev).add(rowNumber));
    },
    [],
  );

  /* --- 确认提交导入 --- */
  const handleCommit = useCallback(async () => {
    if (!hasValidRows || committing) return;

    setCommitting(true);
    try {
      const response = await axios.post<CommitResponse>(
        '/api/v1/assets/import/commit',
        { parseId, rows },
      );
      setCommitResult(response.data);
      setPhase('complete');
      message.success(
        `成功导入 ${response.data.importedCount} 条资产，${response.data.failedCount} 条失败`,
      );
    } catch (err: any) {
      if (err.response?.status === 401) {
        message.error('登录已过期');
        window.location.href = '/login';
      } else {
        message.error('提交失败，请重试');
      }
    } finally {
      setCommitting(false);
    }
  }, [hasValidRows, committing, parseId, rows]);

  /* --- 重置整个导入流程 --- */
  const handleReset = useCallback(() => {
    setPhase('idle');
    setUploadProgress(0);
    setParseId('');
    setRows([]);
    setErrorMap(new Map());
    setModifiedRows(new Set());
    setCommitResult(null);
    setCurrentFile(null);
    setCommitting(false);
  }, []);

  /* --- 可编辑单元格渲染器 --- */
  const renderEditableCell = useCallback(
    (record: AssetRow, field: string, text: React.ReactNode) => {
      const isErrorRow = errorRowNumbers.has(record.rowNumber);
      if (!isErrorRow) {
        return <span>{text}</span>;
      }

      const fieldError = errorMap.get(record.rowNumber)?.[field];

      return (
        <div>
          <Input
            value={String(text ?? '')}
            onChange={(e) =>
              handleCellEdit(record.rowNumber, field, e.target.value)
            }
            bordered={false}
            style={{
              borderBottom: '1px solid #1890ff',
              borderRadius: 0,
              padding: '2px 4px',
            }}
          />
          {fieldError && (
            <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 2 }}>
              {fieldError}
            </div>
          )}
        </div>
      );
    },
    [errorRowNumbers, errorMap, handleCellEdit],
  );

  /* --- 预览表格列定义 --- */
  const columns: ColumnsType<AssetRow> = useMemo(
    () => [
      {
        title: '序号',
        dataIndex: 'rowNumber',
        key: 'rowNumber',
        width: 60,
        align: 'center' as const,
      },
      {
        title: '资产名称',
        dataIndex: 'name',
        key: 'name',
        width: 160,
        render: (text: string, record: AssetRow) =>
          renderEditableCell(record, 'name', text),
      },
      {
        title: '分类',
        dataIndex: 'categoryCode',
        key: 'categoryCode',
        width: 100,
        render: (text: string, record: AssetRow) =>
          renderEditableCell(record, 'categoryCode', text),
      },
      {
        title: '状态',
        dataIndex: 'statusCode',
        key: 'statusCode',
        width: 100,
        render: (text: string, record: AssetRow) =>
          renderEditableCell(record, 'statusCode', text),
      },
      {
        title: '位置',
        dataIndex: 'locationCode',
        key: 'locationCode',
        width: 120,
        render: (text: string, record: AssetRow) =>
          renderEditableCell(record, 'locationCode', text),
      },
      {
        title: '购置日期',
        dataIndex: 'purchaseDate',
        key: 'purchaseDate',
        width: 120,
        render: (text: string, record: AssetRow) =>
          renderEditableCell(record, 'purchaseDate', text),
      },
      {
        title: '原值',
        dataIndex: 'originalValue',
        key: 'originalValue',
        width: 120,
        align: 'right' as const,
        render: (val: number, record: AssetRow) => {
          if (errorRowNumbers.has(record.rowNumber)) {
            const fieldError = errorMap.get(record.rowNumber)?.['originalValue'];
            return (
              <div>
                <InputNumber
                  value={val}
                  onChange={(v) =>
                    handleCellEdit(record.rowNumber, 'originalValue', v)
                  }
                  bordered={false}
                  min={0}
                  style={{
                    width: '100%',
                    borderBottom: '1px solid #1890ff',
                  }}
                />
                {fieldError && (
                  <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 2 }}>
                    {fieldError}
                  </div>
                )}
              </div>
            );
          }
          return <span>{val != null ? val.toLocaleString() : ''}</span>;
        },
      },
      {
        title: '校验状态',
        key: 'validationStatus',
        width: 120,
        align: 'center' as const,
        render: (_: any, record: AssetRow) => {
          const hasErr = errorRowNumbers.has(record.rowNumber);
          const isModified = modifiedRows.has(record.rowNumber);

          if (isModified && !hasErr) {
            return <Badge status="warning" text="已修正" />;
          }
          if (hasErr) {
            return <Badge status="error" text="校验失败" />;
          }
          return <Badge status="success" text="通过" />;
        },
      },
    ],
    [renderEditableCell, errorRowNumbers, errorMap, handleCellEdit, modifiedRows],
  );

  /* --- 自定义表格行组件（行背景色） --- */
  const tableComponents = useMemo(
    () => ({
      body: {
        row: (props: any) => {
          const rowKey = Number(props['data-row-key']);
          const backgroundColor = errorRowNumbers.has(rowKey)
            ? '#FFF2F0'
            : '#F6FFED';
          return (
            <tr
              {...props}
              style={{ ...props.style, backgroundColor }}
            >
              {props.children}
            </tr>
          );
        },
      },
    }),
    [errorRowNumbers],
  );

  /* ==================== Render ==================== */

  return (
    <div>
      {/* 模板下载按钮 */}
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<DownloadOutlined />}
          onClick={handleDownloadTemplate}
          disabled={phase === 'uploading' || phase === 'parsing'}
        >
          下载导入模板
        </Button>
      </div>

      {/* ====== 上传区域（idle 阶段） ====== */}
      {phase === 'idle' && (
        <Upload.Dragger
          name="file"
          accept=".xlsx"
          multiple={false}
          maxCount={1}
          showUploadList={false}
          beforeUpload={handleBeforeUpload}
          style={{ padding: '40px 20px' }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16 }}>
            将 .xlsx 文件拖到此处，或点击选择文件
          </p>
          <p className="ant-upload-hint" style={{ color: '#999' }}>
            支持 .xlsx 格式，单文件最大 10MB
          </p>
        </Upload.Dragger>
      )}

      {/* ====== 上传进度条（uploading / parsing 阶段） ====== */}
      {(phase === 'uploading' || phase === 'parsing') && (
        <Card style={{ textAlign: 'center', padding: 24 }}>
          <Progress
            percent={phase === 'parsing' ? 100 : uploadProgress}
            status={phase === 'parsing' ? 'active' : 'normal'}
            style={{ maxWidth: 400, margin: '0 auto' }}
          />
          <p style={{ marginTop: 16, color: '#666' }}>
            {phase === 'parsing'
              ? '文件上传完成，正在解析...'
              : `上传中 ${uploadProgress}%`}
          </p>
        </Card>
      )}

      {/* ====== 上传失败（failed 阶段） ====== */}
      {phase === 'failed' && (
        <Card style={{ textAlign: 'center', padding: 24 }}>
          <Progress
            percent={100}
            status="exception"
            style={{ maxWidth: 400, margin: '0 auto' }}
          />
          <p style={{ marginTop: 16, color: '#ff4d4f', fontSize: 16 }}>
            上传失败
          </p>
          <Space style={{ marginTop: 16 }}>
            <Button type="primary" icon={<ReloadOutlined />} onClick={handleRetry}>
              重试
            </Button>
            <Button onClick={handleReset}>取消</Button>
          </Space>
        </Card>
      )}

      {/* ====== 解析预览表格（preview / complete 阶段） ====== */}
      {(phase === 'preview' || phase === 'complete') && (
        <div>
          {/* 工具栏 */}
          <div
            style={{
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重新上传
              </Button>
              {rows.length > 0 && (
                <Tag color={errorRowNumbers.size > 0 ? 'error' : 'success'}>
                  {errorRowNumbers.size > 0
                    ? `${errorRowNumbers.size} 行校验失败，${rows.length - errorRowNumbers.size} 行通过`
                    : `全部 ${rows.length} 行校验通过`}
                </Tag>
              )}
            </Space>

            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              disabled={!hasValidRows || committing || phase === 'complete'}
              loading={committing}
              onClick={handleCommit}
            >
              {phase === 'complete' ? '导入完成' : '确认导入'}
            </Button>
          </div>

          {/* 提交结果摘要 */}
          {commitResult && (
            <Alert
              type={commitResult.failedCount > 0 ? 'warning' : 'success'}
              message={`成功导入 ${commitResult.importedCount} 条资产，${commitResult.failedCount} 条失败`}
              showIcon
              closable
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 预览表格 */}
          <Table
            dataSource={rows}
            columns={columns}
            rowKey="rowNumber"
            components={tableComponents}
            pagination={{
              pageSize: PAGE_SIZE,
              showTotal: (total) => `共 ${total} 条`,
              showSizeChanger: false,
            }}
            size="middle"
            bordered
            scroll={{ x: 1000 }}
          />
        </div>
      )}
    </div>
  );
}

/* ==================== Export Panel ==================== */

/**
 * 导出面板
 * 三维度筛选：资产分类（树形选择）、资产状态（多选）、存放位置（级联选择）
 * 无筛选条件时弹出确认对话框
 */
function ExportPanel() {
  const [categoryCodes, setCategoryCodes] = useState<string[]>([]);
  const [statusCodes, setStatusCodes] = useState<string[]>([]);
  const [locationCodes, setLocationCodes] = useState<string[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryTreeNode[]>([]);
  const [locationCascade, setLocationCascade] = useState<LocationCascadeOption[]>(
    [],
  );
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);

  /* 加载筛选器选项数据 */
  useEffect(() => {
    Promise.all([
      axios
        .get<CategoryTreeNode[]>('/api/v1/asset-categories/tree')
        .catch(() => ({ data: [] as CategoryTreeNode[] })),
      axios
        .get<LocationCascadeOption[]>('/api/v1/asset-locations/cascade')
        .catch(() => ({ data: [] as LocationCascadeOption[] })),
    ]).then(([catRes, locRes]) => {
      setCategoryTree(catRes.data);
      setLocationCascade(locRes.data);
      setLoading(false);
    });
  }, []);

  /** 执行导出 API 调用并触发下载 */
  const doExport = useCallback(async () => {
    setExporting(true);
    try {
      const response = await axios.post(
        '/api/v1/assets/export',
        { categoryCodes, statusCodes, locationCodes },
        { responseType: 'blob' },
      );

      const filename = generateExportFilename();
      downloadBlob(new Blob([response.data]), filename);
      message.success('导出成功，文件已开始下载');
    } catch (err: any) {
      if (err.response?.status === 401) {
        message.error('登录已过期');
        window.location.href = '/login';
      } else {
        message.error('导出失败，请稍后重试');
      }
    } finally {
      setExporting(false);
    }
  }, [categoryCodes, statusCodes, locationCodes]);

  /** 导出按钮点击：空条件时弹出确认框 */
  const handleExportClick = useCallback(() => {
    const hasFilters =
      categoryCodes.length > 0 ||
      statusCodes.length > 0 ||
      locationCodes.length > 0;

    if (!hasFilters) {
      Modal.confirm({
        title: '确认导出',
        content: '未设置筛选条件，将导出全部资产，是否继续？',
        okText: '确定',
        cancelText: '取消',
        onOk: doExport,
      });
    } else {
      doExport();
    }
  }, [categoryCodes, statusCodes, locationCodes, doExport]);

  /* ==================== Render ==================== */

  return (
    <Card loading={loading}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* 资产分类 - TreeSelect */}
        <div style={{ marginBottom: 24 }}>
          <Typography.Text
            strong
            style={{ display: 'block', marginBottom: 8 }}
          >
            资产分类
          </Typography.Text>
          <TreeSelect
            treeData={categoryTree}
            value={categoryCodes}
            onChange={(val: string[]) => setCategoryCodes(val)}
            treeCheckable
            showCheckedStrategy={TreeSelect.SHOW_CHILD}
            placeholder="请选择资产分类"
            style={{ width: '100%' }}
            allowClear
          />
        </div>

        {/* 资产状态 - 多选 Select */}
        <div style={{ marginBottom: 24 }}>
          <Typography.Text
            strong
            style={{ display: 'block', marginBottom: 8 }}
          >
            资产状态
          </Typography.Text>
          <Select
            mode="multiple"
            value={statusCodes}
            onChange={(val: string[]) => setStatusCodes(val)}
            options={STATUS_OPTIONS}
            placeholder="请选择资产状态"
            style={{ width: '100%' }}
            allowClear
          />
        </div>

        {/* 存放位置 - Cascader */}
        <div style={{ marginBottom: 24 }}>
          <Typography.Text
            strong
            style={{ display: 'block', marginBottom: 8 }}
          >
            存放位置
          </Typography.Text>
          <Cascader
            options={locationCascade}
            value={locationCodes}
            onChange={(val: any) => setLocationCodes((val as string[]) || [])}
            placeholder="请选择存放位置"
            style={{ width: '100%' }}
            allowClear
            changeOnSelect
          />
        </div>

        <Divider />

        {/* 导出按钮 */}
        <div style={{ textAlign: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<ExportOutlined />}
            loading={exporting}
            onClick={handleExportClick}
            style={{ minWidth: 200 }}
          >
            导出
          </Button>
        </div>
      </div>
    </Card>
  );
}