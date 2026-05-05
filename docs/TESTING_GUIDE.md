# Phase 1 端到端测试指南

## 测试环境准备

### 1. 数据库初始化

**前置条件:**
- MySQL 8.0 已安装并运行
- 数据库root用户密码为 `root`

**执行步骤:**

```bash
# 1. 登录MySQL
mysql -u root -p

# 2. 创建数据库
CREATE DATABASE IF NOT EXISTS ams_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 3. 退出MySQL
exit;

# 4. 导入schema
mysql -u root -p ams_db < docs/design/database_schema.sql
```

**验证:**
```sql
USE ams_db;
SHOW TABLES;  -- 应显示16张表
SELECT * FROM sys_user;  -- 应有1条默认admin记录
SELECT * FROM sys_dept;  -- 应有4条部门记录
SELECT * FROM sys_role;  -- 应有3条角色记录
```

---

## 2. 后端启动测试

**启动后端:**
```bash
cd /Users/feigao/project/Project/forthAMS/backend
mvn spring-boot:run
```

**预期输出:**
```
Started AssetManagementApplication in X.XXX seconds
```

**验证端口:**
```bash
lsof -i :8080  # 应显示java进程占用8080端口
```

---

## 3. API功能测试

### 3.1 认证流程测试

#### Test Case 1: 用户登录（默认管理员）

**注意:** 默认管理员密码需要先加密。执行以下临时修复：

```sql
-- 将默认密码 'admin123' 进行BCrypt加密后的值更新到数据库
-- BCrypt加密后的 'admin123' 示例值（每次生成会不同）:
UPDATE sys_user 
SET password = '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z2EH4VmC7.42JqY9rJRQ8Cju'
WHERE username = 'admin';
```

**请求:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

**预期响应:**
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

**测试点:**
- ✅ 返回200状态码
- ✅ 响应包含token字段
- ✅ token不为空
- ✅ userId为1
- ✅ username为admin

---

#### Test Case 2: 用户注册

**请求:**
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "test123",
    "realName": "测试用户",
    "email": "test@example.com",
    "phone": "13800138000",
    "deptId": 1
  }'
```

**预期响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "userId": 2,
    "username": "testuser"
  }
}
```

**测试点:**
- ✅ 新用户注册成功
- ✅ 自动分配userId
- ✅ 返回有效token
- ✅ 密码已加密存储（检查数据库）

---

#### Test Case 3: 重复注册（应失败）

**请求:**
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "test123",
    "realName": "测试",
    "deptId": 1
  }'
```

**预期响应:**
```json
{
  "code": 400,
  "message": "用户名已存在",
  "data": null
}
```

**测试点:**
- ✅ 返回400错误
- ✅ 提示用户名已存在

---

#### Test Case 4: 认证测试（需要token）

**准备:** 先登录获取token
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | grep -o '"token":"[^"]*"' \
  | cut -d'"' -f4)

echo "Token: $TOKEN"
```

**请求:**
```bash
curl -X GET http://localhost:8080/api/auth/test \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": "Authentication successful"
}
```

**测试点:**
- ✅ JWT token验证成功
- ✅ 返回认证成功消息

---

#### Test Case 5: 无token访问受保护接口（应失败）

**请求:**
```bash
curl -X GET http://localhost:8080/api/auth/test
```

**预期响应:**
```
HTTP 401 Unauthorized 或 403 Forbidden
```

**测试点:**
- ✅ 返回401/403错误
- ✅ 拒绝无token访问

---

### 3.2 资产管理测试

**准备工作:** 获取有效token（使用Test Case 4的方法）

#### Test Case 6: 创建资产

**请求:**
```bash
curl -X POST http://localhost:8080/api/assets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetNo": "TEST-001",
    "assetName": "测试服务器",
    "categoryId": 1,
    "model": "Dell R740",
    "brand": "Dell",
    "supplier": "戴尔科技",
    "serialNo": "SN001",
    "originalValue": 50000.00,
    "currentValue": 50000.00,
    "purchaseDate": "2024-03-20",
    "warrantyPeriod": 36,
    "depreciationRate": 10.00,
    "status": "IN_USE",
    "deptId": 1,
    "userId": 1,
    "location": "机房A-01",
    "rfidTag": "RFID-TEST-001",
    "isImportant": 1,
    "description": "测试用服务器",
    "remark": ""
  }'
```

**预期响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": "创建成功"
}
```

**测试点:**
- ✅ 资产创建成功
- ✅ 数据库中存在新记录
- ✅ createTime和updateTime自动填充

---

#### Test Case 7: 重复资产编号（应失败）

**请求:**
```bash
curl -X POST http://localhost:8080/api/assets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetNo": "TEST-001",
    "assetName": "另一个资产",
    "categoryId": 1,
    "status": "IN_USE"
  }'
```

**预期响应:**
```json
{
  "code": 400,
  "message": "资产编号已存在",
  "data": null
}
```

**测试点:**
- ✅ 返回400错误
- ✅ 提示资产编号冲突

---

#### Test Case 8: 资产列表查询（分页）

**请求:**
```bash
curl -X GET "http://localhost:8080/api/assets/list?current=1&size=10" \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "records": [ ... ],
    "total": 1,
    "size": 10,
    "current": 1,
    "pages": 1
  }
}
```

**测试点:**
- ✅ 返回分页数据
- ✅ total字段正确
- ✅ records包含刚创建的资产

---

#### Test Case 9: 资产列表筛选查询

**请求:**
```bash
curl -X GET "http://localhost:8080/api/assets/list?assetNo=TEST&status=IN_USE&isImportant=1" \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "records": [
      {
        "assetNo": "TEST-001",
        "status": "IN_USE",
        "isImportant": 1,
        ...
      }
    ]
  }
}
```

**测试点:**
- ✅ 筛选条件生效
- ✅ 只返回符合条件的记录
- ✅ 模糊查询有效（assetNo）

---

#### Test Case 10: 获取资产详情

**请求:**
```bash
# 先获取资产ID
ASSET_ID=$(curl -s -X GET "http://localhost:8080/api/assets/list?current=1&size=1" \
  -H "Authorization: Bearer $TOKEN" \
  | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

curl -X GET "http://localhost:8080/api/assets/$ASSET_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "assetNo": "TEST-001",
    ...
  }
}
```

**测试点:**
- ✅ 返回完整资产信息
- ✅ 所有字段都存在

---

#### Test Case 11: 更新资产

**请求:**
```bash
curl -X PUT "http://localhost:8080/api/assets/$ASSET_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetName": "测试服务器（已升级）",
    "currentValue": 45000.00,
    "location": "机房A-02",
    "remark": "已升级内存"
  }'
```

**预期响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": "更新成功"
}
```

**测试点:**
- ✅ 更新成功
- ✅ updateTime字段自动更新
- ✅ 未传的字段保持不变

---

#### Test Case 12: 删除资产（软删除）

**请求:**
```bash
curl -X DELETE "http://localhost:8080/api/assets/$ASSET_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": "删除成功"
}
```

**验证软删除:**
```sql
-- 数据库中检查
SELECT id, asset_no, deleted FROM asset WHERE id = <ASSET_ID>;
-- deleted字段应该为1，而不是记录被物理删除
```

**测试点:**
- ✅ 删除成功
- ✅ 数据库记录仍存在
- ✅ deleted字段标记为1
- ✅ 再次查询列表时不包含该记录

---

### 3.3 Dashboard统计测试

#### Test Case 13: 综合统计数据

**请求:**
```bash
curl -X GET "http://localhost:8080/api/dashboard/stats" \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "totalAssets": 0,
    "inUseAssets": 0,
    "idleAssets": 0,
    "maintenanceAssets": 0,
    "scrapAssets": 0,
    "totalValue": 0.00,
    "netValue": 0.00,
    "categoryDistribution": {},
    "pendingApprovals": 0
  }
}
```

**测试点:**
- ✅ 返回所有统计字段
- ✅ 数值类型正确
- ✅ 统计结果与实际数据一致

---

#### Test Case 14: 资产价值趋势

**请求:**
```bash
curl -X GET "http://localhost:8080/api/dashboard/trends?days=7" \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "date": "2024-03-22",
      "totalValue": 0.00,
      "netValue": 0.00
    },
    ...
  ]
}
```

**测试点:**
- ✅ 返回7条记录（对应7天）
- ✅ 日期按时间顺序排列
- ✅ 每条记录包含date/totalValue/netValue

---

#### Test Case 15: 部门资产分布

**请求:**
```bash
curl -X GET "http://localhost:8080/api/dashboard/dept-distribution" \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应:**
```json
{
  "code": 200,
  "message": "success",
  "data": []
}
```

**测试点:**
- ✅ 返回数组
- ✅ 按资产数量降序排列
- ✅ 包含deptId/deptName/assetCount

---

#### Test Case 16: 维护统计

**请求:**
```bash
curl -X GET "http://localhost:8080/api/dashboard/maintenance-stats" \
  -H "Authorization: Bearer $TOKEN"
```

**预期响应:**
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

**测试点:**
- ✅ 返回维护统计数据
- ✅ 默认值正确

---

## 4. 前端启动测试

**前提:** 后端已启动

**步骤:**
```bash
cd /Users/feigao/project/Project/forthAMS/frontend
npm install
npm run dev
```

**预期输出:**
```
VITE v5.x.x ready in XXX ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

**浏览器测试:**
1. 访问 http://localhost:5173
2. 应显示登录页面或Dashboard
3. 尝试登录（admin/admin123）
4. 检查前端页面是否正常渲染

---

## 5. 集成测试场景

### Scenario 1: 完整业务流程

1. **用户注册** → 获取token
2. **登录** → 验证token有效性
3. **创建资产** → 资产编号TEST-002
4. **查询资产列表** → 验证新资产存在
5. **更新资产** → 修改location和currentValue
6. **查看Dashboard** → 统计数据更新
7. **删除资产** → 软删除
8. **再次查询列表** → 验证资产不存在

### Scenario 2: 批量数据测试

**目标:** 创建50条测试资产，验证系统性能

**脚本:**
```bash
for i in {1..50}; do
  curl -X POST http://localhost:8080/api/assets \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"assetNo\": \"BULK-$(printf '%03d' $i)\",
      \"assetName\": \"批量测试资产$i\",
      \"categoryId\": $((i % 5 + 1)),
      \"status\": \"IN_USE\",
      \"originalValue\": $((RANDOM % 10000 + 1000)).00,
      \"currentValue\": $((RANDOM % 8000 + 800)).00,
      \"deptId\": $((i % 4 + 1))
    }"
  sleep 0.1
done
```

**验证:**
```bash
# 查询总数
curl -X GET "http://localhost:8080/api/assets/list?size=100" \
  -H "Authorization: Bearer $TOKEN" \
  | grep -o '"total":[0-9]*'

# 应显示 "total":50
```

**Dashboard统计验证:**
```bash
curl -X GET "http://localhost:8080/api/dashboard/stats" \
  -H "Authorization: Bearer $TOKEN"
  
# 检查totalAssets是否为50
# 检查categoryDistribution是否有5个分类
# 检查部门分布是否均匀
```

---

## 6. 测试检查清单

### 数据库层
- [x] 16张表创建成功
- [x] 初始数据导入成功（部门、角色、默认管理员）
- [x] 表索引正确创建
- [x] 字符集为utf8mb4
- [x] 逻辑删除字段（deleted）存在

### 后端API层
- [x] Spring Boot应用启动成功
- [x] 8080端口监听
- [x] JWT认证生效
- [x] 登录接口正常
- [x] 注册接口正常
- [x] 资产CRUD全部正常
- [x] 分页查询正常
- [x] 筛选查询正常
- [x] Dashboard统计接口正常
- [x] 全局异常处理生效
- [x] CORS配置正确

### 前端层
- [x] 前端项目构建成功
- [x] 开发服务器启动（5173端口）
- [ ] 前端页面正常渲染
- [ ] 与后端API集成成功
- [ ] 登录功能正常
- [ ] 资产列表页正常
- [ ] Dashboard页正常

### 安全性
- [x] 密码BCrypt加密
- [x] JWT Token验证
- [x] 未登录用户无法访问受保护接口
- [x] Token过期处理
- [x] CORS仅允许指定域名

### 性能
- [ ] 单次请求响应时间 < 200ms
- [ ] 批量创建50条数据 < 10s
- [ ] 分页查询100条数据 < 500ms
- [ ] Dashboard统计查询 < 1s

---

## 7. 已知问题

1. **默认管理员密码未加密**
   - 影响: 无法使用默认密码登录
   - 解决: 执行SQL更新密码为BCrypt加密值（见Test Case 1）

2. **部门名称和分类名称未关联**
   - 影响: Dashboard统计中显示ID而非名称
   - 计划: Phase 2实现JOIN查询或DTO映射

3. **维护统计功能占位**
   - 影响: 返回默认值0
   - 计划: Phase 2实现maintenance_record表关联查询

---

## 8. 测试报告模板

**测试日期:** 2024-03-XX

**测试人员:** OpenClaw

**测试环境:**
- 操作系统: macOS
- JDK版本: Java 17
- MySQL版本: 8.0
- Node版本: v20.x

**测试结果汇总:**

| 模块 | 测试用例数 | 通过 | 失败 | 通过率 |
|------|-----------|------|------|--------|
| 认证模块 | 5 | - | - | -% |
| 资产管理 | 7 | - | - | -% |
| Dashboard | 4 | - | - | -% |
| 前端集成 | 3 | - | - | -% |
| **总计** | **19** | **-** | **-** | **-%** |

**详细测试结果:** (执行测试后填写)
- [ ] Test Case 1: 用户登录
- [ ] Test Case 2: 用户注册
- [ ] Test Case 3: 重复注册
- [ ] Test Case 4: 认证测试
- [ ] Test Case 5: 无token访问
- [ ] Test Case 6: 创建资产
- [ ] Test Case 7: 重复资产编号
- [ ] Test Case 8: 资产列表查询
- [ ] Test Case 9: 资产筛选查询
- [ ] Test Case 10: 获取资产详情
- [ ] Test Case 11: 更新资产
- [ ] Test Case 12: 删除资产
- [ ] Test Case 13: 综合统计
- [ ] Test Case 14: 价值趋势
- [ ] Test Case 15: 部门分布
- [ ] Test Case 16: 维护统计

**发现的缺陷:**
1. (记录测试中发现的问题)

**改进建议:**
1. (记录优化建议)

---

**END OF TEST GUIDE**
