const inventoryLocale = {
  /** 模块标题 */
  title: '盘点管理',
  pageTitle: '盘点任务',
  unnamedTask: '未命名任务',
  assetCountUnit: '项',

  module: {
    title: '资产盘点管理',
    breadcrumb: {
      root: '盘点管理',
      detail: '任务详情',
    },
  },

  /** 任务列表 */
  taskList: {
    title: '盘点任务',
    createTaskBtn: '新建任务',
    emptyState: '暂无盘点任务',
    columns: {
      taskName: '任务名称',
      scopeLabel: '盘点范围',
      status: '状态',
      createdAt: '创建时间',
      progress: '进度',
    },
    statusFilter: {
      all: '全部',
      draft: '草稿',
      inProgress: '进行中',
      completed: '已完成',
      submitted: '已提交',
    },
    statusBadge: {
      draft: '草稿',
      inProgress: '进行中',
      completed: '已完成',
      submitted: '已提交',
    },
    scopeTypeLabel: {
      location: '按位置',
      category: '按分类',
      all: '全部资产',
    },
  },

  scopeType: {
    all: '全部资产',
    location: '按位置',
    category: '按分类',
  },

  columns: {
    scopeType: '盘点范围',
    createdAt: '创建时间',
    actions: '操作',
  },

  statCards: {
    totalTasks: '任务总数',
    taskUnit: '个',
    avgProgress: '平均进度',
    countedAssets: '已盘资产',
    assetUnit: '项',
    deficitWarnings: '盘亏预警',
    deficitUnit: '项',
  },

  actions: {
    continueScan: '继续扫描',
    scan: '扫描',
    detail: '详情',
    edit: '编辑',
    summary: '决策摘要',
    trend: '进度趋势',
    filter: '筛选',
    reset: '重置',
    refresh: '刷新中',
    viewReport: '查看报告',
    focusInProgress: '聚焦进行中',
  },

  summary: {
    deficit: '盘亏 {{count}} 项',
    surplus: '盘盈 {{count}} 项',
    filterLabel: '状态：{{label}}',
    totalTasks: '共 {{count}} 个盘点任务',
    counted: '已盘',
    noDifference: '暂无盘盈盘亏差异',
    noReport: '暂无可生成报告的盘点任务',
    chartTitle: '任务进度趋势',
    chartRecent: '最近 {{count}} 个任务',
    chartEmpty: '暂无趋势数据',
    chartTooltip: '盘点进度',
  },

  /** 创建任务弹窗 */
  createTaskModal: {
    title: '新建盘点任务',
    form: {
      taskName: '任务名称',
      taskNamePlaceholder: '请输入任务名称（1-50字）',
      taskNameRequired: '请输入任务名称',
      scopeType: '盘点范围',
      scopeRequired: '请选择盘点范围',
    },
    scopeTabs: {
      byLocation: '按位置',
      byCategory: '按分类',
      allAssets: '全部资产',
    },
    allAssetsHint: '将对所有资产进行盘点',
    actions: {
      cancel: '取消',
      confirm: '确认',
    },
  },

  dialog: {
    createTitle: '新建盘点任务',
    createDescription: '配置盘点范围后，可立即进入 RFID 扫描或人工复核流程。',
    taskName: '任务名称',
    taskNamePlaceholder: '请输入盘点任务名称',
    scopeType: '盘点范围',
    selectScopeAll: '全部资产',
    selectScopeLocation: '按位置',
    selectScopeCategory: '按分类',
    scopeIds: '范围 ID',
    scopeIdsPlaceholder: '多个 ID 请用英文逗号分隔',
  },

  /** 进度概览 */
  progressSummary: {
    progressLabel: '盘点进度',
    progressFormat: '{percent}%',
    statsCards: {
      totalAssets: '总资产',
      countedAssets: '已盘点',
      uncountedAssets: '未盘点',
      surplusAssets: '盘盈',
      deficitAssets: '盘亏',
    },
  },

  /** 资产盘点明细表 */
  assetTable: {
    title: '资产明细',
    columns: {
      assetCode: '资产编号',
      assetName: '资产名称',
      bookStatus: '账面状态',
      actualStatus: '实际状态',
      remark: '备注',
      actions: '操作',
    },
    actions: {
      markCounted: '标记已盘点',
      markUncounted: '取消盘点',
      editRemark: '编辑备注',
    },
    statusBadge: {
      consistent: '一致',
      surplus: '盘盈',
      deficit: '盘亏',
    },
  },

  /** 提交盘点 */
  submit: {
    button: '提交盘点结果',
    confirmTitle: '确认提交',
    confirmMessage: '提交后盘点数据将进入审核流程，确定要提交吗？',
    success: '盘点结果已提交',
    failed: '提交失败，请重试',
  },

  /** 提示消息 */
  messages: {
    loadFailed: '加载盘点数据失败',
    saveFailed: '保存盘点数据失败',
    operationSuccess: '操作成功',
    confirmDelete: '确定要删除该任务吗？',
    deleteSuccess: '删除成功',
  },
};

export default inventoryLocale;
