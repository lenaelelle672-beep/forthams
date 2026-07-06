import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inspectionTaskApi } from '@/api/inspectionTask';
import type { InspectionTask } from '@/types/inspectionTask';
import { Card, Button, Table, Badge, Input, Select, Space, message, Modal, Form, DatePicker, Tag, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

const InspectionTaskPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [params, setParams] = useState({
    keyword: '',
    status: undefined as string | undefined,
    taskType: undefined as string | undefined,
    startDate: undefined as Dayjs | undefined,
    endDate: undefined as Dayjs | undefined,
    pageNum: 1,
    pageSize: 10
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<InspectionTask | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['inspectionTasks', params],
    queryFn: () => inspectionTaskApi.list({
      ...params,
      startDate: params.startDate?.format('YYYY-MM-DD'),
      endDate: params.endDate?.format('YYYY-MM-DD')
    })
  });

  const createMutation = useMutation({
    mutationFn: inspectionTaskApi.create,
    onSuccess: () => {
      message.success('创建成功');
      setModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inspectionTasks'] });
    },
    onError: (error: any) => {
      message.error(error.message || '创建失败');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: InspectionTask }) =>
      inspectionTaskApi.update(id, data),
    onSuccess: () => {
      message.success('更新成功');
      setModalVisible(false);
      setEditingTask(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inspectionTasks'] });
    },
    onError: (error: any) => {
      message.error(error.message || '更新失败');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: inspectionTaskApi.delete,
    onSuccess: () => {
      message.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['inspectionTasks'] });
    },
    onError: (error: any) => {
      message.error(error.message || '删除失败');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      inspectionTaskApi.updateStatus(id, status),
    onSuccess: () => {
      message.success('状态更新成功');
      queryClient.invalidateQueries({ queryKey: ['inspectionTasks'] });
    },
    onError: (error: any) => {
      message.error(error.message || '状态更新失败');
    }
  });

  const handleSearch = () => {
    setParams({ ...params, pageNum: 1 });
  };

  const handleReset = () => {
    setParams({
      keyword: '',
      status: undefined,
      taskType: undefined,
      startDate: undefined,
      endDate: undefined,
      pageNum: 1,
      pageSize: 10
    });
  };

  const handleCreate = () => {
    setEditingTask(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: InspectionTask) => {
    setEditingTask(record);
    form.setFieldsValue({
      ...record,
      plannedDate: record.plannedDate ? dayjs(record.plannedDate) : undefined,
      actualDate: record.actualDate ? dayjs(record.actualDate) : undefined
    });
    setModalVisible(true);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const taskData = {
        ...values,
        plannedDate: values.plannedDate?.format('YYYY-MM-DD'),
        actualDate: values.actualDate?.format('YYYY-MM-DD')
      };

      if (editingTask) {
        updateMutation.mutate({ id: editingTask.id!, data: taskData });
      } else {
        createMutation.mutate(taskData);
      }
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const handleStartTask = (record: InspectionTask) => {
    updateStatusMutation.mutate({ id: record.id!, status: 'IN_PROGRESS' });
  };

  const handleCompleteTask = (record: InspectionTask) => {
    updateStatusMutation.mutate({
      id: record.id!,
      status: 'COMPLETED'
    });
  };

  const handleCancelTask = (record: InspectionTask) => {
    updateStatusMutation.mutate({ id: record.id!, status: 'CANCELLED' });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      PENDING: { color: 'default', text: '待处理' },
      IN_PROGRESS: { color: 'processing', text: '进行中' },
      COMPLETED: { color: 'success', text: '已完成' },
      CANCELLED: { color: 'default', text: '已取消' },
      OVERDUE: { color: 'error', text: '已逾期' }
    };
    const { color, text } = statusMap[status] || { color: 'default', text: status };
    return <Badge status={color as any} text={text} />;
  };

  const getTaskTypeTag = (type: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      ANNUAL: { color: 'blue', text: '年度检验' },
      PERIODIC: { color: 'green', text: '定期检验' },
      SPECIAL: { color: 'orange', text: '专项检验' }
    };
    const { color, text } = typeMap[type] || { color: 'default', text: type };
    return <Tag color={color}>{text}</Tag>;
  };

  const isOverdue = (record: InspectionTask) => {
    return record.status === 'PENDING' || record.status === 'IN_PROGRESS';
  };

  const columns: ColumnsType<InspectionTask> = [
    {
      title: '任务编号',
      dataIndex: 'taskNo',
      key: 'taskNo',
      width: 150,
      fixed: 'left' as const,
      render: (text: string, record: InspectionTask) => {
        const overdue = isOverdue(record) && new Date(record.plannedDate!) < new Date();
        return (
          <Tooltip title={overdue ? '任务已逾期' : ''}>
            <span style={{ color: overdue ? '#ff4d4f' : undefined }}>{text}</span>
          </Tooltip>
        );
      }
    },
    {
      title: '任务名称',
      dataIndex: 'taskName',
      key: 'taskName',
      width: 200,
      ellipsis: true
    },
    {
      title: '任务类型',
      dataIndex: 'taskType',
      key: 'taskType',
      width: 120,
      render: (type: string) => getTaskTypeTag(type)
    },
    {
      title: '计划日期',
      dataIndex: 'plannedDate',
      key: 'plannedDate',
      width: 120,
      render: (date: string, record: InspectionTask) => {
        const overdue = isOverdue(record) && new Date(record.plannedDate!) < new Date();
        return (
          <span style={{ color: overdue ? '#ff4d4f' : undefined }}>
            {date}
          </span>
        );
      }
    },
    {
      title: '实际日期',
      dataIndex: 'actualDate',
      key: 'actualDate',
      width: 120
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => getStatusBadge(status)
    },
    {
      title: '分配给',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 100
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 200,
      ellipsis: true
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 160
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right' as const,
      render: (_, record: InspectionTask) => (
        <Space size="small">
          {record.status === 'PENDING' && (
            <Button
              type="link"
              size="small"
              icon={<ClockCircleOutlined />}
              onClick={() => handleStartTask(record)}
            >
              开始
            </Button>
          )}
          {record.status === 'IN_PROGRESS' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleCompleteTask(record)}
            >
              完成
            </Button>
          )}
          {(record.status === 'PENDING' || record.status === 'IN_PROGRESS') && (
            <Popconfirm
              title="确认取消该任务？"
              onConfirm={() => handleCancelTask(record)}
              okText="确认"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                icon={<StopOutlined />}
                danger
              >
                取消
              </Button>
            </Popconfirm>
          )}
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该任务？"
            onConfirm={() => handleDelete(record.id!)}
            okText="确认"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              icon={<DeleteOutlined />}
              danger
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6">
      <Card>
        <div className="mb-4">
          <Space wrap>
            <Input
              placeholder="任务编号/名称"
              value={params.keyword}
              onChange={(e) => setParams({ ...params, keyword: e.target.value })}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder="任务状态"
              value={params.status}
              onChange={(value) => setParams({ ...params, status: value })}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value="PENDING">待处理</Select.Option>
              <Select.Option value="IN_PROGRESS">进行中</Select.Option>
              <Select.Option value="COMPLETED">已完成</Select.Option>
              <Select.Option value="CANCELLED">已取消</Select.Option>
              <Select.Option value="OVERDUE">已逾期</Select.Option>
            </Select>
            <Select
              placeholder="任务类型"
              value={params.taskType}
              onChange={(value) => setParams({ ...params, taskType: value })}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value="ANNUAL">年度检验</Select.Option>
              <Select.Option value="PERIODIC">定期检验</Select.Option>
              <Select.Option value="SPECIAL">专项检验</Select.Option>
            </Select>
            <DatePicker
              placeholder="开始日期"
              value={params.startDate}
              onChange={(date) => setParams({ ...params, startDate: date })}
            />
            <DatePicker
              placeholder="结束日期"
              value={params.endDate}
              onChange={(date) => setParams({ ...params, endDate: date })}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
            >
              搜索
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
            >
              重置
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建任务
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={data?.list || []}
          loading={isLoading}
          rowKey="id"
          scroll={{ x: 1500 }}
          pagination={{
            current: params.pageNum,
            pageSize: params.pageSize,
            total: data?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setParams({ ...params, pageNum: page, pageSize });
            }
          }}
        />
      </Card>

      <Modal
        title={editingTask ? '编辑检验任务' : '新建检验任务'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setModalVisible(false);
          setEditingTask(null);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            label="任务名称"
            name="taskName"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="请输入任务名称" />
          </Form.Item>
          <Form.Item
            label="任务类型"
            name="taskType"
            rules={[{ required: true, message: '请选择任务类型' }]}
            initialValue="PERIODIC"
          >
            <Select placeholder="请选择任务类型">
              <Select.Option value="ANNUAL">年度检验</Select.Option>
              <Select.Option value="PERIODIC">定期检验</Select.Option>
              <Select.Option value="SPECIAL">专项检验</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="计划检验日期"
            name="plannedDate"
            rules={[{ required: true, message: '请选择计划检验日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="实际检验日期"
            name="actualDate"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="分配给"
            name="assignedTo"
          >
            <Input type="number" placeholder="请输入用户ID" />
          </Form.Item>
          <Form.Item
            label="备注"
            name="remarks"
          >
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InspectionTaskPage;