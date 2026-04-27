/**
 * 资产退役审批列表组件
 * 
 * 功能说明：
 * - 展示待审批的资产退役申请列表
 * - 支持审批操作（批准/驳回）
 * - 支持状态筛选和搜索
 * - 显示申请详情和审批历史
 * 
 * @_SWARM-502 资产报废/退役流程
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Card,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
  Divider,
  Tooltip,
  Badge,
  Empty,
  Spin,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  SearchOutlined,
  FilterOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useApprovalPermission } from '@/composables/useApprovalPermission';
import { useApprovalBinding } from '@/composables/useApprovalBinding';
import { approvalService } from '@/services/approvalService';
import { retirementService } from '@/services/retirementService';
import type { RetirementApplication, RetirementStatus, ApprovalRecord } from '../types/retirement.types';
import styles from './RetirementApprovalList.module.css';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ==================== 类型定义 ====================

/** 筛选器状态 */
interface FilterState {
  status: RetirementStatus | 'ALL';
  department: string | 'ALL';
  dateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  keyword: string;
}

/** 审批操作表单 */
interface ApprovalFormValues {
  action: 'approve' | 'reject';
  comment: string;
  effectiveDate?: dayjs.Dayjs;
}

// ==================== 常量配置 ====================

/** 状态配置映射 */
const STATUS_CONFIG: Record<
  RetirementStatus,
  { color: string; label: string; description: string }
> = {
  DRAFT: { color: 'default', label: '草稿', description: '申请人正在编辑' },
  PENDING_APPROVAL: {
    color: 'processing',
    label: '待审批',
    description: '等待审批人审核',
  },
  APPROVED: { color: 'success', label: '已批准', description: '审批通过，待执行' },
  REJECTED: { color: 'error', label: '已驳回', description: '审批未通过' },
  CANCELLED: { color: 'default', label: '已撤回', description: '申请人主动撤回' },
  RETIRED: { color: 'success', label: '已退役', description: '资产已完成退役' },
};

/** 状态选项 */
const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, config]) => ({
  value: value as RetirementStatus,
  label: config.label,
}));

// ==================== 组件实现 ====================

/**
 * 资产退役审批列表组件
 * 
 * @description
 * 展示系统中所有资产退役申请，支持审批操作和状态筛选
 * 
 * @example
 * ```tsx
 * <RetirementApprovalList />
 * ```
 */
export const RetirementApprovalList: React.FC = () => {
  // ==================== State 管理 ====================
  const [applications, setApplications] = useState<RetirementApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // 筛选状态
  const [filters, setFilters] = useState<FilterState>({
    status: 'ALL',
    department: 'ALL',
    dateRange: null,
    keyword: '',
  });
  
  // 详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [currentApplication, setCurrentApplication] = useState<RetirementApplication | null>(null);
  
  // 审批弹窗
  const [approvalModalVisible, setApprovalModalVisible] = useState<boolean>(false);
  const [approvalLoading, setApprovalLoading] = useState<boolean>(false);
  const [approvalForm] = Form.useForm<ApprovalFormValues>();
  
  // ==================== Hooks ====================
  const navigate = useNavigate();
  const { canApprove, canView, userInfo } = useApprovalPermission();
  const { bindApprovalContext, unbindApprovalContext } = useApprovalBinding();

  // ==================== 数据加载 ====================

  /**
   * 加载退役申请列表
   */
  const loadApplications = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        status: filters.status === 'ALL' ? undefined : filters.status,
        department: filters.department === 'ALL' ? undefined : filters.department,
        keyword: filters.keyword || undefined,
        startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
      };
      
      const response = await retirementService.getApplications(params);
      setApplications(response.items || []);
      setPagination(prev => ({
        ...prev,
        total: response.total || 0,
      }));
    } catch (error) {
      message.error('加载申请列表失败');
      console.error('Load applications error:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  /**
   * 初始化加载
   */
  useEffect(() => {
    if (canView) {
      loadApplications();
    }
  }, [canView, loadApplications]);

  // ==================== 事件处理 ====================

  /**
   * 处理表格分页变化
   */
  const handleTableChange = useCallback(
    (newPagination: { current?: number; pageSize?: number }) => {
      setPagination(prev => ({
        ...prev,
        current: newPagination.current || prev.current,
        pageSize: newPagination.pageSize || prev.pageSize,
      }));
    },
    []
  );

  /**
   * 处理筛选变化
   */
  const handleFilterChange = useCallback(
    (key: keyof FilterState, value: FilterState[keyof FilterState]) => {
      setFilters(prev => ({ ...prev, [key]: value }));
      setPagination(prev => ({ ...prev, current: 1 }));
    },
    []
  );

  /**
   * 重置筛选器
   */
  const handleResetFilters = useCallback(() => {
    setFilters({
      status: 'ALL',
      department: 'ALL',
      dateRange: null,
      keyword: '',
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  }, []);

  /**
   * 查看详情
   */
  const handleViewDetail = useCallback(async (record: RetirementApplication) => {
    try {
      const detail = await retirementService.getApplicationById(record.id);
      setCurrentApplication(detail);
      setDetailModalVisible(true);
      bindApprovalContext(record.id, 'VIEW');
    } catch (error) {
      message.error('加载详情失败');
    }
  }, [bindApprovalContext]);

  /**
   * 打开审批弹窗
   */
  const handleOpenApproval = useCallback(
    (record: RetirementApplication, action: 'approve' | 'reject') => {
      setCurrentApplication(record);
      approvalForm.setFieldsValue({ action });
      setApprovalModalVisible(true);
      bindApprovalContext(record.id, action === 'approve' ? 'APPROVE' : 'REJECT');
    },
    [approvalForm, bindApprovalContext]
  );

  /**
   * 关闭审批弹窗
   */
  const handleCloseApproval = useCallback(() => {
    setApprovalModalVisible(false);
    approvalForm.resetFields();
    if (currentApplication) {
      unbindApprovalContext(currentApplication.id);
    }
  }, [approvalForm, currentApplication, unbindApprovalContext]);

  /**
   * 提交审批
   */
  const handleSubmitApproval = useCallback(async () => {
    try {
      const values = await approvalForm.validateFields();
      if (!currentApplication) return;

      setApprovalLoading(true);
      
      if (values.action === 'approve') {
        await approvalService.approveRetirement(currentApplication.id, {
          comment: values.comment,
          effectiveDate: values.effectiveDate?.format('YYYY-MM-DD'),
        });
        message.success('审批通过');
      } else {
        await approvalService.rejectRetirement(currentApplication.id, {
          reason: values.comment,
        });
        message.success('已驳回申请');
      }

      handleCloseApproval();
      loadApplications();
    } catch (error) {
      message.error('审批操作失败');
      console.error('Approval error:', error);
    } finally {
      setApprovalLoading(false);
    }
  }, [approvalForm, currentApplication, handleCloseApproval, loadApplications]);

  /**
   * 批量审批
   */
  const handleBatchApprove = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要审批的申请');
      return;
    }

    try {
      setApprovalLoading(true);
      await approvalService.batchApprove(selectedRowKeys as string[]);
      message.success(`成功审批 ${selectedRowKeys.length} 条申请`);
      setSelectedRowKeys([]);
      loadApplications();
    } catch (error) {
      message.error('批量审批失败');
    } finally {
      setApprovalLoading(false);
    }
  }, [selectedRowKeys, loadApplications]);

  /**
   * 撤销选择
   */
  const handleClearSelection = useCallback(() => {
    setSelectedRowKeys([]);
  }, []);

  // ==================== 表格列配置 ====================

  /**
   * 表格列定义
   */
  const columns: ColumnsType<RetirementApplication> = useMemo(
    () => [
      {
        title: '申请编号',
        dataIndex: 'applicationNo',
        key: 'applicationNo',
        width: 150,
        fixed: 'left',
        render: (text: string) => (
          <Text strong className={styles.applicationNo}>
            {text}
          </Text>
        ),
      },
      {
        title: '资产编号',
        dataIndex: 'assetCode',
        key: 'assetCode',
        width: 120,
      },
      {
        title: '资产名称',
        dataIndex: 'assetName',
        key: 'assetName',
        width: 180,
        ellipsis: true,
      },
      {
        title: '申请人',
        dataIndex: 'applicantName',
        key: 'applicantName',
        width: 100,
      },
      {
        title: '所属部门',
        dataIndex: 'department',
        key: 'department',
        width: 120,
      },
      {
        title: '退役原因',
        dataIndex: 'retirementReason',
        key: 'retirementReason',
        width: 200,
        ellipsis: true,
        render: (text: string) => (
          <Tooltip title={text}>
            <span>{text}</span>
          </Tooltip>
        ),
      },
      {
        title: '计划退役日期',
        dataIndex: 'plannedRetirementDate',
        key: 'plannedRetirementDate',
        width: 130,
        render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        filters: STATUS_OPTIONS.map(opt => ({ text: opt.label, value: opt.value })),
        render: (status: RetirementStatus) => {
          const config = STATUS_CONFIG[status];
          return (
            <Tag color={config.color} icon={status === 'PENDING_APPROVAL' ? <ClockCircleOutlined /> : undefined}>
              {config.label}
            </Tag>
          );
        },
      },
      {
        title: '申请时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 160,
        sorter: true,
        render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: '操作',
        key: 'actions',
        width: 160,
        fixed: 'right',
        render: (_, record) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            >
              详情
            </Button>
            {record.status === 'PENDING_APPROVAL' && canApprove && (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleOpenApproval(record, 'approve')}
                  className={styles.approveBtn}
                >
                  批准
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleOpenApproval(record, 'reject')}
                >
                  驳回
                </Button>
              </>
            )}
          </Space>
        ),
      },
    ],
    [canApprove, handleViewDetail, handleOpenApproval]
  );

  // ==================== 统计计算 ====================

  /**
   * 计算统计数据
   */
  const statistics = useMemo(() => {
    const pending = applications.filter(app => app.status === 'PENDING_APPROVAL').length;
    const approved = applications.filter(app => app.status === 'APPROVED').length;
    const rejected = applications.filter(app => app.status === 'REJECTED').length;
    const retired = applications.filter(app => app.status === 'RETIRED').length;
    return { pending, approved, rejected, retired };
  }, [applications]);

  // ==================== 渲染逻辑 ====================

  /**
   * 渲染筛选器
   */
  const renderFilters = () => (
    <Card size="small" className={styles.filterCard}>
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} sm={12} md={6}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text type="secondary" className={styles.filterLabel}>
              <FilterOutlined /> 状态筛选
            </Text>
            <Select
              value={filters.status}
              onChange={value => handleFilterChange('status', value)}
              style={{ width: '100%' }}
              allowClear
            >
              <Option value="ALL">全部状态</Option>
              {STATUS_OPTIONS.map(opt => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Space>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text type="secondary" className={styles.filterLabel}>
              <SearchOutlined /> 关键词搜索
            </Text>
            <Input
              placeholder="搜索资产编号/名称"
              value={filters.keyword}
              onChange={e => handleFilterChange('keyword', e.target.value)}
              allowClear
              prefix={<SearchOutlined />}
            />
          </Space>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text type="secondary" className={styles.filterLabel}>
              日期范围
            </Text>
            <DatePicker.RangePicker
              value={filters.dateRange}
              onChange={date => handleFilterChange('dateRange', date)}
              style={{ width: '100%' }}
            />
          </Space>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Space>
            <Button onClick={handleResetFilters}>重置</Button>
            <Button type="primary" onClick={() => loadApplications()}>
              应用筛选
            </Button>
          </Space>
        </Col>
      </Row>
    </Card>
  );

  /**
   * 渲染统计卡片
   */
  const renderStatistics = () => (
    <Row gutter={16} className={styles.statisticsRow}>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic
            title="待审批"
            value={statistics.pending}
            valueStyle={{ color: '#faad14' }}
            prefix={<Badge status="processing" />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic
            title="已批准"
            value={statistics.approved}
            valueStyle={{ color: '#52c41a' }}
            prefix={<CheckCircleOutlined />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic
            title="已驳回"
            value={statistics.rejected}
            valueStyle={{ color: '#ff4d4f' }}
            prefix={<CloseCircleOutlined />}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small">
          <Statistic
            title="已完成退役"
            value={statistics.retired}
            valueStyle={{ color: '#1890ff' }}
            prefix={<DeleteOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );

  /**
   * 渲染详情弹窗
   */
  const renderDetailModal = () => (
    <Modal
      title="退役申请详情"
      open={detailModalVisible}
      onCancel={() => setDetailModalVisible(false)}
      footer={null}
      width={700}
      destroyOnClose
    >
      {currentApplication && (
        <div className={styles.detailContent}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text type="secondary">申请编号：</Text>
              <Text strong>{currentApplication.applicationNo}</Text>
            </Col>
            <Col span={12}>
              <Text type="secondary">状态：</Text>
              <Tag color={STATUS_CONFIG[currentApplication.status].color}>
                {STATUS_CONFIG[currentApplication.status].label}
              </Tag>
            </Col>
            <Col span={12}>
              <Text type="secondary">资产编号：</Text>
              <Text strong>{currentApplication.assetCode}</Text>
            </Col>
            <Col span={12}>
              <Text type="secondary">资产名称：</Text>
              <Text strong>{currentApplication.assetName}</Text>
            </Col>
            <Col span={12}>
              <Text type="secondary">申请人：</Text>
              <Text strong>{currentApplication.applicantName}</Text>
            </Col>
            <Col span={12}>
              <Text type="secondary">所属部门：</Text>
              <Text strong>{currentApplication.department}</Text>
            </Col>
            <Col span={24}>
              <Divider orientation="left">退役原因</Divider>
              <Text>{currentApplication.retirementReason || '未填写'}</Text>
            </Col>
            <Col span={12}>
              <Text type="secondary">计划退役日期：</Text>
              <Text>{dayjs(currentApplication.plannedRetirementDate).format('YYYY-MM-DD')}</Text>
            </Col>
            <Col span={12}>
              <Text type="secondary">申请时间：</Text>
              <Text>{dayjs(currentApplication.createdAt).format('YYYY-MM-DD HH:mm')}</Text>
            </Col>
            {currentApplication.actualRetirementDate && (
              <Col span={12}>
                <Text type="secondary">实际退役日期：</Text>
                <Text>{dayjs(currentApplication.actualRetirementDate).format('YYYY-MM-DD')}</Text>
              </Col>
            )}
          </Row>
          
          {currentApplication.approvalHistory && currentApplication.approvalHistory.length > 0 && (
            <>
              <Divider orientation="left">审批历史</Divider>
              <div className={styles.approvalHistory}>
                {currentApplication.approvalHistory.map((record, index) => (
                  <div key={record.id || index} className={styles.historyItem}>
                    <Badge status={record.action === 'APPROVE' ? 'success' : 'error'} />
                    <Text>
                      {record.approverName} -{' '}
                      {record.action === 'APPROVE' ? '批准' : '驳回'}
                      {record.comment && `：「${record.comment}」`}
                    </Text>
                    <Text type="secondary" className={styles.historyTime}>
                      {dayjs(record.actionTime).format('YYYY-MM-DD HH:mm')}
                    </Text>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );

  /**
   * 渲染审批弹窗
   */
  const renderApprovalModal = () => (
    <Modal
      title={
        approvalForm.getFieldValue('action') === 'approve' ? '批准退役申请' : '驳回退役申请'
      }
      open={approvalModalVisible}
      onCancel={handleCloseApproval}
      footer={
        <Space>
          <Button onClick={handleCloseApproval}>取消</Button>
          <Button
            type="primary"
            loading={approvalLoading}
            onClick={handleSubmitApproval}
          >
            确认{approvalForm.getFieldValue('action') === 'approve' ? '批准' : '驳回'}
          </Button>
        </Space>
      }
      width={500}
    >
      <Form form={approvalForm} layout="vertical">
        <Form.Item
          name="comment"
          label={approvalForm.getFieldValue('action') === 'approve' ? '审批意见' : '驳回原因'}
          rules={[
            { required: true, message: '请输入意见或原因' },
            { max: 200, message: '意见不能超过200字符' },
          ]}
        >
          <TextArea
            rows={4}
            placeholder={
              approvalForm.getFieldValue('action') === 'approve'
                ? '请输入审批意见（选填）'
                : '请输入驳回原因（必填）'
            }
          />
        </Form.Item>
        {approvalForm.getFieldValue('action') === 'approve' && (
          <Form.Item name="effectiveDate" label="生效日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );

  // ==================== 权限检查 ====================

  if (!canView) {
    return (
      <Card>
        <Empty
          description="您没有权限查看此页面"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  // ==================== 主渲染 ====================

  return (
    <div className={styles.retirementApprovalList}>
      <Title level={4} className={styles.pageTitle}>
        资产退役审批
      </Title>
      
      {renderStatistics()}
      {renderFilters()}
      
      <Card className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <Space>
            <Text type="secondary">
              共 {pagination.total} 条申请记录
            </Text>
            {selectedRowKeys.length > 0 && (
              <>
                <Badge count={selectedRowKeys.length} />
                <Button size="small" onClick={handleClearSelection}>
                  清除选择
                </Button>
                {canApprove && (
                  <Popconfirm
                    title={`确认批量审批 ${selectedRowKeys.length} 条申请？`}
                    onConfirm={handleBatchApprove}
                  >
                    <Button type="primary" size="small" loading={approvalLoading}>
                      批量批准
                    </Button>
                  </Popconfirm>
                )}
              </>
            )}
          </Space>
        </div>
        
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={applications}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: total => `共 ${total} 条`,
            }}
            onChange={handleTableChange}
            rowSelection={
              canApprove
                ? {
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                    getCheckboxProps: record => ({
                      disabled: record.status !== 'PENDING_APPROVAL',
                    }),
                  }
                : undefined
            }
            scroll={{ x: 1300 }}
          />
        </Spin>
      </Card>
      
      {renderDetailModal()}
      {renderApprovalModal()}
    </div>
  );
};

export default RetirementApprovalList;