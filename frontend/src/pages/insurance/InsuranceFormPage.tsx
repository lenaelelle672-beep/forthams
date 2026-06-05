import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { insuranceApi } from '../../api/insurance';
import type { Insurance, InsuranceTypeEnum, InsuranceStatusEnum } from '../../types/insurance';
import { Card, Form, Input, Select, DatePicker, InputNumber, Button, Space, message } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const InsuranceFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const isEdit = !!id;

  const { data: insurance } = useQuery({
    queryKey: ['insurance', id],
    queryFn: () => insuranceApi.getById(Number(id)),
    enabled: isEdit
  });

  useEffect(() => {
    if (insurance && isEdit) {
      form.setFieldsValue({
        ...insurance,
        startDate: dayjs(insurance.startDate),
        endDate: dayjs(insurance.endDate)
      });
    }
  }, [insurance, isEdit, form]);

  const createMutation = useMutation({
    mutationFn: insuranceApi.create,
    onSuccess: () => {
      message.success('创建成功');
      navigate('/insurance');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Insurance }) =>
      insuranceApi.update(id, data),
    onSuccess: () => {
      message.success('更新成功');
      navigate('/insurance');
    }
  });

  const handleSubmit = (values: any) => {
    const data: Insurance = {
      ...values,
      startDate: values.startDate.format('YYYY-MM-DD'),
      endDate: values.endDate.format('YYYY-MM-DD'),
      assetIds: JSON.stringify(values.assetIdList || [])
    };
    if (isEdit) {
      updateMutation.mutate({ id: Number(id), data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="p-6">
      <Card
        title={isEdit ? '编辑保险' : '新增保险'}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/insurance')}>
            返回
          </Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            insuranceType: 'PROPERTY',
            status: 'ACTIVE'
          }}
        >
          <Form.Item
            label="保单号"
            name="policyNo"
            rules={[{ required: true, message: '请输入保单号' }]}
          >
            <Input placeholder="请输入保单号" />
          </Form.Item>

          <Form.Item
            label="保险名称"
            name="insuranceName"
            rules={[{ required: true, message: '请输入保险名称' }]}
          >
            <Input placeholder="请输入保险名称" />
          </Form.Item>

          <Form.Item
            label="保险类型"
            name="insuranceType"
            rules={[{ required: true, message: '请选择保险类型' }]}
          >
            <Select>
              <Select.Option value="PROPERTY">财产险</Select.Option>
              <Select.Option value="LIABILITY">责任险</Select.Option>
              <Select.Option value="VEHICLE">车险</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="保险公司"
            name="insurer"
            rules={[{ required: true, message: '请输入保险公司' }]}
          >
            <Input placeholder="请输入保险公司" />
          </Form.Item>

          <Form.Item
            label="保费"
            name="premium"
            rules={[{ required: true, message: '请输入保费' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入保费"
              addonAfter="元"
            />
          </Form.Item>

          <Form.Item label="保额" name="coverage">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入保额"
              addonAfter="元"
            />
          </Form.Item>

          <Form.Item label="免赔额" name="deductible">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入免赔额"
              addonAfter="元"
            />
          </Form.Item>

          <Form.Item
            label="开始日期"
            name="startDate"
            rules={[{ required: true, message: '请选择开始日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="结束日期"
            name="endDate"
            rules={[{ required: true, message: '请选择结束日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Select.Option value="ACTIVE">生效中</Select.Option>
              <Select.Option value="EXPIRED">已过期</Select.Option>
              <Select.Option value="CANCELLED">已取消</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={4} placeholder="请输入备注" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={createMutation.isPending || updateMutation.isPending}>
                保存
              </Button>
              <Button onClick={() => navigate('/insurance')}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default InsuranceFormPage;