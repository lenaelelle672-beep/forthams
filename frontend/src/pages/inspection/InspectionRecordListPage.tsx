import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Button, Space, Tag, Input, Select, DatePicker, Row, Col, Card, Statistic, message, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { inspectionApi } from '@/api/inspection';
import { Inspection, InspectionTypeEnum, InspectionResultEnum } from '@/types/inspection';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

/**
 * 检验记录列表页面
 * 支持记录浏览、筛选、详情查看、统计图表
 */
const InspectionRecordListPage: React.FC = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState<string>('');
  const [inspectionType, setInspectionType] = useState<string | undefined>();
  const [result, setResult] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 查询记录列表
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inspections', keyword, assetId, inspectionType, result, dateRange, pageNum, pageSize],
    queryFn: () => inspectionApi.list({
      keyword,
      inspectionType,
      result,
      startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
      pageNum,
      pageSize
    })
  });

  // 查询统计数据（注：后端暂无统计端点，暂时注释）
  /*
  const { data: statisticsData } = useQuery({
    queryKey: ['inspection-statistics'],
    queryFn: () => inspectionApi.getStatistics({})
  });
  */

  // 删除记录
  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此检验记录吗？',
      onOk: async () => {
        try {
          await inspectionApi.delete(id);
          message.success('删除成功');
          refetch();
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  // 新建记录
  const handleCreate = () => {
    navigate('/inspections/new');
  };

  // 编辑记录
  const handleEdit = (id: number) => {
    navigate(`/inspections/${id}/edit`);
  };

  // 查看详情
  const handleView = (id: number) => {
    navigate(`/inspections/${id}`);
  };

  const columns = [
    {
      title: '检验编号',
      dataIndex: 'inspectionNo',
      key: 'inspectionNo',
      width: 150
    },
    {
      title: '资产ID',
      dataIndex: 'assetId',
      key: 'assetId',
      width: 100
    },
    {
      title: '检验类型',
      dataIndex: 'inspectionType',
      key: 'inspectionType',
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
      title: '检验日期',
      dataIndex: 'inspectionDate',
      key: 'inspectionDate',
      width: 120
    },
    {
      title: '下次检验日期',
      dataIndex: 'nextInspectionDate',
      key: 'nextInspectionDate',
      width: 120
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 100,
      render: (result: InspectionResultEnum) => {
        const resultMap = {
          PASS: { text: '通过', color: 'success' },
          FAIL: { text: '不通过', color: 'error' },
          CONDITIONAL: { text: '有条件通过', color: 'warning' },
          PENDING: { text: '待检验', color: 'default' },
          OVERDUE: { text: '已逾期', color: 'error' }
        };
        const { text, color } = resultMap[result] || { text: result, color: 'default' };
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '检验机构',
      dataIndex: 'inspectionAgency',
      key: 'inspectionAgency',
      width: 120
    },
    {
      title: '检验人员',
      dataIndex: 'inspectorName',
      key: 'inspectorName',
      width: 100
    },
    {
      title: '检验人',
      dataIndex: 'inspectorName',
      key: 'inspectorName',
      width: 120
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: InspectionRecord) => (
        <Space size="small">
          <Button type="link" onClick={() => handleView(record.id!)}>
            详情
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record.id!)}
          >
            编辑
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
      {/* 统计卡片（暂无统计端点，注释） */}
      {/*
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="总记录数"
              value={statisticsData?.totalCount || 0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={statisticsData?.passCount || 0}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="未通过"
              value={statisticsData?.failCount || 0}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="通过率"
              value={statisticsData?.passRate || 0}
              suffix="%"
              precision={2}
            />
          </Card>
        </Col>
      </Row>
      */}

      {/* 筛选区域 */}
      <div className="flex flex-wrap gap-4 mb-4">
        <Search
          placeholder="搜索检验编号/检验人"
          allowClear
          style={{ width: 300 }}
          onSearch={setKeyword}
        />
        <Select
          placeholder="检验类型"
          allowClear
          style={{ width: 150 }}
          onChange={setInspectionType}
        >
          <Option value="ANNUAL">年检</Option>
          <Option value="PERIODIC">定期检验</Option>
          <Option value="SPECIAL">专项检验</Option>
        </Select>
        <Select
          placeholder="检验结果"
          allowClear
          style={{ width: 150 }}
          onChange={setResult}
        >
          <Option value="PASS">通过</Option>
          <Option value="FAIL">不通过</Option>
          <Option value="CONDITIONAL">有条件通过</Option>
          <Option value="PENDING">待检验</Option>
          <Option value="OVERDUE">已逾期</Option>
        </Select>
        <RangePicker
          placeholder={['开始日期', '结束日期']}
          onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建记录
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

export default InspectionRecordListPage;