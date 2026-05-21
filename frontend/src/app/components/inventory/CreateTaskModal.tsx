import React, { useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Radio,
  Divider,
  Typography,
  TreeSelect,
  Spin,
} from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

const { Text } = Typography;
const { TextArea } = Input;

/**
 * 树节点数据结构，供位置树 / 分类树使用
 */
export interface TreeNodeData {
  /** 节点显示文本 */
  title: string;
  /** 节点值（对应位置 ID 或分类 ID） */
  value: string;
  /** 节点唯一标识 */
  key: string;
  /** 子节点列表 */
  children?: TreeNodeData[];
}

/**
 * 盘点任务创建表单值类型定义
 *
 * 对应 SPEC: [SWARM-P3-010-FE] 创建盘点任务表单字段
 */
export interface CreateTaskFormValues {
  /** 任务名称 */
  name: string;
  /** 任务类型: annual-年度盘点 | spot_check-定期抽检 | special-临时专项 */
  type: 'annual' | 'spot_check' | 'special';
  /** 盘点范围维度: location-按位置 | category-按资产分类 */
  scopeType: 'location' | 'category';
  /** 盘点范围节点 ID 列表（位置 ID 或分类 ID，由 scopeType 决定语义） */
  scopeIds: string[];
  /** 盘点开始日期 */
  startDate: Dayjs;
  /** 盘点结束日期 */
  endDate: Dayjs;
  /** 负责人 ID */
  responsiblePersonId?: string;
  /** 备注说明 */
  description?: string;
}

/**
 * CreateTaskModal 组件属性定义
 */
export interface CreateTaskModalProps {
  /** 控制弹窗显示 / 隐藏 */
  open: boolean;
  /** 取消 / 关闭回调 */
  onCancel: () => void;
  /** 表单提交回调，由父组件负责序列化并发起 API 请求 */
  onSubmit: (values: CreateTaskFormValues) => Promise<void>;
  /** 提交按钮加载状态 */
  loading?: boolean;
  /** 位置树数据，供 TreeSelect 渲染 */
  locationTreeData?: TreeNodeData[];
  /** 分类树数据，供 TreeSelect 渲染 */
  categoryTreeData?: TreeNodeData[];
  /** 树数据加载中状态 */
  treeLoading?: boolean;
}

/**
 * 盘点范围选择器 — 位置树 / 分类树多选组件
 *
 * 根据 SPEC 组件化约束要求封装为独立高复用性组件：
 * 内部状态高内聚，对外暴露标准 onChange 事件。
 *
 * 注：生产环境中建议抽离至独立文件
 * `@/components/inventory/InventoryScopeSelector.tsx` 以实现跨页面复用。
 *
 * @param mode     - 'location' 按位置选择 | 'category' 按资产分类选择
 * @param value    - 当前已选中的节点 ID 数组（受控模式）
 * @param onChange - 选中值变更回调
 * @param treeData - 树形数据源
 * @param loading  - 数据加载中状态
 */
const InventoryScopeSelector: React.FC<{
  mode: 'location' | 'category';
  value?: string[];
  onChange?: (values: string[]) => void;
  treeData?: TreeNodeData[];
  loading?: boolean;
}> = React.memo(({ mode, value, onChange, treeData = [], loading = false }) => {
  /**
   * 处理 TreeSelect 选中值变更，统一输出 string[] 格式
   */
  const handleChange = useCallback(
    (selectedValues: string[]) => {
      onChange?.(selectedValues);
    },
    [onChange],
  );

  /** 数据加载中时展示 Spin 占位 */
  if (loading) {
    return (
      <div style={{ padding: '8px 0', textAlign: 'center' }}>
        <Spin size="small" />
      </div>
    );
  }

  return (
    <TreeSelect
      style={{ width: '100%' }}
      treeData={treeData}
      placeholder={
        mode === 'location'
          ? '请选择位置范围（可多选）'
          : '请选择资产分类（可多选）'
      }
      multiple
      allowClear
      value={value}
      onChange={handleChange}
      showSearch
      treeCheckable
      treeCheckStrictly={false}
      showCheckedStrategy={TreeSelect.SHOW_CHILD}
      filterTreeNode={(input, node) =>
        String(node.title ?? '')
          .toLowerCase()
          .includes(input.toLowerCase())
      }
      maxTagCount={5}
      maxTagPlaceholder={(omitted) => `+${omitted.length} 项`}
    />
  );
});

InventoryScopeSelector.displayName = 'InventoryScopeSelector';

/**
 * 新建盘点任务弹窗组件
 *
 * 对应 SPEC: [SWARM-P3-010-FE] Phase 3 — 任务列表与创建
 * 对应 ATB-02: 新建盘点任务弹窗与范围选择
 *
 * 功能：
 * - 表单字段：任务名称、任务类型、盘点范围（位置树 / 分类树）、时间范围、负责人、备注
 * - 表单校验：必填项校验 + 日期范围合法性校验
 * - 盘点范围支持 Radio 切换位置树 / 分类树，并渲染对应的 TreeSelect
 * - 提交后调用父组件 onSubmit 回调，由父组件负责 API 交互
 *
 * @param props - CreateTaskModalProps
 */
export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  open,
  onCancel,
  onSubmit,
  loading = false,
  locationTreeData = [],
  categoryTreeData = [],
  treeLoading = false,
}) => {
  const [form] = Form.useForm<CreateTaskFormValues>();

  /** 监听 scopeType 字段变化，动态切换范围选择器模式 */
  const scopeType = Form.useWatch('scopeType', form) as
    | 'location'
    | 'category'
    | undefined;

  /** 根据当前 scopeType 获取对应的树数据 */
  const currentTreeData = useMemo(() => {
    return scopeType === 'category' ? categoryTreeData : locationTreeData;
  }, [scopeType, locationTreeData, categoryTreeData]);

  /** 弹窗打开时重置表单到初始状态 */
  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  /**
   * 盘点维度切换时清空已选范围，
   * 避免切换维度后残留上一维度的选中节点
   */
  const handleScopeTypeChange = useCallback(
    (_value: 'location' | 'category') => {
      form.setFieldValue('scopeIds', []);
    },
    [form],
  );

  /**
   * 处理表单提交：
   * 1. 触发 Ant Design 表单校验
   * 2. 自定义日期范围合法性校验
   * 3. 调用父组件 onSubmit 回调
   */
  const handleOk = async () => {
    try {
      const values = await form.validateFields();

      /** 自定义日期范围校验：结束日期不得早于开始日期 */
      if (
        values.startDate &&
        values.endDate &&
        values.endDate.isBefore(values.startDate)
      ) {
        form.setFields([
          {
            name: 'endDate',
            errors: ['结束日期不能早于开始日期'],
          },
        ]);
        return;
      }

      await onSubmit(values);
    } catch (error: unknown) {
      /**
       * Ant Design form.validateFields 校验失败会抛出包含 errorFields 的错误，
       * 此时表单已自动展示错误信息，无需额外处理。
       * 仅对非表单校验异常打印日志。
       */
      if (
        error &&
        typeof error === 'object' &&
        !('errorFields' in error)
      ) {
        console.error('[CreateTaskModal] 提交异常:', error);
      }
    }
  };

  return (
    <Modal
      title="新建盘点任务"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={680}
      destroyOnClose
      okText="创建任务"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          type: 'annual',
          scopeType: 'location',
          startDate: dayjs(),
          endDate: dayjs().add(7, 'day'),
          scopeIds: [],
        }}
      >
        {/* ── 任务名称 ── */}
        <Form.Item
          name="name"
          label="任务名称"
          rules={[
            { required: true, message: '请输入盘点任务名称' },
            { max: 100, message: '任务名称不能超过 100 个字符' },
          ]}
        >
          <Input
            placeholder="例如：2024年第一季度资产年度大盘点"
            maxLength={100}
            showCount
          />
        </Form.Item>

        {/* ── 任务类型 + 负责人 ── */}
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            name="type"
            label="任务类型"
            style={{ flex: 1 }}
            rules={[{ required: true, message: '请选择任务类型' }]}
          >
            <Select
              options={[
                { label: '年度盘点', value: 'annual' },
                { label: '定期抽检', value: 'spot_check' },
                { label: '临时专项盘点', value: 'special' },
              ]}
              placeholder="请选择任务类型"
            />
          </Form.Item>

          <Form.Item
            name="responsiblePersonId"
            label="负责人"
            style={{ flex: 1 }}
          >
            <Select
              placeholder="请选择执行负责人"
              showSearch
              allowClear
              options={[]}
              filterOption={(input, option) =>
                (option?.label as string)
                  ?.toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </div>

        <Divider
          orientation="left"
          plain
          style={{ fontSize: 14, color: '#8c8c8c', margin: '8px 0 16px' }}
        >
          盘点范围配置
        </Divider>

        {/* ── 盘点维度 Radio 选择 ── */}
        <Form.Item
          name="scopeType"
          label="盘点维度"
          rules={[{ required: true, message: '请选择盘点维度' }]}
        >
          <Radio.Group onChange={(e) => handleScopeTypeChange(e.target.value)}>
            <Radio value="location">按位置范围</Radio>
            <Radio value="category">按资产分类</Radio>
          </Radio.Group>
        </Form.Item>

        {/* ── 盘点范围 TreeSelect ── */}
        <Form.Item
          name="scopeIds"
          label={scopeType === 'category' ? '选择资产分类' : '选择位置范围'}
          rules={[
            {
              required: true,
              validator: (_rule: unknown, value: string[]) => {
                if (!value || value.length === 0) {
                  return Promise.reject(
                    new Error('请至少选择一个盘点范围节点'),
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <InventoryScopeSelector
            mode={scopeType ?? 'location'}
            treeData={currentTreeData}
            loading={treeLoading}
          />
        </Form.Item>

        {/* ── 盘点时间范围 ── */}
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            name="startDate"
            label="开始日期"
            style={{ flex: 1 }}
            rules={[{ required: true, message: '请选择盘点开始日期' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              disabledDate={(current: Dayjs) =>
                current && current < dayjs().startOf('day')
              }
            />
          </Form.Item>

          <Form.Item
            name="endDate"
            label="结束日期"
            style={{ flex: 1 }}
            rules={[{ required: true, message: '请选择盘点结束日期' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              disabledDate={(current: Dayjs) =>
                current && current < dayjs().startOf('day')
              }
            />
          </Form.Item>
        </div>

        {/* ── 备注说明 ── */}
        <Form.Item name="description" label="备注说明">
          <TextArea
            rows={3}
            placeholder="请输入任务详细描述或注意事项..."
            allowClear
            maxLength={500}
            showCount
          />
        </Form.Item>

        {/* ── 底部提示 ── */}
        <div
          style={{
            marginTop: 16,
            padding: '8px 12px',
            background: '#ffffff',
            borderRadius: 6,
            border: '1px solid #f0f0f0',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            💡 提示：创建任务后，系统将根据所选范围自动生成待盘点资产清单。任务创建成功后可在任务列表中查看和执行。
          </Text>
        </div>
      </Form>
    </Modal>
  );
};

export default CreateTaskModal;