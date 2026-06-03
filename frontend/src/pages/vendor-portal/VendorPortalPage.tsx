import React, { useState } from 'react';
import { PageTransition, ErrorState, EmptyState, SkeletonCard } from '@/components/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import http from '@/utils/http';
import { toast } from 'sonner';

function VendorPortalContent() {
  const [vendorCode, setVendorCode] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('vendor_token') || '');
  const [vendorId, setVendorId] = useState(Number(localStorage.getItem('vendor_id')) || 0);
  const [vendorName, setVendorName] = useState(localStorage.getItem('vendor_name') || '');
  const [contracts, setContracts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [contractsError, setContractsError] = useState<string | null>(null);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [activeView, setActiveView] = useState<'login' | 'contracts'>(token ? 'contracts' : 'login');

  const handleLogin = async () => {
    if (!vendorCode || !password) { toast.error('请输入供应商编码和密码'); return; }
    try {
      const res: any = await http.post('/vendor-portal/login', { vendorCode, password });
      localStorage.setItem('vendor_token', res.token);
      localStorage.setItem('vendor_id', String(res.vendorId));
      localStorage.setItem('vendor_name', res.vendorName);
      setToken(res.token);
      setVendorId(res.vendorId);
      setVendorName(res.vendorName);
      setActiveView('contracts');
      toast.success(`欢迎，${res.vendorName}！`);
    } catch { setError('登录失败，请检查供应商编码和密码'); toast.error('登录失败'); }
  };

  const fetchContracts = async () => {
    setContractsLoading(true);
    setContractsError(null);
    try {
      const res: any = await http.get('/vendor-portal/contracts', { params: { vendorId } });
      setContracts(res || []);
    } catch {
      toast.error('获取合同失败');
      setContractsError('获取合同列表失败，请稍后重试');
    }
    setContractsLoading(false);
  };

  React.useEffect(() => {
    if (activeView === 'contracts' && vendorId) fetchContracts();
  }, [activeView, vendorId]);

  const handleLogout = () => {
    localStorage.removeItem('vendor_token');
    localStorage.removeItem('vendor_id');
    localStorage.removeItem('vendor_name');
    setToken(''); setVendorId(0); setVendorName('');
    setActiveView('login');
  };

  if (activeView === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">供应商门户</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="供应商编码" value={vendorCode} onChange={e => setVendorCode(e.target.value)} />
            <Input type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
            <Button className="w-full" onClick={() => { setError(null); handleLogin(); }}>登录</Button>
            {error && (
              <ErrorState title="登录失败" description={error} className="!py-3 !shadow-none" />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusMap: Record<string, { label: string; color: string }> = {
    'DRAFT': { label: '草稿', color: 'bg-gray-200 text-gray-700' },
    'ACTIVE': { label: '生效中', color: 'bg-green-100 text-green-700' },
    'EXPIRED': { label: '已过期', color: 'bg-red-100 text-red-700' },
    'TERMINATED': { label: '已终止', color: 'bg-yellow-100 text-yellow-700' },
  };

  return (
    <PageTransition>
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title={`供应商门户 — ${vendorName}`} subtitle="查看合同和订单" />
        <Button variant="outline" onClick={handleLogout}>退出登录</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>我的合同 ({contracts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {contractsLoading ? (
            <SkeletonCard className="h-48" />
          ) : contractsError ? (
            <ErrorState title="加载失败" description={contractsError} onRetry={fetchContracts} />
          ) : contracts.length === 0 ? (
            <EmptyState title="暂无合同数据" description="您的供应商账户暂无关联合同" className="py-8" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left">合同编号</th>
                    <th className="px-4 py-3 text-left">合同名称</th>
                    <th className="px-4 py-3 text-left">类型</th>
                    <th className="px-4 py-3 text-left">金额</th>
                    <th className="px-4 py-3 text-left">开始日期</th>
                    <th className="px-4 py-3 text-left">结束日期</th>
                    <th className="px-4 py-3 text-left">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c: any) => (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono">{c.contractNo}</td>
                      <td className="px-4 py-3">{c.contractName}</td>
                      <td className="px-4 py-3">{c.contractType || '-'}</td>
                      <td className="px-4 py-3">{c.amount || '-'}</td>
                      <td className="px-4 py-3">{c.startDate}</td>
                      <td className="px-4 py-3">{c.endDate}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${(statusMap[c.status] || statusMap['DRAFT']).color}`}>
                          {(statusMap[c.status] || statusMap['DRAFT']).label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </PageTransition>
  );
};

const VendorPortalPage: React.FC = () => {
  return (
    <ErrorBoundary>
      <VendorPortalContent />
    </ErrorBoundary>
  );
};

export default VendorPortalPage;
