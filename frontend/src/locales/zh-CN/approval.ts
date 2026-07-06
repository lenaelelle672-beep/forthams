/**
 * 审批管理模块 — 中文（简体）国际化文案
 *
 * 本文件集中定义审批管理前端所有面向用户的文本。
 * 键名按功能区域组织，覆盖列表、详情、操作等场景。
 */
const approvalLocale = {
  /** 模块标题 */
  title: '审批管理',
  pageTitle: '审批列表',
  detailTitle: '审批详情',

  /** 统计卡片 */
  stats: {
    pending: '待审批',
    approved: '已通过',
    rejected: '已拒绝',
    total: '总审批数',
    processTypes: '流程类型数',
  },

  /** 表格列 */
  columns: {
    title: '审批标题',
    type: '审批类型',
    applicant: '申请人',
    status: '状态',
    createdAt: '提交时间',
    completedAt: '完成时间',
    actions: '操作',
  },

  /** 状态选项 */
  statusOptions: {
    PENDING: '待审批',
    APPROVED: '已通过',
    REJECTED: '已拒绝',
    CANCELLED: '已撤销',
  },
  statusBadge: {
    PENDING: '待审批',
    APPROVED: '已通过',
    REJECTED: '已拒绝',
    CANCELLED: '已撤销',
  },

  /** 操作 */
  actions: {
    approve: '通过',
    reject: '拒绝',
    recall: '撤销',
    view: '查看',
    create: '新建审批',
  },

  /** 审批详情 */
  detail: {
    timeline: '审批时间线',
    approver: '审批人',
    comment: '审批意见',
    commentPlaceholder: '请输入审批意见…',
    decision: '审批结果',
    attachments: '附件',
  },

  /** 提示消息 */
  messages: {
    approveSuccess: '审批已通过',
    rejectSuccess: '已拒绝',
    recallSuccess: '已撤销',
    approveFailed: '审批操作失败',
    loadFailed: '加载审批数据失败',
    pendingCount: '待审批 {count} 项',
  },

  /** 流程类型 */
  processTypes: {
    PURCHASE: '采购审批',
    REPAIR: '维修审批',
    DISPOSAL: '处置审批',
    BORROW: '借出审批',
    OTHER: '其他审批',
  },

  /** 列表页 */
  list: {
    title: '审批列表',
    subtitle: '共 {total} 条审批',
    emptyText: '暂无审批数据',
    loading: '加载中...',
    searchPlaceholder: '搜索审批标题...',
    totalCount: '共 {total} 条',
  },

  /** 表单 */
  form: {
    sections: {
      basic: '基本信息',
      detail: '审批详情',
      history: '审批历史',
    },
  },
};

export default approvalLocale;
