# SWARM-S5-001 工單審批流程 Specifications

## 1. 需求與背景

### 1.1 業務場景
GSD（Global Service Desk）系統需要支持標準化的工單審批流程。使用者可在前端提交審批工單，後端基於狀態機實現審批節點的自動流轉，審批結果（通過/駁回）觸發對應的通知機制。

### 1.2 核心能力要求

| 能力項 | 描述 |
|--------|------|
| 工單創建 | 使用者填寫工單表單並提交 |
| 狀態機流轉 | 審批節點按預定義規則自動流轉 |
| 審批動作 | 審批人可執行通過/駁回操作 |
| 通知觸發 | 審批完成後自動發送通知 |

### 1.3 技術驅動因素
- 統一工單狀態管理，避免硬編碼狀態判斷
- 審批流程可配置化，降低業務變更成本
- 事件驅動通知，保障審批結果及時觸達

### 1.4 前端服務層職責（聚焦 `approvalService.ts`）

```typescript
// frontend/src/services/approvalService.ts 核心職責
interface ApprovalService {
  // 提交審批工單
  submitWorkOrder(data: WorkOrderSubmitDTO): Promise<WorkOrderResponse>;
  
  // 執行審批通過
  approveWorkOrder(id: string, comment?: string): Promise<ApprovalResult>;
  
  // 執行審批駁回
  rejectWorkOrder(id: string, reason: string): Promise<ApprovalResult>;
  
  // 查詢審批狀態
  getApprovalStatus(id: string): Promise<ApprovalStatusDTO>;
  
  // 獲取審批歷史
  getApprovalHistory(id: string): Promise<ApprovalHistory[]>;
}
```

---

## 2. 當前 Phase 對應實施目標

### Phase 1: 核心狀態機與工單創建
**目標**: 實現工單的基礎CRUD + 狀態機流轉框架

| 交付物 | 說明 |
|--------|------|
| 工單數據模型 | 包含工單號、標題、申請人、當前狀態、審批節點鏈 |
| 狀態機定義 | 預定義狀態：`PENDING` → `APPROVING` → `APPROVED` / `REJECTED` |
| 工單創建API | `POST /api/v1/work-orders` |
| 狀態流轉API | `POST /api/v1/work-orders/{id}/approve` / `reject` |

### Phase 2: 前端交互與通知集成
**目標**: 完成前端表單與通知服務對接

| 交付物 | 說明 |
|--------|------|
| 工單提交表單 | React組件，支持表單校驗 |
| 審批操作界面 | 審批人可查看詳情並執行審批 |
| 通知觸發器 | 審批完成後向消息隊列投遞通知事件 |

---

## 3. 邊界約束

### 3.1 功能邊界

```
[約束項] 不支持的功能範圍
├─ 多級會簽審批（Phase3獨立交付）
├─ 審批時限自動催辦
├─ 工單轉發與委託
└─ 移動端離線提交
```

### 3.2 技術邊界

| 約束維度 | 具體限制 |
|----------|----------|
| 狀態機實現 | 僅支持單向線性流轉，不支持條件分支 |
| 通知渠道 | 僅支持Email + 企業微信Webhook |
| 並發控制 | 樂觀鎖機制，version字段控制 |
| 工單數量上限 | 單用戶同一時間最多50個PENDING工單 |

### 3.3 數據約束

```
工單狀態枚舉: PENDING | APPROVING | APPROVED | REJECTED | CANCELLED
審批節點狀態: PENDING | APPROVED | REJECTED
狀態流轉規則:
  - PENDING → APPROVING (提交動作)
  - APPROVING → APPROVED (審批通過)
  - APPROVING → REJECTED (審批駁回)
  - APPROVED/REJECTED → CANCELLED (用戶撤銷，僅限創建者)

版本控制:
  - 每個狀態變更自動遞增 version 字段
  - 衝突檢測基於 version 比對
```

### 3.4 前端服務層約束（`approvalService.ts`）

```typescript
// 請求超時限制
const REQUEST_TIMEOUT = 30000; // 30秒

// 重試策略
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1秒，指數退避
  retryableStatuses: [408, 500, 502, 503, 504]
};

// 錯誤碼映射
const ERROR_CODE_MAP = {
  'DUPLICATE_APPROVAL': '該工單已執行過審批操作',
  'INVALID_TRANSITION': '不允許的狀態變更',
  'PERMISSION_DENIED': '無權執行此操作',
  'WORK_ORDER_NOT_FOUND': '工單不存在',
  'CONCURRENT_MODIFICATION': '並發衝突，請刷新後重試'
};
```

---

## 4. 驗收測試基準 (ATB)

### 4.1 工單創建（ATB-1）

| 測試編號 | 物理測試用例 | 期待結果 | 測試工具 |
|----------|--------------|----------|----------|
| ATB-1.1 | `POST /api/v1/work-orders` with valid payload | HTTP 201, 返回工單ID, 狀態=PENDING | pytest |
| ATB-1.2 | `POST /api/v1/work-orders` with missing required fields | HTTP 400, error_detail包含缺失字段 | pytest |
| ATB-1.3 | 工單創建後狀態機初始化 | 數據庫work_orders表status=PENDING, 初始節點鏈存在 | MySQL query |
| ATB-1.4 | 前端表單提交成功 | UI Toast提示"工單已提交", 跳轉詳情頁 | Playwright |
| ATB-1.5 | 前端表單校驗失敗 | 即時顯示字段錯誤，不觸發API請求 | Playwright |

### 4.2 狀態機流轉（ATB-2）

| 測試編號 | 物理測試用例 | 期待結果 | 測試工具 |
|----------|--------------|----------|----------|
| ATB-2.1 | `POST /api/v1/work-orders/{id}/approve` | HTTP 200, status變更=APPROVED, 流轉時間戳更新 | pytest |
| ATB-2.2 | `POST /api/v1/work-orders/{id}/reject` with reason | HTTP 200, status=REJECTED, reason字段存儲 | pytest |
| ATB-2.3 | 重複審批同一工單 | HTTP 409 Conflict, 錯誤碼DUPLICATE_APPROVAL | pytest |
| ATB-2.4 | 對非APPROVING狀態工單執行審批 | HTTP 422 Unprocessable Entity | pytest |
| ATB-2.5 | 無權限用戶執行審批 | HTTP 403 Forbidden | pytest |
| ATB-2.6 | 前端審批操作成功 | UI更新為新狀態，顯示審批人信息 | Playwright |
| ATB-2.7 | 前端審批操作失敗 | 顯示友好錯誤提示，工單狀態保持不變 | Playwright |

### 4.3 通知觸發（ATB-3）

| 測試編號 | 物理測試用例 | 期待結果 | 測試工具 |
|----------|--------------|----------|----------|
| ATB-3.1 | 工單審批通過後 | 消息隊列存在type=APPROVAL_RESULT的event | Redis/RabbitMQ client |
| ATB-3.2 | 工單審批駁回後 | 消息隊列event包含rejected_by, reject_reason | Redis/RabbitMQ client |
| ATB-3.3 | 通知消費者處理 | Email已發送或Webhook已推送 | Mock server驗證 |
| ATB-3.4 | 通知發送失敗重試 | 重試機制觸發，3次重試後進入死信隊列 | pytest + mock |

### 4.4 邊界與異常（ATB-4）

| 測試編號 | 物理測試用例 | 期待結果 | 測試工具 |
|----------|--------------|----------|----------|
| ATB-4.1 | 工單數量超限（≥50條PENDING） | HTTP 429 Too Many Requests | pytest |
| ATB-4.2 | 工單創建者撤銷已審批工單 | HTTP 400, 錯誤碼INVALID_TRANSITION | pytest |
| ATB-4.3 | 並發審批同一工單 | 僅一個請求成功，另一個返回409 | pytest (concurrent) |
| ATB-4.4 | 工單詳情查詢 | HTTP 200, 返回完整節點鏈與審批歷史 | pytest |
| ATB-4.5 | 網絡超時場景 | 前端顯示超時提示，提供重試按鈕 | Playwright |
| ATB-4.6 | 服務端500錯誤 | 前端顯示通用錯誤提示，記錄日誌 | Playwright |

---

## 5. 開發切入層級序列

### Layer 1: 數據層 (Day 1-2)

```
/backend/app/models/
├── work_order.py          # 工單數據模型 + 狀態枚舉
├── approval_node.py       # 審批節點模型
└── work_order_history.py  # 審批歷史記錄

/backend/app/migrations/
└── 001_create_work_order_tables.sql
```

**關鍵代碼示例**:

```python
# src/models/workorder.py
from enum import Enum
from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class WorkOrderStatus(str, Enum):
    PENDING = "PENDING"
    APPROVING = "APPROVING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"

class WorkOrder(Base):
    __tablename__ = "work_orders"
    
    id = Column(String(36), primary_key=True)
    title = Column(String(200), nullable=False)
    description = Column(String(2000), nullable=False)
    status = Column(String(20), nullable=False, default=WorkOrderStatus.PENDING)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
```

### Layer 2: 狀態機引擎 (Day 3-4)

```
/backend/app/state_machine/
├── engine.py              # 狀態機核心引擎
├── transitions.py         # 流轉規則定義
└── validators.py          # 流轉前置校驗

/backend/app/events/
└── approval_events.py     # 狀態變更事件定義
```

### Layer 3: Repository層 (Day 4-5)

```
/backend/app/repositories/
├── work_order_repo.py     # 工單倉儲
└── approval_node_repo.py  # 審批節點倉儲
```

### Layer 4: Service層 (Day 6-7)

```
/backend/app/services/
├── work_order_service.py  # 工單業務邏輯
├── approval_service.py    # 審批業務邏輯
└── notification_service.py # 通知服務接口
```

### Layer 5: API層 (Day 8-9)

```
/backend/app/api/v1/
├── work_orders.py         # 工單路由
└── approvals.py           # 審批路由

/backend/app/schemas/
├── work_order_schema.py   # Pydantic請求/響應模型
└── approval_schema.py
```

### Layer 6: 通知消費者 (Day 10)

```
/backend/app/workers/
├── notification_consumer.py  # 消息隊列消費者
└── channels/
    ├── email_channel.py       # Email通知通道
    └── webhook_channel.py     # 企業微信Webhook通道
```

### Layer 7: 前端組件 (Day 11-14)

```
/frontend/src/pages/work-orders/
├── WorkOrderList.tsx       # 工單列表頁
├── WorkOrderForm.tsx       # 工單提交表單
└── WorkOrderDetail.tsx     # 工單詳情+審批操作

/frontend/src/components/
├── StatusBadge.tsx         # 狀態徽章組件
└── ApprovalActions.tsx     # 審批操作組件
```

### Layer 8: 前端服務層 (Day 11-12) — **核心實現**

```
/frontend/src/services/
├── approvalService.ts      # 審批服務封裝 ⭐
├── workorderService.ts    # 工單服務
└── notificationService.ts # 通知服務
```

---

## 6. 附錄：關鍵接口定義

### 6.1 前端服務接口（`approvalService.ts`）

```typescript
/**
 * 工單審批服務
 * 職責：封裝審批相關的API調用、錯誤處理、重試邏輯
 */
export interface WorkOrderSubmitDTO {
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category_id: string;
  attachments?: string[];
}

export interface ApprovalActionDTO {
  comment?: string;
  reason?: string; // 駁回時必填
}

export interface WorkOrderResponse {
  id: string;
  status: WorkOrderStatus;
  created_at: string;
  updated_at: string;
  current_node_id: string;
}

export interface ApprovalResult {
  success: boolean;
  work_order_id: string;
  new_status: WorkOrderStatus;
  approved_by?: string;
  approved_at?: string;
  reject_reason?: string;
}

export interface ApprovalHistory {
  id: string;
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'CANCEL';
  actor: string;
  timestamp: string;
  comment?: string;
}

export enum WorkOrderStatus {
  PENDING = 'PENDING',
  APPROVING = 'APPROVING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}
```

### 6.2 後端API接口

#### 創建工單
```yaml
POST /api/v1/work-orders
Request:
  title: string (required, max: 200)
  description: string (required, max: 2000)
  priority: enum [LOW, MEDIUM, HIGH, CRITICAL]
  category_id: string (required)
Response:
  id: string (uuid)
  status: "PENDING"
  created_at: datetime
```

#### 執行審批
```yaml
POST /api/v1/work-orders/{id}/approve
POST /api/v1/work-orders/{id}/reject
Request:
  comment: string (optional, max: 500)
  reason: string (required for reject, max: 500)
Response:
  id: string
  status: "APPROVED" | "REJECTED"
  approved_by: string
  approved_at: datetime
```

#### 查詢審批歷史
```yaml
GET /api/v1/work-orders/{id}/history
Response:
  items: ApprovalHistory[]
  total: number
```

---

## 7. 錯誤處理規範

### 7.1 前端服務層錯誤處理

```typescript
// approvalService.ts 錯誤處理策略
export class ApprovalServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ApprovalServiceError';
  }
}

export const ERROR_CODE_MAP = {
  DUPLICATE_APPROVAL: '該工單已執行過審批操作',
  INVALID_TRANSITION: '不允許的狀態變更',
  PERMISSION_DENIED: '無權執行此操作',
  WORK_ORDER_NOT_FOUND: '工單不存在',
  CONCURRENT_MODIFICATION: '並發衝突，請刷新後重試',
  RATE_LIMIT_EXCEEDED: '操作過於頻繁，請稍後重試',
  NETWORK_ERROR: '網絡連接異常',
  SERVER_ERROR: '服務器錯誤，請稍後重試'
} as const;
```

### 7.2 錯誤碼與用戶提示映射

| 錯誤碼 | HTTP Status | 用戶提示 | 操作建議 |
|--------|-------------|----------|----------|
| DUPLICATE_APPROVAL | 409 | 該工單已執行過審批操作 | 刷新頁面查看最新狀態 |
| INVALID_TRANSITION | 422 | 不允許的狀態變更 | 聯繫管理員 |
| PERMISSION_DENIED | 403 | 無權執行此操作 | 檢查權限或切換帳戶 |
| WORK_ORDER_NOT_FOUND | 404 | 工單不存在或已刪除 | 返回列表頁 |
| CONCURRENT_MODIFICATION | 409 | 並發衝突，請刷新後重試 | 點擊刷新按鈕 |
| RATE_LIMIT_EXCEEDED | 429 | 操作過於頻繁，請稍後重試 | 等待30秒後重試 |
| NETWORK_ERROR | N/A | 網絡連接異常 | 檢查網絡後重試 |
| SERVER_ERROR | 500 | 服務器錯誤，請稍後重試 | 聯繫技術支持 |

---

## 8. 監控與可觀測性

### 8.1 關鍵指標

| 指標名 | 描述 | 告警閾值 |
|--------|------|----------|
| approval_latency_p95 | 審批操作延遲P95 | > 2000ms |
| approval_failure_rate | 審批失敗率 | > 5% |
| notification_delivery_rate | 通知送達率 | < 95% |
| concurrent_approval_conflicts | 並發衝突次數 | > 10次/小時 |

### 8.2 日誌規範

```typescript
// approvalService.ts 日誌格式
interface ApprovalLogEntry {
  trace_id: string;
  action: 'SUBMIT' | 'APPROVE' | 'REJECT';
  work_order_id: string;
  user_id: string;
  timestamp: string;
  duration_ms: number;
  status: 'SUCCESS' | 'FAILURE';
  error_code?: string;
}
```

---

## 9. 安全考量

### 9.1 權限控制

| 操作 | 所需角色 |
|------|----------|
| 提交工單 | USER, ADMIN |
| 執行審批 | APPROVER, ADMIN |
| 撤銷工單 | 工單創建者, ADMIN |
| 查看審批歷史 | USER（own）, APPROVER（all）, ADMIN |

### 9.2 敏感操作審計

所有審批操作均需記錄審計日誌，包括：
- 操作人、操作時間
- 操作前後狀態
- IP地址、設備信息
- 審批意見/駁回原因

---

## 10. 測試覆蓋率要求

| 測試類型 | 覆蓋率要求 |
|----------|------------|
| 單元測試 (Unit Test) | > 80% |
| 集成測試 (Integration Test) | 核心流程100%覆蓋 |
| E2E測試 (Playwright) | 主要用戶路徑100% |

---

*文檔版本: 1.0*  
*創建日期: 2024*  
*最後更新: SWARM-S5-001 Iteration 1*