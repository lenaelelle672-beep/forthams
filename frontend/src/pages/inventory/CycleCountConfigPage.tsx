import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cycleCountApi } from '../../api/cycleCount';
import type { CycleCountRule } from '../../types/cycleCount';
import { Card, Table, Button, Space, Modal, Form, Select, InputNumber, message, Tag, Tooltip } from 'antd';
import { PlusOutlined, PlayCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const CycleCountConfigPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CycleCountRule | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['cycleCountRules'],
    queryFn: () => cycleCountApi.list({ pageNum: 1, pageSize: 100 })
  });

  const createMutation = useMutation({
    mutationFn: cycleCountApi.create,
    onSuccess: () => {
      message.success('规则创建成功');
      queryClient.invalidateQueries({ queryKey: ['cycleCountRules'] });
      handleClose();
    },
    onError: () => message.error('创建失败')
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: number; data: CycleCountRule }) =>
      cycleCountApi.update(params.id, params.data),
    onSuccess: () => {
      message.success('规则更新成功');
      queryClient.invalidateQueries({ queryKey: ['cycleCountRules'] });
      handleClose();
    },
    onError: () => message.error('更新失败')
  });

  const deleteMutation = useMutation({
    mutationFn: cycleCountApi.delete,
    onSuccess: () => {
      message.success('规则已删除');
      queryClient.invalidateQueries({ queryKey: ['cycleCountRules'] });
    }
  });

  const triggerMutation = useMutation({
    mutationFn: (classification: string) => cycleCountApi.triggerGenerate(classification),
    onSuccess: (data: any) => {
      message.success(data as any || '盘点任务已触发生成');
    }
  });

  const handleOpen = (rule?: CycleCountRule) => {
    if (rule) {
      setEditingRule(rule);
      form.setFieldsValue(rule);
    } else {
      setEditingRule(null);
      form.resetFields();
    }
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditingRule(null);
    form.resetFields();
  };

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      if (editingRule?.id) {
        updateMutation.mutate({ id: editingRule.id, data: values });
      } else {
        createMutation.mutate(values);
      }
    });
  };

  const classificationColors: Record<string, string> = {
    A: 'red',
    B: 'blue',
    C: 'green'
  };

  const frequencyLabels: Record<string, string> = {
    MONTHLY: '月度',
    QUARTERLY: '季度',
    YEARLY: '年度'
  };

  const columns = [
    {
      title: '分类',
      dataIndex: 'classification',
      key: 'classification',
      render: (cls: string) => <Tag color={classificationColors[cls]}>{cls}类</Tag>
    },
    {
      title: '盘点频率',
      dataIndex: 'frequency',
      key: 'frequency',
      render: (freq: string) => frequencyLabels[freq] || freq
    },
    {
      title: '最小价值',
      dataIndex: 'minValue',
      key: 'minValue',
      render: (val: number) => (val != null ? `¥${val.toLocaleString()}` : '-')
    },
    {
      title: '最大价值',
      dataIndex: 'maxValue',
      key: 'maxValue',
      render: (val: number) => (val != null ? `¥${val.toLocaleString()}` : '-')
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CycleCountRule) => (
        <Space size="small">
          <Tooltip title="编辑规则">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpen(record)} />
          </Tooltip>
          <Tooltip title="触发盘点">
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => triggerMutation.mutate(record.classification)}
              loading={triggerMutation.isPending}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                if (window.confirm('确定删除此规则？')) {
                  deleteMutation.mutate(record.id!);
                }
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6">
      <Card
        title="循环盘点规则配置（ABC分类）"
        extra={
          <Space>
            <Button icon={<PlayCircleOutlined />} onClick={() => triggerMutation.mutate('A')} loading={triggerMutation.isPending}>
              触发A类盘点
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpen()}>
              新增规则
            </Button>
          </Space>
        }
      >
        <div className="mb-4 text-sm text-gray-500">
          <p>A类（关键资产）：月度盘点 | B类（重要资产）：季度盘点 | C类（一般资产）：年度盘点</p>
        </div>
        <Table
          columns={columns}
          dataSource={data?.records || data?.list || []}
          loading={isLoading}
          rowKey="id"
          pagination={false}
        />
      </Card>

      <Modal
        title={editingRule ? '编辑规则' : '新增规则'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={handleClose}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="classification" label="ABC分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="请选择">
              <Select.Option value="A">A类（关键资产）</Select.Option>
              <Select.Option value="B">B类（重要资产）</Select.Option>
              <Select.Option value="C">C类（一般资产）</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="frequency" label="盘点频率" rules={[{ required: true, message: '请选择频率' }]}>
            <Select placeholder="请选择">
              <Select.Option value="MONTHLY">月度</Select.Option>
              <Select.Option value="QUARTERLY">季度</Select.Option>
              <Select.Option value="YEARLY">年度</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="minValue" label="最小价值（元）">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="不填表示无下限" />
          </Form.Item>
          <Form.Item name="maxValue" label="最大价值（元）">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="不填表示无上限" />
          </Form.Item>
          <Form.Item name="categoryIds" label="适用资产分类">
            <Input.TextArea rows={2} placeholder="JSON数组：[1,2,3] 或留空表示全部" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CycleCountConfigPage;
