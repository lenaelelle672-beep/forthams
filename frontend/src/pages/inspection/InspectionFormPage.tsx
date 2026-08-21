import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inspectionApi } from '../../api/inspection';
import type { Inspection } from '../../types/inspection';
import { Alert, Card, Form, Input, Select, DatePicker, Button, Space, message, Modal, Tag, InputNumber, Image } from 'antd';
import { QrcodeOutlined, CameraOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import http from '@/utils/http';

type WorkbenchInspectionPrefill = {
  hasPrefill: boolean;
  sourceLabel: string;
  values: Record<string, unknown>;
  tags: string[];
};

const WORKBENCH_INSPECTION_SOURCE_LABELS: Record<string, string> = {
  'quick-inspection': '设备巡检快捷入口',
  'temperature-check': '温度异常点检',
  'asset-risk': '资产风险巡检',
};

function getSearchValue(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key)?.trim() ?? '';
}

function parseAssetId(searchParams: URLSearchParams): number | undefined {
  const assetId = Number(getSearchValue(searchParams, 'assetId'));
  return Number.isFinite(assetId) && assetId > 0 ? assetId : undefined;
}

function getWorkbenchInspectionPrefill(searchParams: URLSearchParams): WorkbenchInspectionPrefill {
  const source = getSearchValue(searchParams, 'source');
  const assetName = getSearchValue(searchParams, 'assetName');
  const inspectionNo = getSearchValue(searchParams, 'inspectionNo');
  const inspectionType = getSearchValue(searchParams, 'inspectionType') || 'SPECIAL';
  const inspectionDate = getSearchValue(searchParams, 'inspectionDate');
  const nextInspectionDate = getSearchValue(searchParams, 'nextInspectionDate');
  const inspectorName = getSearchValue(searchParams, 'inspectorName');
  const findings = getSearchValue(searchParams, 'findings');
  const assetId = parseAssetId(searchParams);
  const hasPrefill = Boolean(source || assetId || assetName || inspectionNo || findings);

  if (!hasPrefill) {
    return {
      hasPrefill: false,
      sourceLabel: '',
      values: {},
      tags: [],
    };
  }

  const sourceLabel = WORKBENCH_INSPECTION_SOURCE_LABELS[source] ?? '固定资产工作台巡检';
  const generatedFindings = findings ||
    [
      `来源：${sourceLabel}`,
      assetName ? `资产：${assetName}` : '',
      '请现场核验在线状态、所在位置、温度与维保等级。',
    ].filter(Boolean).join('；');

  return {
    hasPrefill,
    sourceLabel,
    values: {
      inspectionNo: inspectionNo || `INSP-${dayjs().format('YYYYMMDD-HHmm')}`,
      assetId,
      inspectionType,
      inspectionDate: inspectionDate ? dayjs(inspectionDate) : dayjs(),
      nextInspectionDate: nextInspectionDate ? dayjs(nextInspectionDate) : undefined,
      inspectorName,
      result: 'PENDING',
      findings: generatedFindings,
    },
    tags: [assetName, assetId ? `资产ID ${assetId}` : '', inspectionType, inspectionDate, nextInspectionDate]
      .filter(Boolean),
  };
}

// 简单的 PhotoUpload 组件（使用 Ant Design）
const PhotoUpload: React.FC<{ value?: string; onChange?: (value: string) => void }> = ({ value, onChange }) => {
  const [photos, setPhotos] = useState<string[]>(value ? JSON.parse(value) : []);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const formData = new FormData();
      formData.append('file', files[0]);
      try {
        const url = await http.post<string>('/file/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (url) {
          const newPhotos = [...photos, url];
          setPhotos(newPhotos);
          onChange?.(JSON.stringify(newPhotos));
          message.success('照片上传成功');
        }
      } catch (error) {
        message.error('照片上传失败');
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    onChange?.(JSON.stringify(newPhotos));
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <Button
        icon={<CameraOutlined />}
        onClick={() => fileInputRef.current?.click()}
        style={{ marginBottom: 8 }}
      >
        上传照片
      </Button>
      {photos.length > 0 && (
        <Image.PreviewGroup
          preview={{
            visible: previewOpen,
            onVisibleChange: (vis) => setPreviewOpen(vis),
            current: Number(previewImage) || 0,
            onChange: (current) => setPreviewImage(String(current))
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {photos.map((url, index) => (
              <div key={index} style={{ position: 'relative' }}>
                <Image
                  src={url}
                  alt={`照片${index + 1}`}
                  width={100}
                  height={100}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                  preview={{ src: url }}
                />
                <Button
                  type="text"
                  danger
                  size="small"
                  style={{ position: 'absolute', top: 4, right: 4 }}
                  onClick={() => removePhoto(index)}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </Image.PreviewGroup>
      )}
    </div>
  );
};

const InspectionFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const workbenchPrefill = useMemo(() => getWorkbenchInspectionPrefill(searchParams), [searchParams]);

  const { data: inspectionData } = useQuery({
    queryKey: ['inspection', id],
    queryFn: () => inspectionApi.getById(Number(id)),
    enabled: isEdit
  });

  useEffect(() => {
    if (inspectionData) {
      const data = inspectionData as any;
      form.setFieldsValue({
        ...data,
        inspectionDate: data.inspectionDate ? dayjs(data.inspectionDate) : undefined,
        nextInspectionDate: data.nextInspectionDate ? dayjs(data.nextInspectionDate) : undefined,
        certificateExpiry: data.certificateExpiry ? dayjs(data.certificateExpiry) : undefined
      });
    }
  }, [inspectionData, form]);

  useEffect(() => {
    if (isEdit || !workbenchPrefill.hasPrefill) return;
    form.setFieldsValue(workbenchPrefill.values);
  }, [form, isEdit, workbenchPrefill]);

  const mutation = useMutation({
    mutationFn: (values: Inspection) =>
      isEdit ? inspectionApi.update(Number(id), values) : inspectionApi.create(values),
    onSuccess: () => {
      message.success(isEdit ? '更新成功' : '创建成功');
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      navigate('/inspections');
    },
    onError: () => {
      message.error('操作失败');
    }
  });

  const handleScan = async () => {
    try {
      // 使用原生浏览器 API 调用摄像头
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setScanModalVisible(true);
      }
    } catch (error) {
      message.error('无法访问摄像头，请确保已授予权限');
    }
  };

  const handleScanConfirm = () => {
    // 简化实现：手动输入资产ID
    const assetId = prompt('请输入扫描到的资产ID：');
    if (assetId) {
      form.setFieldValue('assetId', Number(assetId));
    }
    stopScan();
  };

  const stopScan = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setScanModalVisible(false);
  };

  const handleSubmit = (values: any) => {
    const data = {
      ...values,
      inspectionDate: values.inspectionDate?.format('YYYY-MM-DD'),
      nextInspectionDate: values.nextInspectionDate?.format('YYYY-MM-DD'),
      certificateExpiry: values.certificateExpiry?.format('YYYY-MM-DD')
    };
    mutation.mutate(data);
  };

  return (
    <div className="p-6">
      {!isEdit && workbenchPrefill.hasPrefill && (
        <Alert
          data-testid="workbench-inspection-prefill"
          type="info"
          showIcon
          className="mb-4"
          message={workbenchPrefill.sourceLabel}
          description={
            <div className="space-y-2">
              <div>已从固定资产工作台带入资产、巡检编号、计划日期和检查发现，提交前可继续调整模板、检验人、照片和证书信息。</div>
              <div className="flex flex-wrap gap-2">
                {workbenchPrefill.tags.map((tag) => (
                  <Tag key={String(tag)} color="blue">{String(tag)}</Tag>
                ))}
              </div>
            </div>
          }
        />
      )}
      <Card title={isEdit ? '编辑检验记录' : '新增检验记录'}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ maxWidth: 800 }}
        >
          <Form.Item name="inspectionNo" label="检验编号" rules={[{ required: true, message: '请输入检验编号' }]}>
            <Input placeholder="自动生成或手动输入" />
          </Form.Item>

          <Form.Item label="资产ID" required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="assetId" noStyle rules={[{ required: true, message: '请选择资产' }]}>
                <InputNumber
                  placeholder="输入资产ID"
                  min={1}
                  style={{ flex: 1 }}
                />
              </Form.Item>
              <Button icon={<QrcodeOutlined />} onClick={handleScan}>
                扫码
              </Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item name="templateId" label="检验模板">
            <Select placeholder="请选择检验模板（可选）">
              <Select.Option value={1}>年度检验模板</Select.Option>
              <Select.Option value={2}>定期检验模板</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="inspectionType" label="检验类型" rules={[{ required: true, message: '请选择检验类型' }]}>
            <Select placeholder="请选择">
              <Select.Option value="ANNUAL">年度检验</Select.Option>
              <Select.Option value="PERIODIC">定期检验</Select.Option>
              <Select.Option value="SPECIAL">专项检验</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="inspectionDate" label="检验日期" rules={[{ required: true, message: '请选择检验日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="nextInspectionDate" label="下次检验日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="inspectionAgency" label="检验机构">
            <Input placeholder="请输入检验机构" />
          </Form.Item>

          <Form.Item name="inspectorName" label="检验人">
            <Input placeholder="请输入检验人" />
          </Form.Item>

          <Form.Item name="result" label="检验结果" rules={[{ required: true, message: '请选择检验结果' }]}>
            <Select placeholder="请选择">
              <Select.Option value="PASS">通过</Select.Option>
              <Select.Option value="FAIL">不通过</Select.Option>
              <Select.Option value="CONDITIONAL">附条件通过</Select.Option>
              <Select.Option value="PENDING">待检验</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="findings" label="检查发现">
            <Input.TextArea placeholder="请输入检查发现内容" rows={4} />
          </Form.Item>

          <Form.Item name="photos" label="检验照片">
            <PhotoUpload />
          </Form.Item>

          <Form.Item name="certificateNo" label="证书编号">
            <Input placeholder="请输入证书编号" />
          </Form.Item>

          <Form.Item name="certificateExpiry" label="证书到期日">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="cost" label="检验费用">
            <InputNumber prefix="¥" style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>

          <Form.Item name="reportAttachment" label="报告附件">
            <Input placeholder="附件路径或URL" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={mutation.isPending}>
                {isEdit ? '更新' : '创建'}
              </Button>
              <Button onClick={() => navigate('/inspections')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 扫码弹窗 */}
      <Modal
        title="扫描资产二维码"
        open={scanModalVisible}
        onOk={handleScanConfirm}
        onCancel={stopScan}
        okText="确认"
        cancelText="取消"
      >
        <div style={{ textAlign: 'center' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: '100%', maxHeight: 400, background: '#000' }}
          />
          <p style={{ marginTop: 16 }}>请将二维码置于摄像头前扫描</p>
        </div>
      </Modal>
    </div>
  );
};

export default InspectionFormPage;
