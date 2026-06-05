/**
 * @file pages/report-builder/ReportBuilderPage.tsx
 * @description 自定义报表构建器 — 拖拽式字段选择 + 预览
 * 使用 react-dnd 实现拖拽，Recharts 渲染图表预览
 */

import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  Layout, Save, Eye, Table2, BarChart3, PieChart as PieChartIcon,
  TrendingUp, GripVertical, X, Plus, Trash2,
} from 'lucide-react';
import { createSavedReport } from '@/api/savedReport';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import type { ReportConfig, ReportField, SavedReport } from '@/types/savedReport';

// 可用字段分组
const AVAILABLE_FIELDS: Record<string, ReportField[]> = {
  资产: [
    { name: 'assetCode', label: '资产编码', selected: false },
    { name: 'assetName', label: '资产名称', selected: false },
    { name: 'categoryName', label: '资产分类', selected: false },
    { name: 'status', label: '状态', selected: false },
    { name: 'originalValue', label: '原值', selected: false },
    { name: 'currentValue', label: '净值', selected: false },
    { name: 'purchaseDate', label: '购入日期', selected: false },
    { name: 'locationName', label: '位置', selected: false },
    { name: 'departmentName', label: '使用部门', selected: false },
  ],
  运维: [
    { name: 'workOrderCount', label: '工单数量', selected: false },
    { name: 'maintenanceCount', label: '保养次数', selected: false },
    { name: 'faultCount', label: '故障次数', selected: false },
    { name: 'mtbf', label: 'MTBF', selected: false },
    { name: 'mttr', label: 'MTTR', selected: false },
  ],
  财务: [
    { name: 'depreciationAmount', label: '折旧金额', selected: false },
    { name: 'maintenanceCost', label: '维保费用', selected: false },
    { name: 'energyCost', label: '能耗费用', selected: false },
    { name: 'totalCost', label: '总成本', selected: false },
  ],
};

const CHART_TYPES = [
  { value: 'table', label: '表格', icon: Table2 },
  { value: 'bar', label: '柱状图', icon: BarChart3 },
  { value: 'line', label: '折线图', icon: TrendingUp },
  { value: 'pie', label: '饼图', icon: PieChartIcon },
] as const;

const REPORT_TYPES = [
  { value: 'ASSET', label: '资产报表' },
  { value: 'MAINTENANCE', label: '运维报表' },
  { value: 'FINANCIAL', label: '财务报表' },
  { value: 'INVENTORY', label: '盘点报表' },
];

const PIE_COLORS = ['#1d4ed8', '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#14b8a6'];

// ── react-dnd 拖拽相关 ─────────────────────────────────────────────────────

const DragType = {
  FIELD: 'FIELD',
  SELECTED_FIELD: 'SELECTED_FIELD',
} as const;

/** 拖拽项数据结构 */
interface DragItem {
  type: string;
  field: ReportField;
  index: number;
}

/** 左侧可用字段——可拖拽源 */
function DraggableFieldItem({
  field,
  isSelected,
  onAdd,
  onRemove,
}: {
  field: ReportField;
  isSelected: boolean;
  onAdd: (f: ReportField) => void;
  onRemove: (name: string) => void;
}) {
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: DragType.FIELD,
      item: { field, index: -1 } as DragItem,
      canDrag: !isSelected,
      end: (_item, monitor) => {
        const dropResult = monitor.getDropResult<{ dropped: boolean }>();
        if (dropResult?.dropped && !isSelected) {
          onAdd(field);
        }
      },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [field, isSelected, onAdd],
  );

  return (
    <button
      ref={drag}
      onClick={() => (isSelected ? onRemove(field.name) : onAdd(field))}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition ${
        isSelected
          ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] cursor-not-allowed opacity-60'
          : 'hover:bg-[var(--surface-muted)] text-[var(--surface-muted-text)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <GripVertical className="w-3 h-3 opacity-40 shrink-0" />
      <span className="truncate">{field.label}</span>
      {isSelected && <X className="w-3 h-3 ml-auto shrink-0" />}
    </button>
  );
}

/** 已选字段排序项——既可拖拽源又可作为放置目标 */
function SortableFieldItem({
  field,
  index,
  moveField,
  onRemove,
}: {
  field: ReportField;
  index: number;
  moveField: (from: number, to: number) => void;
  onRemove: (name: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: DragType.SELECTED_FIELD,
      item: { index } as DragItem,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [index],
  );

  const [, drop] = useDrop(
    () => ({
      accept: DragType.SELECTED_FIELD,
      hover: (item: DragItem, monitor) => {
        if (!ref.current) return;
        const dragIndex = item.index;
        const hoverIndex = index;
        if (dragIndex === hoverIndex) return;
        // 判断鼠标位置是否过了一半
        const hoverBoundingRect = ref.current.getBoundingClientRect();
        const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) return;
        const hoverClientY = clientOffset.y - hoverBoundingRect.top;
        // 向下拖时只有超过一半才交换
        if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
        // 向上拖时只有超过一半才交换
        if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
        moveField(dragIndex, hoverIndex);
        item.index = hoverIndex;
      },
    }),
    [index, moveField],
  );

  drag(drop(ref));

  return (
    <div
      ref={ref}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] cursor-grab active:cursor-grabbing transition ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <GripVertical className="w-3 h-3 shrink-0 opacity-50" />
      {field.label}
      <button onClick={() => onRemove(field.name)} className="hover:opacity-70 ml-0.5" type="button">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

/** 已选字段区域——放置目标（接受从左侧拖来的新字段） */
function FieldDropZone({
  selectedFields,
  onAddField,
  onRemoveField,
  onMoveField,
}: {
  selectedFields: ReportField[];
  onAddField: (f: ReportField) => void;
  onRemoveField: (name: string) => void;
  onMoveField: (from: number, to: number) => void;
}) {
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: [DragType.FIELD, DragType.SELECTED_FIELD],
      drop: (item: DragItem) => {
        if (item.type === DragType.FIELD) {
          // 从左侧拖入新字段
          onAddField(item.field);
        }
        // SELECTED_FIELD 由 SortableFieldItem 的 hover 处理交换
        return { dropped: true };
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [onAddField],
  );

  const isEmpty = selectedFields.length === 0;

  return (
    <div
      ref={drop}
      className={`min-h-[60px] rounded-lg border-2 border-dashed p-3 transition-colors ${
        isOver && canDrop
          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
          : isEmpty
            ? 'border-[var(--surface-border)]'
            : 'border-transparent'
      }`}
    >
      {isEmpty ? (
        <p className="text-xs text-[var(--surface-muted-text)] text-center py-2">
          将字段拖拽到此处，或点击左侧字段添加
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selectedFields.map((f, idx) => (
            <SortableFieldItem
              key={f.name}
              field={f}
              index={idx}
              moveField={onMoveField}
              onRemove={onRemoveField}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReportBuilderPage() {
  const qc = useQueryClient();
  const [reportName, setReportName] = useState('');
  const [reportType, setReportType] = useState('ASSET');
  const [selectedFields, setSelectedFields] = useState<ReportField[]>([]);
  const [chartType, setChartType] = useState<string>('table');
  const [previewData, setPreviewData] = useState<any[]>([]);

  const handleAddField = useCallback((field: ReportField) => {
    if (!selectedFields.find((f) => f.name === field.name)) {
      setSelectedFields((prev) => [...prev, { ...field, selected: true }]);
    }
  }, [selectedFields]);

  const handleRemoveField = useCallback((fieldName: string) => {
    setSelectedFields((prev) => prev.filter((f) => f.name !== fieldName));
  }, []);

  const handleMoveField = useCallback((fromIndex: number, toIndex: number) => {
    setSelectedFields((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }, []);

  const handleGeneratePreview = useCallback(() => {
    if (selectedFields.length === 0) {
      toast.warning('请至少选择一个字段');
      return;
    }
    // 生成模拟预览数据
    const mockData = Array.from({ length: 8 }, (_, i) => {
      const row: Record<string, any> = { name: `项目 ${i + 1}` };
      selectedFields.forEach((f) => {
        if (f.name.includes('Value') || f.name.includes('Cost') || f.name.includes('Amount')) {
          row[f.name] = Math.round(Math.random() * 100000) / 100;
        } else if (f.name.includes('Count') || f.name.includes('Count')) {
          row[f.name] = Math.floor(Math.random() * 50);
        } else if (f.name === 'status') {
          row[f.name] = ['在库', '使用中', '维修中', '已报废'][Math.floor(Math.random() * 4)];
        } else {
          row[f.name] = `${f.label} ${i + 1}`;
        }
      });
      return row;
    });
    setPreviewData(mockData);
    toast.success('预览数据已生成');
  }, [selectedFields]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<SavedReport>) => createSavedReport(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-reports'] });
      toast.success('报表已保存');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = useCallback(() => {
    if (!reportName.trim()) {
      toast.warning('请输入报表名称');
      return;
    }
    if (selectedFields.length === 0) {
      toast.warning('请至少选择一个字段');
      return;
    }

    const config: ReportConfig = {
      fields: selectedFields,
      chartType: chartType as ReportConfig['chartType'],
      sortBy: selectedFields[0]?.name,
      sortOrder: 'asc',
    };

    saveMutation.mutate({
      reportName: reportName.trim(),
      reportType: reportType as SavedReport['reportType'],
      configJson: JSON.stringify(config),
      isPublic: 1,
    });
  }, [reportName, reportType, selectedFields, chartType, saveMutation]);

  const renderChart = () => {
    if (previewData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-sm text-[var(--surface-muted-text)]">
          <Eye className="w-10 h-10 mb-2 opacity-40" />
          <span>点击"生成预览"查看数据</span>
        </div>
      );
    }

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={previewData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              {selectedFields.slice(0, 3).map((f, idx) => (
                <Bar
                  key={f.name}
                  dataKey={f.name}
                  fill={PIE_COLORS[idx % PIE_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={previewData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              {selectedFields.slice(0, 3).map((f, idx) => (
                <Line
                  key={f.name}
                  type="monotone"
                  dataKey={f.name}
                  stroke={PIE_COLORS[idx % PIE_COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={previewData.slice(0, 8)}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey={selectedFields[0]?.name || 'value'}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {previewData.slice(0, 8).map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--surface-border)]">
                  <th className="text-left py-2 px-2 text-[var(--surface-muted-text)] font-medium">#</th>
                  {selectedFields.map((f) => (
                    <th key={f.name} className="text-left py-2 px-2 text-[var(--surface-muted-text)] font-medium">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, idx) => (
                  <tr key={idx} className="border-b border-[var(--surface-border-subtle)]">
                    <td className="py-1.5 px-2 text-[var(--surface-muted-text)]">{idx + 1}</td>
                    {selectedFields.map((f) => (
                      <td key={f.name} className="py-1.5 px-2">{row[f.name] ?? '-'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-xl font-bold text-[var(--surface-heading)]">自定义报表构建器</h1>
        <p className="text-sm text-[var(--surface-muted-text)]">通过拖拽选择字段，快速创建自定义报表</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧：可用字段 */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-[var(--surface-card)]">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-[var(--surface-heading)] mb-3">可用字段</h3>
              {Object.entries(AVAILABLE_FIELDS).map(([group, fields]) => (
                <div key={group} className="mb-3">
                  <p className="text-xs font-medium text-[var(--surface-muted-text)] uppercase mb-1.5">
                    {group}
                  </p>
                  <div className="space-y-1">
                    {fields.map((field) => {
                      const isSelected = selectedFields.some((f) => f.name === field.name);
                      return (
                        <DraggableFieldItem
                          key={field.name}
                          field={field}
                          isSelected={isSelected}
                          onAdd={handleAddField}
                          onRemove={handleRemoveField}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* 中间+右侧：配置区 + 预览区 */}
        <div className="lg:col-span-3 space-y-4">
          {/* 配置区 */}
          <Card className="bg-[var(--surface-card)]">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--surface-heading)] mb-1">
                    报表名称
                  </label>
                  <input
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="输入报表名称"
                    className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--input-background)] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--surface-heading)] mb-1">
                    报表类型
                  </label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--input-background)] px-3 py-2 text-sm"
                  >
                    {REPORT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--surface-heading)] mb-1">
                    图表类型
                  </label>
                  <div className="flex gap-1">
                    {CHART_TYPES.map((ct) => {
                      const Icon = ct.icon;
                      return (
                        <button
                          key={ct.value}
                          onClick={() => setChartType(ct.value)}
                          className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs transition ${
                            chartType === ct.value
                              ? 'bg-[var(--brand-primary)] text-white'
                              : 'bg-[var(--surface-muted)] text-[var(--surface-muted-text)] hover:bg-[var(--surface-muted-strong)]'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {ct.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 已选字段（拖拽放置区） */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-[var(--surface-heading)] mb-2">
                  已选字段 ({selectedFields.length})
                </label>
                <FieldDropZone
                  selectedFields={selectedFields}
                  onAddField={handleAddField}
                  onRemoveField={handleRemoveField}
                  onMoveField={handleMoveField}
                />
              </div>

              {/* 操作按钮 */}
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  onClick={handleGeneratePreview}
                  variant="outline"
                  className="inline-flex items-center gap-1.5"
                >
                  <Eye className="w-4 h-4" />
                  生成预览
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending ? '保存中...' : '保存报表'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 预览区 */}
          <Card className="bg-[var(--surface-card)]">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-[var(--surface-heading)] mb-3">数据预览</h3>
              {renderChart()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </DndProvider>
  );
}
