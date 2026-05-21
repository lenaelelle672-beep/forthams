import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip,
} from 'recharts';
import {
  ArrowLeft, Edit, Trash2, Info, TrendingDown,
  History, QrCode, Package, Hash, MapPin,
  User, Building2, Calendar, DollarSign, Wrench,
  ArrowRightLeft, PlusCircle, Move,
} from 'lucide-react';
import { getAssetById } from '@/api/asset';
import type { Asset } from '@/types/asset';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';

const DEPRECIATION_MOCK = [
  { date: '2023-03', value: 45000 },
  { date: '2023-09', value: 38500 },
  { date: '2024-03', value: 32400 },
  { date: '2024-09', value: 26800 },
  { date: '2025-03', value: 21500 },
];

const CHANGE_HISTORY = [
  {
    id: 4,
    title: '维修完成',
    desc: '更换了电源模块，恢复正常运行。',
    date: '2024-05-12 14:30:15',
    color: 'bg-green-500',
    icon: Wrench,
  },
  {
    id: 3,
    title: '部门调拨',
    desc: '由 IT基础设施组 调拨至 技术部。',
    date: '2023-11-20 09:15:42',
    color: 'bg-blue-500',
    icon: Move,
  },
  {
    id: 2,
    title: '状态变更',
    desc: '状态从 "闲置" 更新为 "在用"。',
    date: '2023-03-20 16:45:00',
    color: 'bg-orange-500',
    icon: ArrowRightLeft,
  },
  {
    id: 1,
    title: '资产创建',
    desc: '系统录入，原始单据: PO-2023-0092。',
    date: '2023-03-15 10:00:00',
    color: 'bg-slate-400',
    icon: PlusCircle,
  },
];

function TimelineEntry({ entry }: { entry: typeof CHANGE_HISTORY[number] }) {
  const TimelineIcon = entry.icon;
  return (
    <div className="relative">
      <div className={`absolute -left-[30px] top-1 w-6 h-6 ${entry.color} rounded-full flex items-center justify-center text-white ring-4 ring-white`}>
        <TimelineIcon className="w-3.5 h-3.5" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-[#0f172a]">{entry.title}</span>
          <span className="text-[13px] text-[#64748b]">{entry.desc}</span>
        </div>
        <span className="text-xs text-[#64748b] flex-shrink-0 ml-4">{entry.date}</span>
      </div>
    </div>
  );
}

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('info');

  const { data: assetRes, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => getAssetById(id!),
    enabled: !!id,
  });

  const asset = (assetRes as any)?.data as Asset | undefined;

  const displayAsset = asset ?? {
    name: '戴尔PowerEdge R740',
    code: 'AST-2024-0156',
    category: '服务器',
    brand: '戴尔',
    model: 'PowerEdge R740',
    serialNumber: 'SN20240156',
    status: 'IN_USE',
    originalValue: 45000,
    netValue: 32400,
    purchaseDate: '2023-03-15',
    warrantyMonths: 36,
    depreciationRate: '6.67%',
    department: '技术部',
    owner: '张三',
    location: 'A栋3层机房',
    rfid: 'RF20240156',
    isImportant: true,
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                className="p-2 hover:bg-[#f1f5f9] rounded-full transition-colors active:scale-95"
                onClick={() => navigate('/assets')}
              >
                <ArrowLeft className="w-5 h-5 text-[#0f172a]" />
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-[#0f172a]">资产详情</h1>
                <StatusBadge status={displayAsset.status} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate(`/assets/${id}/edit`)}
              >
                <Edit className="w-4 h-4" />
                编辑
              </Button>
              <Button variant="destructive" size="md">
                <Trash2 className="w-4 h-4" />
                删除
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-8">
          <div className="grid grid-cols-3 gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[#64748b] font-medium tracking-wide">资产名称</span>
              <span className="text-base font-semibold text-[#0f172a]">{displayAsset.name}</span>
              <span className="text-[13px] text-[#64748b] mt-1">
                资产编号: <span className="text-[#0f172a] font-medium">{displayAsset.code}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-4 border-x border-[#e5e7eb]/60 px-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide">分类</span>
                <span className="text-sm font-medium text-[#0f172a]">{displayAsset.category}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide">品牌</span>
                <span className="text-sm font-medium text-[#0f172a]">{displayAsset.brand}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide">型号</span>
                <span className="text-sm font-medium text-[#0f172a]">{displayAsset.model}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium tracking-wide">序列号</span>
                <span className="text-sm font-medium text-[#0f172a]">{displayAsset.serialNumber}</span>
              </div>
            </div>
            <div className="flex items-center justify-center p-2">
              <div className="w-full h-24 bg-[#f3f4f6] border border-dashed border-[#c3c6d7] rounded-lg flex flex-col items-center justify-center gap-1 opacity-60">
                <QrCode className="w-5 h-5 text-[#64748b]" />
                <span className="text-xs font-medium text-[#64748b]">RFID: {displayAsset.rfid}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold flex items-center gap-2 text-[#0f172a]">
                <Info className="w-5 h-5 text-[#004ac6]" />
                基本信息
              </h2>
              {displayAsset.isImportant && (
                <span className="bg-[#dbe1ff] text-[#003ea8] px-3 py-1 rounded-full text-xs font-medium">重要设备</span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-y-8">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">原值</span>
                <span className="text-sm font-semibold text-[#0f172a]">¥{Number(displayAsset.originalValue).toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">净值</span>
                <span className="text-sm font-semibold text-[#004ac6]">¥{Number(displayAsset.netValue).toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">购置日期</span>
                <span className="text-sm text-[#0f172a]">{displayAsset.purchaseDate}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">保修期</span>
                <span className="text-sm text-[#0f172a]">{displayAsset.warrantyMonths}个月</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">折旧率</span>
                <span className="text-sm text-[#0f172a]">{displayAsset.depreciationRate}/月</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">使用部门</span>
                <span className="text-sm text-[#0f172a]">{displayAsset.department}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">使用人</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#0f172a]">{displayAsset.owner}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#64748b] font-medium">存放位置</span>
                <span className="text-sm text-[#0f172a]">{displayAsset.location}</span>
              </div>
              <div className="col-span-4 flex flex-col gap-1 border-t border-[#e5e7eb]/60 pt-4">
                <span className="text-xs text-[#64748b] font-medium">备注</span>
                <span className="text-sm text-[#0f172a] italic opacity-60">无</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-4 flex flex-col">
          <CardContent className="p-6 flex flex-col flex-1">
            <h2 className="text-base font-semibold flex items-center gap-2 mb-6 text-[#0f172a]">
              <TrendingDown className="w-5 h-5 text-[#004ac6]" />
              折旧趋势
            </h2>
            <div className="flex-1 relative mt-4 min-h-[200px]">
              <div className="absolute inset-0 rounded-lg border border-blue-100 bg-gradient-to-b from-blue-500/5 to-transparent" />
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={DEPRECIATION_MOCK} margin={{ top: 16, right: 8, left: -8, bottom: 24 }}>
                  <defs>
                    <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} fill="url(#depGrad)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm p-2 rounded shadow-sm border border-[#e5e7eb] text-[11px]">
                <p className="font-bold text-[#004ac6]">当前净值</p>
                <p>¥{Number(displayAsset.netValue).toLocaleString('en', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-12">
          <CardContent className="p-6">
            <h2 className="text-base font-semibold flex items-center gap-2 mb-8 text-[#0f172a]">
              <History className="w-5 h-5 text-[#004ac6]" />
              变更记录
            </h2>
            <div className="relative space-y-8 pl-8 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[#e5e7eb]/60">
              {CHANGE_HISTORY.map((entry) => (
                <TimelineEntry key={entry.id} entry={entry} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
