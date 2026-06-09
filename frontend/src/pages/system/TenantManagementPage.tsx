import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageTransition, ErrorState, EmptyState, SkeletonTable } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Modal, Tag, message } from 'antd';
import {
  activateTenant,
  createTenant,
  listTenants,
  suspendTenant,
  updateTenant,
  type TenantPayload as TenantForm,
  type TenantRecord,
} from '@/api/tenant';

const planColors: Record<string, string> = {
  FREE: 'default', BASIC: 'blue', PRO: 'green', ENTERPRISE: 'gold'
};

const defaultForm: TenantForm = { id: '', name: '', plan: 'FREE', maxUsers: 100, maxAssets: 1000, contactName: '', contactPhone: '', contactEmail: '' };

const toForm = (t: TenantRecord): TenantForm => ({
  id: t.id || '',
  name: t.name || '',
  plan: t.plan || 'FREE',
  maxUsers: t.maxUsers ?? 100,
  maxAssets: t.maxAssets ?? 1000,
  contactName: t.contactName || '',
  contactPhone: t.contactPhone || '',
  contactEmail: t.contactEmail || '',
});

function TenantManagementContent() {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<TenantRecord | null>(null);
  const [form, setForm] = useState<TenantForm>(defaultForm);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await listTenants({ pageSize: 100 });
      setTenants(data?.records || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取租户列表失败');
      message.error('获取租户列表失败');
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      if (editingItem) {
        await updateTenant(editingItem.id, form);
      } else {
        await createTenant(form);
      }
      message.success('保存成功');
      setModalVisible(false);
      fetchData();
    } catch { message.error('保存失败'); }
  };

  const handleToggleStatus = async (id: string, action: 'suspend' | 'activate') => {
    try {
      if (action === 'suspend') {
        await suspendTenant(id);
      } else {
        await activateTenant(id);
      }
      message.success('操作成功');
      fetchData();
    } catch { message.error('操作失败'); }
  };

  if (error) {
    return (
      <PageTransition>
        <ErrorState title="加载失败" description={error} onRetry={fetchData} />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="p-6 space-y-4">
        <PageHeader title="租户管理" subtitle="多租户 SaaS 管理" />
        <Card>
          <CardHeader>
            <div className="flex justify-between">
              <CardTitle>租户列表 ({tenants.length})</CardTitle>
              <Button onClick={() => { setEditingItem(null); setForm(defaultForm); setModalVisible(true); }}>
                新建租户
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonTable rows={5} cols={7} />
            ) : tenants.length === 0 ? (
              <EmptyState title="暂无租户" description="点击「新建租户」添加第一个租户" className="py-8" />
            ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">名称</th>
                  <th className="px-4 py-3 text-left">套餐</th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-left">用户上限</th>
                  <th className="px-4 py-3 text-left">联系人</th>
                  <th className="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t: TenantRecord) => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono">{t.id}</td>
                    <td className="px-4 py-3">{t.name}</td>
                    <td className="px-4 py-3"><Tag color={planColors[t.plan]}>{t.plan}</Tag></td>
                    <td className="px-4 py-3">
                      <Tag color={t.status === 'ACTIVE' ? 'green' : 'red'}>{t.status}</Tag>
                    </td>
                    <td className="px-4 py-3">{t.maxUsers}</td>
                    <td className="px-4 py-3">{t.contactName || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditingItem(t); setForm(toForm(t)); setModalVisible(true); }}>编辑</Button>
                        {t.status === 'ACTIVE' ? (
                          <Button size="sm" variant="outline" onClick={() => handleToggleStatus(t.id, 'suspend')}>暂停</Button>
                        ) : (
                          <Button size="sm" onClick={() => handleToggleStatus(t.id, 'activate')}>激活</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </CardContent>
        </Card>

        <Modal title={editingItem ? '编辑租户' : '新建租户'} open={modalVisible} onOk={handleSave} onCancel={() => setModalVisible(false)}>
          <div className="space-y-4">
            {!editingItem && <Input placeholder="租户ID (如 dept:42)" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} />}
            <Input placeholder="租户名称" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="联系人" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} />
            <Input placeholder="联系电话" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
            <Input placeholder="联系邮箱" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
          </div>
        </Modal>
      </div>
    </PageTransition>
  );
};

const TenantManagementPage: React.FC = () => {
  return (
    <ErrorBoundary>
      <TenantManagementContent />
    </ErrorBoundary>
  );
};

export default TenantManagementPage;
