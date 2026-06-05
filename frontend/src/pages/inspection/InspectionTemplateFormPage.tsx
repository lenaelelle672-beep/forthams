import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, InputNumber, Button, message, Card, Space } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { inspectionTemplateApi } from '@/api/inspection';
import { InspectionTemplate, InspectionTypeEnum } from '@/types/inspection';

const { Option } = Select;

/**
 * 检验模板表单页面
 * 支持模板创建和编辑，包括检查项配置
 */
const InspectionTemplateFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm<InspectionTemplate>();
  const isEdit = !!id;

  // 查询模板详情（编辑模式）
  const { data: templateData, isLoading } = useQuery({
    queryKey: ['inspection-template', id],
    queryFn: () => inspectionTemplateApi.getById(Number(id)),
    enabled: isEdit
  });

  // 初始化表单数据
  useEffect(() => {
    if (templateData) {
      form.setFieldsValue({
        templateName: templateData.templateName,
        type: templateData.type,
        frequency: templateData.frequency,
        checkItems: templateData.checkItems
      });
    }
  }, [templateData, form]);

  // 创建/更新模板
  const { mutate, isPending } = useMutation({
    mutationFn: async (data: InspectionTemplate) => {
      if (isEdit) {
        return await inspectionTemplateApi.update(Number(id), data);
      } else {
        return await inspectionTemplateApi.create(data);
      }
    },
    onSuccess: () => {
      message.success(isEdit ? '更新成功' : '创建成功');
      navigate('/inspection-templates');
    },
    onError: () => {
      message.error(isEdit ? '更新失败' : '创建失败');
    }
  });

  // 提交表单
  const handleSubmit = (values: InspectionTemplate) => {
    mutate(values);
  };

  // 检查项编辑器（简化版，使用 JSON 输入）
  const [checkItemsText, setCheckItemsText] = useState<string>('[]');

  useEffect(() => {
    if (templateData?.checkItems) {
      try {
        const items = JSON.parse(templateData.checkItems);
        setCheckItemsText(JSON.stringify(items, null, 2));
      } catch (e) {
        setCheckItemsText(templateData.checkItems);
      }
    }
  }, [templateData]);

  const handleCheckItemsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCheckItemsText(e.target.value);
  };

  return (
    <div className="p-6">
      <Card>
        <div className="mb-6">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/inspection-templates')}
          >
            返回列表
          </Button>
        </div>

        <h1 className="text-2xl font-bold mb-6">
          {isEdit ? '编辑检验模板' : '新建检验模板'}
        </h1>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="模板名称"
            name="templateName"
            rules={[
              { required: true, message: '请输入模板名称' },
              { max: 200, message: '模板名称不能超过200个字符' }
            ]}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>

          <Form.Item
            label="检验类型"
            name="type"
            rules={[{ required: true, message: '请选择检验类型' }]}
          >
            <Select placeholder="请选择检验类型">
              <Option value={InspectionTypeEnum.ANNUAL}>年检</Option>
              <Option value={InspectionTypeEnum.PERIODIC}>定期检验</Option>
              <Option value={InspectionTypeEnum.SPECIAL}>专项检验</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="检验周期（月）"
            name="frequency"
            rules={[
              { required: true, message: '请输入检验周期' },
              { type: 'number', min: 1, message: '检验周期必须大于0' }
            ]}
            initialValue={12}
          >
            <InputNumber min={1} max={120} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="检查项配置（JSON格式）"
            help={'请输入检查项数组，例如：[{"name":"外观检查","description":"检查设备外观是否完好","required":true}]'}
          >
            <Input.TextArea
              value={checkItemsText}
              onChange={handleCheckItemsChange}
              rows={8}
              placeholder="请输入检查项配置（JSON格式）"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={isLoading || isPending}
              >
                {isEdit ? '保存' : '创建'}
              </Button>
              <Button onClick={() => navigate('/inspection-templates')}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default InspectionTemplateFormPage;