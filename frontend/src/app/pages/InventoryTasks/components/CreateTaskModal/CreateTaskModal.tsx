/**
 * CreateTaskModal — 新建盘点任务弹窗组件
 *
 * 提供盘点任务的创建表单，支持选择盘点范围（按位置树 / 按分类树 / 全部资产），
 * 设置任务名称、起止时间和任务说明。提交时调用后端 API 创建任务。
 *
 * @module InventoryTasks/CreateTaskModal
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  DatePicker,
  Form,
  Input,
  message,
  Modal,
  Radio,
  TreeSelect,
} from 'antd';
import type { DefaultOptionType } from 'antd/es/select';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/** 盘点范围类型 */
export type InventoryScopeType = 'location' | 'category' | 'all';

/** 新建盘点任务表单值 */
export interface ICreateTaskFormValues {
  /** 任务名称 */
  taskName: string;
  /** 盘点范围类型 */
  scopeType: InventoryScopeType;
  /** 盘点范围 ID 列表（位置 ID 或分类 ID） */
  scopeIds?: string[];
  /** 盘点开始时间 */
  startDate: Dayjs;
  /** 盘点截止时间 */
  endDate: Dayjs;
  /** 任务说明 */
  description?: string;
}

/** 创建任务 API 提交载荷 */
export interface ICreateTaskPayload {
  /** 任务名称 */
  taskName: string;
  /** 盘点范围类型 */
  scopeType: InventoryScopeType;
  /** 盘点范围 ID 列表 */
  scopeIds: string[];
  /** 盘点开始时间（ISO 8601） */
  startDate: string;
  /** 盘点截止时间（ISO 8601） */
  endDate: string;
  /** 任务说明 */
  description: string;
}

/** 创建任务成功后返回的任务对象 */
export interface ICreatedTask extends ICreateTaskPayload {
  /** 后端返回的任务 ID */
  id: string;
}

/** CreateTaskModal 组件属性 */
export interface CreateTaskModalProps {
  /** 是否显示弹窗 */
  open: boolean;
  /** 关闭弹窗回调 */
  onCancel: () => void;
  /** 创建成功回调，接收后端返回的任务对象 */
  onSuccess?: (task: ICreatedTask) => void;
  /** 外部 loading 状态（由父组件控制时使用） */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Tree data — 位置树 / 分类树
// 在生产环境中应通过 API 获取，此处为默认静态数据
// ---------------------------------------------------------------------------

/** 位置树节点类型 */
interface TreeNodeData {
  title: string;
  value: string;
  key: string;
  children?: TreeNodeData[];
}

/** 按位置/部门组织的树形数据 */
const LOCATION_TREE_DATA: TreeNodeData[] = [
  {
    title: '总部大楼',
    value: 'hq',
    key: 'hq',
    children: [
      { title: '研发中心', value: 'rd', key: 'rd' },
      { title: '行政办公区', value: 'admin', key: 'admin' },
      { title: '财务部', value: 'finance', key: 'finance' },
    ],
  },
  {
    title: '上海分公司',
    value: 'shanghai',
    key: 'shanghai',
    children: [
      { title: '研发一部', value: 'sh_rd_1', key: 'sh_rd_1' },
      { title: '市场部', value: 'sh_market', key: 'sh_market' },
    ],
  },
  {
    title: '北京办公室',
    value: 'beijing',
    key: 'beijing',
  },
];

/** 按资产分类组织的树形数据 */
const CATEGORY_TREE_DATA: TreeNodeData[] = [
  {
    title: '电子设备',
    value: 'electronics',
    key: 'electronics',
    children: [
      { title: '笔记本电脑', value: 'laptop', key: 'laptop' },
      { title: '台式电脑', value: 'desktop', key: 'desktop' },
      { title: '服务器', value: 'server', key: 'server' },
      { title: '网络设备', value: 'network', key: 'network' },
    ],
  },
  {
    title: '办公家具',
    value: 'furniture',
    key: 'furniture',
    children: [
      { title: '办公桌', value: 'desk', key: 'desk' },
      { title: '办公椅', value: 'chair', key: 'chair' },
      { title: '文件柜', value: 'cabinet', key: 'cabinet' },
    ],
  },
  {
    title: '交通工具',
    value: 'vehicle',
    key: 'vehicle',
  },
];

// ---------------------------------------------------------------------------
// API 调用函数
// 在生产环境中应从 inventoryService 模块导入
// ---------------------------------------------------------------------------

/**
 * 调用后端 POST /api/inventory/tasks 接口创建盘点任务。
 *
 * @param payload - 创建任务的请求载荷
 * @returns 后端返回的任务对象（含 id）
 * @throws 网络错误或后端业务异常
 */
const createInventoryTask = async (
  payload: ICreateTaskPayload,
): Promise<ICreatedTask> => {
  const response = await fetch('/api/inventory/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `创建盘点任务失败 (HTTP ${response.status}): ${errorBody}`,
    );
  }

  return response.json() as Promise<ICreatedTask>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * 新建盘点任务弹窗组件。
 *
 * 弹窗包含以下表单字段：
 * - **任务名称**（必填，最长 100 字符）
 * - **盘点范围**（单选 Radio：按位置树 / 按分类树 / 全部资产）
 * - **范围节点**（多选 TreeSelect，选择 "全部资产" 时隐藏）
 * - **起止时间**（必填，截止时间须晚于开始时间）
 * - **任务说明**（选填，最长 500 字符）
 *
 * 提交时校验表单 -> 构建 API 载荷 -> 调用后端接口 -> 成功后触发 `onSuccess` 回调并关闭弹窗。
 */
const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  open,
  onCancel,
  onSuccess,
  loading: externalLoading = false,
}) => {
  const [form] = Form.useForm<ICreateTaskFormValues>();
  const [submitting, setSubmitting] = useState<boolean>(false);

  /** 监听 scopeType 字段值，用于动态切换 TreeSelect 数据源与显示/隐藏 */
  const scopeType = Form.useWatch<InventoryScopeType>('scopeType', form);

  // ---- 弹窗打开时重置表单并填入默认值 ----
  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  /**
   * 根据当前 scopeType 返回对应的树形数据源。
   * - `'location'` → 位置树
   * - `'category'` → 分类树
   * - `'all'` → 空数组（无需选择具体节点）
   *
   * @returns 树形选择器的 data 数组
   */
  const getTreeData = useCallback((): DefaultOptionType[] => {
    switch (scopeType) {
      case 'location':
        return LOCATION_TREE_DATA as unknown as DefaultOptionType[];
      case 'category':
        return CATEGORY_TREE_DATA as unknown as DefaultOptionType[];
      default:
        return [];
    }
  }, [scopeType]);

  /** 是否处于提交中状态（外部或内部 loading 任一为 true） */
  const isSubmitting = externalLoading || submitting;

  /**
   * 处理表单校验与提交。
   *
   * 流程：
   * 1. 调用 `form.validateFields()` 触发前端校验
   * 2. 将表单值转换为 API 载荷格式（日期转 ISO 字符串）
   * 3. 调用 `createInventoryTask` 发起 POST 请求
   * 4. 成功后弹出提示、触发 `onSuccess` 回调、关闭弹窗
   * 5. 失败时区分表单校验错误（由 Ant Design 自动展示）和 API 错误（弹出错误提示）
   */
  const handleOk = async (): Promise<void> => {
    try {
      const values = await form.validateFields();

      setSubmitting(true);

      const payload: ICreateTaskPayload = {
        taskName: values.taskName,
        scopeType: values.scopeType,
        scopeIds:
          values.scopeType === 'all'
            ? []
            : (values.scopeIds ?? []),
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
        description: values.description ?? '',
      };

      const createdTask = await createInventoryTask(payload);

      message.success('盘点任务创建成功');
      onSuccess?.(createdTask);
      onCancel();
    } catch (error: unknown) {
      // Ant Design 表单校验失败 — errorFields 属性存在时为表单错误，组件已自动展示
      if (
        typeof error === 'object' &&
        error !== null &&
        'errorFields' in error
      ) {
        return;
      }
      // API 或未知错误
      console.error('[CreateTaskModal] 创建盘点任务失败:', error);
      message.error('创建盘点任务失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 处理弹窗取消/关闭。
   * 重置表单状态后调用外部 onCancel 回调。
   */
  const handleCancel = (): void => {
    form.resetFields();
    onCancel();
  };

  /**
   * 根据当前 scopeType 生成范围节点选择器的 label 文本。
   */
  const getScopeLabel = (): string => {
    if (scopeType === 'location') return '选择位置节点';
    if (scopeType === 'category') return '选择分类节点';
    return '选择范围';
  };

  /**
   * 根据当前 scopeType 生成范围节点选择器的 placeholder 文本。
   */
  const getScopePlaceholder = (): string => {
    if (scopeType === 'location') return '请选择需要盘点的位置/部门';
    if (scopeType === 'category') return '请选择需要盘点的资产分类';
    return '请选择范围';
  };

  return (
    <Modal
      title="新建盘点任务"
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      confirmLoading={isSubmitting}
      okText="创建任务"
      cancelText="取消"
      width={640}
      destroyOnClose
      maskClosable={false}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          scopeType: 'location' as InventoryScopeType,
          startDate: dayjs(),
          endDate: dayjs().add(7, 'day'),
        }}
        autoComplete="off"
        style={{ marginTop: 16 }}
      >
        {/* ---- 任务名称 ---- */}
        <Form.Item<ICreateTaskFormValues>
          name="taskName"
          label="任务名称"
          rules={[
            { required: true, message: '请输入盘点任务名称' },
            { max: 100, message: '任务名称不能超过 100 个字符' },
            { whitespace: true, message: '任务名称不能为空白' },
          ]}
        >
          <Input
            placeholder="例如：2024年Q3年度资产大盘点"
            maxLength={100}
            showCount
          />
        </Form.Item>

        {/* ---- 盘点范围类型（Radio 切换） ---- */}
        <Form.Item<ICreateTaskFormValues>
          name="scopeType"
          label="盘点范围"
          rules={[{ required: true, message: '请选择盘点范围类型' }]}
        >
          <Radio.Group>
            <Radio value="location">按位置树</Radio>
            <Radio value="category">按分类树</Radio>
            <Radio value="all">全部资产</Radio>
          </Radio.Group>
        </Form.Item>

        {/* ---- 盘点范围节点多选（scopeType !== 'all' 时显示） ---- */}
        {scopeType && scopeType !== 'all' && (
          <Form.Item<ICreateTaskFormValues>
            name="scopeIds"
            label={getScopeLabel()}
            rules={[
              {
                required: true,
                message: '请至少选择一个盘点范围节点',
              },
            ]}
          >
            <TreeSelect
              showSearch
              treeData={getTreeData()}
              placeholder={getScopePlaceholder()}
              multiple
              treeCheckable
              showCheckedStrategy={TreeSelect.SHOW_CHILD}
              allowClear
              style={{ width: '100%' }}
              treeNodeFilterProp="title"
              maxTagCount={5}
              maxTagPlaceholder={(omittedValues) =>
                `+${omittedValues.length} 个节点`
              }
            />
          </Form.Item>
        )}

        {/* ---- 起止时间 ---- */}
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item<ICreateTaskFormValues>
            name="startDate"
            label="开始时间"
            rules={[{ required: true, message: '请选择开始时间' }]}
            style={{ flex: 1 }}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              placeholder="选择开始日期"
            />
          </Form.Item>

          <Form.Item<ICreateTaskFormValues>
            name="endDate"
            label="截止时间"
            dependencies={['startDate']}
            rules={[
              { required: true, message: '请选择截止时间' },
              ({ getFieldValue }) => ({
                /** 校验截止时间必须晚于开始时间 */
                validator(_: unknown, value: Dayjs | undefined) {
                  const startDate: Dayjs | undefined =
                    getFieldValue('startDate');
                  if (!value || !startDate || value.isAfter(startDate)) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error('截止时间必须晚于开始时间'),
                  );
                },
              }),
            ]}
            style={{ flex: 1 }}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              placeholder="选择截止日期"
            />
          </Form.Item>
        </div>

        {/* ---- 任务说明 ---- */}
        <Form.Item<ICreateTaskFormValues>
          name="description"
          label="任务说明"
        >
          <Input.TextArea
            rows={3}
            placeholder="请输入本次盘点的注意事项或特殊要求..."
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateTaskModal;