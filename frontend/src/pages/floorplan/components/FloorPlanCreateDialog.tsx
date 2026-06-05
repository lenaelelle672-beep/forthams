/**
 * @file pages/floorplan/components/FloorPlanCreateDialog.tsx
 * @description 新建平面图 Dialog 组件（gai2 W23 拆分 — FloorPlanPage 从 334 行精简到 < 250）。
 *
 * 职责：UI 表单 + 表单校验 + 提交。
 * 父组件 FloorPlanPage 负责 open/onClose 状态 + refetch 列表。
 */
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import floorplanService from '@/services/floorplanService';
import { message } from 'antd';

export interface FloorPlanCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface FormState {
  name: string;
  building: string;
  floor: string;
  imageUrl: string;
}

const EMPTY: FormState = { name: '', building: '', floor: '', imageUrl: '' };

export const FloorPlanCreateDialog: React.FC<FloorPlanCreateDialogProps> = ({ open, onOpenChange, onCreated }) => {
  const [form, setForm] = React.useState<FormState>(EMPTY);

  const update = (patch: Partial<FormState>) => setForm((p) => ({ ...p, ...patch }));

  const handleClose = () => {
    onOpenChange(false);
    setForm(EMPTY);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      message.warning('请输入平面图名称');
      return;
    }
    try {
      await floorplanService.create(form);
      message.success('创建成功');
      onCreated();
      handleClose();
    } catch {
      message.error('创建失败');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent title="新建平面图" className="max-w-md">
        <DialogHeader>
          <DialogTitle>新建平面图</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-3">
          <Field label="名称 *" placeholder="平面图名称" value={form.name} onChange={(v) => update({ name: v })} />
          <Field label="楼栋" placeholder="楼栋" value={form.building} onChange={(v) => update({ building: v })} />
          <Field label="楼层" placeholder="楼层" value={form.floor} onChange={(v) => update({ floor: v })} />
          <Field label="图片URL" placeholder="图片URL" value={form.imageUrl} onChange={(v) => update({ imageUrl: v })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleSubmit}>创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}

const Field: React.FC<FieldProps> = ({ label, placeholder, value, onChange }) => (
  <div>
    <label className="text-xs text-[#64748b] mb-1 block">{label}</label>
    <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export default FloorPlanCreateDialog;
