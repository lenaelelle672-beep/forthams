/**
 * 资产报废/退役流程主页面
 * 
 * 功能模块：
 * - 报废申请列表
 * - 发起新报废申请
 * - 报废审批历史记录展示
 * 
 * @module Retirement
 * @version SWARM-002-Iter1
 */

import React, { useState, useCallback } from 'react';
import { Card, Table, Button, Tag, Modal, Form, Input, Select, message, Timeline, Space, Typography } from 'antd';
import { PlusOutlined, HistoryOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useRetirementList } from '../../hooks/useRetirementList';
import { useRetirementSubmit } from '../../hooks/useRetirementSubmit';
import { RetirementApplication, RetirementStatus, RetirementHistoryRecord } from '../types/retirement.types';
import { RetirementService } from '../../services/retirementService';
import styles from './Retirement.module.css';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface RetirementFormValues {
  assetId: string;
  reason: RetirementReason;
  description: string;
  attachmentUrls?: string[];
}

type RetirementReason = 'DAMAGE' | 'OBSOLETE' | 'UPGRADE' | 'END_OF_LIFE' | 'OTHER';

const RETIREMENT_REASON_OPTIONS: { value: RetirementReason; label: string }[] = [
  { value: 'DAMAGE', label: '设备损坏无法修复' },
  { value: 'OBSOLETE', label: '技术淘汰' },
  { value: 'UPGRADE', label: '升级换代' },
  { value: 'END_OF_LIFE', label: '使用年限到期' },
  { value: 'OTHER', label: '其他原因' },
];

const STATUS_TAG_MAP: Record<RetirementStatus, { color: string; text: string }> = {
  [RetirementStatus.DRAFT]: { color: 'default', text: '草稿' },
  [RetirementStatus.PENDING]: { color: 'processing', text: '审批中' },
  [RetirementStatus.APPROVED]: { color: 'success', text: '已批准' },
  [RetirementStatus.REJECTED]: { color: 'error', text: '已驳回' },
  [RetirementStatus.COMPLETED]: { color: 'success', text: '已完成' },
};

/**
 * 资产报废/退役流程主页面组件
 * 
 * @description 提供报废申请管理界面，包括：
 * - 报废申请列表展示
 * - 发起新的报废申请
 * - 查看审批历史记录
 */
export const RetirementPage: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<RetirementHistoryRecord[]>([]);
  const [form] = Form.useForm<RetirementFormValues>();

  const { data: retirementList, isLoading, refetch } = useRetirementList();
  const submitMutation = useRetirementSubmit();

  /**
   * 打开报废申请弹窗
   */
  const handleOpenModal = useCallback(() => {
    setIsModalVisible(true);
  }, []);

  /**
   * 关闭报废申请弹窗
   */
  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
    form.resetFields();
  }, [form]);

  /**
   * 提交报废申请
   * 
   * @param values - 报废申请表单数据
   */
  const handleSubmitRetirement = useCallback(async (values: RetirementFormValues) => {
    try {
      await submitMutation.mutateAsync({
        assetId: values.assetId,
        reason: values.reason,
        description: values.description,
        attachmentUrls: values.attachmentUrls || [],
      });
      message.success('报废申请已提交');
      handleCloseModal();
      refetch();
    } catch (error) {
      message.error('提交失败，请重试');
    }
  }, [submitMutation, refetch, handleCloseModal]);

  /**
   * 查看报废历史记录
   * 
   * @param assetId - 资产ID
   */
  const handleViewHistory = useCallback(async (assetId: string) => {
    setSelectedAssetId(assetId);
    try {
      const history = await RetirementService.getRetirementHistory(assetId);
      setHistoryRecords(history);
      setIsHistoryVisible(true);
    } catch (error) {
      message.error('获取历史记录失败');
    }
  }, []);

  /**
   * 关闭历史记录弹窗
   */
  const handleCloseHistory = useCallback(() => {
    setIsHistoryVisible(false);
    setSelectedAssetId(null);
    setHistoryRecords([]);
  }, []);

  /**
   * 确认删除操作
   * 
   * @param record - 报废申请记录
   */
  const handleDelete = useCallback((record: RetirementApplication) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这条报废申请吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await RetirementService.deleteRetirement(record.id);
          message.success('删除成功');
          refetch();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  }, [refetch]);

  const columns = [
    {
      title: '申请编号',
      dataIndex: 'retirementNo',
      key: 'retirementNo',
      width: 180,
    },
    {
      title: '资产编号',
      dataIndex: 'assetNo',
      key: 'assetNo',
      width: 120,
    },
    {
      title: '资产名称',
      dataIndex: 'assetName',
      key: 'assetName',
      width: 150,
    },
    {
      title: '报废原因',
      dataIndex: 'reasonText',
      key: 'reasonText',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: RetirementStatus) => {
        const tagInfo = STATUS_TAG_MAP[status] || STATUS_TAG_MAP[RetirementStatus.DRAFT];
        return <Tag color={tagInfo.color}>{tagInfo.text}</Tag>;
      },
    },
    {
      title: '申请人',
      dataIndex: 'applicantName',
      key: 'applicantName',
      width: 100,
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: RetirementApplication) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleViewHistory(record.assetId)}
          >
            历史
          </Button>
          {record.status === RetirementStatus.DRAFT && (
            <Button 
              type="link" 
              size="small" 
              danger
              onClick={() => handleDelete(record)}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={4}>资产报废/退役管理</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleOpenModal}
        >
          发起报废
        </Button>
      </div>

      <Card className={styles.card}>
        <Table
          columns={columns}
          dataSource={retirementList}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      {/* 发起报废申请弹窗 */}
      <Modal
        title="发起报废申请"
        open={isModalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitRetirement}
          className={styles.form}
        >
          <Form.Item
            name="assetId"
            label="资产"
            rules={[{ required: true, message: '请选择要报废的资产' }]}
          >
            <Select
              placeholder="请选择资产"
              showSearch
              filterOption={(input, option) =>
                (option?.children as unknown as string)
                  ?.toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {/* 资产列表选项将通过 API 获取 */}
            </Select>
          </Form.Item>

          <Form.Item
            name="reason"
            label="报废原因"
            rules={[{ required: true, message: '请选择报废原因' }]}
          >
            <Select placeholder="请选择报废原因">
              {RETIREMENT_REASON_OPTIONS.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="详细说明"
            rules={[{ required: true, message: '请输入详细说明' }]}
          >
            <TextArea
              rows={4}
              placeholder="请详细描述报废原因和资产当前状况"
              maxLength={1000}
              showCount
            />
          </Form.Item>

          <Form.Item className={styles.formFooter}>
            <Space>
              <Button onClick={handleCloseModal}>取消</Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={submitMutation.isPending}
              >
                提交申请
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 审批历史记录弹窗 */}
      <Modal
        title="报废审批历史"
        open={isHistoryVisible}
        onCancel={handleCloseHistory}
        footer={null}
        width={700}
      >
        <div className={styles.historyContainer}>
          {historyRecords.length > 0 ? (
            <Timeline
              items={historyRecords.map((record) => ({
                color: record.action === 'APPROVE' ? 'green' : 
                       record.action === 'REJECT' ? 'red' : 'blue',
                children: (
                  <div className={styles.historyItem}>
                    <div className={styles.historyHeader}>
                      <Text strong>{record.operatorName}</Text>
                      <Text type="secondary">
                        {new Date(record.createdAt).toLocaleString('zh-CN')}
                      </Text>
                    </div>
                    <div className={styles.historyContent}>
                      <Tag color={
                        record.action === 'APPROVE' ? 'success' :
                        record.action === 'REJECT' ? 'error' : 'processing'
                      }>
                        {record.actionText}
                      </Tag>
                      <Text type="secondary">{record.remark}</Text>
                    </div>
                  </div>
                ),
              }))}
            />
          ) : (
            <div className={styles.emptyHistory}>
              <Text type="secondary">暂无审批历史记录</Text>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default RetirementPage;