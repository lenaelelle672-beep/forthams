/**
 * @file pages/spare-parts/SparePartDetailPage.tsx
 * @description 备品备件详情页面
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Edit, AlertTriangle, Package } from 'lucide-react';
import { getSparePartDetail, getUsageBySparePart, getLowStockAlerts } from '@/api/sparePart';
import type { SparePart, SparePartUsage } from '@/types/sparePart';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function SparePartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sparePartId = Number(id);

  const { data: detailRes, isLoading } = useQuery({
    queryKey: ['spare-part', sparePartId],
    queryFn: () => getSparePartDetail(sparePartId),
    enabled: !!sparePartId,
  });

  const { data: usageRes } = useQuery({
    queryKey: ['spare-part', sparePartId, 'usages'],
    queryFn: () => getUsageBySparePart(sparePartId),
    enabled: !!sparePartId,
  });

  const sparePart = (detailRes as any)?.data as SparePart | undefined;
  const usages = (usageRes as any)?.data ?? [];

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">加载中...</div>;
  }

  if (!sparePart) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400">备件不存在</div>;
  }

  const isLowStock = sparePart.currentStock < sparePart.safetyStock;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={sparePart.partName}
        description={`编码: ${sparePart.partNo}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> 返回
            </Button>
            <Button onClick={() => navigate(`/spare-parts/${sparePartId}/edit`)} className="gap-2">
              <Edit className="w-4 h-4" /> 编辑
            </Button>
          </div>
        }
      />

      {/* 库存概况 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-500" />
            <div>
              <div className="text-2xl font-bold">{sparePart.currentStock}</div>
              <div className="text-xs text-gray-400">当前库存 ({sparePart.unit})</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="w-8 h-8 text-amber-500" />
            <div>
              <div className="text-2xl font-bold">{sparePart.safetyStock}</div>
              <div className="text-xs text-gray-400">安全库存 ({sparePart.unit})</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={`p-4 flex items-center gap-3 ${isLowStock ? 'bg-red-50' : ''}`}>
            <AlertTriangle className={`w-8 h-8 ${isLowStock ? 'text-red-500' : 'text-green-500'}`} />
            <div>
              <div className={`text-lg font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                {isLowStock ? `缺货 ${(sparePart.safetyStock - sparePart.currentStock).toFixed(2)}` : '库存正常'}
              </div>
              <div className="text-xs text-gray-400">库存状态</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-400">备件编码：</span>{sparePart.partNo}</div>
            <div><span className="text-gray-400">规格型号：</span>{sparePart.specification || '-'}</div>
            <div><span className="text-gray-400">计量单位：</span>{sparePart.unit}</div>
            <div><span className="text-gray-400">单价：</span>{sparePart.unitPrice ? `¥${sparePart.unitPrice}` : '-'}</div>
            <div><span className="text-gray-400">状态：</span>
              <Badge variant={sparePart.status === 'ENABLED' ? 'success' : 'gray'}>
                {sparePart.status === 'ENABLED' ? '启用' : '停用'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 领用记录 */}
      <Card>
        <CardHeader><CardTitle>领用记录</CardTitle></CardHeader>
        <CardContent>
          {usages.length > 0 ? (
            <div className="space-y-2">
              {usages.map((usage: SparePartUsage) => (
                <div key={usage.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="text-sm">
                    <span className="font-medium">工单 #{usage.workOrderId}</span>
                    <span className="text-gray-400 ml-2">{usage.usageDate ? new Date(usage.usageDate).toLocaleString('zh-CN') : '-'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-red-600 font-medium">-{usage.quantity}</span>
                    {usage.note && <span className="text-xs text-gray-400">{usage.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">暂无领用记录</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
