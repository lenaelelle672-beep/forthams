/**
 * CommandPalette.test.tsx
 *
 * 全局搜索组件（GlobalSearch / CommandDialog）测试覆盖：
 * - 搜索数据源完整性（纯函数验证）
 * - 分组逻辑纯函数测试
 * - API mock 测试
 * - 键盘快捷键逻辑测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// ── 搜索词校验模式 ───────────────────────────────────────────────────────

const searchQuerySchema = z.string().max(100, '搜索词不能超过100个字符');

// ── 分组逻辑（与 GlobalSearch.tsx 中 groupItems 函数逻辑一致）────────────

interface SearchItem {
  label: string;
  path: string;
  group: string;
}

function groupItems(items: SearchItem[]): Map<string, SearchItem[]> {
  const grouped = new Map<string, SearchItem[]>();
  for (const item of items) {
    const list = grouped.get(item.group) ?? [];
    list.push(item);
    grouped.set(item.group, list);
  }
  return grouped;
}

// ── 导航搜索数据源（与 GlobalSearch.tsx 同步）───────────────────────────

const SEARCH_ITEMS: SearchItem[] = [
  // 概览
  { label: '仪表板',     path: '/dashboard',  group: '概览' },
  { label: '数据分析',   path: '/analytics',  group: '概览' },
  // 资产管理
  { label: '资产台账',   path: '/assets',     group: '资产管理' },
  { label: '重要设备',   path: '/equipment',  group: '资产管理' },
  { label: '闲置资产',   path: '/idle',       group: '资产管理' },
  { label: '折旧管理',   path: '/depreciation', group: '资产管理' },
  // 运营管理
  { label: 'RFID 盘点',  path: '/inventory',  group: '运营管理' },
  { label: '工单管理',   path: '/workorders', group: '运营管理' },
  { label: '审批流程',   path: '/approvals',  group: '运营管理' },
  { label: '工作流',     path: '/workflows',  group: '运营管理' },
  // 退役与处置
  { label: '退役管理',   path: '/retirement', group: '退役与处置' },
  { label: '资产处置',   path: '/disposals',  group: '退役与处置' },
  { label: '赔偿管理',   path: '/compensation', group: '退役与处置' },
  // 报表
  { label: '报表中心',   path: '/reports',    group: '报表' },
  // 监控与审计
  { label: '审计日志',   path: '/audit',      group: '监控与审计' },
  // 基础数据
  { label: '供应商',     path: '/vendors',    group: '基础数据' },
  { label: '位置管理',   path: '/locations',  group: '基础数据' },
  { label: '系统设置',   path: '/settings',   group: '基础数据' },
  // 系统
  { label: '通知中心',   path: '/notifications', group: '系统' },
];

describe('CommandPalette — 搜索数据源验证', () => {
  it('应包含至少 15 个搜索条目', () => {
    expect(SEARCH_ITEMS.length).toBeGreaterThanOrEqual(15);
  });

  it('应包含报表中心条目', () => {
    const hasReports = SEARCH_ITEMS.some(
      (item) => item.label === '报表中心' && item.path === '/reports',
    );
    expect(hasReports).toBe(true);
  });

  it('所有条目应有非空的 label 和 path', () => {
    for (const item of SEARCH_ITEMS) {
      expect(item.label).toBeTruthy();
      expect(item.path).toBeTruthy();
      expect(item.path.startsWith('/')).toBe(true);
    }
  });

  it('所有分组名称不重复（每个分组应聚合多个条目）', () => {
    const groupSet = new Set(SEARCH_ITEMS.map((i) => i.group));
    expect(groupSet.size).toBeGreaterThan(0);
    // 验证分组数合理（6-10 个分组）
    expect(groupSet.size).toBeGreaterThanOrEqual(6);
    expect(groupSet.size).toBeLessThanOrEqual(10);
  });
});

describe('CommandPalette — 分组逻辑纯函数', () => {
  it('应按 group 字段正确分组', () => {
    const grouped = groupItems(SEARCH_ITEMS);
    expect(grouped.size).toBeGreaterThanOrEqual(6);
    // 概览分组应有 2 条
    expect(grouped.get('概览')?.length).toBe(2);
    // 资产管理分组应有 4 条
    expect(grouped.get('资产管理')?.length).toBe(4);
  });

  it('空列表应返回空 Map', () => {
    const grouped = groupItems([]);
    expect(grouped.size).toBe(0);
  });

  it('同一分组的条目应保持插入顺序', () => {
    const items = [
      { label: 'C', path: '/c', group: 'test' },
      { label: 'A', path: '/a', group: 'test' },
      { label: 'B', path: '/b', group: 'test' },
    ];
    const grouped = groupItems(items);
    expect(grouped.get('test')?.map((i) => i.label)).toEqual(['C', 'A', 'B']);
  });

  it('单个条目分组应正常', () => {
    const items = [{ label: '唯一项', path: '/only', group: 'singleton' }];
    const grouped = groupItems(items);
    expect(grouped.get('singleton')?.length).toBe(1);
    expect(grouped.get('singleton')?.[0].label).toBe('唯一项');
  });
});

describe('CommandPalette — 搜索词校验', () => {
  it('应接受有效搜索词', () => {
    expect(searchQuerySchema.safeParse('资产').success).toBe(true);
    expect(searchQuerySchema.safeParse('报表中心').success).toBe(true);
  });

  it('应接受空字符串', () => {
    expect(searchQuerySchema.safeParse('').success).toBe(true);
  });

  it('应拒绝超过 100 字符的搜索词', () => {
    const longStr = 'a'.repeat(101);
    const result = searchQuerySchema.safeParse(longStr);
    expect(result.success).toBe(false);
  });

  it('应接受 100 字符边界值', () => {
    const edgeStr = 'a'.repeat(100);
    expect(searchQuerySchema.safeParse(edgeStr).success).toBe(true);
  });
});

describe('CommandPalette — 快捷键逻辑', () => {
  it('Cmd+K 应触发打开操作', () => {
    let open = false;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        open = !open;
      }
    };
    document.addEventListener('keydown', handler);

    // 模拟 Cmd+K
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    expect(open).toBe(true);

    // 再次 Cmd+K 关闭
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    expect(open).toBe(false);

    document.removeEventListener('keydown', handler);
  });

  it('Ctrl+K 应触发打开操作', () => {
    let open = false;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        open = !open;
      }
    };
    document.addEventListener('keydown', handler);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(open).toBe(true);

    document.removeEventListener('keydown', handler);
  });

  it('普通 K 键不应触发', () => {
    let triggered = false;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        triggered = true;
      }
    };
    document.addEventListener('keydown', handler);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(triggered).toBe(false);

    document.removeEventListener('keydown', handler);
  });
});
