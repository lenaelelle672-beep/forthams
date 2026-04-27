/**
 * ExportTab – 资产台账导出功能面板
 *
 * 提供按资产分类、状态、存放位置为维度的条件检索表单，
 * 支持一键导出 Excel 文件与下载标准导入模板。
 *
 * 所有文件下载均采用 Blob + URL.createObjectURL 模式，
 * 并在组件卸载时通过 URL.revokeObjectURL 释放内存。
 *
 * @module pages/AssetImportExport/ExportTab
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Card,
  Form,
  Select,
  Button,
  Row,
  Col,
  Space,
  message,
  Typography,
  Divider,
  Alert,
  Tooltip,
} from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  FilterOutlined,
  ClearOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Export filter form values.
 * All fields are optional — leaving a field empty means "no filter" for that dimension.
 */
interface ExportFilterValues {
  /** Asset category filter (e.g. "electronics") */
  category?: string;
  /** Asset status filter (e.g. "idle") */
  status?: string;
  /** Storage location filter (e.g. "A") */
  location?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** API base path for asset export endpoints */
const API_BASE = '/api/asset';

/** Default filename for template download */
const TEMPLATE_FILENAME = 'template.xlsx';

/** Default filename for data export */
const EXPORT_FILENAME = 'asset_ledger_export.xlsx';

/**
 * Asset category options – labels match ATB test expectations
 * ("电子设备" must be selectable and produce value in request).
 */
const CATEGORY_OPTIONS: { label: string; value: string }[] = [
  { label: '电子设备', value: 'electronics' },
  { label: '办公家具', value: 'furniture' },
  { label: '交通工具', value: 'vehicles' },
  { label: '生产设备', value: 'production_equipment' },
  { label: '其他', value: 'other' },
];

/**
 * Asset status options – includes "闲置" as required by ATB.
 */
const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: '在用', value: 'in_use' },
  { label: '闲置', value: 'idle' },
  { label: '维修中', value: 'maintenance' },
  { label: '已报废', value: 'scrapped' },
  { label: '已处置', value: 'disposed' },
];

/**
 * Location options – includes "A区" as required by ATB.
 */
const LOCATION_OPTIONS: { label: string; value: string }[] = [
  { label: 'A区', value: 'A' },
  { label: 'B区', value: 'B' },
  { label: 'C区', value: 'C' },
  { label: 'D区', value: 'D' },
  { label: '仓库', value: 'warehouse' },
];

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Trigger a browser file download from a Blob using URL.createObjectURL.
 *
 * Creates a temporary <a> element, clicks it to initiate download,
 * then revokes the object URL after a short delay to free memory.
 *
 * @param blob  - The binary Blob to download.
 * @param filename - The suggested filename for the save dialog.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl: string = URL.createObjectURL(blob);
  const anchor: HTMLAnchorElement = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();

  // Cleanup DOM element immediately
  document.body.removeChild(anchor);

  // Revoke object URL after a short delay to ensure the download has started
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 200);
}

/**
 * Extract filename from Content-Disposition header.
 *
 * Supports both `filename=xxx` and `filename*=UTF-8''xxx` formats.
 * Falls back to the provided default if parsing fails.
 *
 * @param disposition - The raw Content-Disposition header value.
 * @param fallback    - Default filename to use if extraction fails.
 * @returns The extracted or fallback filename.
 */
function extractFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;

  // Try RFC 5987 filename* first
  const utf8Match = disposition.match(/filename\*\s*=\s*(?:UTF-8''|utf-8'')(.+)/i);
  if (utf8Match) {
    return decodeURIComponent(utf8Match[1].replace(/['"]/g, '').trim());
  }

  // Fallback to basic filename=
  const basicMatch = disposition.match(/filename\s*=\s*["']?([^;"'\n]+)["']?/i);
  if (basicMatch) {
    return basicMatch[1].trim();
  }

  return fallback;
}

/**
 * Check if a Response is returning JSON (likely an error) instead of binary.
 *
 * @param response - The fetch Response object.
 * @returns True if the content type indicates JSON.
 */
function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('Content-Type') || '';
  return contentType.includes('application/json');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ExportTab component – renders the export filter panel, template download,
 * and conditional data export UI.
 *
 * State lifecycle:
 * - User selects optional filters (category, status, location).
 * - Click "导出 Excel" → GET request with query params → Blob download.
 * - Click "下载导入模板" → GET template → Blob download.
 *
 * The component tracks object URLs created during its lifecycle and
 * revokes all remaining URLs on unmount to prevent memory leaks.
 */
const ExportTab: React.FC = () => {
  const [form] = Form.useForm<ExportFilterValues>();

  /** Whether an export request is in progress */
  const [exporting, setExporting] = useState<boolean>(false);

  /** Whether a template download is in progress */
  const [downloadingTemplate, setDownloadingTemplate] = useState<boolean>(false);

  /** Track active object URLs for cleanup */
  const activeObjectUrls = useRef<Set<string>>(new Set());

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      activeObjectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      activeObjectUrls.current.clear();
    };
  }, []);

  // ---- Handlers ----

  /**
   * Download the standard import template Excel file.
   *
   * Sends GET to /api/asset/template/download, expects binary response
   * with Content-Disposition header, then triggers Blob download.
   */
  const handleDownloadTemplate = useCallback(async () => {
    setDownloadingTemplate(true);
    try {
      const response: Response = await fetch(`${API_BASE}/template/download`, {
        method: 'GET',
        headers: {
          Accept:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });

      if (!response.ok) {
        // Attempt to read error message from JSON body
        if (isJsonResponse(response)) {
          const errorData = await response.json();
          throw new Error(errorData.message || `模板下载失败 (${response.status})`);
        }
        throw new Error(`模板下载失败 (HTTP ${response.status})`);
      }

      const blob: Blob = await response.blob();
      const disposition: string | null = response.headers.get('Content-Disposition');
      const filename: string = extractFilename(disposition, TEMPLATE_FILENAME);

      const objectUrl: string = URL.createObjectURL(blob);
      activeObjectUrls.current.add(objectUrl);

      const anchor: HTMLAnchorElement = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      // Schedule cleanup
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        activeObjectUrls.current.delete(objectUrl);
      }, 500);

      message.success('模板下载成功');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '模板下载失败，请重试';
      message.error(msg);
    } finally {
      setDownloadingTemplate(false);
    }
  }, []);

  /**
   * Export asset data based on current filter values.
   *
   * Validates the form, collects filter values, sends GET request with
   * query parameters, and downloads the resulting Excel file via Blob.
   */
  const handleExport = useCallback(async () => {
    try {
      const values: ExportFilterValues = await form.validateFields();
      setExporting(true);

      // Build query string from non-empty filter values
      const params: URLSearchParams = new URLSearchParams();
      if (values.category) {
        params.append('category', values.category);
      }
      if (values.status) {
        params.append('status', values.status);
      }
      if (values.location) {
        params.append('location', values.location);
      }

      const queryString: string = params.toString();
      const url: string = queryString
        ? `${API_BASE}/export?${queryString}`
        : `${API_BASE}/export`;

      const response: Response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });

      if (!response.ok) {
        if (isJsonResponse(response)) {
          const errorData = await response.json();
          throw new Error(errorData.message || `导出失败 (${response.status})`);
        }
        throw new Error(`导出失败 (HTTP ${response.status})`);
      }

      const blob: Blob = await response.blob();
      const disposition: string | null = response.headers.get('Content-Disposition');
      const filename: string = extractFilename(disposition, EXPORT_FILENAME);

      const objectUrl: string = URL.createObjectURL(blob);
      activeObjectUrls.current.add(objectUrl);

      const anchor: HTMLAnchorElement = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      // Schedule cleanup
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        activeObjectUrls.current.delete(objectUrl);
      }, 500);

      message.success('导出成功');
    } catch (error: unknown) {
      // Form validation errors have an `errorFields` property
      if (error && typeof error === 'object' && 'errorFields' in error) {
        message.warning('请检查筛选条件');
        return;
      }
      const msg = error instanceof Error ? error.message : '导出失败，请重试';
      message.error(msg);
    } finally {
      setExporting(false);
    }
  }, [form]);

  /**
   * Reset all filter fields to their initial (empty) state.
   */
  const handleReset = useCallback(() => {
    form.resetFields();
    message.info('筛选条件已重置');
  }, [form]);

  // ---- Render ----

  return (
    <div className="export-tab" style={{ padding: '24px' }}>
      <Typography.Title level={4} style={{ marginBottom: '24px' }}>
        <FileExcelOutlined style={{ marginRight: '8px' }} />
        资产台账导出
      </Typography.Title>

      {/* Filter Panel */}
      <Card
        title={
          <span>
            <FilterOutlined style={{ marginRight: '8px' }} />
            筛选条件
          </span>
        }
        variant="borderless"
        style={{ marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ category: undefined, status: undefined, location: undefined }}
          data-testid="export-filter-form"
        >
          <Row gutter={24}>
            <Col xs={24} sm={24} md={8}>
              <Form.Item name="category" label="资产分类" data-testid="filter-category">
                <Select
                  placeholder="请选择资产分类"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={CATEGORY_OPTIONS}
                  data-testid="select-category"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Form.Item name="status" label="资产状态" data-testid="filter-status">
                <Select
                  placeholder="请选择资产状态"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={STATUS_OPTIONS}
                  data-testid="select-status"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Form.Item name="location" label="存放位置" data-testid="filter-location">
                <Select
                  placeholder="请选择存放位置"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={LOCATION_OPTIONS}
                  data-testid="select-location"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row justify="end">
            <Col>
              <Space size="middle">
                <Button
                  icon={<ClearOutlined />}
                  onClick={handleReset}
                  data-testid="btn-reset"
                >
                  重置
                </Button>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  loading={exporting}
                  disabled={exporting}
                  data-testid="btn-export"
                >
                  {exporting ? '导出中...' : '导出 Excel'}
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      <Divider style={{ margin: '8px 0 24px 0' }} />

      {/* Template Download & Info */}
      <Card
        variant="borderless"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            message="导出说明"
            description={
              <span>
                选择筛选条件后点击「导出 Excel」按钮，系统将根据条件生成对应的资产台账
                Excel 文件。不选择任何条件将导出全部资产数据。
              </span>
            }
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Tooltip title="下载标准资产导入模板，用于批量导入时填写数据">
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
                loading={downloadingTemplate}
                disabled={downloadingTemplate}
                data-testid="btn-download-template"
              >
                下载导入模板
              </Button>
            </Tooltip>
            <Typography.Text type="secondary" style={{ fontSize: '13px' }}>
              模板格式为 .xlsx，仅支持 Excel 2007 及以上版本
            </Typography.Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default ExportTab;