/**
 * @file pages/intake/IntakeFormPage.tsx
 * @description 入库验收表单页
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useCreateIntakeOrder, useUpdateIntakeOrder, useIntakeOrderDetail } from '@/hooks/intake/useIntakeOrders';
import type { CreateIntakeOrderRequest, IntakeCheckItem, IntakeAsset } from '@/types/intake';
import type { Vendor, Location } from '@/types/common';
import type { AssetCategory } from '@/types/asset';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectItem } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { getVendorList } from '@/api/vendor';
import { getCategoryTree } from '@/api/asset';
import { getLocationTree } from '@/api/base';
import { toast } from 'sonner';

export default function IntakeFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id && id !== 'new';

  const { data: detailRes } = useIntakeOrderDetail(isEdit ? Number(id) : null);
  const createMutation = useCreateIntakeOrder();
  const updateMutation = useUpdateIntakeOrder();

  const [remark, setRemark] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [checkItems, setCheckItems] = useState<IntakeCheckItem[]>([
    { itemName: '', expectedValue: '' },
  ]);
  const [intakeAssets, setIntakeAssets] = useState<IntakeAsset[]>([
    { assetName: '' },
  ]);
  const [loading, setLoading] = useState(false);

  // 供应商列表 (用于下拉选择)
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', 'select'],
    queryFn: async () => {
      const res = await getVendorList({ page: 1, pageSize: 999 });
      return (res as any)?.records ?? [];
    },
    staleTime: 60_000,
  });
  const vendors: Vendor[] = vendorsData ?? [];

  // 分类树 (用于下拉选择)
  const { data: categoriesData } = useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: async () => {
      const res = await getCategoryTree();
      // 处理可能的分页/解包结构
      const raw = (res as any)?.data ?? res;
      return Array.isArray(raw) ? raw : [];
    },
    staleTime: 60_000,
  });
  const categories: AssetCategory[] = categoriesData ?? [];

  // 地点树 (用于下拉选择)
  const { data: locationsData } = useQuery({
    queryKey: ['locations', 'tree'],
    queryFn: async () => {
      const res = await getLocationTree();
      return Array.isArray(res) ? res : [];
    },
    staleTime: 60_000,
  });
  const locations: Location[] = locationsData ?? [];

  /** 递归展平分类树得到所有叶子/中间节点 */
  const flattenCategories = (nodes: AssetCategory[]): AssetCategory[] => {
    const result: AssetCategory[] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children?.length) result.push(...flattenCategories(node.children));
    }
    return result;
  };

  /** 递归展平地点树 */
  const flattenLocations = (nodes: Location[]): Location[] => {
    const result: Location[] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children?.length) result.push(...flattenLocations(node.children));
    }
    return result;
  };

  React.useEffect(() => {
    if (detailRes) {
      const order = (detailRes as any)?.data || detailRes;
      setRemark(order.remark || '');
      setOrderDate(order.orderDate || new Date().toISOString().split('T')[0]);
      setTotalAmount(order.totalAmount?.toString() || '');
      setVendorId(order.vendorId?.toString() || '');
      if (order.checkItems?.length) setCheckItems(order.checkItems);
      if (order.intakeAssets?.length) setIntakeAssets(order.intakeAssets);
    }
  }, [detailRes]);

  const addCheckItem = () => {
    setCheckItems([...checkItems, { itemName: '', expectedValue: '' }]);
  };

  const removeCheckItem = (index: number) => {
    setCheckItems(checkItems.filter((_, i) => i !== index));
  };

  const updateCheckItem = (index: number, field: keyof IntakeCheckItem, value: string) => {
    const updated = [...checkItems];
    updated[index] = { ...updated[index], [field]: value };
    setCheckItems(updated);
  };

  const addIntakeAsset = () => {
    setIntakeAssets([...intakeAssets, { assetName: '' }]);
  };

  const removeIntakeAsset = (index: number) => {
    setIntakeAssets(intakeAssets.filter((_, i) => i !== index));
  };

  const updateIntakeAsset = (index: number, field: keyof IntakeAsset, value: any) => {
    const updated = [...intakeAssets];
    updated[index] = { ...updated[index], [field]: value };
    setIntakeAssets(updated);
  };

  const handleSubmit = async () => {
    if (intakeAssets.length === 0 || !intakeAssets[0].assetName) {
      toast.error('请至少添加一个入库资产');
      return;
    }

    setLoading(true);
    try {
      const data: CreateIntakeOrderRequest = {
        vendorId: vendorId ? parseInt(vendorId) : undefined,
        remark,
        orderDate,
        totalAmount: totalAmount ? parseFloat(totalAmount) : undefined,
        checkItems: checkItems.filter((c) => c.itemName),
        intakeAssets: intakeAssets.filter((a) => a.assetName),
      };

      if (isEdit) {
        await updateMutation.mutateAsync({ id: Number(id), data });
      } else {
        await createMutation.mutateAsync(data);
      }
      navigate('/intake');
    } catch (err) {
      // Error is handled by mutation
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={isEdit ? '编辑验收单' : '新建验收单'}
        description="填写验收信息和入库资产"
        actions={
          <Button variant="outline" onClick={() => navigate('/intake')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        }
      />

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
        {/* 验收单信息 */}
        <Card>
          <CardHeader>
            <CardTitle>验收单信息</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">验收日期</label>
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">供应商</label>
              <Select
                value={vendorId}
                onValueChange={setVendorId}
                placeholder="选择供应商"
              >
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">总金额</label>
              <Input
                type="number"
                step="0.01"
                placeholder="输入总金额"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-[#374151] mb-1">备注</label>
              <Input
                placeholder="验收备注"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 验收项 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>验收检查项</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addCheckItem}>
                <Plus className="w-3.5 h-3.5 mr-1" /> 添加
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {checkItems.map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-[#f8fafc] rounded-lg border border-[#e5e7eb]">
                <span className="text-xs font-medium text-[#64748b] w-6">{index + 1}</span>
                <Input
                  placeholder="检查项名称"
                  value={item.itemName}
                  onChange={(e) => updateCheckItem(index, 'itemName', e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="预期值"
                  value={item.expectedValue || ''}
                  onChange={(e) => updateCheckItem(index, 'expectedValue', e.target.value)}
                  className="flex-1"
                />
                {checkItems.length > 1 && (
                  <button type="button" onClick={() => removeCheckItem(index)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 入库资产 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>入库资产</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addIntakeAsset}>
                <Plus className="w-3.5 h-3.5 mr-1" /> 添加
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {intakeAssets.map((asset, index) => (
              <div key={index} className="p-4 bg-[#f8fafc] rounded-lg border border-[#e5e7eb] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#374151]">资产 #{index + 1}</span>
                  {intakeAssets.length > 1 && (
                    <button type="button" onClick={() => removeIntakeAsset(index)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-[#64748b] mb-1">资产编号</label>
                    <Input placeholder="自动生成" value={asset.assetNo || ''} onChange={(e) => updateIntakeAsset(index, 'assetNo', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748b] mb-1">资产名称 *</label>
                    <Input placeholder="必填" value={asset.assetName} onChange={(e) => updateIntakeAsset(index, 'assetName', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748b] mb-1">品牌</label>
                    <Input placeholder="品牌" value={asset.brand || ''} onChange={(e) => updateIntakeAsset(index, 'brand', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748b] mb-1">型号</label>
                    <Input placeholder="型号" value={asset.model || ''} onChange={(e) => updateIntakeAsset(index, 'model', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748b] mb-1">序列号</label>
                    <Input placeholder="序列号" value={asset.serialNo || ''} onChange={(e) => updateIntakeAsset(index, 'serialNo', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748b] mb-1">供应商</label>
                    <Input placeholder="供应商" value={asset.supplier || ''} onChange={(e) => updateIntakeAsset(index, 'supplier', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748b] mb-1">资产分类</label>
                    <Select
                      value={asset.categoryId?.toString() || ''}
                      onValueChange={(val) => updateIntakeAsset(index, 'categoryId', val ? parseInt(val) : undefined)}
                      placeholder="选择分类"
                    >
                      {flattenCategories(categories).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.categoryName}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748b] mb-1">存放地点</label>
                    <Select
                      value={asset.locationId?.toString() || ''}
                      onValueChange={(val) => updateIntakeAsset(index, 'locationId', val ? parseInt(val) : undefined)}
                      placeholder="选择地点"
                    >
                      {flattenLocations(locations).map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748b] mb-1">购置日期</label>
                    <Input type="date" value={asset.purchaseDate || ''} onChange={(e) => updateIntakeAsset(index, 'purchaseDate', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748b] mb-1">原值</label>
                    <Input type="number" step="0.01" placeholder="0.00" value={asset.originalValue?.toString() || ''} onChange={(e) => updateIntakeAsset(index, 'originalValue', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748b] mb-1">保修期(月)</label>
                    <Input type="number" placeholder="12" value={asset.warrantyPeriod?.toString() || ''} onChange={(e) => updateIntakeAsset(index, 'warrantyPeriod', parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs text-[#64748b] mb-1">备注</label>
                    <Input placeholder="资产备注" value={asset.remark || ''} onChange={(e) => updateIntakeAsset(index, 'remark', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/intake')}>取消</Button>
          <Button type="submit" loading={loading}>
            <Save className="w-4 h-4 mr-2" />
            {isEdit ? '保存修改' : '创建验收单'}
          </Button>
        </div>
      </form>
    </div>
  );
}
