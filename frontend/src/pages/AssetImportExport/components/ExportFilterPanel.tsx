import React, { useState, useEffect, useCallback } from 'react';
import {
  Form,
  TreeSelect,
  Select,
  Cascader,
  Button,
  Modal,
  Card,
  message,
  Spin,
  Typography,
} from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import http from '../../../utils/http';

const { Text } = Typography;

/**
 * 资产状态硬编码选项（在用、闲置、维修中、报废）
 * 来源：SPEC 交互约束 — 资产状态选择器为多选 Select，选项固定
 */
const STATUS_OPTIONS = [
  { label: '在用', value: 'in_use' },
  { label: '闲置', value: 'idle' },
  { label: '维修中', value: 'under_repair' },
  { label: '报废', value: 'scrapped' },
];

/** 导出筛选面板 Props */
interface ExportFilterPanelProps {
  /** 导出成功后的回调，返回生成的文件名 */
  onExportSuccess?: (fileName: string) => void;
}

/**
 * 导出筛选面板组件 (FE-8 / FE-9)
 *
 * 提供三维度筛选：
 *   - 资产分类：TreeSelect，数据源 GET /api/v1/asset-categories/tree
 *   - 资产状态：Select mode="multiple"，硬编码选项
 *   - 存放位置：Cascader，数据源 GET /api/v1/asset-locations/cascade
 *
 * 交互规则：
 *   - 三个筛选维度均为可选
 *   - 不选任何条件时，点击导出弹出确认弹窗
 *   - 导出请求使用 POST /api/v1/assets/export，JSON body
 *   - 文件名格式：资产台账_YYYYMMDD_HHmmss.xlsx
 *   - 下载完成后调用 URL.revokeObjectURL 释放内存
 */
const ExportFilterPanel: React.FC<ExportFilterPanelProps> = ({ onExportSuccess }) => {
  const [form] = Form.useForm();
  const [categoryTree, setCategoryTree] = useState<any[]>([]);
  const [locationData, setLocationData] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  /**
   * 获取资产分类树形数据
   * 调用 GET /api/v1/asset-categories/tree
   */
  const fetchCategoryTree = useCallback(async () => {
    try {
      const response = await http.get('/api/v1/asset-categories/tree');
      const data = response.data?.data ?? response.data ?? [];
      setCategoryTree(Array.isArray(data) ? data : []);
    } catch {
      message.error('获取资产分类数据失败');
    }
  }, []);

  /**
   * 获取存放位置级联数据（省/市/区）
   * 调用 GET /api/v1/asset-locations/cascade
   */
  const fetchLocationCascade = useCallback(async () => {
    try {
      const response = await http.get('/api/v1/asset-locations/cascade');
      const data = response.data?.data ?? response.data ?? [];
      setLocationData(Array.isArray(data) ? data : []);
    } catch {
      message.error('获取存放位置数据失败');
    }
  }, []);

  /** 初始化时并行加载分类树和位置级联数据 */
  useEffect(() => {
    const loadAllData = async () => {
      setDataLoading(true);
      await Promise.all([fetchCategoryTree(), fetchLocationCascade()]);
      setDataLoading(false);
    };
    loadAllData();
  }, [fetchCategoryTree, fetchLocationCascade]);

  /**
   * 生成导出文件名
   * 格式：资产台账_YYYYMMDD_HHmmss.xlsx
   */
  const generateExportFileName = useCallback((): string => {
    const timestamp = dayjs().format('YYYYMMDD_HHmmss');
    return `资产台账_${timestamp}.xlsx`;
  }, []);

  /**
   * 从 Cascader 值中提取叶子节点 code 列表
   * Cascader multiple 模式返回 string[][]，每项为完整路径，取最后一级作为 locationCode
   */
  const extractLocationLeafCodes = (cascaderValue: string[][] | undefined): string[] => {
    if (!cascaderValue || !Array.isArray(cascaderValue)) return [];
    return cascaderValue
      .map((path) => path[path.length - 1])
      .filter(Boolean);
  };

  /**
   * 执行导出操作
   * 调用 POST /api/v1/assets/export，请求体为 { categoryCodes, statusCodes, locationCodes }
   * 响应为 Blob 文件流，使用 URL.createObjectURL 触发下载后调用 URL.revokeObjectURL 释放
   */
  const doExport = useCallback(
    async (filters: {
      categoryCodes: string[];
      statusCodes: string[];
      locationCodes: string[];
    }) => {
      setExportLoading(true);
      try {
        const response = await http.post('/api/v1/assets/export', filters, {
          responseType: 'blob',
        });

        const blob = new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fileName = generateExportFileName();
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 释放 Object URL 内存（ATB-017）
        URL.revokeObjectURL(url);

        message.success('导出成功');
        onExportSuccess?.(fileName);
      } catch (error: any) {
        // Token 过期处理（ATB-018）
        if (error?.response?.status === 401) {
          message.error('登录已过期');
          window.location.href = '/login';
          return;
        }
        message.error('导出失败，请重试');
      } finally {
        setExportLoading(false);
      }
    },
    [generateExportFileName, onExportSuccess],
  );

  /**
   * 处理导出按钮点击
   * 校验筛选条件：无任何条件时弹出确认对话框（ATB-015）
   */
  const handleExport = useCallback(() => {
    const values = form.getFieldsValue();

    const categoryCodes: string[] = values.categoryCodes ?? [];
    const statusCodes: string[] = values.statusCodes ?? [];
    const locationCodes: string[] = extractLocationLeafCodes(values.locationCodes);

    const filters = { categoryCodes, statusCodes, locationCodes };
    const hasFilters =
      categoryCodes.length > 0 ||
      statusCodes.length > 0 ||
      locationCodes.length > 0;

    if (!hasFilters) {
      Modal.confirm({
        title: '导出确认',
        content: '未设置筛选条件，将导出全部资产，是否继续？',
        okText: '确定',
        cancelText: '取消',
        onOk: () => doExport(filters),
      });
    } else {
      doExport(filters);
    }
  }, [form, doExport]);

  /** 重置筛选条件 */
  const handleReset = useCallback(() => {
    form.resetFields();
  }, [form]);

  return (
    <Spin spinning={dataLoading}>
      <Card title="导出筛选条件" style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical" autoComplete="off">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0 24px',
            }}
          >
            {/* 资产分类 — TreeSelect 树形选择 */}
            <Form.Item name="categoryCodes" label="资产分类">
              <TreeSelect
                treeData={categoryTree}
                placeholder="请选择资产分类"
                allowClear
                multiple
                treeCheckable
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                style={{ width: '100%' }}
              />
            </Form.Item>

            {/* 资产状态 — Select mode="multiple" 多选 */}
            <Form.Item name="statusCodes" label="资产状态">
              <Select
                mode="multiple"
                placeholder="请选择资产状态"
                allowClear
                options={STATUS_OPTIONS}
                style={{ width: '100%' }}
              />
            </Form.Item>

            {/* 存放位置 — Cascader 省/市/区级联选择 */}
            <Form.Item name="locationCodes" label="存放位置">
              <Cascader
                options={locationData}
                placeholder="请选择存放位置"
                allowClear
                multiple
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>

          <div
            style={{
              marginTop: 24,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
            }}
          >
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
              disabled={exportLoading}
            >
              重置
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              loading={exportLoading}
              size="large"
            >
              导出
            </Button>
          </div>
        </Form>

        <div style={{ marginTop: 16 }}>
          <Text type="secondary">
            不设置任何筛选条件时将导出全部资产数据。
          </Text>
        </div>
      </Card>
    </Spin>
  );
};

export default ExportFilterPanel;