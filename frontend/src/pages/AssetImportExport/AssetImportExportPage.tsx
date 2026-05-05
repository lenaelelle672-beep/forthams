import React, { useState, useMemo, useEffect } from 'react';
import {
  Tabs,
  Button,
  Upload,
  Card,
  Table,
  Tag,
  Alert,
  Progress,
  Modal,
  Select,
  TreeSelect,
  Cascader,
  Space,
  message,
  Typography,
  Input,
  Result,
  Divider,
} from 'antd';
import {
  InboxOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// ==================== 类型定义 ====================

/** 资产行数据（对应后端解析返回的行结构） */
interface AssetRow {
  rowNumber: number;
  name: string;
  categoryCode: string;
  statusCode: string;
  locationCode: string;
  purchaseDate: string;
  originalValue: number;
  [key: string]: unknown;
}

/** 行级校验错误 */
interface RowError {
  rowNumber: number;
  field: string;
  message: string;
}

/** 解析结果（POST /import/parse 返回） */
interface ParseResult {
  parseId: string;
  rows: AssetRow[];
  errors: RowError[];
}

/** 提交结果（POST /import/commit 返回） */
interface CommitResult {
  success: boolean;
  importedCount: number;
  failedCount: number;
}

/** 导出筛选条件（POST /export 请求体） */
interface ExportFilters {
  categoryCodes: string[];
  statusCodes: string[];
  locationCodes: string[];
}

/** 级联选项（存放位置） */
interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
  isLeaf?: boolean;
}

/** 导入面板阶段状态机 */
type ImportPhase =
  | 'idle'           // 等待上传
  | 'uploading'      // 上传中（显示进度）
  | 'parsing'        // 上传完成，等待后端解析
  | 'preview'        // 解析完成，显示预览表格
  | 'uploadFailed'   // 上传/解析失败，可重试
  | 'submitting'     // 提交中
  | 'completed';     // 提交完成，显示结果摘要

// ==================== 常量 ====================

/** 单文件大小上限 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 资产状态选项（导出筛选面板硬编码） */
const STATUS_OPTIONS = [
  { label: '在用', value: 'IN_USE' },
  { label: '闲置', value: 'IDLE' },
  { label: '维修中', value: 'MAINTAINING' },
  { label: '报废', value: 'SCRAPPED' },
];

/** 校验失败行背景色 */
const ROW_ERROR_BG = '#FFF2F0';
/** 校验通过行背景色 */
const ROW_VALID_BG = '#F6FFED';
/** 可编辑单元格下划线色 */
const EDITABLE_UNDERLINE_COLOR = '#1890ff';

// ==================== 工具函数 ====================

/**
 * 使用 Blob + URL.createObjectURL 触发浏览器文件下载。
 * 下载完成后调用 URL.revokeObjectURL() 释放内存。
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * 校验上传文件：仅允许 .xlsx 格式，大小不超过 10MB。
 * 返回 { valid: boolean, message: string }。
 */
function validateUploadFile(file: File): { valid: boolean; message: string } {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (ext !== '.xlsx') {
    return { valid: false, message: '仅支持 .xlsx 格式文件' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: '文件大小不能超过 10MB' };
  }
  return { valid: true, message: '' };
}

// ==================== Axios 实例（含 401 拦截） ====================

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 120000,
});

/** 响应拦截器：Token 过期时展示 Toast 并跳转登录页 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      message.error('登录已过期');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    }
    return Promise.reject(error);
  }
);

// ==================== 注入行级背景色样式 ====================

const rowStyles = `
  .import-row-error td { background-color: ${ROW_ERROR_BG} !important; }
  .import-row-valid td { background-color: ${ROW_VALID_BG} !important; }
  .import-row-error:hover > td { background-color: #fff1f0 !important; }
  .import-row-valid:hover > td { background-color: #f0ffe6 !important; }
`;

// ==================== 主组件 ====================

const AssetImportExportPage: React.FC = () => {
  // ---------- Tab 状态 ----------
  const [activeTab, setActiveTab] = useState<string>('import');

  // ---------- 导入状态 ----------
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseId, setParseId] = useState('');
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [originalErrors, setOriginalErrors] = useState<RowError[]>([]);
  /** 记录用户编辑过的 `${rowNumber}-${field}` 组合，编辑后移除对应错误提示 */
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  // ---------- 导出状态 ----------
  const [categoryTree, setCategoryTree] = useState<Array<{ value: string; title: string; children?: unknown[] }>>([]);
  const [locationCascade, setLocationCascade] = useState<CascaderOption[]>([]);
  const [exportCategoryCodes, setExportCategoryCodes] = useState<string[]>([]);
  const [exportStatusCodes, setExportStatusCodes] = useState<string[]>([]);
  /** Cascader 多选值为 string[][]，每项为路径数组 */
  const [exportLocationValues, setExportLocationValues] = useState<string[][]>([]);
  const [exportLoading, setExportLoading] = useState(false);

  // ---------- 派生状态 ----------

  /**
   * 当前仍有错误的字段映射（排除已被用户编辑清除的）。
   * key = rowNumber, value = 未清除的 RowError[]
   */
  const errorsMap = useMemo(() => {
    const map = new Map<number, RowError[]>();
    originalErrors.forEach((err) => {
      const key = `${err.rowNumber}-${err.field}`;
      if (!editedFields.has(key)) {
        const list = map.get(err.rowNumber) || [];
        list.push(err);
        map.set(err.rowNumber, list);
      }
    });
    return map;
  }, [originalErrors, editedFields]);

  /** 初始就存在错误的行号集合 */
  const originalErrorRowNumbers = useMemo(() => {
    const s = new Set<number>();
    originalErrors.forEach((e) => s.add(e.rowNumber));
    return s;
  }, [originalErrors]);

  /** 用户编辑过的行号集合 */
  const editedRowNumbers = useMemo(() => {
    const s = new Set<number>();
    editedFields.forEach((key) => {
      const rn = parseInt(key.split('-')[0], 10);
      s.add(rn);
    });
    return s;
  }, [editedFields]);

  /** 当前无剩余错误的行号（可作为有效数据提交） */
  const validRowNumbers = useMemo(() => {
    return new Set(
      rows.filter((r) => !errorsMap.has(r.rowNumber)).map((r) => r.rowNumber)
    );
  }, [rows, errorsMap]);

  /** 是否存在至少一行有效数据 */
  const hasAnyValidRow = validRowNumbers.size > 0;

  // ---------- 导入处理函数 ----------

  /** 下载导入模板：GET /api/v1/assets/import/template → Blob 下载 */
  const handleDownloadTemplate = async () => {
    try {
      const res = await apiClient.get('/assets/import/template', {
        responseType: 'blob',
      });
      downloadBlob(res.data, 'asset_import_template.xlsx');
    } catch {
      message.error('下载模板失败，请稍后重试');
    }
  };

  /**
   * 执行文件上传与解析：POST /api/v1/assets/import/parse
   * 使用 XMLHttpRequest 以获取上传进度。
   */
  const doUpload = (file: File) => {
    setImportPhase('uploading');
    setUploadProgress(0);
    setCurrentFile(file);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(pct);
        if (pct >= 100) {
          setImportPhase('parsing');
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const result: ParseResult = JSON.parse(xhr.responseText);
          setParseId(result.parseId);
          setRows(result.rows);
          setOriginalErrors(result.errors || []);
          setEditedFields(new Set());
          setCommitResult(null);
          setImportPhase('preview');
        } catch {
          setImportPhase('uploadFailed');
          message.error('解析返回数据格式异常');
        }
      } else if (xhr.status === 401) {
        // 由拦截器处理
      } else {
        setImportPhase('uploadFailed');
        try {
          const errBody = JSON.parse(xhr.responseText);
          message.error(errBody.message || '上传解析失败，请重试');
        } catch {
          message.error('上传解析失败，请重试');
        }
      }
    };

    xhr.onerror = () => {
      setImportPhase('uploadFailed');
      message.error('网络错误，请检查网络连接后重试');
    };

    xhr.open('POST', '/api/v1/assets/import/parse');
    xhr.send(formData);
  };

  /**
   * Dragger beforeUpload 回调：
   * 1. 并发上传防护
   * 2. 文件类型校验
   * 3. 文件大小校验
   * 返回 false 阻止 Ant Design 默认上传行为。
   */
  const handleBeforeUpload = (file: File) => {
    // ATB-019: 并发上传防护
    if (importPhase === 'uploading' || importPhase === 'parsing') {
      message.warning('当前有文件正在上传，请等待完成');
      return false;
    }
    const validation = validateUploadFile(file);
    if (!validation.valid) {
      message.error(validation.message);
      return false;
    }
    doUpload(file);
    return false;
  };

  /** 重试上传（使用上次上传的文件） */
  const handleRetry = () => {
    if (currentFile) {
      doUpload(currentFile);
    }
  };

  /**
   * 可编辑单元格值变更：
   * 更新行数据，并标记该字段为已编辑以移除错误提示。
   */
  const handleCellEdit = (rowNumber: number, field: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.rowNumber === rowNumber ? { ...r, [field]: value } : r))
    );
    setEditedFields((prev) => {
      const next = new Set(prev);
      next.add(`${rowNumber}-${field}`);
      return next;
    });
  };

  /**
   * 确认提交导入：POST /api/v1/assets/import/commit
   * 发送 parseId + 用户修正后的全部 rows。
   */
  const handleCommit = async () => {
    if (!parseId) return;
    setImportPhase('submitting');
    try {
      const res = await apiClient.post<CommitResult>('/assets/import/commit', {
        parseId,
        rows,
      });
      setCommitResult(res.data);
      setImportPhase('completed');
    } catch {
      message.error('提交失败，请稍后重试');
      setImportPhase('preview');
    }
  };

  /** 重置导入流程回到初始状态 */
  const handleResetImport = () => {
    setImportPhase('idle');
    setUploadProgress(0);
    setParseId('');
    setRows([]);
    setOriginalErrors([]);
    setEditedFields(new Set());
    setCommitResult(null);
    setCurrentFile(null);
  };

  // ---------- 导出处理函数 ----------

  /** 页面加载时获取分类树和位置级联数据 */
  useEffect(() => {
    apiClient
      .get('/asset-categories/tree')
      .then((res) => setCategoryTree(res.data || []))
      .catch(() => {});
    apiClient
      .get('/asset-locations/cascade')
      .then((res) => setLocationCascade(res.data || []))
      .catch(() => {});
  }, []);

  /**
   * 执行导出：POST /api/v1/assets/export
   * 返回文件流，使用 Blob + downloadBlob 触发下载。
   */
  const doExport = async (filters: ExportFilters) => {
    setExportLoading(true);
    try {
      const res = await apiClient.post('/assets/export', filters, {
        responseType: 'blob',
      });
      const timestamp = dayjs().format('YYYYMMDD_HHmmss');
      downloadBlob(res.data, `资产台账_${timestamp}.xlsx`);
      message.success('导出成功');
    } catch {
      message.error('导出失败，请稍后重试');
    } finally {
      setExportLoading(false);
    }
  };

  /**
   * 导出按钮点击：
   * - 有筛选条件时直接导出
   * - 无筛选条件时弹出确认对话框（ATB-015）
   */
  const handleExport = () => {
    const hasFilters =
      exportCategoryCodes.length > 0 ||
      exportStatusCodes.length > 0 ||
      exportLocationValues.length > 0;

    if (!hasFilters) {
      Modal.confirm({
        title: '导出确认',
        icon: <ExclamationCircleOutlined />,
        content: '未设置筛选条件，将导出全部资产，是否继续？',
        okText: '确定',
        cancelText: '取消',
        onOk: () => doExport({ categoryCodes: [], statusCodes: [], locationCodes: [] }),
      });
    } else {
      // 从级联选择值中提取叶子节点作为 locationCodes
      const locationCodes = exportLocationValues.map((path) => path[path.length - 1]);
      doExport({
        categoryCodes: exportCategoryCodes,
        statusCodes: exportStatusCodes,
        locationCodes,
      });
    }
  };

  // ---------- 表格辅助函数 ----------

  /** 获取某行某字段当前剩余的错误信息列表 */
  const getFieldErrors = (rowNumber: number, field: string): string[] => {
    const errs = errorsMap.get(rowNumber);
    if (!errs) return [];
    return errs.filter((e) => e.field === field).map((e) => e.message);
  };

  /** 判断行是否属于"可编辑行"（该行初始就有校验错误） */
  const isRowEditable = (rowNumber: number): boolean => {
    return originalErrorRowNumbers.has(rowNumber);
  };

  /**
   * 渲染可编辑/只读单元格。
   * - 仅校验失败行允许编辑（ATB-010）
   * - 可编辑单元格加蓝色下划线标识
   * - 有错误的单元格显示红色错误提示
   */
  const renderEditableCell = (
    rowNumber: number,
    field: string,
    value: unknown,
    editable: boolean,
    type: 'text' | 'number' = 'text',
  ) => {
    const fieldErrors = getFieldErrors(rowNumber, field);

    if (!editable) {
      return (
        <span>
          {String(value ?? '')}
          {fieldErrors.length > 0 && (
            <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 2 }}>
              {fieldErrors.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}
        </span>
      );
    }

    return (
      <div>
        <Input
          value={value != null ? String(value) : ''}
          onChange={(e) => handleCellEdit(rowNumber, field, e.target.value)}
          type={type}
          size="small"
          status={fieldErrors.length > 0 ? 'error' : undefined}
          style={{
            borderBottom: `2px solid ${EDITABLE_UNDERLINE_COLOR}`,
            borderRadius: '2px 2px 0 0',
          }}
        />
        {fieldErrors.length > 0 && (
          <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 2 }}>
            {fieldErrors.map((msg, i) => (
              <div key={i}>{msg}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /** 判断某行是否仍存在剩余错误 */
  const hasRemainingErrors = (rowNumber: number): boolean => {
    return errorsMap.has(rowNumber);
  };

  // ---------- 表格列定义 ----------

  const columns: TableColumnsType<AssetRow> = [
    {
      title: '序号',
      dataIndex: 'rowNumber',
      key: 'rowNumber',
      width: 70,
      fixed: 'left',
    },
    {
      title: '资产名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (val: unknown, record) =>
        renderEditableCell(record.rowNumber, 'name', val, isRowEditable(record.rowNumber)),
    },
    {
      title: '分类',
      dataIndex: 'categoryCode',
      key: 'categoryCode',
      width: 120,
      render: (val: unknown, record) =>
        renderEditableCell(record.rowNumber, 'categoryCode', val, isRowEditable(record.rowNumber)),
    },
    {
      title: '状态',
      dataIndex: 'statusCode',
      key: 'statusCode',
      width: 100,
      render: (val: unknown, record) =>
        renderEditableCell(record.rowNumber, 'statusCode', val, isRowEditable(record.rowNumber)),
    },
    {
      title: '位置',
      dataIndex: 'locationCode',
      key: 'locationCode',
      width: 120,
      render: (val: unknown, record) =>
        renderEditableCell(record.rowNumber, 'locationCode', val, isRowEditable(record.rowNumber)),
    },
    {
      title: '购置日期',
      dataIndex: 'purchaseDate',
      key: 'purchaseDate',
      width: 140,
      render: (val: unknown, record) =>
        renderEditableCell(record.rowNumber, 'purchaseDate', val, isRowEditable(record.rowNumber)),
    },
    {
      title: '原值',
      dataIndex: 'originalValue',
      key: 'originalValue',
      width: 120,
      render: (val: unknown, record) =>
        renderEditableCell(
          record.rowNumber,
          'originalValue',
          val,
          isRowEditable(record.rowNumber),
          'number'
        ),
    },
    {
      title: '校验状态',
      key: 'validationStatus',
      width: 100,
      fixed: 'right',
      render: (_: unknown, record: AssetRow) => {
        const originallyFailed = originalErrorRowNumbers.has(record.rowNumber);
        const wasEdited = editedRowNumbers.has(record.rowNumber);
        const stillHasErrors = hasRemainingErrors(record.rowNumber);

        if (!originallyFailed) {
          // 从未有过错误 → 绿色「校验通过」
          return (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              校验通过
            </Tag>
          );
        }
        if (wasEdited) {
          // 有过错误且用户已编辑 → 橙色「已修正」
          return (
            <Tag color="warning" icon={<WarningOutlined />}>
              已修正
            </Tag>
          );
        }
        // 有错误但用户未编辑 → 红色「校验失败」
        return (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            校验失败
          </Tag>
        );
      },
    },
  ];

  // ---------- 导入面板渲染 ----------

  const renderImportPanel = () => {
    // ---- 提交完成：展示结果摘要 ----
    if (importPhase === 'completed' && commitResult) {
      return (
        <Card>
          <Result
            status={
              commitResult.failedCount === 0
                ? 'success'
                : commitResult.importedCount === 0
                  ? 'error'
                  : 'warning'
            }
            title={
              commitResult.failedCount === 0
                ? '全部导入成功'
                : `成功导入 ${commitResult.importedCount} 条资产，${commitResult.failedCount} 条失败`
            }
            subTitle="导入任务已完成"
            extra={[
              <Button key="again" type="primary" onClick={handleResetImport}>
                继续导入
              </Button>,
            ]}
          />
        </Card>
      );
    }

    return (
      <div>
        {/* ---- 下载导入模板按钮（导入 Tab 内始终可见） ---- */}
        <div style={{ marginBottom: 16 }}>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownloadTemplate}
            disabled={importPhase === 'submitting'}
          >
            下载导入模板
          </Button>
        </div>

        {/* ---- 拖拽上传区域（idle / uploading / parsing / uploadFailed 阶段可见） ---- */}
        {!['preview', 'submitting', 'completed'].includes(importPhase) && (
          <Dragger
            accept=".xlsx"
            showUploadList={false}
            beforeUpload={handleBeforeUpload}
            multiple={false}
            style={{ padding: importPhase === 'uploadFailed' ? '24px 0' : '40px 0' }}
          >
            {/* 空闲状态 */}
            {importPhase === 'idle' && (
              <>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                </p>
                <p className="ant-upload-text" style={{ fontSize: 16 }}>
                  将 .xlsx 文件拖到此处，或点击选择文件
                </p>
                <p className="ant-upload-hint" style={{ color: '#999' }}>
                  支持 .xlsx 格式，文件大小不超过 10MB
                </p>
              </>
            )}

            {/* 上传中 */}
            {importPhase === 'uploading' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Title level={5} style={{ margin: '0 0 12px 0' }}>
                  上传中 {uploadProgress}%
                </Title>
                <Progress
                  percent={uploadProgress}
                  status="active"
                  strokeColor="#1890ff"
                  style={{ maxWidth: 400 }}
                />
              </div>
            )}

            {/* 解析中 */}
            {importPhase === 'parsing' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Title level={5} style={{ margin: '0 0 12px 0' }}>
                  解析中...
                </Title>
                <Progress
                  percent={100}
                  status="active"
                  strokeColor="#1890ff"
                  style={{ maxWidth: 400 }}
                />
              </div>
            )}

            {/* 上传失败 */}
            {importPhase === 'uploadFailed' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Title level={5} style={{ margin: '0 0 12px 0', color: '#ff4d4f' }}>
                  上传失败
                </Title>
                <Progress
                  percent={uploadProgress}
                  status="exception"
                  style={{ maxWidth: 400, marginBottom: 16 }}
                />
                <Button icon={<ReloadOutlined />} type="primary" onClick={handleRetry}>
                  重试
                </Button>
              </div>
            )}
          </Dragger>
        )}

        {/* ---- 解析结果预览表格（preview / submitting 阶段） ---- */}
        {(importPhase === 'preview' || importPhase === 'submitting') && (
          <>
            {/* 操作栏 */}
            <div
              style={{
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Space>
                <Text strong>预览数据（共 {rows.length} 行）</Text>
                {errorsMap.size > 0 && (
                  <Tag color="error">{errorsMap.size} 行存在校验错误</Tag>
                )}
                {validRowNumbers.size > 0 && (
                  <Tag color="success">{validRowNumbers.size} 行校验通过</Tag>
                )}
              </Space>
              <Space>
                <Button onClick={handleResetImport}>取消</Button>
                <Button
                  type="primary"
                  loading={importPhase === 'submitting'}
                  disabled={!hasAnyValidRow || importPhase === 'submitting'}
                  onClick={handleCommit}
                >
                  {importPhase === 'submitting' ? '提交中...' : '确认导入'}
                </Button>
              </Space>
            </div>

            {/* 全部行均无效时的警告 */}
            {!hasAnyValidRow && rows.length > 0 && (
              <Alert
                message="所有行均存在校验错误，请修正后提交"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {/* 预览表格 */}
            <Table<AssetRow>
              dataSource={rows}
              columns={columns}
              rowKey="rowNumber"
              pagination={{
                pageSize: 20,
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 行`,
              }}
              scroll={{ x: 930 }}
              size="small"
              rowClassName={(record) =>
                errorsMap.has(record.rowNumber) ? 'import-row-error' : 'import-row-valid'
              }
            />

            {/* 行级背景色样式注入 */}
            <style>{rowStyles}</style>
          </>
        )}
      </div>
    );
  };

  // ---------- 导出面板渲染 ----------

  const renderExportPanel = () => (
    <Card title="导出条件筛选">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 资产分类 — TreeSelect（树形选择） */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            资产分类
          </Text>
          <TreeSelect
            treeData={categoryTree}
            value={exportCategoryCodes.length > 0 ? exportCategoryCodes : undefined}
            onChange={(val) => setExportCategoryCodes(val as string[])}
            treeCheck
            showCheckedStrategy={TreeSelect.SHOW_CHILD}
            placeholder="请选择资产分类"
            allowClear
            treeDefaultExpandAll
            style={{ width: '100%' }}
            dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
          />
        </div>

        {/* 资产状态 — Select（多选） */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            资产状态
          </Text>
          <Select
            mode="multiple"
            value={exportStatusCodes.length > 0 ? exportStatusCodes : undefined}
            onChange={(val) => setExportStatusCodes(val)}
            options={STATUS_OPTIONS}
            placeholder="请选择资产状态（可多选）"
            allowClear
            style={{ width: '100%' }}
          />
        </div>

        {/* 存放位置 — Cascader（级联选择） */}
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            存放位置
          </Text>
          <Cascader
            options={locationCascade}
            value={exportLocationValues.length > 0 ? exportLocationValues : undefined}
            onChange={(val) => setExportLocationValues(val as string[][])}
            placeholder="请选择存放位置"
            changeOnSelect
            multiple
            allowClear
            style={{ width: '100%' }}
          />
        </div>

        <Divider />

        {/* 导出按钮 */}
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={exportLoading}
          onClick={handleExport}
          size="large"
          disabled={exportLoading}
        >
          导出
        </Button>
      </Space>
    </Card>
  );

  // ---------- 主渲染 ----------

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        资产批量导入导出
      </Title>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'import',
            label: '导入',
            children: renderImportPanel(),
          },
          {
            key: 'export',
            label: '导出',
            children: renderExportPanel(),
          },
        ]}
      />
    </div>
  );
};

export default AssetImportExportPage;