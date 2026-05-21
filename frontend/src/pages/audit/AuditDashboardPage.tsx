import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Download,
  CalendarDays,
  ChevronDown,
  ListFilter,
  Bell,
  HelpCircle,
  ClipboardList,
  RefreshCw,
  Users,
  FileBarChart,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

const KPI_CARDS = [
  { label: '今日操作', value: '156', icon: ClipboardList, bg: '#d8e2ff', color: '#004191' },
  { label: '本周操作', value: '1,243', icon: RefreshCw, bg: '#d7e3fc', color: '#535f74' },
  { label: '活跃用户', value: '42', icon: Users, bg: '#d3e4fe', color: '#36455a' },
  { label: '异常操作', value: '3', icon: FileBarChart, bg: '#ffdad6', color: '#ba1a1a', borderError: true },
];

const TYPE_DISTRIBUTION = [
  { label: '资产变更', pct: 45, color: '#004191' },
  { label: '用户登录', pct: 25, color: '#535f74' },
  { label: '新建操作', pct: 15, color: '#36455a' },
  { label: '其他', pct: 15, color: '#adc6ff' },
];

const AUDIT_ROWS = [
  { time: '2024-05-20 14:30:12', name: '陈明', avatar: 'CM', type: '资产变更', typeColor: '#004191', typeBg: '#d8e2ff', desc: '更新精密车床X1状态为"维修中"', ip: '192.168.1.105', status: 'success' as const },
  { time: '2024-05-20 13:15:44', name: '李芳', avatar: 'LF', type: '数据导出', typeColor: '#ba1a1a', typeBg: '#ffdad6', desc: '批量导出500+条敏感资产记录', ip: '10.0.4.52', status: 'warning' as const },
  { time: '2024-05-20 11:02:10', name: '王丽', avatar: 'WL', type: '用户登录', typeColor: '#535f74', typeBg: '#d7e3fc', desc: '通过Chrome/macOS标准网页登录', ip: '172.16.25.4', status: 'success' as const },
  { time: '2024-05-20 09:45:30', name: '金博', avatar: 'JB', type: '工作流中心', typeColor: '#004191', typeBg: '#d8e2ff', desc: '审批维修申请单 #RQ-5582', ip: '192.168.1.12', status: 'success' as const },
  { time: '2024-05-20 08:30:15', name: '赵伟', avatar: 'ZW', type: 'RFID盘点', typeColor: '#004191', typeBg: '#d8e2ff', desc: '同步7号区域RFID标签数据库', ip: '10.0.2.18', status: 'success' as const },
  { time: '2024-05-19 23:55:00', name: '系统', avatar: 'XT', type: '退役', typeColor: '#424753', typeBg: '#e9edfe', desc: '自动退役12项超出生命周期限制的资产', ip: 'localhost', status: 'success' as const },
  { time: '2024-05-19 16:40:22', name: '刘强', avatar: 'LQ', type: '工单管理', typeColor: '#004191', typeBg: '#d8e2ff', desc: '为HVAC设备 #H-22 创建新工单', ip: '192.168.1.115', status: 'success' as const },
  { time: '2024-05-19 10:20:05', name: '未知用户', avatar: '??', type: '登录失败', typeColor: '#ba1a1a', typeBg: '#ffdad6', desc: '检测到多次登录失败尝试', ip: '45.2.19.201', status: 'error' as const, rowError: true },
];

const STATUS_CONFIG = {
  success: { text: '成功', color: '#16a34a' },
  warning: { text: '警告', color: '#d97706' },
  error: { text: '失败', color: '#ba1a1a' },
} as const;

export default function AuditDashboardPage() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'alerts'>('all');

  useQuery({
    queryKey: ['audit-logs', search, activeFilter],
    queryFn: async () => {
      return { data: { records: [], total: 0 } };
    },
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-[#f9f9ff]">
      <PageHeader
        title="审计日志"
        breadcrumbs={[{ label: '数据分析' }, { label: '审计日志' }]}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#f1f3ff] px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-sm">
              <CalendarDays className="w-4 h-4 text-[#424753]" />
              <span>最近7天</span>
              <ChevronDown className="w-4 h-4 text-[#424753]" />
            </div>
            <div className="relative flex items-center bg-[#f1f3ff] px-3 py-1.5 rounded-lg border border-[#e5e7eb] w-64">
              <Search className="w-4 h-4 text-[#424753] mr-2" />
              <input
                className="bg-transparent border-none focus:ring-0 text-sm w-full p-0 h-auto placeholder:text-[#727784]"
                placeholder="搜索操作记录..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="primary" size="md">
              <Download className="w-4 h-4" />
              导出
            </Button>
            <Bell className="w-8 h-8 p-1.5 text-[#424753] hover:bg-[#f1f3ff] rounded-full cursor-pointer transition-colors" />
            <HelpCircle className="w-8 h-8 p-1.5 text-[#424753] hover:bg-[#f1f3ff] rounded-full cursor-pointer transition-colors" />
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-6">
          {KPI_CARDS.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className={`bg-white border p-3 rounded-xl flex items-center gap-4 shadow-sm ${
                  kpi.borderError ? 'border-[#ba1a1a]' : 'border-[#e5e7eb]'
                }`}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: kpi.bg, color: kpi.color }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: kpi.borderError ? '#ba1a1a' : '#424753' }}>
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-bold" style={{ color: kpi.borderError ? '#ba1a1a' : '#161c27' }}>
                    {kpi.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <Card className="col-span-2 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-semibold text-[#161c27]">操作趋势（近7天）</h3>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#004191]" />
                <span className="text-xs text-[#424753]">系统日志</span>
              </div>
            </div>
            <div className="h-64 relative flex items-end justify-between gap-4 px-4">
              <svg className="absolute inset-0 w-full h-full p-4" preserveAspectRatio="none" viewBox="0 0 800 200">
                <path d="M0,150 Q100,160 200,120 T400,140 T600,100 T800,110" fill="none" stroke="#004191" strokeLinecap="round" strokeWidth="3" />
                <path d="M0,150 Q100,160 200,120 T400,140 T600,100 T800,110 L800,200 L0,200 Z" fill="url(#auditGrad)" opacity="0.1" />
                <defs>
                  <linearGradient id="auditGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#004191" stopOpacity="1" />
                    <stop offset="100%" stopColor="#004191" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute bottom-0 left-0 w-full flex justify-between px-8 text-[10px] font-semibold uppercase tracking-wider text-[#424753]">
                <span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>周日</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-base font-semibold text-[#161c27] mb-6">操作类型分布</h3>
            <div className="flex flex-col items-center">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" fill="transparent" r="16" stroke="#e9edfe" strokeWidth="4" />
                  <circle cx="18" cy="18" fill="transparent" r="16" stroke="#004191" strokeDasharray="45 100" strokeWidth="4" />
                  <circle cx="18" cy="18" fill="transparent" r="16" stroke="#535f74" strokeDasharray="25 100" strokeDashoffset="-45" strokeWidth="4" />
                  <circle cx="18" cy="18" fill="transparent" r="16" stroke="#36455a" strokeDasharray="15 100" strokeDashoffset="-70" strokeWidth="4" />
                  <circle cx="18" cy="18" fill="transparent" r="16" stroke="#adc6ff" strokeDasharray="10 100" strokeDashoffset="-85" strokeWidth="4" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold">1.2k</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#424753]">总计</span>
                </div>
              </div>
              <div className="w-full mt-6 space-y-2">
                {TYPE_DISTRIBUTION.map((d) => (
                  <div key={d.label} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs">{d.label}</span>
                    </div>
                    <span className="text-xs font-semibold">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="px-6 py-4 border-b border-[#e5e7eb] flex justify-between items-center">
            <h3 className="text-base font-semibold text-[#161c27]">最近操作</h3>
            <div className="flex items-center gap-4">
              <div className="flex rounded-lg border border-[#e5e7eb] overflow-hidden">
                <button
                  className={`px-3 py-1.5 text-xs font-semibold border-r border-[#e5e7eb] transition-colors ${
                    activeFilter === 'all' ? 'bg-[#f1f3ff] text-[#004191]' : 'bg-white text-[#424753] hover:bg-[#f1f3ff]'
                  }`}
                  onClick={() => setActiveFilter('all')}
                >
                  全部日志
                </button>
                <button
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    activeFilter === 'alerts' ? 'bg-[#f1f3ff] text-[#004191] font-semibold' : 'bg-white text-[#424753] hover:bg-[#f1f3ff]'
                  }`}
                  onClick={() => setActiveFilter('alerts')}
                >
                  告警
                </button>
              </div>
              <button className="flex items-center gap-1 text-[#424753] text-xs hover:text-[#004191]">
                <ListFilter className="w-4 h-4" />
                筛选
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f1f3ff]/50 text-[10px] font-semibold uppercase tracking-wider text-[#424753]">
                  <th className="px-6 py-4">时间</th>
                  <th className="px-6 py-4">操作人</th>
                  <th className="px-6 py-4">操作类型</th>
                  <th className="px-6 py-4">描述</th>
                  <th className="px-6 py-4">IP地址</th>
                  <th className="px-6 py-4">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e7eb]">
                {AUDIT_ROWS.map((row) => {
                  const st = STATUS_CONFIG[row.status];
                  return (
                    <tr
                      key={row.time}
                      className={`hover:bg-[#f1f3ff] transition-colors ${row.rowError ? 'bg-[#ffdad6]/20' : ''}`}
                    >
                      <td className="px-6 py-4 text-sm text-[#161c27] whitespace-nowrap">{row.time}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#d4e0f9] flex items-center justify-center text-[#0f1c2e] text-[10px] font-bold">
                            {row.avatar}
                          </div>
                          <span className="text-sm font-semibold text-[#161c27]">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ backgroundColor: row.typeBg, color: row.typeColor, border: `1px solid ${row.typeColor}33` }}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm ${row.rowError ? 'text-[#ba1a1a] font-semibold' : 'text-[#424753]'}`}>
                        {row.desc}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-[#424753]">{row.ip}</td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: st.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.color }} />
                          {st.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-[#e5e7eb] flex justify-between items-center bg-[#f1f3ff]/30">
            <p className="text-xs text-[#424753]">显示 1,243 条操作中的 8 条</p>
            <div className="flex gap-1">
              <button className="w-8 h-8 flex items-center justify-center rounded border border-[#e5e7eb] hover:bg-[#e3e8f8] transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button className="w-8 h-8 flex items-center justify-center rounded border border-[#004191] bg-[#004191] text-white text-xs font-bold">1</button>
              <button className="w-8 h-8 flex items-center justify-center rounded border border-[#e5e7eb] hover:bg-[#e3e8f8] transition-colors text-xs">2</button>
              <button className="w-8 h-8 flex items-center justify-center rounded border border-[#e5e7eb] hover:bg-[#e3e8f8] transition-colors text-xs">3</button>
              <button className="w-8 h-8 flex items-center justify-center rounded border border-[#e5e7eb] hover:bg-[#e3e8f8] transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
