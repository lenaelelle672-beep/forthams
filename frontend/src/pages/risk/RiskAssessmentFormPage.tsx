import React, { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { riskApi } from '../../api/risk';
import { Card, Form, Input, InputNumber, Select, DatePicker, Button, Space, message, Alert } from 'antd';
import type { RiskAssessment } from '../../types/risk';

const RiskAssessmentFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const probability = Form.useWatch('probability', form);
  const impact = Form.useWatch('impact', form);

  const riskLevel = useMemo(() => {
    if (probability && impact) {
      const score = probability * impact;
      if (score >= 20) return 'CRITICAL（重大）';
      if (score >= 10) return 'HIGH（高危）';
      if (score >= 4) return 'MEDIUM（中危）';
      return 'LOW（低危）';
    }
    return '请选择概率和影响程度';
  }, [probability, impact]);

  const { data: assessmentData } = useQuery({
    queryKey: ['riskAssessment', id],
    queryFn: () => riskApi.getById(Number(id)),
    enabled: isEdit
  });

  useEffect(() => {
    if (assessmentData) {
      form.setFieldsValue(assessmentData);
    }
  }, [assessmentData, form]);

  const mutation = useMutation({
    mutationFn: (values: RiskAssessment) =>
      isEdit ? riskApi.update(Number(id), values) : riskApi.create(values),
    onSuccess: () => {
      message.success(isEdit ? '更新成功' : '创建成功');
      queryClient.invalidateQueries({ queryKey: ['riskAssessments'] });
      queryClient.invalidateQueries({ queryKey: ['riskHeatmap'] });
      navigate('/risk-assessments');
    },
    onError: () => {
      message.error('操作失败');
    }
  });

  const handleSubmit = (values: any) => {
    mutation.mutate(values);
  };

  return (
    <div className="p-6">
      <Card title={isEdit ? '编辑风险评估' : '新增风险评估'}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ maxWidth: 800 }}
          initialValues={{ probability: 1, impact: 1 }}
        >
          <Alert
            message={`自动计算的风险等级：${riskLevel}`}
            type="info"
            showIcon
            className="mb-4"
          />

          <Form.Item name="assetId" label="资产ID" rules={[{ required: true, message: '请选择资产' }]}>
            <InputNumber style={{ width: '100%' }} min={1} placeholder="输入资产ID" />
          </Form.Item>

          <Space size="large" className="w-full">
            <Form.Item name="probability" label="可能性（1-5）" rules={[{ required: true }]}>
              <Select style={{ width: 200 }}>
                <Select.Option value={1}>1 - 极低</Select.Option>
                <Select.Option value={2}>2 - 低</Select.Option>
                <Select.Option value={3}>3 - 中等</Select.Option>
                <Select.Option value={4}>4 - 高</Select.Option>
                <Select.Option value={5}>5 - 极高</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="impact" label="影响程度（1-5）" rules={[{ required: true }]}>
              <Select style={{ width: 200 }}>
                <Select.Option value={1}>1 - 极小</Select.Option>
                <Select.Option value={2}>2 - 小</Select.Option>
                <Select.Option value={3}>3 - 中等</Select.Option>
                <Select.Option value={4}>4 - 大</Select.Option>
                <Select.Option value={5}>5 - 极大</Select.Option>
              </Select>
            </Form.Item>
          </Space>

          <Form.Item name="mitigationMeasures" label="缓解措施">
            <Input.TextArea rows={4} placeholder="描述风险缓解措施" />
          </Form.Item>

          <Form.Item name="reviewDate" label="评审日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="assessorId" label="评估人ID">
            <InputNumber style={{ width: '100%' }} min={1} placeholder="评估人ID" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={mutation.isPending}>
                {isEdit ? '更新' : '创建'}
              </Button>
              <Button onClick={() => navigate('/risk-assessments')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default RiskAssessmentFormPage;
