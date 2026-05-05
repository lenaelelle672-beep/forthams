import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Select,
  Button,
  Space,
  message,
  Modal,
  TreeSelect,
  Cascader,
  Row,
  Col,
  Spin,
  Alert,
} from 'antd';
import { DownloadOutlined, ExportOutlined } from '@ant-design/icons';
import axios from 'axios';

/** 资产状态选项（硬编码，ATB-014 要求） */
const STATUS_OPTIONS = [
  { label: '在用', value: 'IN_USE' },
  { label: '闲置', value: 'IDLE' },
  { label: '维修中', value: 'MAINTENANCE' },
  { label: '报废', value: 'SCRAPPED' },
];

/**
 * 生成导出文件名
 * 格式：资产台账_YYYYMMDD_HHmmss.xlsx（Spec [3.3]）
 */
function generateExportFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const mo = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  return `资产台账_${y}${mo}${d}_${h}${mi}${s}.xlsx`;
}

/**
 * Blob 下载工具函数
 * 使用 URL.createObjectURL 创建临时链接触发下载，完成后调用 URL.revokeObjectURL 释放内存（ATB-017）
 *
 * @param blob  - 文件 Blob 对象
 * @param filename - 下载文件名
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** 导出筛选请求体结构（Spec 数据约束） */
interface ExportFilters {
  categoryCodes: string[];
  statusCodes: string[];
  locationCodes: string[];
}

/** 分类树节点结构 */
interface CategoryTreeNode {
  title: string;
  value: string;
  key: string;
  children?: CategoryTreeNode[];
}

/** 位置级联选项结构 */
interface LocationCascadeOption {
  label: string;
  value: string;
  children?: LocationCascadeOption[];
}

/**
 * 导出面板组件（Spec Layer 3）
 *
 * 提供资产分类（树形选择）、资产状态（多选）、存放位置（级联选择）三维度筛选，
 * 并通过 POST /api/v1/assets/export 以 JSON body 发送筛选条件，
 * 前端以 Blob + URL.createObjectURL 方式触发 .xlsx 文件下载。
 */
const ExportPanel: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [categoryTree, setCategoryTree] = useState<CategoryTreeNode[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationCascadeOption[]>([]);
  const [fetchingData, setFetchingData] = useState(true);

  /** 挂载时并行获取分类树与位置级联数据（Spec [3.1]） */
  useEffect(() => {
    const fetchData = async () => {
      setFetchingData(true);
      const results = await Promise.allSettled([
        axios.get('/api/v1/asset-categories/tree'),
        axios.get('/api/v1/asset-locations/cascade'),
      ]);

      // 处理分类树结果
      if (results[0].status === 'fulfilled') {
        const res = results[0].value;
        setCategoryTree(res.data?.data || res.data || []);
      } else {
        message.error('获取资产分类数据失败');
      }

      // 处理位置级联结果
      if (results[1].status === 'fulfilled') {
        const res = results[1].value;
        setLocationOptions(res.data?.data || res.data || []);
      } else {
        message.error('获取位置数据失败');
      }

      setFetchingData(false);
    };
    fetchData();
  }, []);

  /**
   * 检查是否设置了任何筛选条件
   * 用于决定是否需要弹出无条件导出确认框（ATB-015）
   */
  const hasFilters = useCallback((): boolean => {
    const values = form.getFieldsValue();
    const categoryCodes: string[] = values.categoryCodes || [];
    const statusCodes: string[] = values.statusCodes || [];
    const locationCodes: string[][] = values.locationCodes || [];
    return (
      categoryCodes.length > 0 ||
      statusCodes.length > 0 ||
      locationCodes.length > 0
    );
  }, [form]);

  /**
   * 执行导出操作
   * POST /api/v1/assets/export，以 Blob 方式接收文件流并触发下载
   */
  const doExport = useCallback(async () => {
    setLoading(true);
    try {
      const values = form.getFieldsValue();

      // Cascader multiple 模式返回 string[][]，提取每条路径的叶子节点作为 locationCode
      const locationPaths: string[][] = values.locationCodes || [];
      const locationCodes = locationPaths
        .map((path) => path[path.length - 1])
        .filter(Boolean);

      const filters: ExportFilters = {
        categoryCodes: values.categoryCodes || [],
        statusCodes: values.statusCodes || [],
        locationCodes,
      };

      const response = await axios.post('/api/v1/assets/export', filters, {
        responseType: 'blob',
      });

      // 使用 Blob + URL.createObjectURL 触发下载（Spec 安全约束：下载后 revokeObjectURL 释放内存）
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const filename = generateExportFilename();
      downloadBlob(blob, filename);
      message.success('导出成功');
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError?.response?.status === 401) {
        // Token 过期处理（ATB-018）
        message.error('登录已过期');
        window.location.href = '/login';
        return;
      }
      message.error('导出失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [form]);

  /**
   * 导出按钮点击处理
   * 未设置任何筛选条件时弹出确认对话框（ATB-015）
   */
  const handleExport = useCallback(() => {
    if (!hasFilters()) {
      Modal.confirm({
        title: '导出确认',
        content: '未设置筛选条件，将导出全部资产，是否继续？',
        okText: '确定',
        cancelText: '取消',
        onOk: () => {
          doExport();
        },
      });
    } else {
      doExport();
    }
  }, [hasFilters, doExport]);

  /** 重置筛选条件 */
  const handleReset = useCallback(() => {
    form.resetFields();
  }, [form]);

  return (
    <Spin spinning={fetchingData} tip="加载筛选数据...">
      <Card
        title={
          <Space>
            <ExportOutlined />
            <span>资产导出</span>
          </Space>
        }
      >
        <Alert
          message="导出说明"
          description="选择筛选条件后点击「导出」按钮，系统将生成 Excel 文件并自动下载。所有筛选条件均为可选。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            {/* 资产分类 - TreeSelect（数据源 /api/v1/asset-categories/tree） */}
            <Col span={8}>
              <Form.Item label="资产分类" name="categoryCodes">
                <TreeSelect
                  treeData={categoryTree}
                  placeholder="请选择资产分类"
                  allowClear
                  treeCheckable
                  showCheckedStrategy={TreeSelect.SHOW_CHILD}
                  style={{ width: '100%' }}
                  dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                />
              </Form.Item>
            </Col>

            {/* 资产状态 - Select mode="multiple"，硬编码选项（ATB-014） */}
            <Col span={8}>
              <Form.Item label="资产状态" name="statusCodes">
                <Select
                  mode="multiple"
                  placeholder="请选择资产状态"
                  allowClear
                  options={STATUS_OPTIONS}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>

            {/* 存放位置 - Cascader 级联选择（数据源 /api/v1/asset-locations/cascade） */}
            <Col span={8}>
              <Form.Item label="存放位置" name="locationCodes">
                <Cascader
                  options={locationOptions}
                  placeholder="请选择存放位置"
                  allowClear
                  multiple
                  changeOnSelect
                  style={{ width: '100%' }}
                  maxTagCount="responsive"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Space>
            <Button onClick={handleReset} disabled={loading}>
              重置
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              loading={loading}
            >
              导出
            </Button>
          </Space>
        </div>
      </Card>
    </Spin>
  );
};

export default ExportPanel;