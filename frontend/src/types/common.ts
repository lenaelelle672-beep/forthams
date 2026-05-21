/**
 * @file types/common.ts
 * @description 全项目共享基础类型 — 唯一权威定义
 *
 * 规则：
 * - 所有其他模块的 PaginatedResponse / ApiResponse / Result 必须从这里导入
 * - 禁止在其他文件中重复定义这些泛型
 * - 与后端 Result<T> + Page<T>（MyBatis-Plus）格式严格对齐
 */

// ---------------------------------------------------------------------------
// 后端统一响应包装 — 对应 Result<T>
// ---------------------------------------------------------------------------

/**
 * 后端统一响应格式。
 * 所有接口返回 { code, message, data } 包装。
 * code=200 表示成功，其他值表示业务错误。
 */
export interface ApiResponse<T = unknown> {
  /** HTTP/业务状态码，200 表示成功 */
  code: number;
  /** 提示信息，成功时为 "操作成功" */
  message: string;
  /** 实际业务数据 */
  data: T;
}

// ---------------------------------------------------------------------------
// 分页响应 — 对应后端 MyBatis-Plus Page<T>
// ---------------------------------------------------------------------------

/**
 * MyBatis-Plus 分页数据结构（后端 Page<T> 的 data 字段）。
 * 字段名与后端 Page 序列化完全对齐：records / total / size / current。
 */
export interface PageData<T> {
  /** 当前页数据列表 */
  records: T[];
  /** 总记录数 */
  total: number;
  /** 每页条数 */
  size: number;
  /** 当前页码（从 1 开始） */
  current: number;
  /** 总页数 */
  pages?: number;
}

/**
 * 完整分页响应（ApiResponse 包装 PageData）。
 */
export type PaginatedResponse<T> = ApiResponse<PageData<T>>;

// ---------------------------------------------------------------------------
// 前端内部使用的标准化分页状态（解包后）
// ---------------------------------------------------------------------------

/**
 * 前端统一分页状态，由 hooks 解包后向组件暴露。
 * 字段使用更语义化的英文名。
 */
export interface PaginationState {
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 总记录数 */
  total: number;
  /** 总页数 */
  totalPages: number;
}

/**
 * 带分页状态的列表数据。
 */
export interface ListResult<T> {
  items: T[];
  pagination: PaginationState;
}

// ---------------------------------------------------------------------------
// 通用查询参数基类
// ---------------------------------------------------------------------------

/**
 * 所有列表查询参数的基类。
 * 模块内的 XxxListQuery 应 extends 此接口。
 */
export interface BaseListQuery {
  /** 当前页码（从 1 开始，默认 1） */
  page?: number;
  /** 每页条数（默认 20） */
  pageSize?: number;
  /** 关键词搜索 */
  keyword?: string;
  /** 排序字段 */
  sortBy?: string;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
}

// ---------------------------------------------------------------------------
// 通用实体基类
// ---------------------------------------------------------------------------

/**
 * 所有实体的公共字段基类。
 * 后端 BaseEntity 对应字段。
 */
export interface BaseEntity {
  /** 主键 ID（后端为 Long，前端用 number） */
  id: number;
  /** 创建人 ID */
  createBy?: number;
  /** 创建时间（ISO 8601） */
  createTime?: string;
  /** 更新时间（ISO 8601） */
  updateTime?: string;
  /** 逻辑删除标志（0=正常，1=删除） */
  deleted?: number;
  /** 租户 ID（多租户隔离） */
  tenantId?: number;
}

// ---------------------------------------------------------------------------
// 树形结构
// ---------------------------------------------------------------------------

/**
 * 通用树节点类型，适用于分类树、位置树等。
 */
export interface TreeNode<T = Record<string, unknown>> {
  /** 节点 ID */
  id: number | string;
  /** 节点名称 */
  name: string;
  /** 父节点 ID */
  parentId?: number | string | null;
  /** 子节点列表 */
  children?: TreeNode<T>[];
  /** 扩展字段 */
  extra?: T;
}

// ---------------------------------------------------------------------------
// 操作结果
// ---------------------------------------------------------------------------

/**
 * 通用操作结果（用于 create/update/delete 等无返回值操作）。
 */
export interface OperationResult {
  /** 是否成功 */
  success: boolean;
  /** 提示消息 */
  message?: string;
}

// ---------------------------------------------------------------------------
// 用户与认证
// ---------------------------------------------------------------------------

/**
 * 当前登录用户信息（JWT 解析后存储）。
 */
export interface CurrentUser {
  /** 用户 ID */
  id: number;
  /** 用户名 */
  username: string;
  /** 真实姓名 */
  realName?: string;
  /** 角色列表 */
  roles: UserRole[];
  /** 部门 ID */
  deptId?: number;
  /** 部门名称 */
  deptName?: string;
  /** 头像 URL */
  avatar?: string;
  /** Token 过期时间 */
  exp?: number;
}

/**
 * 用户角色枚举（与后端 Role 表 role_key 字段对应）。
 */
export enum UserRole {
  /** 超级管理员 */
  SUPER_ADMIN = 'SUPER_ADMIN',
  /** 资产管理员 */
  ASSET_MANAGER = 'ASSET_MANAGER',
  /** 部门负责人 */
  DEPARTMENT_MANAGER = 'DEPARTMENT_MANAGER',
  /** 普通员工 */
  EMPLOYEE = 'EMPLOYEE',
}

/**
 * 登录请求体。
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * 登录响应数据（ApiResponse<LoginResponse>）。
 */
export interface LoginResponse {
  /** JWT Token */
  token: string;
  /** Token 类型，固定 "Bearer" */
  tokenType: string;
  /** 用户信息 */
  userInfo: CurrentUser;
}

// ---------------------------------------------------------------------------
// 通知
// ---------------------------------------------------------------------------

/**
 * 系统通知消息。
 */
export interface Notification {
  id: number;
  /** 通知类型 */
  type: NotificationType;
  /** 通知标题 */
  title: string;
  /** 通知内容 */
  content: string;
  /** 是否已读 */
  isRead: boolean;
  /** 关联业务 ID（如工单 ID、资产 ID） */
  refId?: number;
  /** 关联业务类型 */
  refType?: string;
  /** 创建时间 */
  createTime: string;
}

export enum NotificationType {
  /** 待审批 */
  APPROVAL = 'APPROVAL',
  /** 维保提醒 */
  MAINTENANCE = 'MAINTENANCE',
  /** 盘点提醒 */
  INVENTORY = 'INVENTORY',
  /** 系统消息 */
  SYSTEM = 'SYSTEM',
}

// ---------------------------------------------------------------------------
// 文件上传
// ---------------------------------------------------------------------------

/**
 * 文件上传响应。
 */
export interface UploadResponse {
  /** 文件访问 URL */
  url: string;
  /** 文件名 */
  fileName: string;
  /** 文件大小（字节） */
  fileSize: number;
}

// ---------------------------------------------------------------------------
// 部门与位置（基础数据）
// ---------------------------------------------------------------------------

export interface Department {
  id: number;
  deptName: string;
  parentId?: number | null;
  children?: Department[];
  sort?: number;
  status?: number;
}

export interface Location {
  id: number;
  locationName: string;
  locationCode?: string;
  parentId?: number | null;
  children?: Location[];
  level?: number;
}

export interface Vendor {
  id: number;
  vendorName: string;
  vendorCode?: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  status?: number;
  createTime?: string;
}
