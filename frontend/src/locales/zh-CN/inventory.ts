/**
 * 资产盘点管理模块 — 中文（简体）国际化文案
 *
 * 本文件集中定义盘点管理前端所有面向用户的文本，结构上支持 i18n 扩展。
 * 键名按功能区域组织，对应 SPEC SWARM-P3-010-FE 中 ATB-001 ~ ATB-009 涉及的全部文案。
 */
const inventoryLocale = {
  /** 模块级标题与面包屑 */
  module: {
    title: '资产盘点管理',
    breadcrumb: {
      root: '盘点管理',
      detail: '任务详情',
    },
  },

  /** P3-010-A：盘点任务列表页（左侧面板） */
  taskList: {
    title: '盘点任务',
    createTaskBtn: '新建盘点任务',
    emptyState: '暂无盘点任务',
    columns: {
      taskName: '任务名称',
      scopeLabel: '盘点范围',
      status: '状态',
      createdAt: '创建时间',
      progress: '进度',
    },
    /** 任务状态筛选下拉选项 — 对应 status 字段枚举值 */
    statusFilter: {
      all: '全部状态',
      draft: '草稿',
      inProgress: '进行中',
      completed: '已完成',
      submitted: '已提交',
    },
    /** 任务状态 Badge 文案 */
    statusBadge: {
      draft: '草稿',
      inProgress: '进行中',
      completed: '已完成',
      submitted: '已提交',
    },
    /** 盘点范围类型标签 */
    scopeTypeLabel: {
      location: '按位置',
      category: '按分类',
      all: '全部资产',
    },
    pagination: {
      pageSize: 20,
    },
  },

  /** P3-010-B：新建盘点任务弹窗 */
  createTaskModal: {
    title: '新建盘点任务',
    form: {
      taskName: '任务名称',
      taskNamePlaceholder: '请输入任务名称（1-50字符）',
      taskNameRequired: '请输入任务名称',
      scopeType: '盘点范围',
      scopeRequired: '请选择盘点范围',
    },
    /** 范围选择器 Tab 标签 */
    scopeTabs: {
      byLocation: '按位置树多选',
      byCategory: '按分类多选',
      allAssets: '全部资产',
    },
    /** 选中"全部资产"时的提示文案 */
    allAssetsHint: '将对所有资产进行盘点',
    locationTreePlaceholder: '请选择位置节点',
    categoryTreePlaceholder: '请选择分类节点',
    selectedListTitle: '已选范围',
    selectedListEmpty: '暂未选择',
    /** 弹窗底部按钮 */
    actions: {
      cancel: '取消',
      confirm: '确定',
    },
  },

  /** P3-010-C：盘点执行详情页 — 进度条 + 统计摘要 */
  progressSummary: {
    progressLabel: '盘点进度',
    progressFormat: '{percent}%',
    statsCards: {
      totalAssets: '总资产',
      countedAssets: '已盘',
      uncountedAssets: '未盘',
      surplusAssets: '盘盈',
      deficitAssets: '盘亏',
    },
  },

  /** P3-010-D：盘点执行详情页 — 资产清单表格 */
  assetTable: {
    title: '资产清单',
    columns: {
      assetCode: '资产编号',
      assetName: '资产名称',
      bookStatus: '账面状态',
      actualStatus: '实盘状态',
      remark: '备注',
      actions: '操作',
    },
    /** 实盘状态下拉选项 — 对应 actualStatus 枚举值 */
    actualStatusOptions: {
      normal: '正常',
      surplus: '盘盈',
      deficit: '盘亏',
      damaged: '损坏',
      other: '其他',
    },
    actualStatusPlaceholder: '请选择实盘状态',
    remarkPlaceholder: '请输入备注（0-200字符）',
    /** 逐条确认按钮 */
    confirmBtn: '确认',
    /** 批量操作栏 */
    batchToolbar: {
      selectedCount: '已选 {count} 项',
      batchConfirmBtn: '批量确认',
    },
    /** 批量确认上限提示 */
    batchLimitWarning: '单次批量确认上限为 100 条，已自动截断',
  },

  /** 批量确认弹窗 */
  batchConfirmDialog: {
    title: '批量确认',
    actualStatusLabel: '统一实盘状态',
    actualStatusRequired: '请选择实盘状态',
    remarkLabel: '统一备注',
    remarkPlaceholder: '请输入统一备注（可选）',
    actions: {
      cancel: '取消',
      confirm: '确认',
    },
  },

  /** P3-010-E：盘盈盘亏汇总面板 */
  differencePanel: {
    title: '盘盈盘亏汇总',
    tabs: {
      surplus: '盘盈明细',
      deficit: '盘亏明细',
    },
    /** 差异明细列表列标题 */
    columns: {
      assetCode: '资产编号',
      assetName: '资产名称',
      reason: '{type}原因',
      reasonSurplus: '盘盈原因',
      reasonDeficit: '盘亏原因',
    },
    /** 无差异时的提示 */
    noDifference: '无差异',
    /** 提交核准按钮 */
    submitApprovalBtn: '提交核准',
  },

  /** 提交核准二次确认弹窗 */
  submitApprovalDialog: {
    title: '提交核准',
    message: '确认提交核准？提交后不可修改。',
    actions: {
      cancel: '取消',
      confirm: '确认提交',
    },
  },

  /** P3-010-C/D：只读模式相关提示 */
  readOnly: {
    draftHint: '请先将任务状态变更为进行中',
  },

  /** 通用操作反馈消息 */
  messages: {
    createSuccess: '盘点任务创建成功',
    confirmSuccess: '资产确认成功',
    batchConfirmSuccess: '批量确认成功',
    submitSuccess: '盘点结果已提交核准',
    loadFailed: '数据加载失败，请重试',
    createFailed: '创建盘点任务失败',
    confirmFailed: '确认操作失败',
    batchConfirmFailed: '批量确认操作失败',
    submitFailed: '提交核准失败',
    noPermission: '您没有权限执行此操作',
    deleteConfirm: '确定要删除该任务吗？此操作不可撤销。',
    loading: '加载中…',
  },
};

export default inventoryLocale;