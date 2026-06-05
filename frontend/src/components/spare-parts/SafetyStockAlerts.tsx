/**
 * @file components/spare-parts/SafetyStockAlerts.tsx
 * @description 安全库存告警面板
 */

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { AlertTriangle, Package } from 'lucide-react';
import { getLowStockAlerts } from '@/api/sparePart';
import type { SparePart } from '@/types/sparePart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function SafetyStockAlerts() {
  const navigate = useNavigate();

  const { data: res, isLoading } = useQuery({
    queryKey: ['spare-parts', 'low-stock'],
    queryFn: () => getLowStockAlerts(),
    refetchInterval: 60000, // 每分钟刷新
  });

  const alerts = (res as any)?.data ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-gray-400">加载中...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-600">
          <AlertTriangle className="w-4 h-4" />
          库存告警
          {alerts.length > 0 && (
            <span className="ml-auto text-xs font-normal text-gray-400">{alerts.length} 项</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Package className="w-4 h-4" />
            所有备件库存充足
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((sp: SparePart) => {
              const gap = sp.safetyStock - sp.currentStock;
              return (
                <div
                  key={sp.id}
                  className="flex items-center justify-between p-2 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={() => navigate(`/spare-parts/${sp.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-red-700 truncate">{sp.partName}</div>
                    <div className="text-xs text-red-500">
                      当前: {sp.currentStock} / 安全: {sp.safetyStock} {sp.unit}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-red-600 ml-2">
                    缺 {gap.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
