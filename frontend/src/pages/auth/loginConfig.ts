/**
 * @file pages/auth/loginConfig.ts
 * @description Login shared config: schema, types, demo accounts, constants.
 */

import { z } from 'zod';
import { ShieldCheck, Package, Building2, Wrench, type LucideIcon } from 'lucide-react';

// ── Schema ──────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// ── Demo Accounts ───────────────────────────────────────────────────────────────

export interface DemoAccount {
  label: string;
  desc: string;
  username: string;
  password: string;
  Icon: LucideIcon;
}

const isDev = import.meta.env.DEV;
const envDemoUser = import.meta.env.VITE_DEMO_USERNAME;
const envDemoPass = import.meta.env.VITE_DEMO_PASSWORD;

export const DEMO_ACCOUNTS: DemoAccount[] = isDev
  ? [
      { label: '系统管理员', desc: '全域权限', username: envDemoUser || 'admin', password: envDemoPass || 'admin123', Icon: ShieldCheck },
      { label: '资产管理员', desc: '全生命周期', username: 'asset', password: 'asset123', Icon: Package },
      { label: '部门负责人', desc: '资源审批', username: 'manager', password: 'manager123', Icon: Building2 },
      { label: '运维人员', desc: '巡检维修', username: 'staff', password: 'staff123', Icon: Wrench },
    ]
  : envDemoUser && envDemoPass
    ? [{ label: '演示账号', desc: '只读权限', username: envDemoUser, password: envDemoPass, Icon: ShieldCheck }]
    : [];

// ── Feature list (left panel) ──────────────────────────────────────────────────

export const FEATURES = [
  { title: '统一资产台账', description: '资产、位置、供应商与责任人信息在一个视图中保持同步' },
  { title: '审批流程闭环', description: '处置、折旧、报废等关键操作进入可追踪的审批链路' },
  { title: '实时运营看板', description: '登录后直达仪表板，快速识别待办、风险和资产价值变化' },
  { title: '审计合规留痕', description: '全链路操作日志审计，满足等保与行业合规要求' },
] as const;
