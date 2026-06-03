import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { insuranceApi, claimApi } from '../../api/insurance';
import type { Insurance, InsuranceClaim } from '../../types/insurance';
import { Card, Descriptions, Button, Table, Space, message, Badge } from 'antd';
import { ArrowLeftOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const InsuranceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: insurance, isLoading: insuranceLoading } = useQuery({
    queryKey: ['insurance', id],
    queryFn: () => insuranceApi.getById(Number(id))
  });

  const { data: claimsData, isLoading: claimsLoading } = useQuery({
    queryKey: ['claims', id],
    queryFn: () => claimApi.list(Number(id))
  });

  const handleCreateClaim = () => {
    navigate(`/insurance/${id}/claims/create`);
  };

  const insuranceTypeMap: Record<string, string> = {
    PROPERTY: '财产险',
    LIABILITY: '责任险',
    VEHICLE: '车险'
  };

  const statusMap: Record<string, { text: string; color: string }> = {
    ACTIVE: { text: '生效中', color: 'green' },
    EXPIRED: { text: '已过期', color: 'red' },
    CANCELLED: { text: '已取消', color: 'gray' }
  };

  const claimStatusMap: Record<string, { text: string; color: string }> = {
    PENDING: { text: '待处理', color: 'orange' },
    APPROVED: { text: '已批准', color: 'green' },
    REJECTED: { text: '已拒绝', color: 'red' }
  };

  const claimColumns = [
    { title: '理赔编号', dataIndex: 'claimNo', key: 'claimNo' },
    { title: '理赔日期', dataIndex: 'claimDate', key: 'claimDate' },
    { title: '理赔金额', dataIndex: 'claimAmount', key: 'claimAmount',
      render: (value: number) => `￥${value?.toFixed(2)}`
    },
    { title: '已赔付金额', dataIndex: 'settledAmount', key: 'settledAmount',
      render: (value: number) => `￥${value?.toFixed(2)}`
    },
    { title: '状态', dataIndex: 'status', key: 'status',
      render: (status: string) => {
        const info = claimStatusMap[status] || { text: status, color: 'default' };
        return <Badge color={info.color} text={info.text} />;
      }
    },
    { title: '赔付日期', dataIndex: 'settleDate', key: 'settleDate' },
    { title: '事故描述', dataIndex: 'incidentDescription', key: 'incidentDescription',
      ellipsis: true
    }
  ];

  if (insuranceLoading) {
    return <div className="p-6">加载中...</div>;
  }

  if (!insurance) {
    return <div className="p-6">未找到保险记录</div>;
  }

  const statusInfo = statusMap[insurance.status] || { text: insurance.status, color: 'default' };

  return (
    <div className="p-6">
      <Card
        title="保险详情"
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/insurance')}>
              返回
            </Button>
            <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/insurance/${id}/edit`)}>
              编辑
            </Button>
          </Space>
        }
      >
        <Descriptions column={2} bordered>
          <Descriptions.Item label="保单号">{insurance.policyNo}</Descriptions.Item>
          <Descriptions.Item label="保险名称">{insurance.insuranceName}</Descriptions.Item>
          <Descriptions.Item label="保险类型">
            {insuranceTypeMap[insurance.insuranceType] || insurance.insuranceType}
          </Descriptions.Item>
          <Descriptions.Item label="保险公司">{insurance.insurer}</Descriptions.Item>
          <Descriptions.Item label="保费">￥{insurance.premium?.toFixed(2)}</Descriptions.Item>
          <Descriptions.Item label="保额">￥{insurance.coverage?.toFixed(2) || '-'}</Descriptions.Item>
          <Descriptions.Item label="免赔额">￥{insurance.deductible?.toFixed(2) || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Badge color={statusInfo.color} text={statusInfo.text} />
          </Descriptions.Item>
          <Descriptions.Item label="开始日期">{insurance.startDate}</Descriptions.Item>
          <Descriptions.Item label="结束日期">{insurance.endDate}</Descriptions.Item>
          <Descriptions.Item label="创建时间" span={2}>
            {insurance.createTime ? dayjs(insurance.createTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>
            {insurance.remark || '-'}
          </Descriptions.Item>
        </Descriptions>

        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">理赔记录</h3>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateClaim}>
              新增理赔
            </Button>
          </div>
          <Table
            columns={claimColumns}
            dataSource={claimsData?.list || []}
            loading={claimsLoading}
            rowKey="id"
            pagination={{
              total: claimsData?.total || 0,
              showSizeChanger: true,
              showQuickJumper: true
            }}
          />
        </div>
      </Card>
    </div>
  );
};

export default InsuranceDetailPage;