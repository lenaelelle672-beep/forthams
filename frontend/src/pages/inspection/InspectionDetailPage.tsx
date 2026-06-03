import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { inspectionApi } from '../../api/inspection';
import { Card, Descriptions, Badge, Button, Spin, Space, Image, Table, Tag } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const InspectionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['inspection', id],
    queryFn: () => inspectionApi.getById(Number(id)),
    enabled: !!id
  });

  // 查询检验历史
  const { data: historyData } = useQuery({
    queryKey: ['inspection-history', (data as any)?.assetId],
    queryFn: () => inspectionApi.getHistory((data as any)?.assetId),
    enabled: !!(data as any)?.assetId
  });

  const inspection = data as any;
  const historyList = historyData as any[] || [];

  if (isLoading) {
    return <div className="p-6 text-center"><Spin size="large" /></div>;
  }

  if (!inspection) {
    return <div className="p-6 text-center">检验记录不存在</div>;
  }

  const typeMap: Record<string, string> = {
    ANNUAL: '年度检验',
    PERIODIC: '定期检验',
    SPECIAL: '专项检验'
  };

  const resultMap: Record<string, { text: string; color: string }> = {
    PASS: { text: '通过', color: 'green' },
    FAIL: { text: '不通过', color: 'red' },
    CONDITIONAL: { text: '附条件通过', color: 'orange' },
    PENDING: { text: '待检验', color: 'blue' },
    OVERDUE: { text: '逾期', color: 'volcano' }
  };

  // 解析照片数组
  const photos = inspection.photos ? JSON.parse(inspection.photos) : [];

  return (
    <div className="p-6" style={{ maxWidth: 1200 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 检验详情卡片 */}
        <Card
          title={
            <Space>
              <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/inspections')} />
              检验详情
            </Space>
          }
          extra={
            <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/inspections/${id}/edit`)}>
              编辑
            </Button>
          }
        >
          <Descriptions bordered column={2}>
            <Descriptions.Item label="检验编号">{inspection.inspectionNo}</Descriptions.Item>
            <Descriptions.Item label="资产ID">{inspection.assetId}</Descriptions.Item>
            <Descriptions.Item label="检验类型">{typeMap[inspection.inspectionType] || inspection.inspectionType}</Descriptions.Item>
            <Descriptions.Item label="检验日期">{inspection.inspectionDate}</Descriptions.Item>
            <Descriptions.Item label="下次检验日期">
              {inspection.nextInspectionDate ? (
                <span>
                  {inspection.nextInspectionDate}
                  {dayjs(inspection.nextInspectionDate).diff(dayjs(), 'day') <= 30 && (
                    <Badge color="orange" style={{ marginLeft: 8 }} text="即将到期" />
                  )}
                </span>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="检验结果">
              {inspection.result && (
                <Badge color={resultMap[inspection.result]?.color} text={resultMap[inspection.result]?.text} />
              )}
            </Descriptions.Item>
            <Descriptions.Item label="检验机构">{inspection.inspectionAgency || '-'}</Descriptions.Item>
            <Descriptions.Item label="检验人">{inspection.inspectorName || '-'}</Descriptions.Item>
            <Descriptions.Item label="证书编号">{inspection.certificateNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="证书到期日">{inspection.certificateExpiry || '-'}</Descriptions.Item>
            <Descriptions.Item label="检验费用">{inspection.cost ? `¥${inspection.cost}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="报告附件">{inspection.reportAttachment || '-'}</Descriptions.Item>
            <Descriptions.Item label="检验模板" span={2}>
              {inspection.templateId ? `模板ID: ${inspection.templateId}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="检查发现" span={2}>
              {inspection.findings || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 检验照片卡片 */}
        {photos.length > 0 && (
          <Card title="检验照片">
            <Image.PreviewGroup>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {photos.map((url: string, index: number) => (
                  <Image
                    key={index}
                    src={url}
                    alt={`检验照片${index + 1}`}
                    width={200}
                    height={150}
                    style={{ objectFit: 'cover', borderRadius: 8 }}
                  />
                ))}
              </div>
            </Image.PreviewGroup>
          </Card>
        )}

        {/* 检验历史列表卡片 */}
        {historyList.length > 0 && (
          <Card title="检验历史">
            <Table
              dataSource={historyList.filter((item: any) => item.id !== Number(id))}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              columns={[
                {
                  title: '检验编号',
                  dataIndex: 'inspectionNo',
                  key: 'inspectionNo'
                },
                {
                  title: '检验类型',
                  dataIndex: 'inspectionType',
                  key: 'inspectionType',
                  render: (type: string) => typeMap[type] || type
                },
                {
                  title: '检验日期',
                  dataIndex: 'inspectionDate',
                  key: 'inspectionDate'
                },
                {
                  title: '检验结果',
                  dataIndex: 'result',
                  key: 'result',
                  render: (result: string) => (
                    result ? (
                      <Tag color={resultMap[result]?.color}>
                        {resultMap[result]?.text}
                      </Tag>
                    ) : '-'
                  )
                },
                {
                  title: '操作',
                  key: 'action',
                  render: (_: any, record: any) => (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => navigate(`/inspections/${record.id}`)}
                    >
                      查看详情
                    </Button>
                  )
                }
              ]}
            />
          </Card>
        )}
      </Space>
    </div>
  );
};

export default InspectionDetailPage;