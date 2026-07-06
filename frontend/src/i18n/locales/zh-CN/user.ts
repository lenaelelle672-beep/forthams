const userLocale = {
  /** 模块标题 */
  title: '用户管理',
  subtitle: '账号与权限管理',
  sectionTitle: '用户列表',

  /** 统计卡片 */
  stats: {
    totalUsers: '用户总量',
    roleCount: '角色数',
    postCount: '岗位数',
    totalPages: '总页数',
  },

  /** 表格列 */
  columns: {
    user: '用户',
    emailPhone: '邮箱/手机号',
    department: '部门',
    status: '状态',
    createTime: '创建时间',
    actions: '操作',
  },

  /** 状态选项 */
  statusNormal: '正常',
  statusDisabled: '停用',

  /** 操作按钮 */
  actions: {
    create: '新增用户',
    detail: '详情',
    edit: '编辑',
    resetPassword: '重置',
    delete: '删除',
    toggleStatus: '点击切换状态',
  },

  /** 提示消息 */
  messages: {
    createSuccess: '用户创建成功',
    updateSuccess: '用户更新成功',
    deleteSuccess: '用户已删除',
    deleteFailed: '删除失败',
    saveFailed: '保存失败',
    passwordReset: '密码已重置为 123456',
    passwordResetFailed: '重置密码失败',
    statusUpdated: '用户状态已更新',
    statusUpdateFailed: '状态更新失败',
    usernameRequired: '用户名不能为空',
    passwordRequired: '初始密码不能为空',
    noUsers: '暂无用户数据，可调整筛选或新建用户',
    noDetail: '未找到用户详情',
    loading: '加载中...',
    noRole: '暂无角色',
    noPost: '暂无岗位',
    deleteConfirmWithName: '确定要删除「{{name}}」吗？此操作不可撤销。',
  },

  /** 表单 */
  form: {
    username: '用户名',
    password: '初始密码',
    accountId: '账号 ID',
    realName: '真实姓名',
    email: '邮箱',
    phone: '手机号',
    department: '所属部门',
    role: '角色',
    post: '岗位',
    status: '状态',
    remark: '备注',
  },
  formPlaceholders: {
    username: '请输入用户名',
    password: '请输入密码',
    realName: '请输入真实姓名',
    email: '请输入邮箱',
    phone: '请输入手机号',
  },

  /** 分配 */
  assign: {
    title: '分配权限',
    roleLabel: '分配角色',
    postLabel: '分配岗位',
  },

  /** 对话框标题 */
  dialog: {
    createUser: '新增用户',
    editUser: '编辑用户',
    userDetail: '用户详情',
    deleteConfirmTitle: '确认删除用户',
  },

  /** 按钮文字 */
  button: {
    saveUpdate: '保存修改',
    confirmCreate: '确认新增',
    confirmDelete: '确认删除',
  },

  /** 用户详情字段标签 */
  detail: {
    username: '用户名',
    realName: '真实姓名',
    email: '邮箱',
    phone: '手机号',
    dept: '所属部门',
    status: '状态',
    loginIp: '最后登录 IP',
    loginDate: '最后登录时间',
    createTime: '创建时间',
    updateTime: '更新时间',
    remark: '备注',
  },

  /** 详情区域标题 */
  detailSection: {
    role: '角色',
    postId: '岗位 ID',
  },

  /** 筛选相关 */
  filter: {
    allDept: '全部部门',
    searching: '筛选中',
    totalUsers: '共 {{total}} 条用户',
    pageUsers: '本页 {{count}} 条',
    statusColon: '状态',
    searchColon: '搜索',
    searchPlaceholder: '搜索用户名、姓名、邮箱或手机号',
  },

  /** 未分配 */
  unassigned: '未分配',

  /** 部门管理 */
  dept: {
    title: '部门管理',
    list: '部门列表',
    tree: '部门树',
    columns: {
      deptName: '部门名称',
      orderNum: '排序',
      status: '状态',
      createTime: '创建时间',
      actions: '操作',
    },
    actions: {
      create: '新增部门',
      edit: '编辑部门',
      delete: '删除部门',
    },
    messages: {
      createSuccess: '部门创建成功',
      updateSuccess: '部门更新成功',
      deleteSuccess: '部门已删除',
      deleteFailed: '删除失败',
      loadFailed: '加载部门数据失败',
    },
  },

  /** 角色管理 */
  role: {
    title: '角色管理',
    list: '角色列表',
    columns: {
      roleName: '角色名称',
      roleCode: '角色编码',
      status: '状态',
      createTime: '创建时间',
      actions: '操作',
    },
    actions: {
      create: '新增角色',
      edit: '编辑角色',
      delete: '删除角色',
    },
    messages: {
      createSuccess: '角色创建成功',
      updateSuccess: '角色更新成功',
      deleteSuccess: '角色已删除',
      deleteFailed: '删除失败',
      loadFailed: '加载角色数据失败',
    },
  },
};

export default userLocale;
