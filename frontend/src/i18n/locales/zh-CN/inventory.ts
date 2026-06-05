const inventoryLocale = {
  /** 模块标题 */
  title: '盘点管理',
  pageTitle: '盘点任务',

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
