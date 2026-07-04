import { useEffect, useState } from 'react';
import { listSystemInterfaces, testSystemInterfaceConfig, type SystemInterfaceRecord } from '../../api/systemInterfaces';

export const SYSTEM_INTERFACES_ACTION_PERMISSIONS = {
  create: 'system:integration:edit',
  edit: 'system:integration:edit',
  delete: 'system:integration:delete',
  configCheck: 'system:integration:test',
} as const;

export default function SystemInterfacesWorkbenchPage({ embeddedInWorkbench = false }: { embeddedInWorkbench?: boolean }) {
  const [items, setItems] = useState<SystemInterfaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listSystemInterfaces()
      .then((records) => {
        if (mounted) {
          setItems(records);
          setError(null);
        }
      })
      .catch(() => {
        if (mounted) {
          setError('接口数据加载失败，敏感细节已脱敏');
        }
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handleConfigCheck = async (id: number) => {
    const result = await testSystemInterfaceConfig(id);
    setNotice(result.message);
  };

  return (
    <section className="space-y-4" data-embedded={embeddedInWorkbench}>
      <div>
        <h3 className="text-lg font-semibold">接口管理</h3>
        <p className="mt-1 text-sm text-slate-500">只加载接口管理数据，配置校验仅验证元数据，未触发真实外部调用。</p>
      </div>
      {notice ? <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-500">加载中...</div> : null}
      {!loading && items.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">暂无接口，请通过 V3 接口创建。</div> : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold">{item.interfaceName}</h4>
                <p className="text-sm text-slate-500">{item.method} {item.path}</p>
              </div>
              <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white" type="button" onClick={() => handleConfigCheck(item.id)}>
                配置校验
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">敏感配置：{item.configMasked ? '已脱敏' : '未返回原值'}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
