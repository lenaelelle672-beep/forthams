/**
 * @file pages/assignment/AssignmentFormPage.tsx
 * @description 领用归还表单页
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Save } from 'lucide-react';
import { useCreateAssignment, useUpdateAssignment, useAssignmentDetail } from '@/hooks/assignment/useAssignments';
import { useAssetList } from '@/hooks/asset/useAssets';
import { AssetStatus } from '@/types/asset';
import { AllocationType, ALLOCATION_TYPE_CONFIG } from '@/types/assignment';
import type { CreateAssignmentRequest, AssetAssignment } from '@/types/assignment';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from 'sonner';

export default function AssignmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id && id !== 'new';

  const { data: detailRes } = useAssignmentDetail(isEdit ? Number(id) : null);
  const { data: assetsRes } = useAssetList({ status: AssetStatus.IDLE, page: 1, pageSize: 100 });
  const createMutation = useCreateAssignment();
  const updateMutation = useUpdateAssignment();

  const [assetId, setAssetId] = useState<number | ''>('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [assignedToDeptId, setAssignedToDeptId] = useState('');
  const [allocationType, setAllocationType] = useState<string>(AllocationType.ASSIGNMENT);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  const assets = Array.isArray(assetsRes) ? assetsRes : [];

  React.useEffect(() => {
    if (detailRes) {
      const item = (detailRes as any)?.data || detailRes;
      setAssetId(item.assetId || '');
      setAssignedToUserId(item.assignedToUserId?.toString() || '');
      setAssignedToDeptId(item.assignedToDeptId?.toString() || '');
      setAllocationType(item.allocationType || AllocationType.ASSIGNMENT);
      setExpectedReturnDate(item.expectedReturnDate || '');
      setRemark(item.remark || '');
    }
  }, [detailRes]);

  const isBorrow = allocationType === AllocationType.BORROW;
  const isReturn = allocationType === AllocationType.RETURN;

  const handleSubmit = async () => {
    if (!assetId) { toast.error('请选择资产'); return; }
    if (!allocationType) { toast.error('请选择领用类型'); return; }
    if (isBorrow && !expectedReturnDate) {
      toast.error('短期借用必须填写预计归还日期');
      return;
    }
    if (!assignedToUserId && !isReturn) {
      toast.error('请填写使用人');
      return;
    }

    setLoading(true);
    try {
      const data: CreateAssignmentRequest = {
        assetId: Number(assetId),
        allocationType,
        assignedToUserId: assignedToUserId ? Number(assignedToUserId) : undefined,
        assignedToDeptId: assignedToDeptId ? Number(assignedToDeptId) : undefined,
        expectedReturnDate: expectedReturnDate || undefined,
        remark,
      };
      if (isEdit) {
        await updateMutation.mutateAsync({ id: Number(id), data });
      } else {
        await createMutation.mutateAsync(data);
      }
      navigate('/assignments');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={isEdit ? '编辑领用单' : '新建领用单'}
        actions={<Button variant="outline" onClick={() => navigate('/assignments')}><ArrowLeft className="w-4 h-4 mr-2" />返回</Button>}
      />

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="max-w-2xl space-y-6">
        <Card>
          <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* 领用类型选择器 */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">领用类型 <span className="text-red-500">*</span></label>
              <div className="flex gap-4 flex-wrap">
                {(Object.entries(ALLOCATION_TYPE_CONFIG) as [AllocationType, typeof ALLOCATION_TYPE_CONFIG[AllocationType]][]).map(([key, cfg]) => (
                  <label
                    key={key}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                      allocationType === key
                        ? 'border-2 font-medium'
                        : 'border-[#e5e7eb] hover:border-[#94a3b8]'
                    }`}
                    style={{
                      borderColor: allocationType === key ? cfg.color : undefined,
                      color: allocationType === key ? cfg.color : undefined,
                      backgroundColor: allocationType === key ? cfg.bgColor : undefined,
                    }}
                  >
                    <input
                      type="radio"
                      name="allocationType"
                      value={key}
                      checked={allocationType === key}
                      onChange={(e) => setAllocationType(e.target.value)}
                      className="sr-only"
                    />
                    {cfg.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 资产选择器 */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">资产 <span className="text-red-500">*</span></label>
              <select
                className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg bg-white"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value ? Number(e.target.value) : '')}
                disabled={isEdit}
              >
                <option value="">请选择资产</option>
                {(assetsRes as any)?.records?.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.assetNo} - {a.assetName}</option>
                ))}
              </select>
            </div>

            {/* RETURN 类型只显示资产选择和备注 */}
            {!isReturn && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    使用人 {!isReturn && <span className="text-red-500">*</span>}
                  </label>
                  <Input
                    placeholder="使用人 ID"
                    value={assignedToUserId}
                    onChange={(e) => setAssignedToUserId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">使用部门 ID</label>
                  <Input
                    placeholder="使用部门 ID"
                    value={assignedToDeptId}
                    onChange={(e) => setAssignedToDeptId(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* 预计归还日期：BORROW 必填，ASSIGNMENT 可选 */}
            {!isReturn && (
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  预计归还日期 {isBorrow && <span className="text-red-500">*</span>}
                  {isBorrow && <span className="text-xs text-[#d97706] ml-1">（短期借用必填）</span>}
                </label>
                <Input
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">备注</label>
              <Input placeholder="备注" value={remark} onChange={(e) => setRemark(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/assignments')}>取消</Button>
          <Button type="submit" loading={loading}><Save className="w-4 h-4 mr-2" />{isEdit ? '保存修改' : '创建领用单'}</Button>
        </div>
      </form>
    </div>
  );
}
