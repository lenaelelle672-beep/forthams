# API 接口文档

## 基础信息

**Base URL:** `http://localhost:8080/api`

**认证方式:** JWT Token (除登录/注册外的所有接口)

**请求头:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**统一响应格式:**
```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

---

## 1. 认证模块 (Auth)

### 1.1 用户登录

**接口:** `POST /auth/login`

**请求体:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "userId": 1,
    "username": "admin"
  }
}
```

### 1.2 用户注册

**接口:** `POST /auth/register`

**请求体:**
```json
{
  "username": "newuser",
  "password": "password123",
  "realName": "张三",
  "email": "user@example.com",
  "phone": "13800138000",
  "deptId": 1
}
```

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "userId": 2,
    "username": "newuser"
  }
}
```

### 1.3 测试认证

**接口:** `GET /auth/test`

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": "Authentication successful"
}
```

---

## 2. 资产管理模块 (Asset)

### 2.1 资产列表（分页+筛选）

**接口:** `GET /assets/list`

**查询参数:**
- `current` (int, 默认1): 当前页码
- `size` (int, 默认10): 每页条数
- `assetNo` (string, 可选): 资产编号（模糊查询）
- `assetName` (string, 可选): 资产名称（模糊查询）
- `categoryId` (long, 可选): 分类ID
- `status` (string, 可选): 资产状态 (IN_USE/IDLE/MAINTENANCE/SCRAP)
- `deptId` (long, 可选): 部门ID
- `isImportant` (int, 可选): 是否重要设备 (0/1)

**示例请求:**
```
GET /assets/list?current=1&size=10&status=IN_USE&deptId=2
```

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "records": [
      {
        "id": 1,
        "assetNo": "AST-20240301-001",
        "assetName": "Dell服务器",
        "categoryId": 10,
        "model": "PowerEdge R740",
        "brand": "Dell",
        "supplier": "戴尔科技",
        "serialNo": "SN123456789",
        "originalValue": 50000.00,
        "currentValue": 45000.00,
        "purchaseDate": "2024-01-15",
        "warrantyPeriod": 36,
        "depreciationRate": 10.00,
        "status": "IN_USE",
        "deptId": 2,
        "userId": 5,
        "location": "机房A-01",
        "rfidTag": "RFID-001",
        "isImportant": 1,
        "description": "主要生产服务器",
        "remark": "定期维护",
        "createTime": "2024-03-01T10:00:00",
        "updateTime": "2024-03-15T14:30:00"
      }
    ],
    "total": 156,
    "size": 10,
    "current": 1,
    "pages": 16
  }
}
```

### 2.2 获取资产详情

**接口:** `GET /assets/{id}`

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "assetNo": "AST-20240301-001",
    "assetName": "Dell服务器",
    ...
  }
}
```

### 2.3 创建资产

**接口:** `POST /assets`

**请求体:**
```json
{
  "assetNo": "AST-20240301-002",
  "assetName": "联想笔记本",
  "categoryId": 12,
  "model": "ThinkPad X1",
  "brand": "Lenovo",
  "supplier": "联想集团",
  "serialNo": "SN987654321",
  "originalValue": 8000.00,
  "currentValue": 8000.00,
  "purchaseDate": "2024-03-20",
  "warrantyPeriod": 24,
  "depreciationRate": 20.00,
  "status": "IN_USE",
  "deptId": 3,
  "userId": 10,
  "location": "办公室301",
  "rfidTag": "RFID-002",
  "isImportant": 0,
  "description": "开发部用笔记本",
  "remark": ""
}
```

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": "创建成功"
}
```

### 2.4 更新资产

**接口:** `PUT /assets/{id}`

**请求体:**
```json
{
  "assetName": "联想笔记本（已升级）",
  "currentValue": 7500.00,
  "location": "办公室302",
  "remark": "已升级内存到32GB"
}
```

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": "更新成功"
}
```

### 2.5 删除资产（软删除）

**接口:** `DELETE /assets/{id}`

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": "删除成功"
}
```

---

## 3. 仪表板统计模块 (Dashboard)

### 3.1 综合统计数据

**接口:** `GET /dashboard/stats`

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "totalAssets": 156,
    "inUseAssets": 120,
    "idleAssets": 25,
    "maintenanceAssets": 8,
    "scrapAssets": 3,
    "totalValue": 2350000.00,
    "netValue": 1980000.00,
    "categoryDistribution": {
      "10": 45,
      "12": 38,
      "15": 22,
      "18": 30,
      "20": 21
    },
    "pendingApprovals": 0
  }
}
```

### 3.2 资产价值趋势

**接口:** `GET /dashboard/trends`

**查询参数:**
- `days` (int, 默认30): 统计天数

**示例请求:**
```
GET /dashboard/trends?days=7
```

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "date": "2024-03-22",
      "totalValue": 2350000.00,
      "netValue": 1980000.00
    },
    {
      "date": "2024-03-23",
      "totalValue": 2350000.00,
      "netValue": 1975000.00
    },
    ...
  ]
}
```

### 3.3 部门资产分布

**接口:** `GET /dashboard/dept-distribution`

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "deptId": 2,
      "deptName": "部门-2",
      "assetCount": 65
    },
    {
      "deptId": 3,
      "deptName": "部门-3",
      "assetCount": 48
    },
    {
      "deptId": 1,
      "deptName": "部门-1",
      "assetCount": 43
    }
  ]
}
```

### 3.4 维护统计数据

**接口:** `GET /dashboard/maintenance-stats`

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "totalMaintenanceCount": 0,
    "avgMaintenanceCost": 0.00,
    "monthlyMaintenanceCount": 0
  }
}
```

### 3.5 待审批数量

**接口:** `GET /dashboard/pending-approvals`

**响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": 0
}
```

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（未登录或token失效） |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 业务错误码

| 错误码 | 说明 |
|--------|------|
| 1001 | 用户名已存在 |
| 1002 | 用户名或密码错误 |
| 2001 | 资产编号已存在 |
| 2002 | 资产不存在 |

---

## 资产状态枚举

| 状态值 | 说明 |
|--------|------|
| IN_USE | 在用 |
| IDLE | 闲置 |
| MAINTENANCE | 维修中 |
| SCRAP | 已报废 |

## 是否重要设备

| 值 | 说明 |
|----|------|
| 0 | 普通设备 |
| 1 | 重要设备 |

---

## 测试流程

### 1. 获取Token
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 2. 使用Token访问受保护接口
```bash
TOKEN="eyJhbGciOiJIUzI1NiJ9..."

curl -X GET http://localhost:8080/api/assets/list?current=1&size=10 \
  -H "Authorization: Bearer $TOKEN"
```

### 3. 创建资产
```bash
curl -X POST http://localhost:8080/api/assets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetNo": "TEST-001",
    "assetName": "测试资产",
    "categoryId": 10,
    "status": "IN_USE"
  }'
```

---

## 注意事项

1. 所有日期格式为 ISO 8601: `yyyy-MM-dd` 或 `yyyy-MM-dd'T'HH:mm:ss`
2. 金额字段使用 BigDecimal 类型，保留两位小数
3. JWT Token 有效期为 24 小时
4. 删除操作为软删除，数据不会真正从数据库删除
5. 分页查询默认每页10条，最大支持100条
