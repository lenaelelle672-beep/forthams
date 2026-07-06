/**
 * 系统管理模块 — 中文（简体）国际化文案
 *
 * 本文件集中定义系统管理模块（用户管理、部门管理、角色管理等）前端面向用户的文本。
 * 键名按功能区域组织，覆盖用户、部门、角色等管理场景。
 */
const systemLocale = {
  /** 模块标题 */
  title: '系统管理',
  pageTitle: '系统设置',

  /** 用户管理 */
  user: {
    title: '用户管理',
    subtitle: '共 {total} 个用户',
    columns: {
      userId: '用户编号',
      username: '用户名',
      realName: '真实姓名',
      email: '邮箱',
      phone: '手机号',
      role: '角色',
      dept: '部门',
      status: '状态',
      createTime: '创建时间',
      actions: '操作',
    },
    statusOptions: {
      ACTIVE: '正常',
      DISABLED: '已禁用',
    },
    actions: {
      create: '新增用户',
      edit: '编辑',
      delete: '删除',
      resetPassword: '重置密码',
      assignRole: '分配角色',
    },
    messages: {
      createSuccess: '用户创建成功',
      updateSuccess: '用户更新成功',
      deleteSuccess: '用户删除成功',
      deleteConfirm: '确定要删除该用户吗？',
      resetPasswordSuccess: '密码已重置',
      loadFailed: '加载用户数据失败',
    },
    search: {
      placeholder: '搜索用户名、姓名…',
      username: '用户名',
      realName: '真实姓名',
      status: '状态',
    },
    form: {
      username: '用户名',
      usernamePlaceholder: '请输入用户名',
      realName: '真实姓名',
      realNamePlaceholder: '请输入真实姓名',
      password: '密码',
      passwordPlaceholder: '请输入密码',
      email: '邮箱',
      emailPlaceholder: '请输入邮箱地址',
      phone: '手机号',
      phonePlaceholder: '请输入手机号',
      role: '角色',
      rolePlaceholder: '请选择角色',
      dept: '部门',
      deptPlaceholder: '请选择部门',
    },
  },

  /** 部门管理 */
  dept: {
    title: '部门管理',
    columns: {
      deptName: '部门名称',
      parentDept: '上级部门',
      manager: '负责人',
      status: '状态',
      sortOrder: '排序',
      createTime: '创建时间',
      actions: '操作',
    },
    statusOptions: {
      ACTIVE: '正常',
      DISABLED: '已停用',
    },
    actions: {
      create: '新增部门',
      edit: '编辑',
      delete: '删除',
      addChild: '添加子部门',
    },
    messages: {
      createSuccess: '部门创建成功',
      updateSuccess: '部门更新成功',
      deleteSuccess: '部门删除成功',
      deleteConfirm: '确定要删除该部门吗？将同时删除所有子部门。',
      loadFailed: '加载部门数据失败',
    },
    form: {
      deptName: '部门名称',
      deptNamePlaceholder: '请输入部门名称',
      parentDept: '上级部门',
      parentDeptPlaceholder: '请选择上级部门',
      manager: '负责人',
      managerPlaceholder: '请选择负责人',
      sortOrder: '排序号',
      sortOrderPlaceholder: '请输入排序号',
    },
  },

  /** 角色管理 */
  role: {
    title: '角色管理',
    columns: {
      roleCode: '角色编码',
      roleName: '角色名称',
      description: '描述',
      status: '状态',
      userCount: '用户数',
      createTime: '创建时间',
      actions: '操作',
    },
    statusOptions: {
      ACTIVE: '正常',
      DISABLED: '已禁用',
    },
    actions: {
      create: '新增角色',
      edit: '编辑',
      delete: '删除',
      assignPermission: '分配权限',
    },
    messages: {
      createSuccess: '角色创建成功',
      updateSuccess: '角色更新成功',
      deleteSuccess: '角色删除成功',
      deleteConfirm: '确定要删除该角色吗？',
      loadFailed: '加载角色数据失败',
      permissionUpdateSuccess: '权限更新成功',
    },
    form: {
      roleCode: '角色编码',
      roleCodePlaceholder: '请输入角色编码',
      roleName: '角色名称',
      roleNamePlaceholder: '请输入角色名称',
      description: '描述',
      descriptionPlaceholder: '请输入角色描述',
    },
  },
};

export default systemLocale;
