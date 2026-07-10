import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { listTenants, type TenantRecord } from '@/api/tenant';

/**
 * 租户管理页（遗留路由入口，只读降级版）。
 *
 * 已降级为只读：原页面调用 create/update/suspend/activate 等写接口，但后端
 * SysTenantController 按 V3 只读 catalog 设计只提供 list/current/detail/meta。
 * 完整只读租户管理请使用 V3 工作台的 SystemTenantManagementWorkbenchPage。
 */
export default function TenantManagementPage() {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listTenants({ pageSize: 100 });
        if (active) setTenants(data?.records ?? []);
      } catch {
        if (active) setTenants([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <Card className="p-4">
      <h1 className="text-xl font-semibold">租户管理</h1>
      <p className="mt-1 text-sm text-slate-500">只读视图，编辑请在 V3 工作台租户管理页操作。</p>
      {loading ? (
        <p className="mt-4 text-sm text-slate-500">加载中...</p>
      ) : tenants.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">暂无租户。</p>
      ) : (
        <table className="mt-4 min-w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-2 pr-3">租户标识</th>
              <th className="py-2 pr-3">名称</th>
              <th className="py-2 pr-3">套餐</th>
              <th className="py-2 pr-3">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((t) => (
              <tr key={t.id}>
                <td className="py-2 pr-3 font-medium text-slate-800">{t.id}</td>
                <td className="py-2 pr-3 text-slate-600">{t.name}</td>
                <td className="py-2 pr-3 text-slate-500">{t.plan}</td>
                <td className="py-2 pr-3 text-slate-500">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
