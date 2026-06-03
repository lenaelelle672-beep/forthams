/**
 * @file components/spare-parts/SparePartUsageForm.tsx
 * @description 工单领用备件表单
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { consumePart, getUsageByWorkOrder, getSparePartList } from '@/api/sparePart';
import type { SparePart, SparePartUsage } from '@/types/sparePart';
import type { ApiResponse, PageData } from '@/types/common';

interface SparePartUsageFormProps {
  workOrderId: number;
}

export default function SparePartUsageForm({ workOrderId }: SparePartUsageFormProps) {
  const queryClient = useQueryClient();
  const [selectedPartId, setSelectedPartId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');

  const { data: sparePartsRes } = useQuery({
    queryKey: ['spare-parts', 'list', { page: 1, pageSize: 100 }],
    queryFn: () => getSparePartList({ page: 1, pageSize: 100 }),
  });

  const { data: usageRes } = useQuery({
    queryKey: ['spare-part-usage', 'workorder', workOrderId],
    queryFn: () => getUsageByWorkOrder ? getUsageByWorkOrder(workOrderId) : Promise.resolve(null),
  });

  const spareParts = ((sparePartsRes as any)?.data as PageData<SparePart>)?.records ?? [];
  const usages = (usageRes as any)?.data ?? [];

  const consumeMutation = useMutation({
    mutationFn: () => consumePart({
      sparePartId: selectedPartId as number,
      workOrderId,
      quantity: Number(quantity),
      note: note || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spare-part-usage'] });
      queryClient.invalidateQueries({ queryKey: ['spare-parts'] });
      toast.success('备件领用成功');
      setSelectedPartId('');
      setQuantity('1');
      setNote('');
    },
    onError: (err: any) => toast.error(err?.message || '领用失败'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-4 h-4" />
          领用备件
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 选择备件和数量 */}
        <div className="flex gap-2">
          <select
            value={selectedPartId}
            onChange={e => setSelectedPartId(e.target.value ? Number(e.target.value) : '')}
            className="flex-1 h-11 rounded-xl border border-[#d7deea] text-sm px-3 bg-white/95"
          >
            <option value="">选择备件...</option>
            {spareParts.map((sp: SparePart) => (
              <option key={sp.id} value={sp.id} disabled={sp.currentStock <= 0}>
                [{sp.partNo}] {sp.partName}（库存: {sp.currentStock} {sp.unit}）
              </option>
            ))}
          </select>
          <div className="w-24">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="数量"
            />
          </div>
          <Button
            size="sm"
            onClick={() => consumeMutation.mutate()}
            disabled={!selectedPartId || !quantity || Number(quantity) <= 0}
            loading={consumeMutation.isPending}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div>
          <Input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="领用备注（可选）"
          />
        </div>

        {/* 领用记录 */}
        {usages.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-500">领用记录</div>
            {usages.map((u: SparePartUsage) => (
              <div key={u.id} className="flex items-center justify-between text-sm py-1.5">
                <span className="text-gray-600">
                  {u.usageDate ? new Date(u.usageDate).toLocaleString('zh-CN') : '-'}
                </span>
                <span className="text-red-600 font-medium">-{u.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
