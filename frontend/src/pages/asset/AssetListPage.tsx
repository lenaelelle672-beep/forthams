import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Upload, Download, Plus, ChevronLeft, ChevronRight,
  TrendingUp, ShieldCheck, X,
} from 'lucide-react';
import { useAssetList } from '@/hooks/asset/useAssets';
import { AssetStatus } from '@/types/asset';
import type { AssetListQuery } from '@/types/asset';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';

const STATUS_OPTIONS = [
  { key: AssetStatus.IN_USE,             label: '在用',   color: 'bg-green-100 text-green-700' },
  { key: AssetStatus.IDLE,               label: '闲置',   color: 'bg-blue-100 text-blue-700' },
  { key: AssetStatus.MAINTENANCE,        label: '维修中', color: 'bg-orange-100 text-orange-700' },
  { key: AssetStatus.PENDING_RETIREMENT, label: '待退役', color: 'bg-purple-100 text-purple-700' },
  { key: AssetStatus.RETIRED,            label: '已退役', color: 'bg-gray-200 text-gray-700' },
  { key: AssetStatus.SCRAPPED,           label: '已报废', color: 'bg-red-100 text-red-700' },
  { key: AssetStatus.CLEARED,            label: '已清退', color: 'bg-[#EFEBE9] text-[#5D4037]' },
];

const CATEGORY_OPTIONS = ['所有分类', '生产设备', 'IT设备', '办公家具', '办公设备', '后勤设备'];
const DEPARTMENT_OPTIONS = ['所属部门', '生产部', '技术部', '运维部', '行政部', '市场部'];

const MOCK_ASSETS = [
  { id: 1, code: 'AST-2024-001', name: '高精度车床',     category: '生产设备', brand: 'Siemens S2000',        department: '生产部', owner: '张三', location: 'A栋3楼',     originalValue: 125000,   netValue: 45000,   status: AssetStatus.IN_USE },
  { id: 2, code: 'AST-2024-002', name: 'MacBook Pro 16"', category: 'IT设备',  brand: 'Apple M3 Max',         department: '技术部', owner: '李四', location: 'B栋5楼-502', originalValue: 24999,    netValue: 21000,   status: AssetStatus.IDLE },
  { id: 3, code: 'AST-2024-003', name: '激光切割机',     category: '生产设备', brand: "Han's Laser G3015",    department: '生产部', owner: '王五', location: 'C栋1楼',     originalValue: 450000,   netValue: 180000,  status: AssetStatus.MAINTENANCE },
  { id: 4, code: 'AST-2024-004', name: '服务器机架',     category: 'IT设备',  brand: 'Dell PowerEdge R750',  department: '运维部', owner: '赵六', location: '数据中心 1A', originalValue: 88000,    netValue: 12000,   status: AssetStatus.PENDING_RETIREMENT },
  { id: 5, code: 'AST-2023-088', name: '办公人体工学椅', category: '办公家具', brand: 'Herman Miller Aeron',  department: '行政部', owner: '钱七', location: 'B栋4楼',     originalValue: 12800,    netValue: 4500,    status: AssetStatus.RETIRED },
  { id: 6, code: 'AST-2022-152', name: 'UPS备用电源',   category: 'IT设备',  brand: 'APC Smart-UPS',        department: '运维部', owner: '孙八', location: '数据中心 2C', originalValue: 5500,     netValue: 0,       status: AssetStatus.SCRAPPED },
  { id: 7, code: 'AST-2023-015', name: '大型投影仪',     category: '办公设备', brand: 'Epson EB-PU2213B',     department: '市场部', owner: '周九', location: '会议中心',    originalValue: 35000,    netValue: 15600,   status: AssetStatus.CLEARED },
  { id: 8, code: 'AST-2024-112', name: '空气质量监测系统', category: '后勤设备', brand: 'Honeywell AQ-9',     department: '行政部', owner: '吴十', location: '全办公区',    originalValue: 18200,    netValue: 17000,   status: AssetStatus.IN_USE },
];

const SUMMARY_CARDS = [
  { label: '资产总净值',  value: '¥4,281,900.00', sub: '较上月 +2.4%',      subIcon: TrendingUp, subColor: 'text-green-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { label: '待处理维修',  value: '14 项',          sub: '平均响应时间: 4.2h', subIcon: null,        subColor: '',              bg: 'bg-orange-50', border: 'border-orange-200' },
  { label: '闲置率',      value: '5.8%',           sub: '在安全阈值内',       subIcon: ShieldCheck, subColor: 'text-[#004ac6]', bg: 'bg-white', border: 'border-[#e5e7eb]' },
  { label: '本月折旧',    value: '¥125,402',       sub: '查看折旧报表 →',    subIcon: null,        subColor: '',              bg: 'bg-white', border: 'border-[#e5e7eb]' },
];

export default function AssetListPage() {
  const navigate = useNavigate();

  const [query, setQuery] = useState<AssetListQuery>({ page: 1, pageSize: 10 });
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('所有分类');
  const [department, setDepartment] = useState('所属部门');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [importantOnly, setImportantOnly] = useState(false);

  const { data: res, isLoading } = useAssetList(query);

  const records = (res as any)?.data?.records ?? MOCK_ASSETS;
  const total = (res as any)?.data?.total ?? MOCK_ASSETS.length;

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const columns: Column<any>[] = [
    {
      key: 'code', title: '资产编号', width: 130,
      render: (v) => <span className="font-mono text-[13px] text-[#0f172a]">{String(v)}</span>,
    },
    { key: 'name', title: '资产名称', render: (v) => <span className="font-bold text-[#0f172a]">{String(v)}</span> },
    { key: 'category', title: '分类', width: 90 },
    { key: 'brand', title: '品牌/型号', render: (v) => <span className="text-[#505f76]">{String(v)}</span> },
    { key: 'department', title: '使用部门', width: 80 },
    { key: 'owner', title: '使用人', width: 70 },
    { key: 'location', title: '存放位置', width: 100 },
    {
      key: 'originalValue', title: '原值(¥)', width: 110, align: 'right',
      render: (v) => <span className="font-mono text-[13px]">{Number(v).toLocaleString('en', { minimumFractionDigits: 2 })}</span>,
    },
    {
      key: 'netValue', title: '净值(¥)', width: 110, align: 'right',
      render: (v) => <span className="font-mono text-[13px]">{Number(v).toLocaleString('en', { minimumFractionDigits: 2 })}</span>,
    },
    {
      key: 'status', title: '状态', width: 80,
      render: (v) => <StatusBadge status={String(v)} />,
    },
    {
      key: 'id', title: '操作', width: 60, align: 'center',
      render: (_, row) => (
        <button
          className="text-[#004ac6] hover:underline font-bold text-[13px]"
          onClick={(e) => { e.stopPropagation(); navigate(`/assets/${row.id}`); }}
        >
          编辑
        </button>
      ),
    },
  ];

  const totalPages = Math.ceil(total / query.pageSize);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="资产台账"
        actions={
          <>
            <Button variant="outline" size="md">
              <Upload className="w-4 h-4" />
              导入
            </Button>
            <Button variant="outline" size="md">
              <Download className="w-4 h-4" />
              导出
            </Button>
            <Button variant="primary" size="md" onClick={() => navigate('/assets/new')}>
              <Plus className="w-4 h-4" />
              新建资产
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-64">
              <Input
                placeholder="搜索编号、名称..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                prefix={<Search className="w-4 h-4 text-[#737686]" />}
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                className="h-9 bg-white border border-[#e5e7eb] rounded-lg px-3 text-sm focus:border-[#004ac6] outline-none"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORY_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
              </select>

              <div className="flex items-center gap-2 bg-white border border-[#e5e7eb] rounded-lg px-2 py-1.5 h-9">
                <span className="text-sm text-[#737686] pl-1">状态:</span>
                <div className="flex gap-1">
                  {selectedStatuses.map((s) => (
                    <span key={s} className="bg-blue-50 text-[#004ac6] px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1">
                      {STATUS_OPTIONS.find((o) => o.key === s)?.label ?? s}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => toggleStatus(s)} />
                    </span>
                  ))}
                </div>
                <select
                  className="bg-transparent border-none text-sm outline-none cursor-pointer"
                  value=""
                  onChange={(e) => { if (e.target.value) toggleStatus(e.target.value); }}
                >
                  <option value="">选择...</option>
                  {STATUS_OPTIONS.filter((o) => !selectedStatuses.includes(o.key)).map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
              </div>

              <select
                className="h-9 bg-white border border-[#e5e7eb] rounded-lg px-3 text-sm focus:border-[#004ac6] outline-none"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                {DEPARTMENT_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
              </select>
            </div>

            <div className="h-6 w-px bg-[#e5e7eb] mx-2" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-[#64748b]">重要设备</span>
              <button
                className={`w-10 h-5 rounded-full relative transition-colors ${importantOnly ? 'bg-[#2563eb]' : 'bg-[#c3c6d7]'}`}
                onClick={() => setImportantOnly(!importantOnly)}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${importantOnly ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <button
              className="text-[#004ac6] text-sm font-bold hover:underline ml-auto"
              onClick={() => { setSelectedStatuses([]); setKeyword(''); setCategory('所有分类'); setDepartment('所属部门'); setImportantOnly(false); }}
            >
              重置
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={records}
            loading={isLoading}
            rowKey="id"
            onRowClick={(row) => navigate(`/assets/${row.id}`)}
            pagination={{
              page: query.page ?? 1,
              pageSize: query.pageSize ?? 10,
              total,
              onChange: (page, pageSize) => setQuery((prev) => ({ ...prev, page, pageSize })),
            }}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-6">
        {SUMMARY_CARDS.map((card) => (
          <div key={card.label} className={`${card.bg} p-4 rounded-xl border ${card.border} flex flex-col justify-between`}>
            <span className="text-xs font-bold uppercase tracking-wide text-[#505f76]">{card.label}</span>
            <div className="mt-2 text-2xl font-bold text-[#0f172a]">{card.value}</div>
            <div className={`mt-1 text-sm flex items-center gap-1 font-bold ${card.subColor}`}>
              {card.subIcon && <card.subIcon className="w-4 h-4" />}
              {card.sub}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
