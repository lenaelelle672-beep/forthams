# forthAMS API 测试中文指令手册

> 存放路径：`scripts/api-test.sh`
> 一键执行：`bash scripts/api-test.sh`
> 测试对象：运行中的后端 `http://localhost:8080`

---

## 一、起手式

```bash
# 1. 确认 MySQL 通
mysql -uroot -proot ams_db < backend/src/main/resources/schema.sql

# 2. 启动后端（进 backend 目录）
mvn spring-boot:run

# 3. 等 15 秒，然后开始测试
```

---

## 二、测试命令大全

### 1️⃣ 全量测试（推荐）

```bash
cd ~/project/Project/forthAMS
bash scripts/api-test.sh
```

| 测试内容 | 项数 | 说明 |
|---------|------|------|
| 认证模块 | 2 | 登录、登出 |
| 仪表板 | 5 | 概览/趋势/分布/维保/待审批 |
| 分类 CRUD | 6 | 创建/列表/树/详情/更新/删除 |
| 资产 CRUD | 6 | 创建/列表/详情/更新/报表/统计 |
| 工单 CRUD+审批 | 8 | 创建/列表/详情/更新/提交/审批/待审批 |
| 盘点/退役/处置 | 5 | 列表查询 |
| 闲置 CRUD | 3 | 列表/取消/删除 |
| 供应商 CRUD | 4 | 列表/详情/更新/删除 |
| 地点 CRUD | 4 | 列表/详情/更新/删除 |
| 部门 CRUD | 5 | 列表/树/详情/更新/删除 |
| 用户 CRUD | 6 | 列表/搜索/详情/角色/更新/删除 |
| 角色 CRUD | 5 | 列表/所有/详情/更新/删除 |
| 维保 CRUD | 5 | 列表/即将维保/详情/更新/删除 |
| 其他模块 | 12 | 折旧/审计/通知/工作流/赔偿/统计/导入模板 |
| **小计** | **76** | **API 基础 CRUD** |

### 2️⃣ 按场景测试

```bash
bash scripts/api-test.sh --crud    # 只跑增删改查（76项）
bash scripts/api-test.sh --biz     # 只跑业务逻辑（约35项）
bash scripts/api-test.sh --quick   # 快速冒烟（约20项）
```

### 3️⃣ 单挑手动测

```bash
# 先拿 token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | \
  python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

AUTH="Authorization: Bearer $TOKEN"

# 测 GET
curl -s -w "\n状态码: %{http_code}" http://localhost:8080/api/模块路径 -H "$AUTH"

# 测 POST 创建
curl -s -X POST http://localhost:8080/api/模块路径 \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"字段":"值"}'

# 测 PUT 更新
curl -s -X PUT http://localhost:8080/api/模块路径/ID \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"字段":"新值"}'

# 测 DELETE 删除
curl -s -X DELETE http://localhost:8080/api/模块路径/ID -H "$AUTH"
```

| 模块 | 路径 | 注意 |
|------|------|------|
| 资产 | `/api/assets` | 创建用 `assetName` |
| 供应商 | `/api/vendors` | **创建用 `name`**，不是 `vendorName` |
| 分类 | `/api/categories` | 创建用 `categoryName` + `categoryCode` |
| 地点 | `/api/locations` | 创建用 `locationName` + `locationCode` |
| 工单 | `/api/workorders` | 状态: DRAFT→SUBMIT→APPROVE/REJECT |
| 用户 | `/api/user-management` | 也支持 `/api/users` |
| 部门 | `/api/depts` | 创建用 `name` |
| 角色 | `/api/roles` | 创建用 `roleName` + `roleCode` |

---

## 三、业务逻辑测试（--biz 模式详解）

`bash scripts/api-test.sh --biz` 会测以下 4 个维度：

### 维度1：跨模块数据一致性

```
测试逻辑：
  创建一条资产 → 在资产列表能查到 ✓
  创建一个供应商 → 在供应商列表能查到 ✓
  创建一个部门 → 在部门列表/树都能看到 ✓
  创建一个分类 → 在分类树能看到 ✓
```

### 维度2：数据关联完整性

```
测试逻辑：
  创建工单时指定 assetId → 工单详情能查到该 assetId ✓
```

### 维度3：业务流程闭环

```
闲置资产流程：
  发布闲置公告 → 闲置列表出现 → 取消公告 ✓

工单审批流程：
  创建工单 → 提交 → 待审批列表出现 → 审批通过 ✓

用户管理流程：
  创建用户 → 关键词搜索 → 用户名匹配 ✓
```

### 维度4：校验逻辑

```
必填字段校验：
  资产缺 assetName     → 应返回 400 ✓
  供应商缺 name        → 应返回 400 ✓
  分类缺 categoryName  → 应返回 400 ✓
  用户缺 username      → 应返回 400 ✓
  维保缺 assetId      → 应返回 400 ✓

重复数据拦截：
  重复创建 admin 用户 → 应拦截（当前返回 200，期望 409）

边界值：
  查询不存在的 ID → 应返回 400 ✓
  超大 pageSize   → 应正常 ✓
  空搜索关键词    → 应正常 ✓
```

---

## 四、已知问题汇总

| # | 问题 | 表现 | 当前状态 |
|---|------|------|---------|
| 1 | `POST /workorders` 缺少 title 必填校验 | 传空也能创建成功(200) → 应返回 400 | **未修复** |
| 2 | `POST /user-management` 重复用户名 HTTP 语义 | 返回 200 + msg → 应返回 409 | **未修复** |
| 3 | `GET /locations/root` 路径别名 | 返回 500（`/list` 正常）| **未修复** |
| 4 | `POST /assets/export` 导出 | 返回 500 | **未修复** |
| 5 | 4 个 Controller 手动解析 JWT | Approval/IdleAsset/Notification/Retirement | 代码规范问题 |
| 6 | 6 个 Controller 双/多前缀 | Hello/Inventory/Retirement/Compensation/Audit/WorkOrder | 代码规范问题 |
| 7 | 健康检查需 JWT | `/health` `/system/health` 运维探活不可用 | P0 安全问题 |

---

## 五、快速排障

```bash
# 后端日志
tail -f /tmp/backend.log | grep ERROR

# 看具体接口返回的完整 JSON
curl -s http://localhost:8080/api/模块路径 -H "$AUTH" | python3 -m json.tool

# 看数据库有哪些表
mysql -uroot -proot ams_db -e "SHOW TABLES;"

# 看某张表数据
mysql -uroot -proot ams_db -e "SELECT * FROM asset LIMIT 5;"
```
