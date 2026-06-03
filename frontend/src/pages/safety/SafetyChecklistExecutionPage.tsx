import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { safetyApi } from '../../api/safety';
import type { SafetyChecklistItem, SafetyChecklistExecution, SafetyChecklistResult, SysAttachment } from '../../types/safety';
import { Card, Form, Button, Radio, Input, InputNumber, Upload, Space, message, Spin, Steps, Tag, Divider } from 'antd';
import { UploadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';

const SafetyChecklistExecutionPage: React.FC = () => {
  const { executionId } = useParams<{ executionId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);

  // If no executionId, it's a new execution from template
  const isNew = !executionId || executionId === 'new';

  // Get template ID from URL params
  const queryParams = new URLSearchParams(window.location.search);
  const templateIdParam = queryParams.get('templateId');

  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ['safetyTemplate', templateIdParam],
    queryFn: () => safetyApi.getTemplate(Number(templateIdParam)),
    enabled: !!templateIdParam
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['safetyItems', templateIdParam],
    queryFn: () => safetyApi.getItems(Number(templateIdParam)),
    enabled: !!templateIdParam
  });

  const { data: execution, isLoading: executionLoading } = useQuery({
    queryKey: ['safetyExecution', executionId],
    queryFn: () => safetyApi.getExecution(Number(executionId)),
    enabled: !!executionId && executionId !== 'new'
  });

  const { data: existingResults, refetch: refetchResults } = useQuery({
    queryKey: ['safetyResults', executionId],
    queryFn: () => safetyApi.getResults(Number(executionId)),
    enabled: !!executionId && executionId !== 'new'
  });

  const startMutation = useMutation({
    mutationFn: (data: { templateId: number; assetId: number; executorId: number }) =>
      safetyApi.startExecution(data.templateId, data.assetId, data.executorId),
    onSuccess: (data: any) => {
      message.success('检查开始执行');
      navigate(`/safety-checklists/execute/${(data as any).id}`, { replace: true });
    }
  });

  const submitMutation = useMutation({
    mutationFn: (results: SafetyChecklistResult[]) =>
      safetyApi.submitResults(Number(executionId), results),
    onSuccess: () => message.success('检查结果已保存')
  });

  const completeMutation = useMutation({
    mutationFn: () => safetyApi.completeExecution(Number(executionId)),
    onSuccess: () => {
      message.success('检查已完成');
      navigate('/safety-checklists/history');
    }
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: ({ resultId, file }: { resultId: number; file: File }) =>
      safetyApi.uploadPhoto(Number(executionId), resultId, file, 1), // uploadBy=1 实际应从当前用户获取
    onSuccess: (data: any) => {
      message.success('照片上传成功');
      // 刷新照片列表
      if (executionId && executionId !== 'new') {
        safetyApi.getPhotos(Number(executionId)).then(photos => {
          const photoMap = new Map<number, SysAttachment[]>();
          (photos as SysAttachment[]).forEach(photo => {
            const resultId = photo.businessId;
            if (!photoMap.has(resultId)) {
              photoMap.set(resultId, []);
            }
            photoMap.get(resultId)!.push(photo);
          });
          setUploadedPhotos(photoMap);
        });
      }
    }
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: number) => safetyApi.deletePhoto(photoId),
    onSuccess: () => {
      message.success('照片删除成功');
      // 刷新照片列表
      if (executionId && executionId !== 'new') {
        safetyApi.getPhotos(Number(executionId)).then(photos => {
          const photoMap = new Map<number, SysAttachment[]>();
          (photos as SysAttachment[]).forEach(photo => {
            const resultId = photo.businessId;
            if (!photoMap.has(resultId)) {
              photoMap.set(resultId, []);
            }
            photoMap.get(resultId)!.push(photo);
          });
          setUploadedPhotos(photoMap);
        });
      }
    }
  });

  const checklistItems = (items as SafetyChecklistItem[]) || [];
  const executionData = execution as SafetyChecklistExecution | undefined;
  const savedResults = (existingResults as SafetyChecklistResult[]) || [];
  const [uploadedPhotos, setUploadedPhotos] = useState<Map<number, SysAttachment[]>>(new Map());

  // 加载已上传的照片
  useEffect(() => {
    if (executionId && executionId !== 'new') {
      safetyApi.getPhotos(Number(executionId)).then(photos => {
        const photoMap = new Map<number, SysAttachment[]>();
        (photos as SysAttachment[]).forEach(photo => {
          const resultId = photo.businessId;
          if (!photoMap.has(resultId)) {
            photoMap.set(resultId, []);
          }
          photoMap.get(resultId)!.push(photo);
        });
        setUploadedPhotos(photoMap);
      });
    }
  }, [executionId, existingResults]);

  // 如果已有结果，回填
  useEffect(() => {
    if (savedResults.length > 0) {
      const values: Record<string, any> = {};
      savedResults.forEach((r) => {
        if (r.result) values[`result_${r.itemId}`] = r.result;
        if (r.reading != null) values[`reading_${r.itemId}`] = r.reading;
        if (r.photoUrl) values[`photo_${r.itemId}`] = r.photoUrl;
        if (r.note) values[`note_${r.itemId}`] = r.note;
      });
      form.setFieldsValue(values);
    }
  }, [savedResults, form]);

  const handleStart = () => {
    if (!templateIdParam) {
      message.error('缺少模板ID');
      return;
    }
    startMutation.mutate({
      templateId: Number(templateIdParam),
      assetId: 1, // 实际应从资产选择器获取
      executorId: 1 // 实际应从当前用户获取
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const results: SafetyChecklistResult[] = checklistItems.map((item) => ({
        itemId: item.id!,
        result: values[`result_${item.id}`] || undefined,
        reading: values[`reading_${item.id}`] || undefined,
        photoUrl: values[`photo_${item.id}`] || undefined,
        note: values[`note_${item.id}`] || undefined
      }));
      submitMutation.mutate(results);
    } catch (e) {
      message.error('请完成所有必填项');
    }
  };

  const handleComplete = async () => {
    await handleSave();
    completeMutation.mutate();
  };

  // 获取或创建检查项结果
  const getOrCreateResult = (itemId: number): number => {
    const existingResult = savedResults.find(r => r.itemId === itemId);
    if (existingResult && existingResult.id) {
      return existingResult.id;
    }
    // 如果结果不存在，返回一个临时 ID（负数表示临时）
    // 提交时，后端会创建实际的结果记录
    return -itemId;
  };

  const handlePhotoUpload = async (itemId: number, file: File) => {
    const resultId = getOrCreateResult(itemId);
    if (resultId < 0) {
      message.error('请先保存检查结果后再上传照片');
      return;
    }
    uploadPhotoMutation.mutate({ resultId, file });
  };

  const handlePhotoDelete = (photoId: number) => {
    deletePhotoMutation.mutate(photoId);
  };

  const renderItemControl = (item: SafetyChecklistItem) => {
    const isRequired = item.required === 1;
    const rules = isRequired ? [{ required: true, message: `请填写 ${item.itemName}` }] : [];
    const resultId = getOrCreateResult(item.id);
    const photos = resultId > 0 ? (uploadedPhotos.get(resultId) || []) : [];

    switch (item.itemType) {
      case 'PASS_FAIL':
        return (
          <Form.Item
            key={`result_${item.id}`}
            name={`result_${item.id}`}
            label={item.itemName}
            rules={rules}
          >
            <Radio.Group>
              <Radio value="PASS"><Tag color="green">通过</Tag></Radio>
              <Radio value="FAIL"><Tag color="red">不通过</Tag></Radio>
              <Radio value="NA"><Tag color="default">不适用</Tag></Radio>
            </Radio.Group>
          </Form.Item>
        );
      case 'READING':
        return (
          <Form.Item
            key={`reading_${item.id}`}
            name={`reading_${item.id}`}
            label={item.itemName}
            rules={rules}
          >
            <InputNumber style={{ width: 200 }} placeholder="输入读数" suffix="单位" />
          </Form.Item>
        );
      case 'PHOTO':
        return (
          <Form.Item
            key={`photo_${item.id}`}
            name={`photo_${item.id}`}
            label={item.itemName}
          >
            <Upload
              maxCount={5}
              listType="picture-card"
              customRequest={({ file }) => {
                const resultId = (savedResults.find(r => r.itemId === item.id)?.id) || 0;
                if (resultId > 0 && executionId && executionId !== 'new') {
                  uploadPhotoMutation.mutate({ resultId, file: file as File });
                } else {
                  message.warning('请先保存检查结果后再上传照片');
                }
              }}
              onRemove={(file) => {
                const attachment = file.response as SysAttachment;
                if (attachment?.id) {
                  deletePhotoMutation.mutate(attachment.id);
                }
                return true;
              }}
            >
              <Button icon={<UploadOutlined />}>拍照上传</Button>
            </Upload>
          </Form.Item>
        );
      case 'TEXT':
        return (
          <Form.Item
            key={`note_${item.id}`}
            name={`note_${item.id}`}
            label={item.itemName}
            rules={rules}
          >
            <Input.TextArea rows={3} placeholder="输入备注" />
          </Form.Item>
        );
      default:
        return null;
    }
  };

  if (templateLoading || itemsLoading) {
    return <div className="p-6 text-center"><Spin size="large" /></div>;
  }

  // 如果未开始执行（新执行），显示开始页面
  if (isNew && executionData?.status !== 'IN_PROGRESS') {
    return (
      <div className="p-6">
        <Card title="开始安全检查" className="text-center">
          <div className="py-8">
            <h3 className="text-lg mb-4">{templateLoading ? '加载中...' : (template as any)?.templateName || '安全检查'}</h3>
            <p className="text-gray-500 mb-6">包含 {checklistItems.length} 个检查项</p>
            <Button type="primary" size="large" onClick={handleStart} loading={startMutation.isPending}>
              开始执行检查
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card
        title={(template as any)?.templateName || '安全检查执行'}
        extra={
          <Space>
            <Button onClick={handleSave} loading={submitMutation.isPending}>保存</Button>
            <Button type="primary" onClick={handleComplete} loading={completeMutation.isPending}>
              完成检查
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          {checklistItems.map((item, index) => (
            <div key={item.id} className="mb-4 p-4 bg-gray-50 rounded">
              <div className="text-sm text-gray-400 mb-1">第 {index + 1} 项</div>
              {renderItemControl(item)}
            </div>
          ))}
        </Form>
      </Card>
    </div>
  );
};

export default SafetyChecklistExecutionPage;
