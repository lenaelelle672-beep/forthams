import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inspectionTemplateApi } from '@/api/inspection';
import type { InspectionTemplate } from '@/types/inspection';
import { Card, Button, Table, Badge, Input, Select, Space, message, Modal, Form, InputNumber, Tag, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import TextArea from 'antd/es/input/TextArea';

const InspectionTemplatePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [params, setParams] = useState({
    keyword: '',
    type: undefined as string | undefined,
    pageNum: 1,
    pageSize: 10
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InspectionTemplate | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['inspectionTemplates', params],
    queryFn: () => inspectionTemplateApi.list(params)
  });

  const createMutation = useMutation({
    mutationFn: inspectionTemplateApi.create,
    onSuccess: () => {
      message.success('创建成功');
      setModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inspectionTemplates'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: InspectionTemplate }) =>
      inspectionTemplateApi.update(id, data),
    onSuccess: () => {
      message.success('更新成功');
      setModalVisible(false);
      setEditingTemplate(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inspectionTemplates'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: inspectionTemplateApi.delete,
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['inspectionTemplates'] });
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      inspectionTemplateApi.toggleStatus(id, status),
    onSuccess: () => {
      message.success('状态更新成功');
      queryClient.invalidateQueries({ queryKey: ['inspectionTemplates'] });
    }
  });

  const handleSearch = () => {
    setParams({ ...params, pageNum: 1 });
  };

  const handleReset = () => {
    setParams({
      keyword: '',
      type: undefined,
      pageNum: 1,
      pageSize: 10
    });
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: InspectionTemplate) => {
    setEditingTemplate(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleToggleStatus = (record: InspectionTemplate) => {
    const newStatus = record.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    toggleStatusMutation.mutate({ id: record.id!, status: newStatus });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();

      // 处理 categoryIds 和 checkItems 为 JSON 字符串
      const categoryIds = values.categoryIds
        ? JSON.stringify(values.categoryIds.split(',').map((s: string) => s.trim()).filter((s: string) => s))
        : null;
      const checkItems = values.checkItems
        ? JSON.stringify(values.checkItems.split('\n').map((s: string) => s.trim()).filter((s: string) => s))
        : null;

      const data: InspectionTemplate = {
        ...values,
        categoryIds,
        checkItems,
        status: values.status || 'ACTIVE'
      };

      if (editingTemplate) {
        updateMutation.mutate({ id: editingTemplate.id!, data });
      } else {
        createMutation.mutate(data);
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'templateName',
      key: 'templateName'
    },
    {
      title: '检验类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          ANNUAL: '年度检验',
          PERIODIC: '定期检验',
          SPECIAL: '专项检验'
        };
        return typeMap[type] || type;
      }
    },
    {
      title: '检验周期',
      dataIndex: 'frequency',
      key: 'frequency',
      render: (freq: number) => `${freq} 个月`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: InspectionTemplate) => (
        <Badge
          color={status === 'ACTIVE' ? 'green' : 'red'}
          text={status === 'ACTIVE' ? '启用' : '禁用'}
          style={{ cursor: 'pointer' }}
          onClick={() => handleToggleStatus(record)}
        />
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      render: (time: string) => time ? time.split('T')[0] : '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: InspectionTemplate) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个模板吗？"
            onConfirm={() => handleDelete(record.id!)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6">
      <Card
        title="检验模板管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增模板
          </Button>
        }
      >
        <div className="mb-4">
          <Space size="middle">
            <Input
              placeholder="模板名称"
              value={params.keyword}
              onChange={(e) => setParams({ ...params, keyword: e.target.value })}
              style={{ width: 200 }}
            />
            <Select
              placeholder="检验类型"
              value={params.type}
              onChange={(value) => setParams({ ...params, type: value })}
              style={{ width: 150 }}
              allowClear
            >
              <Select.Option value="ANNUAL">年度检验</Select.Option>
              <Select.Option value="PERIODIC">定期检验</Select.Option>
              <Select.Option value="SPECIAL">专项检验</Select.Option>
            </Select>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={data?.records || data?.list || []}
          loading={isLoading}
          rowKey="id"
          pagination={{
            current: params.pageNum,
            pageSize: params.pageSize,
            total: data?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            onChange: (page, pageSize) => setParams({ ...params, pageNum: page, pageSize })
          }}
        />
      </Card>

      <Modal
        title={editingTemplate ? '编辑模板' : '新增模板'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setModalVisible(false);
          setEditingTemplate(null);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            type: 'PERIODIC',
            frequency: 12,
            status: 'ACTIVE'
          }}
        >
          <Form.Item
            label="模板名称"
            name="templateName"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="例如：年度安全检验模板" />
          </Form.Item>

          <Form.Item
            label="检验类型"
            name="type"
            rules={[{ required: true, message: '请选择检验类型' }]}
          >
            <Select>
              <Select.Option value="ANNUAL">年度检验</Select.Option>
              <Select.Option value="PERIODIC">定期检验</Select.Option>
              <Select.Option value="SPECIAL">专项检验</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="检验周期（月）"
            name="frequency"
            rules={[{ required: true, message: '请输入检验周期' }]}
          >
            <InputNumber min={1} max={120} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="适用资产类别ID（逗号分隔）"
            name="categoryIds"
            tooltip="留空表示适用于所有资产类别"
          >
            <TextArea
              rows={2}
              placeholder="例如：1,2,3"
            />
          </Form.Item>

          <Form.Item
            label="检查项（每行一个）"
            name="checkItems"
            rules={[{ required: true, message: '请输入检查项' }]}
          >
            <TextArea
              rows={6}
              placeholder="例如：&#10;外观检查&#10;性能测试&#10;安全检查&#10;精度校验"
            />
          </Form.Item>

          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Select.Option value="ACTIVE">启用</Select.Option>
              <Select.Option value="DISABLED">禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InspectionTemplatePage;