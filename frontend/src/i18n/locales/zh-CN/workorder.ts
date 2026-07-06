const workorderLocale = {
  /** 模块标题 */
  title: '工单管理',
  pageTitle: '工单表单',

  /** 类型选项 */
  typeOptions: {
    PURCHASE: '采购',
    REPAIR: '维修',
    TRANSFER: '调拨',
    DISPOSAL: '处置',
    OTHER: '其他',
  },

  /** 优先级选项 */
  priorityOptions: {
    CRITICAL: '紧急',
    HIGH: '高',
    MEDIUM: '中',
    LOW: '低',
  },
  priorityDescriptions: {
    CRITICAL: '立即处理，影响关键业务',
    HIGH: '优先处理，可能影响业务',
    MEDIUM: '正常处理节奏',
    LOW: '有空时处理即可',
  },

  /** 表单标签 */
  form: {
    title: '工单标题',
    type: '工单类型',
    priority: '优先级',
    description: '工单描述',
    estimatedCost: '预估费用',
    dueDate: '截止日期',
    assignee: '负责人',
    asset: '关联资产',
    faultCode: '故障代码',
    collaborators: '协作者',
    attachments: '附件',
  },
  formPlaceholders: {
    title: '请输入工单标题',
    description: '请输入工单描述…',
    estimatedCost: '¥ 0.00',
    assignee: '请选择负责人',
    assetSearch: '搜索资产…',
  },
  validation: {
    titleMinLength: '标题至少 5 个字',
    titleRequired: '请输入工单标题',
    typeRequired: '请选择工单类型',
    priorityRequired: '请选择优先级',
  },

  /** 提交反馈 */
  messages: {
    createSuccess: '工单创建成功',
    updateSuccess: '工单更新成功',
    saveFailed: '保存工单失败',
    loadFailed: '加载工单数据失败',
    submitSuccess: '工单已提交',
  },

  /** 列表列定义 */
  columns: {
    workOrderNo: '工单号',
    title: '工单标题',
    priority: '优先级',
    status: '状态',
    reporterName: '申请人',
    deptName: '部门',
    createTime: '申请时间',
  },

  /** 状态映射 */
  statusOptions: {
    DRAFT: '草稿',
    PENDING: '待审批',
    APPROVED: '已通过',
    EXECUTING: '执行中',
    ON_HOLD: '挂起中',
    COMPLETED: '已完成',
    REJECTED: '已驳回',
    CANCELLED: '已取消',
  },

  /** SLA 状态 */
  slaStatus: {
    NORMAL: 'SLA 正常',
    WARNING: 'SLA 预警',
    BREACHED: 'SLA 超期',
  },

  /** 列表页 */
  list: {
    title: '工单管理',
    subtitle: '共 {total} 条工单',
    filterLabel: '过滤: {status}',
    exportTitle: '工单统计报表',
    exportCSV: '导出全部',
    exportPDF: '导出 PDF',
    exporting: '导出中...',
    create: '新建工单',
    searchPlaceholder: '搜索工单号、标题...',
    emptyText: '暂无工单记录',
    loading: '加载中...',
    totalResults: '当前筛选：共 {total} 条结果',
    totalCount: '共 {total} 条工单',
    noDataExport: '暂无数据可导出',
    exportSuccess: '已导出 {count} 条工单',
    exportFailed: '导出失败，请重试',
    slaAll: '全部 SLA',
    clearFilter: '清除筛选',
    csvHeaders: '工单号,标题,优先级,状态,申请人,部门,申请时间',
  },

  /** 附件 */
  attachment: {
    uploadLabel: '点击或拖拽上传附件',
    maxSize: '单个文件不超过 10MB',
    uploading: '上传中…',
  },

  /** 操作按钮 */
  actions: {
    submit: '提交工单',
    saveDraft: '保存草稿',
    cancel: '取消',
  },
};

export default workorderLocale;
