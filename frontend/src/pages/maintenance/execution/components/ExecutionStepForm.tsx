/**
 * @file components/ExecutionStepForm.tsx
 * @description 步骤录入表单 — 支持创建和编辑
 *
 * Props：
 * - initialData: 编辑时的初始数据（可选）
 * - onSave: 创建回调
 * - onUpdate: 更新回调
 * - onCancel: 取消回调
 */

import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const stepSchema = z.object({
  stepName: z.string().min(1, '步骤名称不能为空').max(256, '不超过256字符'),
  stepOrder: z.coerce.number().int().nonnegative().optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  operatorName: z.string().max(128).optional().or(z.literal('')),
  laborHours: z.coerce.number().nonnegative('工时不能为负').optional(),
});

interface StepFormData {
  stepName: string;
  stepOrder: string;
  description: string;
  operatorName: string;
  laborHours: string;
}

interface ExecutionStepFormProps {
  initialData?: Partial<StepFormData>;
  onSave: (data: StepFormData) => void;
  onUpdate?: (data: StepFormData) => void;
  onCancel?: () => void;
}

const EMPTY_FORM: StepFormData = {
  stepName: '',
  stepOrder: '',
  description: '',
  operatorName: '',
  laborHours: '',
};

export function ExecutionStepForm({ initialData, onSave, onUpdate, onCancel }: ExecutionStepFormProps) {
  const [form, setForm] = useState<StepFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEditing = !!initialData;

  useEffect(() => {
    if (initialData) {
      setForm({ ...EMPTY_FORM, ...initialData });
    }
  }, [initialData]);

  const handleChange = (field: keyof StepFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = stepSchema.safeParse({
      ...form,
      stepOrder: form.stepOrder || undefined,
      laborHours: form.laborHours || undefined,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    if (isEditing && onUpdate) {
      onUpdate(form);
    } else {
      onSave(form);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="步骤名称 *"
        value={form.stepName}
        onChange={handleChange('stepName')}
        error={errors.stepName}
        placeholder="输入步骤名称"
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="排序号"
          type="number"
          value={form.stepOrder}
          onChange={handleChange('stepOrder')}
          placeholder="自动排序"
        />
        <Input
          label="人工工时 (小时)"
          type="number"
          step="0.5"
          value={form.laborHours}
          onChange={handleChange('laborHours')}
          error={errors.laborHours}
          placeholder="0.0"
        />
      </div>

      <Input
        label="操作人"
        value={form.operatorName}
        onChange={handleChange('operatorName')}
        placeholder="操作人姓名"
      />

      <Input
        label="步骤描述"
        value={form.description}
        onChange={handleChange('description')}
        placeholder="描述该步骤的具体工作内容"
      />

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" variant="primary">
          {isEditing ? '保存修改' : '添加步骤'}
        </Button>
      </div>
    </form>
  );
}
