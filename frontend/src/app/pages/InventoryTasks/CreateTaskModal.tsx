/**
 * CreateTaskModal — 新建盘点任务弹窗
 *
 * 提供完整的盘点任务创建表单，包含：
 * - 任务名称输入
 * - 盘点范围类型切换（按位置树 / 按分类树），对应 ATB-02 中 Radio 切换断言
 * - 位置树 / 分类树多选（TreeSelect + treeCheckable）
 * - 日期范围选择（含跨校验）
 * - 备注说明
 *
 * 提交时通过 useCreateTask hook 发起 POST 请求至后端 API，
 * 前端不持久化任何盘点业务主数据。
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Form,
  Input,
  DatePicker,
  Radio,
  TreeSelect,
  message,
} from 'antd';
import type { RadioChangeEvent } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useCreateTask } from './hooks/useCreateTask';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** 盘点范围类型 */
export type InventoryScopeType = 'location' | 'category';

/** 表单值结构 */
export interface ICreateTaskFormValues {
  taskName: string;
  scopeType: InventoryScopeType;
  locationIds?: string[];
  categoryIds?: string[];
  startDate: Dayjs;
  endDate: Dayjs;
  description?: string;
}

/** TreeSelect 通用树节点 */
export interface ITreeNode {
  title: string;
  value: string;
  key: string;
  children?: ITreeNode[];
}

/** Component props */
export interface CreateTaskModalProps {
  /** 弹窗是否可见 */
  open: boolean;
  /** 关闭弹窗回调 */
  onCancel: () => void;
  /** 创建成功回调 */
  onSuccess: (newTask: Record<string, unknown>) => void;
  /** 位置树数据（由父组件从 API 获取后传入） */
  locationTreeData: ITreeNode[];
  /** 分类树数据（由父组件从 API 获取后传入） */
  categoryTreeData: ITreeNode[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  open,
  onCancel,
  onSuccess,
  locationTreeData,
  categoryTreeData,
}) => {
  const [form] = Form.useForm<ICreateTaskFormValues>();
  const [scopeType, setScopeType] = useState<InventoryScopeType>('location');

  // 使用 co-located hook 发起创建请求
  const { createTask, loading } = useCreateTask();

  /** 弹窗关闭时重置表单与内部状态 */
  useEffect(() => {
    if (!open) {
      form.resetFields();
      setScopeType('location');
    }
  }, [open, form]);

  /** 盘点范围 Radio 切换处理 */
  const handleScopeTypeChange = useCallback(
    (e: RadioChangeEvent) => {
      const next = e.target.value as InventoryScopeType;
      setScopeType(next);
      // 切换范围类型时清空另一侧已选值，避免提交脏数据
      if (next === 'location') {
        form.setFieldValue('categoryIds', []);
      } else {
        form.setFieldValue('locationIds', []);
      }
    },
    [form],
  );

  /** 点击"确定"提交表单 */
  const handleOk = useCallback(async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        taskName: values.taskName,
        scopeType: values.scopeType,
        locationIds: values.scopeType === 'location' ? (values.locationIds ?? []) : [],
        categoryIds: values.scopeType === 'category' ? (values.categoryIds ?? []) : [],
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
        description: values.description ?? '',
      };

      const newTask = await createTask(payload);
      message.success('盘点任务创建成功');
      onSuccess(newTask as Record<string, unknown>);
    } catch (error: unknown) {
      // Ant Design 表单校验失败时 error 包含 errorFields 字段，
      // 此时由 Form 组件自动展示错误提示，无需额外处理。
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      message.error('创建盘点任务失败，请重试');
    }
  }, [form, createTask, onSuccess]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Modal
      title="新建盘点任务"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={640}
      destroyOnClose
      okText="创建任务"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
        initialValues={{
          taskName: '',
          scopeType: 'location' as InventoryScopeType,
          locationIds: [],
          categoryIds: [],
          startDate: dayjs(),
          endDate: dayjs().add(7, 'day'),
          description: '',
        }}
      >
        {/* 任务名称 */}
        <Form.Item
          name="taskName"
          label="任务名称"
          rules={[{ required: true, message: '请输入任务名称' }]}
        >
          <Input placeholder="例如：Q3 年度 IT 设备盘点" maxLength={100} showCount />
        </Form.Item>

        {/* 盘点范围类型 — ATB-02: Radio 切换断言 */}
        <Form.Item name="scopeType" label="盘点范围" rules={[{ required: true }]}>
          <Radio.Group onChange={handleScopeTypeChange}>
            <Radio value="location">按位置树</Radio>
            <Radio value="category">按分类</Radio>
          </Radio.Group>
        </Form.Item>

        {/* 按位置树选择 — ATB-02: 切换后断言 TreeSelect 渲染 */}
        {scopeType === 'location' && (
          <Form.Item
            name="locationIds"
            label="选择位置"
            rules={[{ required: true, message: '请至少选择一个位置' }]}
          >
            <TreeSelect
              treeData={locationTreeData}
              placeholder="请选择盘点位置（可多选）"
              treeCheckable
              allowClear
              showCheckedStrategy={TreeSelect.SHOW_PARENT}
              style={{ width: '100%' }}
              maxTagCount="responsive"
              treeNodeFilterProp="title"
            />
          </Form.Item>
        )}

        {/* 按分类选择 */}
        {scopeType === 'category' && (
          <Form.Item
            name="categoryIds"
            label="选择分类"
            rules={[{ required: true, message: '请至少选择一个资产分类' }]}
          >
            <TreeSelect
              treeData={categoryTreeData}
              placeholder="请选择资产分类（可多选）"
              treeCheckable
              allowClear
              showCheckedStrategy={TreeSelect.SHOW_PARENT}
              style={{ width: '100%' }}
              maxTagCount="responsive"
              treeNodeFilterProp="title"
            />
          </Form.Item>
        )}

        {/* 日期范围 */}
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            name="startDate"
            label="开始日期"
            style={{ flex: 1 }}
            rules={[{ required: true, message: '请选择开始日期' }]}
          >
            <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="endDate"
            label="结束日期"
            style={{ flex: 1 }}
            rules={[
              { required: true, message: '请选择结束日期' },
              {
                validator: (_: unknown, value: Dayjs) => {
                  const startDate: Dayjs | undefined = form.getFieldValue('startDate');
                  if (value && startDate && value.isBefore(startDate, 'day')) {
                    return Promise.reject(new Error('结束日期必须晚于开始日期'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} />
          </Form.Item>
        </div>

        {/* 备注 */}
        <Form.Item name="description" label="备注说明">
          <Input.TextArea
            rows={3}
            placeholder="可选：填写任务说明或备注信息…"
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateTaskModal;