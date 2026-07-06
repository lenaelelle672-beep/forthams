const assetLocale = {
  /** 模块标题 */
  title: '资产管理',
  pageTitle: '资产列表',

  /** 统计卡片 */
  stats: {
    totalAssets: '资产总量',
    inUse: '在用',
    idle: '闲置',
    maintenance: '维修中',
    pendingRetirement: '待退役',
    retired: '已退役',
    scrapped: '已报废',
  },

  /** 资产状态 */
  statusOptions: {
    IN_USE: '在用',
    IDLE: '闲置',
    MAINTENANCE: '维修中',
    PENDING_RETIREMENT: '待退役',
    RETIRED: '已退役',
    SCRAPPED: '已报废',
    CLEARED: '已清退',
  },

  /** 表格列 */
  columns: {
    assetNo: '编号',
    assetCode: '资产编号',
    assetName: '资产名称',
    category: '分类',
    status: '状态',
    location: '存放位置',
    department: '使用部门',
    custodian: '保管人',
    userName: '使用人',
    brandModel: '品牌/型号',
    purchaseDate: '购置日期',
    originalValue: '原值',
    netValue: '净值',
    actions: '操作',
  },

  /** 操作按钮 */
  actions: {
    create: '新增资产',
    import: '导入',
    export: '导出',
    view: '查看',
    edit: '编辑',
    delete: '删除',
    assign: '分配',
    dispose: '处置',
  },

  /** 提示消息 */
  messages: {
    createSuccess: '资产创建成功',
    updateSuccess: '资产更新成功',
    deleteSuccess: '资产已删除',
    deleteConfirm: '确定要删除该资产吗？',
    loadFailed: '资产数据加载失败',
    exportSuccess: '导出成功',
    importSuccess: '导入成功',
    exporting: '导出中...',
    noDataToExport: '暂无数据可导出',
    exportedCount: '已导出 {{count}} 条资产',
    exportFailed: '导出失败，请重试',
  },

  /** 搜索 */
  search: {
    placeholder: '搜索资产编号/名称…',
    advanced: '高级筛选',
    keyword: '关键词',
    status: '状态',
    category: '分类',
    department: '部门',
  },

  /** 列表页 */
  list: {
    title: '资产台账',
    subtitle: '资产台账管理',
    filterTitle: '资产列表',
    totalCount: '共 {total} 条资产',
    pageCount: '本页 {count} 条',
    filterActive: '{count} 项筛选',
    noData: '暂无资产数据，点击「新建资产」开始录入',
    importExport: '导入/导出',
    exportAll: '导出全部',
    exportPDF: '导出 PDF',
    exportCSV: '导出 CSV',
    creating: '新建资产',
    statusAll: '全部',
    searchPlaceholder: '搜索编号、名称...',
    categoryAll: '所有分类',
    deptAll: '所属部门',
    importantLabel: '重要设备',
    reset: '重置',
    refreshing: '刷新中',
    statNetValue: '资产总净值',
    statMaintenance: '待处理维修',
    statIdleRate: '闲置率',
    statDepreciation: '累计折旧',
  },

  /** 详情页 */
  detail: {
    title: '资产详情',
    deleteSuccess: '资产删除成功',
    deleteFailed: '删除失败',
    deleteConfirm: '确认删除',
    deleteConfirmMessage: '确定要删除此资产吗？此操作不可撤销。',
    deleteError: '删除失败，请重试',
    sections: {
      basic: '基本信息',
      depreciation: '折旧信息',
      location: '位置信息',
      financial: '财务信息',
      relation: '关联资产',
      attachments: '附件',
      timeline: '变更记录',
      comments: '评论',
      audit: '审计日志',
      tco: '全生命周期成本',
    },
    buttons: {
      edit: '编辑',
      delete: '删除',
      back: '返回',
    },
    fields: {
      assetNo: '资产编号',
      assetName: '资产名称',
      category: '分类',
      status: '状态',
      location: '位置',
      department: '使用部门',
      custodian: '保管人',
      purchaseDate: '购置日期',
      originalValue: '原值',
      netValue: '净值',
      brand: '品牌',
      model: '型号',
      serialNo: '序列号',
      supplier: '供应商',
      description: '描述',
      remark: '备注',
      rfidTag: 'RFID 标签',
    },
  },

  /** 表单页 */
  form: {
    title: '资产表单',
    createTitle: '新建资产',
    editTitle: '编辑资产',
    sections: {
      basic: '基本信息',
      location: '位置归属',
      financial: '财务信息',
      relation: '关联资产',
      attachment: '附件',
    },
    fields: {
      assetName: '资产名称',
      assetNo: '资产编号',
      categoryId: '资产分类',
      status: '状态',
      brand: '品牌',
      model: '型号',
      serialNo: '序列号',
      supplier: '供应商',
      originalValue: '原值',
      currentValue: '当前净值',
      purchaseDate: '购置日期',
      warrantyPeriod: '保修期（月）',
      depreciationRate: '折旧率',
      deptId: '使用部门',
      location: '存放位置',
      locationLat: '纬度',
      locationLng: '经度',
      rfidTag: 'RFID 标签',
      isImportant: '重要设备',
      description: '描述',
      remark: '备注',
    },
    messages: {
      createSuccess: '资产创建成功',
      updateSuccess: '资产更新成功',
      createFailed: '创建失败，请重试',
      updateFailed: '更新失败，请重试',
      loadFailed: '加载资产数据失败',
    },
    actions: {
      save: '保存',
      cancel: '取消',
    },
  },

  /** 仪表盘 */
  dashboard: {
    title: '资产仪表盘',
    distribution: '资产分布',
    trend: '资产趋势',
    healthScore: '健康度',
  },
};

export default assetLocale;
