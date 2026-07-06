/**
 * @file pages/system/MenuManagement.tsx
 * @description 菜单权限管理页面 — RuoYi RBAC 集成
 *
 * 对应后端 SysMenuController (/menus/admin)
 * 支持菜单树展示、新增/编辑/删除
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, FolderTree, MenuIcon,
  Settings, User, Shield, Building, Menu,
  Package, Clipboard, CheckCircle, Scan, Archive,
  TrendingDown, AlertTriangle,
  PauseCircle, Wrench, MapPin,
  BarChart, Monitor, FileSearch, Bell,
  Layers,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/Dialog';
import {
  getMenuList,
  getMenuTree,
  createMenu,
  updateMenu,
  deleteMenu,
  type MenuItem,
} from '@/api/menu';

// ─── 可用图标列表
const ICON_MAP: Record<string, React.ReactNode> = {
  settings: <Settings className="w-4 h-4" />,
  user: <User className="w-4 h-4" />,
  shield: <Shield className="w-4 h-4" />,
  building: <Building className="w-4 h-4" />,
  menu: <Menu className="w-4 h-4" />,
  package: <Package className="w-4 h-4" />,
  clipboard: <Clipboard className="w-4 h-4" />,
  'check-circle': <CheckCircle className="w-4 h-4" />,
  scan: <Scan className="w-4 h-4" />,
  archive: <Archive className="w-4 h-4" />,
  'trending-down': <TrendingDown className="w-4 h-4" />,
  'alert-triangle': <AlertTriangle className="w-4 h-4" />,
  'pause-circle': <PauseCircle className="w-4 h-4" />,
  wrench: <Wrench className="w-4 h-4" />,
  'map-pin': <MapPin className="w-4 h-4" />,
  'folder-tree': <FolderTree className="w-4 h-4" />,
  'bar-chart': <BarChart className="w-4 h-4" />,
  monitor: <Monitor className="w-4 h-4" />,
  'file-search': <FileSearch className="w-4 h-4" />,
  bell: <Bell className="w-4 h-4" />,
};
const ICON_NAMES = Object.keys(ICON_MAP);

// ─── 菜单类型标签
const TYPE_LABEL: Record<string, string> = { M: '目录', C: '菜单', F: '按钮' };
const TYPE_STYLE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  M: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', dot: 'bg-blue-400' },
  C: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', dot: 'bg-emerald-400' },
  F: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500', dot: 'bg-slate-400' },
};

// ─── 图标选择器
function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState('');
  const filtered = search ? ICON_NAMES.filter((n) => n.includes(search)) : ICON_NAMES;
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-1.5">菜单图标</label>
      <Input placeholder="搜索图标..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
      <div className="grid grid-cols-8 gap-1 max-h-[120px] overflow-y-auto border border-slate-200 rounded-lg p-2">
        {filtered.map((name) => (
          <button key={name} type="button" onClick={() => onChange(name)}
            className={"p-1.5 rounded flex items-center justify-center hover:bg-blue-50 transition-colors " + (value === name ? 'bg-blue-100 ring-2 ring-blue-300' : '')} title={name}>
            {ICON_MAP[name]}
          </button>
        ))}
        {filtered.length === 0 && <span className="col-span-8 text-xs text-slate-400 text-center py-2">无匹配图标</span>}
      </div>
    </div>
  );
}

// ─── 菜单表单弹窗
function MenuFormModal({ open, onOpenChange, editing, parentMenus }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: MenuItem | null; parentMenus: MenuItem[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    menuName: '', menuType: 'M', parentId: 0, path: '', component: '',
    perms: '', icon: '', sortOrder: 0, visible: 1, status: 1,
  });

  React.useEffect(() => {
    if (editing) {
      setForm({
        menuName: editing.menuName, menuType: editing.menuType || 'M',
        parentId: editing.parentId || 0, path: editing.path || '',
        component: editing.component || '', perms: editing.perms || '',
        icon: editing.icon || '', sortOrder: editing.sortOrder || 0,
        visible: editing.visible ?? 1, status: editing.status ?? 1,
      });
    } else {
      setForm({ menuName: '', menuType: 'M', parentId: 0, path: '', component: '', perms: '', icon: '', sortOrder: 0, visible: 1, status: 1 });
    }
  }, [editing, open]);

  const createMut = useMutation({ mutationFn: () => createMenu(form as any),
    onSuccess: () => { toast.success('菜单已创建'); queryClient.invalidateQueries({ queryKey: ['menus'] }); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message) });

  const updateMut = useMutation({ mutationFn: () => updateMenu(editing!.id, form as any),
    onSuccess: () => { toast.success('菜单已更新'); queryClient.invalidateQueries({ queryKey: ['menus'] }); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message) });

  const handleSubmit = () => {
    if (!form.menuName.trim()) { toast.error('请填写菜单名称'); return; }
    if (editing) updateMut.mutate(); else createMut.mutate();
  };

  const u = (f: string, v: any) => setForm((p) => ({ ...p, [f]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editing ? '编辑菜单' : '新增菜单'} className="max-w-xl">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="菜单名称" value={form.menuName} onChange={(e) => u('menuName', e.target.value)} placeholder="菜单显示名称" />
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">菜单类型</label>
              <select value={form.menuType} onChange={(e) => u('menuType', e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 text-sm bg-white px-3 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="M">目录</option>
                <option value="C">菜单</option>
                <option value="F">按钮</option>
              </select>
            </div>
          </div>
          {form.menuType !== 'F' && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="路由路径" value={form.path} onChange={(e) => u('path', e.target.value)} placeholder="如：system/user" />
              <Input label="组件路径" value={form.component} onChange={(e) => u('component', e.target.value)} placeholder="如：system/user/index" />
            </div>
          )}
          {form.menuType === 'F' && (
            <Input label="权限标识" value={form.perms} onChange={(e) => u('perms', e.target.value)} placeholder="如：system:user:add" />
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">父级菜单</label>
              <select value={form.parentId} onChange={(e) => u('parentId', Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-slate-200 text-sm bg-white px-3 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value={0}>顶级目录</option>
                {parentMenus.filter((m) => m.id !== editing?.id).map((m) => (
                  <option key={m.id} value={m.id}>{'─'.repeat((m as any)._depth || 0)}{m.menuName}</option>
                ))}
              </select>
            </div>
            <Input label="排序号" type="number" value={String(form.sortOrder)} onChange={(e) => u('sortOrder', parseInt(e.target.value) || 0)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">可见状态</label>
              <select value={form.visible} onChange={(e) => u('visible', Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-slate-200 text-sm bg-white px-3 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value={1}>显示</option>
                <option value={0}>隐藏</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">菜单状态</label>
              <select value={form.status} onChange={(e) => u('status', Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-slate-200 text-sm bg-white px-3 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value={1}>正常</option>
                <option value={0}>停用</option>
              </select>
            </div>
          </div>
          <IconPicker value={form.icon} onChange={(v) => u('icon', v)} />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <DialogClose asChild><Button variant="secondary">取消</Button></DialogClose>
          <Button onClick={handleSubmit} loading={createMut.isPending || updateMut.isPending}>保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 递归渲染菜单行
function MenuRow({ item, depth, onEdit, onDelete }: {
  item: MenuItem; depth: number; onEdit: (item: MenuItem) => void; onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  const typeStyle = TYPE_STYLE[item.menuType] || TYPE_STYLE['F'];

  return (
    <>
      <tr className="border-b border-slate-100 last:border-b-0 transition-colors hover:bg-slate-50/60">
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2" style={{ paddingLeft: depth * 24 }}>
            {hasChildren ? (
              <button onClick={() => setExpanded(!expanded)} className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <span className="text-xs">{expanded ? '▾' : '▸'}</span>
              </button>
            ) : (
              <span className="w-5" />
            )}
            {item.menuType === 'M' ? (
              <FolderTree className="w-4 h-4 text-blue-500" />
            ) : item.menuType === 'C' ? (
              <MenuIcon className="w-4 h-4 text-emerald-500" />
            ) : (
              <span className="w-4" />
            )}
            <span className="font-medium text-sm text-slate-800">{item.menuName}</span>
          </div>
        </td>
        <td className="px-4 py-2.5">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${typeStyle.bg} ${typeStyle.border} ${typeStyle.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${typeStyle.dot}`} />
            {TYPE_LABEL[item.menuType] || item.menuType}
          </span>
        </td>
        <td className="px-4 py-2.5">
          {item.perms ? (
            <span className="rounded-md bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-500">{item.perms}</span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-sm text-slate-600">{item.path || '—'}</td>
        <td className="px-4 py-2.5 text-sm text-slate-500">{item.sortOrder}</td>
        <td className="px-4 py-2.5">
          {item.status === 1 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 ring-1 ring-inset">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              正常
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 ring-1 ring-inset">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              停用
            </span>
          )}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onEdit(item)}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
              title="编辑"
            >
              <Pencil className="h-3.5 w-3.5" />编辑
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:text-red-500"
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
      {hasChildren && expanded && item.children!.map((child) => <MenuRow key={child.id} item={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />)}
    </>
  );
}

// ─── 主组件
export default function MenuManagement() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);

  const { data: menuTree } = useQuery({ queryKey: ['menus', 'tree'], queryFn: getMenuTree });
  const { isLoading } = useQuery({ queryKey: ['menus', 'list'], queryFn: getMenuList });

  const deleteMutation = useMutation({
    mutationFn: deleteMenu,
    onSuccess: () => { toast.success('菜单已删除'); queryClient.invalidateQueries({ queryKey: ['menus'] }); },
    onError: (err: Error) => toast.error(err.message || '删除失败'),
  });

  const handleDelete = (id: number) => { if (!confirm('确认删除该菜单及其关联数据？')) return; deleteMutation.mutate(id); };
  const handleEdit = (item: MenuItem) => { setEditing(item); setFormOpen(true); };
  const handleNew = () => { setEditing(null); setFormOpen(true); };

  const flattenTree = (items: MenuItem[], depth = 0): (MenuItem & { _depth: number })[] =>
    items.flatMap((item) => {
      const r: (MenuItem & { _depth: number })[] = [{ ...item, _depth: depth }];
      if (item.children) r.push(...flattenTree(item.children, depth + 1));
      return r;
    });

  const displayData = menuTree ? flattenTree(menuTree) : [];
  const flatParentList = menuTree ? flattenTree(menuTree) : [];

  /* ── Count stats ── */
  const dirCount = displayData.filter((m) => m.menuType === 'M').length;
  const menuCount = displayData.filter((m) => m.menuType === 'C').length;
  const btnCount = displayData.filter((m) => m.menuType === 'F').length;

  const statCards = [
    { label: '目录', value: dirCount, icon: FolderTree, gradient: 'from-blue-600 to-cyan-500' },
    { label: '菜单', value: menuCount, icon: MenuIcon, gradient: 'from-emerald-500 to-teal-400' },
    { label: '按钮', value: btnCount, icon: Layers, gradient: 'from-violet-500 to-purple-400' },
    { label: '总计', value: displayData.length, icon: Package, gradient: 'from-amber-500 to-orange-400' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
          <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
            <div className="flex items-center gap-3 px-6 py-4">
              <h1 className="text-xl font-bold text-slate-900">菜单管理</h1>
            </div>
          </section>
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <div className="animate-pulse space-y-4 p-6">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-slate-100 rounded" />)}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[var(--app-background)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
        {/* ── Compact header with stat bar ── */}
        <section className="rounded-2xl border border-[var(--surface-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">菜单管理</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                <FolderTree className="h-3 w-3" />
                树形
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="md" onClick={handleNew}>
                <Plus className="w-4 h-4" />
                新增菜单
              </Button>
            </div>
          </div>

          {/* stat bar */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 sm:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3 px-5 py-3">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${stat.gradient} shadow-sm`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-slate-400">{stat.label}</p>
                    <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Main content card ── */}
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          {/* Toolbar */}
          <div className="border-b border-slate-100 bg-gradient-to-r from-white via-[#fbfdff] to-[#f8fbff] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-blue-600">
                  <FolderTree className="h-3.5 w-3.5" />
                  菜单列表
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  系统菜单目录与按钮权限
                </h2>
              </div>
            </div>
          </div>

          {/* Tree table */}
          <div className="p-4 sm:p-5">
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-gradient-to-r from-[#fbfdff] to-[#f3f7fb] text-xs uppercase tracking-[0.08em] font-semibold text-slate-500">
                    <th className="px-4 py-3">菜单名称</th>
                    <th className="px-4 py-3">类型</th>
                    <th className="px-4 py-3">权限标识</th>
                    <th className="px-4 py-3">路由</th>
                    <th className="px-4 py-3">排序</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                        暂无菜单数据，请通过 DDL 初始化种子数据
                      </td>
                    </tr>
                  ) : (
                    displayData.map((item) => <MenuRow key={item.id} item={item} depth={item._depth} onEdit={handleEdit} onDelete={handleDelete} />)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      <MenuFormModal open={formOpen} onOpenChange={setFormOpen} editing={editing} parentMenus={flatParentList} />
    </div>
  );
}
