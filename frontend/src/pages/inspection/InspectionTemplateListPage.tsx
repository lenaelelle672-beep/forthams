import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Button, Space, Tag, Input, Select, message, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PoweroffOutlined } from '@ant-design/icons';
import { inspectionTemplateApi } from '@/api/inspection';
import { InspectionTemplate, InspectionTypeEnum } from '@/types/inspection';
import { useNavigate } from 'react-router-dom';

const { Search } = Input;
const { Option } = Select;

/**
 * 检验模板列表页面
 * 支持模板浏览、筛选、启用/禁用、复制、删除
 */
const InspectionTemplateListPage: React.FC = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState<string>('');
  const [type, setType] = useState<string | undefined>();
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 查询模板列表
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inspection-templates', keyword, type, pageNum, pageSize],
    queryFn: () => inspectionTemplateApi.list({
      keyword,
      type,
      pageNum,
      pageSize
    })
  });

  // 删除模板
  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此检验模板吗？',
      onOk: async () => {
        try {
          await inspectionTemplateApi.delete(id);
          message.success('删除成功');
          refetch();
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  // 启用/禁用模板
  const handleToggleStatus = async (id: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
      await inspectionTemplateApi.toggleStatus(id, newStatus);
      message.success(newStatus === 'ACTIVE' ? '已启用' : '已禁用');
      refetch();
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 复制模板
  const handleCopy = async (id: number) => {
    try {
      // TODO: 实现复制功能
      message.info('复制功能开发中');
    } catch (error) {
      message.error('复制失败');
    }
  };

  // 新建模板
  const handleCreate = () => {
    navigate('/inspection-templates/new');
  };

  // 编辑模板
  const handleEdit = (id: number) => {
    navigate(`/inspection-templates/${id}/edit`);
  };

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'templateName',
      key: 'templateName',
      width: 200
    },
    {
      title: '检验类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: InspectionTypeEnum) => {
        const typeMap = {
          ANNUAL: '年检',
          PERIODIC: '定期检验',
          SPECIAL: '专项检验'
        };
        return <Tag color={type === 'ANNUAL' ? 'blue' : type === 'PERIODIC' ? 'green' : 'orange'}>
          {typeMap[type] || type}
        </Tag>;
      }
    },
    {
      title: '检验周期（月）',
      dataIndex: 'frequency',
      key: 'frequency',
      width: 120
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>
          {status === 'ACTIVE' ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: InspectionTemplate) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record.id!)}
          >
            编辑
          </Button>
          <Button
            type="link"
            icon={<PoweroffOutlined />}
            onClick={() => handleToggleStatus(record.id!, record.status!)}
          >
            {record.status === 'ACTIVE' ? '禁用' : '启用'}
          </Button>
          <Button
            type="link"
            onClick={() => handleCopy(record.id!)}
          >
            复制
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id!)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">检验模板管理</h1>

        {/* 筛选区域 */}
        <div className="flex gap-4 mb-4">
          <Search
            placeholder="搜索模板名称"
            allowClear
            style={{ width: 300 }}
            onSearch={setKeyword}
          />
          <Select
            placeholder="检验类型"
            allowClear
            style={{ width: 200 }}
            onChange={setType}
          >
            <Option value="ANNUAL">年检</Option>
            <Option value="PERIODIC">定期检验</Option>
            <Option value="SPECIAL">专项检验</Option>
          </Select>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建模板
          </Button>
        </div>
      </div>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={data?.list || []}
        loading={isLoading}
        rowKey="id"
        pagination={{
          current: pageNum,
          pageSize,
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, size) => {
            setPageNum(page);
            setPageSize(size);
          }
        }}
      />
    </div>
  );
};

export default InspectionTemplateListPage;