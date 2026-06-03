/**
 * @file components/MaterialForm.tsx
 * @description 物料/备件录入表单 — totalPrice 自动计算（quantity * unitPrice）
 *
 * Props：
 * - onSave: 创建回调
 * - onCancel: 取消回调
 */

import React, { useState, useMemo } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const materialSchema = z.object({
  materialName: z.string().min(1, '物料名称不能为空').max(256, '不超过256字符'),
  specification: z.string().max(256).optional().or(z.literal('')),
  quantity: z.coerce.number().positive('数量必须大于0'),
  unitPrice: z.coerce.number().nonnegative().optional(),
  sourceWarehouse: z.string().max(128).optional().or(z.literal('')),
  remark: z.string().max(500).optional().or(z.literal('')),
});

interface MaterialFormData {
  materialName: string;
  specification: string;
  quantity: string;
  unitPrice: string;
  sourceWarehouse: string;
  remark: string;
}

interface MaterialFormProps {
  onSave: (data: {
    materialName: string;
    specification?: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    sourceWarehouse?: string;
    remark?: string;
  }) => void;
  onCancel?: () => void;
}

const EMPTY_FORM: MaterialFormData = {
  materialName: '',
  specification: '',
  quantity: '',
  unitPrice: '',
  sourceWarehouse: '',
  remark: '',
};

export function MaterialForm({ onSave, onCancel }: MaterialFormProps) {
  const [form, setForm] = useState<MaterialFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 自动计算 totalPrice
  const calculatedTotal = useMemo(() => {
    const qty = parseFloat(form.quantity);
    const price = parseFloat(form.unitPrice);
    if (!isNaN(qty) && !isNaN(price) && qty > 0 && price >= 0) {
      return (qty * price).toFixed(2);
    }
    return '0.00';
  }, [form.quantity, form.unitPrice]);

  const handleChange = (field: keyof MaterialFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
    const result = materialSchema.safeParse({
      ...form,
      quantity: form.quantity || undefined,
      unitPrice: form.unitPrice || undefined,
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
    onSave({
      materialName: form.materialName,
      specification: form.specification || undefined,
      quantity: parseFloat(form.quantity),
      unitPrice: form.unitPrice ? parseFloat(form.unitPrice) : undefined,
      totalPrice: parseFloat(calculatedTotal),
      sourceWarehouse: form.sourceWarehouse || undefined,
      remark: form.remark || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="物料名称 *"
        value={form.materialName}
        onChange={handleChange('materialName')}
        error={errors.materialName}
        placeholder="输入物料/备件名称"
      />

      <Input
        label="规格型号"
        value={form.specification}
        onChange={handleChange('specification')}
        placeholder="如 12.9级 M16×60"
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="数量 *"
          type="number"
          step="0.01"
          value={form.quantity}
          onChange={handleChange('quantity')}
          error={errors.quantity}
          placeholder="1"
        />
        <Input
          label="单价"
          type="number"
          step="0.01"
          value={form.unitPrice}
          onChange={handleChange('unitPrice')}
          placeholder="0.00"
        />
      </div>

      <Input
        label="合计金额"
        value={calculatedTotal}
        disabled
        className="bg-muted"
        hint="由数量和单价自动计算"
      />

      <Input
        label="来源仓库"
        value={form.sourceWarehouse}
        onChange={handleChange('sourceWarehouse')}
        placeholder="如 一号备件库"
      />

      <Input
        label="备注"
        value={form.remark}
        onChange={handleChange('remark')}
        placeholder="备注信息"
      />

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button type="submit" variant="primary">
          添加物料
        </Button>
      </div>
    </form>
  );
}
