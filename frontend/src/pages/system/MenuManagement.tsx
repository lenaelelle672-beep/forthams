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
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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
const TYPE_COLOR: Record<string, string> = {
  M: 'bg-blue-100 text-blue-800',
  C: 'bg-green-100 text-green-800',
  F: 'bg-gray-100 text-gray-800',
};

// ─── 图标选择器
function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState('');
  const filtered = search ? ICON_NAMES.filter((n) => n.includes(search)) : ICON_NAMES;
  return (
    <div>
      <label className="text-sm font-medium text-[#374151] block mb-1.5">菜单图标</label>
      <Input placeholder="搜索图标..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
      <div className="grid grid-cols-8 gap-1 max-h-[120px] overflow-y-auto border border-gray-100 rounded-lg p-2">
        {filtered.map((name) => (
          <button key={name} type="button" onClick={() => onChange(name)}
            className={"p-1.5 rounded flex items-center justify-center hover:bg-blue-50 transition-colors " + (value === name ? 'bg-blue-100 ring-2 ring-blue-300' : '')} title={name}>
            {ICON_MAP[name]}
          </button>
        ))}
        {filtered.length === 0 && <span className="col-span-8 text-xs text-gray-400 text-center py-2">无匹配图标</span>}
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
              <label className="text-sm font-medium text-[#374151] block mb-1.5">菜单类型</label>
              <select value={form.menuType} onChange={(e) => u('menuType', e.target.value)}
                className="w-full h-9 rounded-lg border border-[#e5e7eb] text-sm bg-white px-3 focus:outline-none focus:ring-2 focus:ring-blue-200">
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
              <label className="text-sm font-medium text-[#374151] block mb-1.5">父级菜单</label>
              <select value={form.parentId} onChange={(e) => u('parentId', Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-[#e5e7eb] text-sm bg-white px-3 focus:outline-none focus:ring-2 focus:ring-blue-200">
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
              <label className="text-sm font-medium text-[#374151] block mb-1.5">可见状态</label>
              <select value={form.visible} onChange={(e) => u('visible', Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-[#e5e7eb] text-sm bg-white px-3 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value={1}>显示</option>
                <option value={0}>隐藏</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[#374151] block mb-1.5">菜单状态</label>
              <select value={form.status} onChange={(e) => u('status', Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-[#e5e7eb] text-sm bg-white px-3 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value={1}>正常</option>
                <option value={0}>停用</option>
              </select>
            </div>
          </div>
          <IconPicker value={form.icon} onChange={(v) => u('icon', v)} />
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
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
  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className="px-4 py-2">
          <div className="flex items-center gap-2" style={{ paddingLeft: depth * 24 }}>
            {hasChildren && <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">{expanded ? '▾' : '▸'}</button>}
            {!hasChildren && <span className="w-4" />}
            {item.menuType === 'M' ? <FolderTree className="w-4 h-4 text-blue-500" /> : item.menuType === 'C' ? <MenuIcon className="w-4 h-4 text-green-500" /> : <span className="w-4" />}
            <span className="font-medium text-sm text-gray-800">{item.menuName}</span>
          </div>
        </td>
        <td className="px-4 py-2"><span className={"inline-block px-2 py-0.5 text-xs rounded " + (TYPE_COLOR[item.menuType] || 'bg-gray-100')}>{TYPE_LABEL[item.menuType] || item.menuType}</span></td>
        <td className="px-4 py-2 text-sm text-gray-600">{item.perms || '—'}</td>
        <td className="px-4 py-2 text-sm text-gray-600">{item.path || '—'}</td>
        <td className="px-4 py-2 text-sm text-gray-500">{item.sortOrder}</td>
        <td className="px-4 py-2 text-sm">{item.status === 1 ? <span className="text-green-600">启用</span> : <span className="text-red-500">停用</span>}</td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(item)} className="p-1 text-gray-400 hover:text-blue-500 rounded" title="编辑"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => onDelete(item.id)} className="p-1 text-gray-400 hover:text-red-500 rounded" title="删除"><Trash2 className="w-4 h-4" /></button>
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

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader title="菜单管理" subtitle="管理系统菜单、按钮权限" />
        <div className="animate-pulse space-y-4 mt-6">{[1,2,3,4,5].map((i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="菜单管理" subtitle="管理系统菜单目录、路由和按钮权限标识" />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>菜单列表</CardTitle>
            <Button size="sm" onClick={handleNew}><Plus className="w-4 h-4 mr-1" />新增菜单</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase">
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
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">暂无菜单数据，请通过 DDL 初始化种子数据</td></tr>
                ) : (
                  displayData.map((item) => <MenuRow key={item.id} item={item} depth={item._depth} onEdit={handleEdit} onDelete={handleDelete} />)
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <MenuFormModal open={formOpen} onOpenChange={setFormOpen} editing={editing} parentMenus={flatParentList} />
    </div>
  );
}
