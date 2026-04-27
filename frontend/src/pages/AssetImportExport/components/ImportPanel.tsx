/**
 * ImportPanel 组件
 *
 * 资产批量导入面板，提供以下能力：
 * - Excel 导入模板下载
 * - 拖拽/点击上传 .xlsx 文件（单文件，≤10MB）
 * - 上传进度实时展示
 * - 解析结果预览表格（分页 20 行/页）
 * - 行级校验错误高亮与内联修正
 * - 确认提交导入并展示结果摘要
 *
 * @module AssetImportExport/ImportPanel
 */
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Button,
  Progress,
  Table,
  Tag,
  Alert,
  Space,
  Typography,
  message,
  Input,
  Badge,
  Spin,
  Upload,
} from 'antd';
import type { UploadProps } from 'antd';
import {
  DownloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  RedoOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useAssetImport } from '../hooks/useAssetImport';
import { downloadBlob } from '../../../utils/fileDownloader';
import { validateUploadFile } from '../../../utils/fileValidator';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// ---------------------------------------------------------------------------
// Types — 匹配 SPEC 数据约束
// ---------------------------------------------------------------------------

/** 解析返回的单条资产行数据 */
interface AssetRow {
  /** 行号 */
  rowNumber: number;
  /** 资产名称 */
  name: string;
  /** 分类编码 */
  categoryCode: string;
  /** 状态编码 */
  statusCode: string;
  /** 位置编码 */
  locationCode: string;
  /** 购置日期 YYYY-MM-DD */
  purchaseDate: string;
  /** 原值 */
  originalValue: number;
  /** 扩展字段 */
  [key: string]: unknown;
}

/** 行级校验错误 */
interface RowError {
  /** 行号 */
  rowNumber: number;
  /** 出错字段名 */
  field: string;
  /** 错误描述 */
  message: string;
}

/** 解析接口响应 */
interface ParseResponse {
  /** 解析批次 ID */
  parseId: string;
  /** 解析出的资产行列表 */
  rows: AssetRow[];
  /** 校验错误列表 */
  errors: RowError[];
}

/** 提交接口响应 */
interface CommitResponse {
  /** 是否成功 */
  success: boolean;
  /** 成功导入数量 */
  importedCount: number;
  /** 失败数量 */
  failedCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ImportPanel — 资产批量导入面板
 *
 * 负责从模板下载、文件上传、解析预览、行级修正到确认提交的完整导入链路。
 */
const ImportPanel: React.FC = () => {
  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  /** 是否正在上传 */
  const [uploading, setUploading] = useState(false);
  /** 上传百分比 */
  const [uploadProgress, setUploadProgress] = useState(0);
  /** 上传是否失败 */
  const [uploadFailed, setUploadFailed] = useState(false);
  /** 解析响应（含 parseId / rows / errors） */
  const [parseResponse, setParseResponse] = useState<ParseResponse | null>(null);
  /** 用户修正后的行数据 key=rowNumber */
  const [editedRows, setEditedRows] = useState<Map<number, AssetRow>>(new Map());
  /** 已清除错误的字段 "rowNumber-field" */
  const [clearedErrors, setClearedErrors] = useState<Set<string>>(new Set());
  /** 是否正在提交 */
  const [committing, setCommitting] = useState(false);
  /** 提交结果 */
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  /** 当前上传文件（用于重试） */
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  /** 并发上传锁（ref 避免闭包过期） */
  const uploadingRef = useRef(false);

  // -----------------------------------------------------------------------
  // Hooks
  // -----------------------------------------------------------------------

  const { downloadTemplate, parseFile, commitImport } = useAssetImport();

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------

  /**
   * 构建错误映射：rowNumber → field → message（已清除的错误不包含）
   */
  const errorMap = useMemo(() => {
    const map = new Map<number, Map<string, string>>();
    if (!parseResponse?.errors) return map;
    for (const err of parseResponse.errors) {
      const key = `${err.rowNumber}-${err.field}`;
      if (clearedErrors.has(key)) continue;
      if (!map.has(err.rowNumber)) {
        map.set(err.rowNumber, new Map());
      }
      map.get(err.rowNumber)!.set(err.field, err.message);
    }
    return map;
  }, [parseResponse, clearedErrors]);

  /** 仍有未清除错误的行号集合 */
  const errorRowNumbers = useMemo(() => {
    const s = new Set<number>();
    if (!parseResponse?.errors) return s;
    for (const err of parseResponse.errors) {
      const key = `${err.rowNumber}-${err.field}`;
      if (!clearedErrors.has(key)) {
        s.add(err.rowNumber);
      }
    }
    return s;
  }, [parseResponse, clearedErrors]);

  /** 原始出现过错误的行号集合（用于判断"已修正"标记） */
  const originalErrorRows = useMemo(() => {
    const s = new Set<number>();
    if (!parseResponse?.errors) return s;
    for (const err of parseResponse.errors) {
      s.add(err.rowNumber);
    }
    return s;
  }, [parseResponse]);

  /** 至少存在一行有效数据 */
  const hasValidRows = useMemo(() => {
    if (!parseResponse?.rows?.length) return false;
    return parseResponse.rows.some(row => !errorRowNumbers.has(row.rowNumber));
  }, [parseResponse, errorRowNumbers]);

  /** 合并编辑后的展示行 */
  const displayRows = useMemo(() => {
    if (!parseResponse?.rows) return [];
    return parseResponse.rows.map(row => {
      const edited = editedRows.get(row.rowNumber);
      return edited ? { ...row, ...edited } : { ...row };
    });
  }, [parseResponse, editedRows]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  /**
   * 下载 Excel 导入模板
   *
   * 调用后端 GET /api/v1/assets/import/template，以 Blob 方式触发浏览器下载，
   * 下载完成后通过 downloadBlob 自动调用 URL.revokeObjectURL 释放内存。
   */
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const blob = await downloadTemplate();
      downloadBlob(blob, 'asset_import_template.xlsx');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '下载模板失败，请稍后重试';
      message.error(msg);
    }
  }, [downloadTemplate]);

  /**
   * 上传并解析文件
   *
   * 1. 并发防护：若已有文件在上传则拒绝
   * 2. 前端校验：类型 .xlsx + 大小 ≤ 10MB
   * 3. 通过 parseFile 上传并获取解析结果
   *
   * @param file - 待上传的文件对象
   */
  const handleUpload = useCallback(
    async (file: File) => {
      // 并发上传防护
      if (uploadingRef.current) {
        message.warning('当前有文件正在上传，请等待完成');
        return;
      }

      // 前端校验
      const validation = validateUploadFile(file);
      if (!validation.valid) {
        message.error(validation.message);
        return;
      }

      // 重置状态
      setCurrentFile(file);
      uploadingRef.current = true;
      setUploading(true);
      setUploadProgress(0);
      setUploadFailed(false);
      setParseResponse(null);
      setCommitResult(null);
      setEditedRows(new Map());
      setClearedErrors(new Set());

      try {
        const response = await parseFile(file, (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded / progressEvent.total) * 100,
            );
            setUploadProgress(percent);
          }
        });
        setParseResponse(response);
      } catch (error: unknown) {
        setUploadFailed(true);
        const msg = error instanceof Error ? error.message : '上传解析失败';
        message.error(msg);
      } finally {
        uploadingRef.current = false;
        setUploading(false);
      }
    },
    [parseFile],
  );

  /**
   * 重试上传（使用上一次的文件）
   */
  const handleRetry = useCallback(() => {
    if (currentFile) {
      handleUpload(currentFile);
    }
  }, [currentFile, handleUpload]);

  /**
   * 编辑单元格值
   *
   * 仅校验失败行可编辑。编辑后立即清除该字段对应的错误标记，
   * 行状态变为"已修正"（橙色标记）。
   *
   * @param rowNumber - 行号
   * @param field     - 字段名
   * @param value     - 新值
   */
  const handleCellEdit = useCallback(
    (rowNumber: number, field: string, value: unknown) => {
      if (!parseResponse) return;
      const originalRow = parseResponse.rows.find(r => r.rowNumber === rowNumber);
      if (!originalRow) return;

      setEditedRows(prev => {
        const next = new Map(prev);
        const existing = next.get(rowNumber) || { ...originalRow };
        next.set(rowNumber, { ...existing, [field]: value });
        return next;
      });

      // 清除该字段错误
      setClearedErrors(prev => {
        const next = new Set(prev);
        next.add(`${rowNumber}-${field}`);
        return next;
      });
    },
    [parseResponse],
  );

  /**
   * 确认提交导入
   *
   * 将修正后的数据连同 parseId 提交至后端，
   * 成功后展示导入结果摘要（成功/失败数量）。
   */
  const handleCommit = useCallback(async () => {
    if (!parseResponse || committing) return;

    setCommitting(true);
    try {
      // 合并修正数据
      const mergedRows = parseResponse.rows.map(row => {
        const edited = editedRows.get(row.rowNumber);
        return edited ? { ...row, ...edited } : row;
      });

      const result = await commitImport(parseResponse.parseId, mergedRows);
      setCommitResult(result);
      message.success(
        `成功导入 ${result.importedCount} 条资产，${result.failedCount} 条失败`,
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '提交失败';
      message.error(msg);
    } finally {
      setCommitting(false);
    }
  }, [parseResponse, editedRows, committing, commitImport]);

  /**
   * 重置到初始状态
   */
  const handleReset = useCallback(() => {
    setParseResponse(null);
    setCommitResult(null);
    setEditedRows(new Map());
    setClearedErrors(new Set());
    setUploadProgress(0);
    setUploadFailed(false);
    setUploading(false);
    setCurrentFile(null);
    uploadingRef.current = false;
  }, []);

  // -----------------------------------------------------------------------
  // Dragger config
  // -----------------------------------------------------------------------

  const uploadProps: UploadProps = {
    accept: '.xlsx',
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      if (uploadingRef.current) {
        message.warning('当前有文件正在上传，请等待完成');
        return Upload.LIST_IGNORE;
      }
      const validation = validateUploadFile(file);
      if (!validation.valid) {
        message.error(validation.message);
        return Upload.LIST_IGNORE;
      }
      handleUpload(file as File);
      return false; // 阻止 Ant Design 默认上传行为
    },
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  /**
   * 渲染可编辑单元格
   *
   * 仅在字段存在校验错误时渲染为 Input（蓝色下划线），
   * 校验通过的单元格以纯文本展示，不可编辑。
   *
   * @param value   - 当前值
   * @param record  - 行数据
   * @param field   - 字段名
   * @param numeric - 是否为数值字段
   */
  const renderEditableCell = (
    value: unknown,
    record: AssetRow,
    field: string,
    numeric = false,
  ) => {
    const errMsg = errorMap.get(record.rowNumber)?.get(field);
    if (errMsg) {
      return (
        <div>
          <Input
            type={numeric ? 'number' : 'text'}
            value={(value ?? (numeric ? 0 : '')) as string | number}
            onChange={(e) =>
              handleCellEdit(
                record.rowNumber,
                field,
                numeric ? parseFloat(e.target.value) || 0 : e.target.value,
              )
            }
            style={{ textDecoration: 'underline', borderColor: '#1890ff' }}
            status="error"
          />
          <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 2 }}>
            {errMsg}
          </div>
        </div>
      );
    }
    return <span>{String(value ?? '')}</span>;
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  // ---- 状态：提交完成 ----
  if (commitResult) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
        <Title level={3} style={{ marginTop: 24 }}>
          导入完成
        </Title>
        <div style={{ margin: '24px 0' }}>
          <Alert
            message={`成功导入 ${commitResult.importedCount} 条资产，${commitResult.failedCount} 条失败`}
            type={commitResult.failedCount > 0 ? 'warning' : 'success'}
            showIcon
            style={{ display: 'inline-block', textAlign: 'left' }}
          />
        </div>
        <Button type="primary" onClick={handleReset}>
          继续导入
        </Button>
      </div>
    );
  }

  // ---- 状态：预览表格 ----
  if (parseResponse && !uploadFailed) {
    const columns = [
      {
        title: '序号',
        dataIndex: 'rowNumber',
        key: 'rowNumber',
        width: 100,
        render: (val: number) => {
          const wasError = originalErrorRows.has(val);
          const stillHasError = errorRowNumbers.has(val);
          return (
            <Space size={4}>
              <span>{val}</span>
              {wasError && !stillHasError && (
                <Badge status="warning" text="已修正" />
              )}
            </Space>
          );
        },
      },
      {
        title: '资产名称',
        dataIndex: 'name',
        key: 'name',
        render: (val: string, record: AssetRow) =>
          renderEditableCell(val, record, 'name'),
      },
      {
        title: '分类',
        dataIndex: 'categoryCode',
        key: 'categoryCode',
        render: (val: string, record: AssetRow) =>
          renderEditableCell(val, record, 'categoryCode'),
      },
      {
        title: '状态',
        dataIndex: 'statusCode',
        key: 'statusCode',
        render: (val: string, record: AssetRow) =>
          renderEditableCell(val, record, 'statusCode'),
      },
      {
        title: '位置',
        dataIndex: 'locationCode',
        key: 'locationCode',
        render: (val: string, record: AssetRow) =>
          renderEditableCell(val, record, 'locationCode'),
      },
      {
        title: '购置日期',
        dataIndex: 'purchaseDate',
        key: 'purchaseDate',
        render: (val: string, record: AssetRow) =>
          renderEditableCell(val, record, 'purchaseDate'),
      },
      {
        title: '原值',
        dataIndex: 'originalValue',
        key: 'originalValue',
        render: (val: number, record: AssetRow) =>
          renderEditableCell(val, record, 'originalValue', true),
      },
      {
        title: '校验状态',
        key: 'validationStatus',
        width: 120,
        render: (_: unknown, record: AssetRow) => {
          const hasError = errorRowNumbers.has(record.rowNumber);
          const wasError = originalErrorRows.has(record.rowNumber);
          const isCorrected = wasError && !hasError;
          if (isCorrected) {
            return <Tag color="orange">已修正</Tag>;
          }
          if (hasError) {
            return (
              <Tag color="red" icon={<WarningOutlined />}>
                校验失败
              </Tag>
            );
          }
          return (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              通过
            </Tag>
          );
        },
      },
    ];

    return (
      <div>
        {/* 顶部操作栏 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              解析结果预览
            </Title>
            <Tag color="blue">{displayRows.length} 行数据</Tag>
            {errorRowNumbers.size > 0 && (
              <Tag color="red">{errorRowNumbers.size} 行错误</Tag>
            )}
          </Space>
          <Space>
            <Button onClick={handleReset}>取消</Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleCommit}
              loading={committing}
              disabled={!hasValidRows || committing}
            >
              {committing ? '提交中...' : '确认导入'}
            </Button>
          </Space>
        </div>

        {/* 提示信息 */}
        <Alert
          message="请检查以下解析结果。红色背景行存在校验错误，点击对应单元格可进行修正。"
          type="info"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />

        {/* 预览表格 */}
        <Table
          dataSource={displayRows}
          columns={columns}
          rowKey="rowNumber"
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 行`,
          }}
          scroll={{ x: 1200 }}
          rowClassName={(record) => {
            const hasError = errorRowNumbers.has(record.rowNumber);
            const wasError = originalErrorRows.has(record.rowNumber);
            if (hasError) return 'import-row-error';
            if (wasError) return 'import-row-corrected';
            return 'import-row-success';
          }}
        />

        {/* 行级样式 */}
        <style>{`
          .import-row-error td { background-color: #FFF2F0 !important; }
          .import-row-success td { background-color: #F6FFED !important; }
          .import-row-corrected td { background-color: #FFF7E6 !important; }
        `}</style>
      </div>
    );
  }

  // ---- 状态：上传区域（初始 / 上传中 / 失败） ----
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* 模板下载按钮 */}
      <div style={{ marginBottom: 24 }}>
        <Button
          icon={<DownloadOutlined />}
          onClick={handleDownloadTemplate}
          size="large"
          disabled={uploading}
        >
          下载导入模板
        </Button>
      </div>

      {/* 拖拽上传区域 */}
      <Dragger {...uploadProps}>
        {uploadFailed ? (
          /* 上传失败状态：红色进度条 */
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <Progress
              percent={100}
              status="exception"
              strokeColor="#ff4d4f"
              style={{ maxWidth: 400, margin: '0 auto' }}
            />
            <Title level={4} type="danger" style={{ marginTop: 16 }}>
              上传失败
            </Title>
            <p style={{ color: '#999' }}>可拖入新文件或点击下方按钮重试</p>
          </div>
        ) : uploading ? (
          /* 上传中状态：蓝色进度条 */
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Progress
                percent={uploadProgress}
                status="active"
                strokeColor="#1890ff"
                style={{ maxWidth: 400, margin: '0 auto' }}
              />
              <Text style={{ display: 'block', marginTop: 8 }}>
                {uploadProgress < 100
                  ? `上传中 ${uploadProgress}%`
                  : '解析中...'}
              </Text>
            </div>
          </div>
        ) : (
          /* 初始状态：上传提示 */
          <>
            <p style={{ marginBottom: 16 }}>
              <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            </p>
            <p style={{ fontSize: 16, color: '#333' }}>
              将 .xlsx 文件拖到此处，或
              <span style={{ color: '#1890ff' }}>点击选择文件</span>
            </p>
            <p style={{ color: '#999', fontSize: 13 }}>
              仅支持 .xlsx 格式，文件大小不超过 10MB
            </p>
          </>
        )}
      </Dragger>

      {/* 上传失败时的操作按钮（放在 Dragger 外部避免触发文件选择） */}
      {uploadFailed && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Space>
            <Button
              icon={<RedoOutlined />}
              type="primary"
              onClick={handleRetry}
            >
              重试
            </Button>
            <Button onClick={handleReset}>取消</Button>
          </Space>
        </div>
      )}
    </div>
  );
};

export default ImportPanel;