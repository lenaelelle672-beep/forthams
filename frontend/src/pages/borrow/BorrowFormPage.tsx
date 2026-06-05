/**
 * @file pages/borrow/BorrowFormPage.tsx
 * @description 借用管理表单页
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Save } from 'lucide-react';
import { useCreateBorrow, useUpdateBorrow, useBorrowDetail } from '@/hooks/borrow/useBorrows';
import { useAssetList } from '@/hooks/asset/useAssets';
import { AssetStatus } from '@/types/asset';
import type { CreateBorrowRequest } from '@/types/borrow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { toast } from 'sonner';

export default function BorrowFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id && id !== 'new';

  const { data: detailRes } = useBorrowDetail(isEdit ? Number(id) : null);
  const { data: assetsRes } = useAssetList({ status: AssetStatus.IDLE, page: 1, pageSize: 100 });
  const createMutation = useCreateBorrow();
  const updateMutation = useUpdateBorrow();

  const [assetId, setAssetId] = useState<number | ''>('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (detailRes) {
      const item = (detailRes as any)?.data || detailRes;
      setAssetId(item.assetId || '');
      setExpectedReturnDate(item.expectedReturnDate || '');
      setPurpose(item.purpose || '');
      setRemark(item.remark || '');
    }
  }, [detailRes]);

  const handleSubmit = async () => {
    if (!assetId) { toast.error('请选择资产'); return; }
    if (!expectedReturnDate) { toast.error('请选择预计归还日期'); return; }
    setLoading(true);
    try {
      const data: CreateBorrowRequest = {
        assetId: Number(assetId),
        expectedReturnDate,
        purpose: purpose || undefined,
        remark: remark || undefined,
      };
      if (isEdit) {
        await updateMutation.mutateAsync({ id: Number(id), data });
      } else {
        await createMutation.mutateAsync(data);
      }
      navigate('/borrows');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={isEdit ? '编辑借用单' : '新建借用单'}
        actions={<Button variant="outline" onClick={() => navigate('/borrows')}><ArrowLeft className="w-4 h-4 mr-2" />返回</Button>} />

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="max-w-2xl space-y-6">
        <Card>
          <CardHeader><CardTitle>借用信息</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">资产</label>
              <select className="w-full px-3 py-2 text-sm border border-[#e5e7eb] rounded-lg bg-white"
                value={assetId} onChange={(e) => setAssetId(e.target.value ? Number(e.target.value) : '')} disabled={isEdit}>
                <option value="">请选择资产</option>
                {(assetsRes as any)?.records?.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.assetNo} - {a.assetName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">预计归还日期 *</label>
              <Input type="date" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">借用用途</label>
              <Input placeholder="借用用途" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">备注</label>
              <Input placeholder="备注" value={remark} onChange={(e) => setRemark(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/borrows')}>取消</Button>
          <Button type="submit" loading={loading}><Save className="w-4 h-4 mr-2" />{isEdit ? '保存修改' : '创建借用单'}</Button>
        </div>
      </form>
    </div>
  );
}
