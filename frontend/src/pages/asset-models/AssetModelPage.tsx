import React, { useState } from 'react';
import { Table, Button, Input, Select, Space, Modal, Form, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAssetModels, createAssetModel, updateAssetModel, deleteAssetModel, type AssetModel } from '@/api/assetModel';
import http from '@/utils/http';

const { Option } = Select;
const { TextArea } = Input;

interface CategoryOption { id: number; categoryName: string; }
interface ManufacturerOption { id: number; name: string; }
interface FieldsetOption { id: number; name: string; }

export default function AssetModelPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>(undefined);
  const [manufacturerFilter, setManufacturerFilter] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [editRecord, setEditRecord] = useState<AssetModel | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['assetModels', { keyword, categoryFilter, manufacturerFilter, page, pageSize }],
    queryFn: () => getAssetModels({ keyword, categoryId: categoryFilter, manufacturerId: manufacturerFilter, page, pageSize }),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categoryOptions'],
    queryFn: () => http.get<CategoryOption[]>('/categories/all'),
  });

  const manufacturersQuery = useQuery({
    queryKey: ['manufacturerOptions'],
    queryFn: () => http.get<ManufacturerOption[]>('/manufacturers/options'),
  });

  const fieldsetsQuery = useQuery({
    queryKey: ['fieldsetOptions'],
    queryFn: () => http.get<FieldsetOption[]>('/system/custom-fieldsets/all'),
  });

  const createMutation = useMutation({
    mutationFn: createAssetModel,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assetModels'] }); message.success('创建成功'); setModalVisible(false); },
    onError: (e: any) => message.error(e?.message || '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AssetModel }) => updateAssetModel(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assetModels'] }); message.success('更新成功'); setModalVisible(false); },
    onError: (e: any) => message.error(e?.message || '更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAssetModel,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assetModels'] }); message.success('删除成功'); },
    onError: (e: any) => message.error(e?.message || '删除失败'),
  });

  const handleAdd = () => { setEditRecord(null); form.resetFields(); setModalVisible(true); };
  const handleEdit = (r: AssetModel) => {
    setEditRecord(r);
    const formValues = { ...r };
    if (formValues.specifications && typeof formValues.specifications === 'object') {
      formValues.specifications = JSON.stringify(formValues.specifications, null, 2);
    }
    form.setFieldsValue(formValues);
    setModalVisible(true);
  };
  const handleDelete = (id: number) => Modal.confirm({ title: '确认删除?', onOk: () => deleteMutation.mutate(id) });

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload = { ...values };
    if (payload.specifications && typeof payload.specifications === 'string') {
      try { JSON.parse(payload.specifications); } catch {
        message.error('规格参数不是合法的 JSON 格式');
        return;
      }
    }
    if (editRecord?.id) updateMutation.mutate({ id: editRecord.id, data: payload });
    else createMutation.mutate(payload);
  };

  const handleFormatJson = () => {
    const val = form.getFieldValue('specifications');
    if (!val) return;
    try {
      form.setFieldsValue({ specifications: JSON.stringify(JSON.parse(val), null, 2) });
    } catch {
      message.error('JSON 格式无效');
    }
  };

  const columns = [
    { title: '模型名称', dataIndex: 'name', key: 'name' },
    { title: '型号', dataIndex: 'modelNo', key: 'modelNo' },
    {
      title: '分类', dataIndex: 'categoryId', key: 'categoryId',
      render: (v: number) => {
        const c = (categoriesQuery.data as any)?.find((x: any) => x.id === v);
        return c?.categoryName ?? '-';
      },
    },
    {
      title: '制造商', dataIndex: 'manufacturerId', key: 'manufacturerId',
      render: (v: number) => {
        const m = (manufacturersQuery.data as any)?.find((x: any) => x.id === v);
        return m?.name ?? '-';
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (v: number) => <Tag color={v === 0 ? 'green' : 'default'}>{v === 0 ? '正常' : '停用'}</Tag>,
    },
    {
      title: '操作', key: 'action',
      render: (_: any, r: AssetModel) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id!)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">资产模型管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增模型</Button>
      </div>
      <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <Input.Search placeholder="搜索名称/型号" style={{ width: 240 }} onSearch={setKeyword} allowClear />
        <Select placeholder="分类" style={{ width: 160 }} allowClear onChange={setCategoryFilter} loading={categoriesQuery.isLoading}>
          {(categoriesQuery.data as any)?.map((c: CategoryOption) => (
            <Option key={c.id} value={c.id}>{c.categoryName}</Option>
          ))}
        </Select>
        <Select placeholder="制造商" style={{ width: 160 }} allowClear onChange={setManufacturerFilter} loading={manufacturersQuery.isLoading}>
          {(manufacturersQuery.data as any)?.map((m: ManufacturerOption) => (
            <Option key={m.id} value={m.id}>{m.name}</Option>
          ))}
        </Select>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={(data as any)?.records ?? []}
        loading={isLoading}
        pagination={{ total: (data as any)?.total ?? 0, pageSize, current: page, onChange: setPage }}
      />
      <Modal
        title={editRecord ? '编辑资产模型' : '新增资产模型'}
        open={modalVisible}
        width={640}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="modelNo" label="型号">
            <Input />
          </Form.Item>
          <Form.Item name="categoryId" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="请选择分类" loading={categoriesQuery.isLoading}>
              {(categoriesQuery.data as any)?.map((c: CategoryOption) => (
                <Option key={c.id} value={c.id}>{c.categoryName}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="manufacturerId" label="制造商">
            <Select placeholder="请选择制造商" loading={manufacturersQuery.isLoading} allowClear>
              {(manufacturersQuery.data as any)?.map((m: ManufacturerOption) => (
                <Option key={m.id} value={m.id}>{m.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="fieldsetId" label="自定义字段集">
            <Select placeholder="请选择字段集" loading={fieldsetsQuery.isLoading} allowClear>
              {(fieldsetsQuery.data as any)?.map((f: FieldsetOption) => (
                <Option key={f.id} value={f.id}>{f.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="specifications" label="规格参数(JSON)">
            <TextArea rows={4} style={{ fontFamily: 'monospace' }} placeholder='{"cpu": "Intel i7", "memory": "32GB"}' />
            <Button size="small" onClick={handleFormatJson} style={{ marginTop: 4 }}>格式化</Button>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
