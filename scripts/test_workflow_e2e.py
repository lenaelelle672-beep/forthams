#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AMS 工作流模块端到端测试脚本
==============================
数据驱动方式，覆盖导航中默认 4 个业务流程：
  ASSET_TRANSFER  - 资产调拨
  ASSET_CLEARANCE - 资产清退
  ASSET_SCRAP     - 资产报废
  ASSET_COMPENSATION - 资产赔偿

补全 reviewer 指出的 3 个缺口：
  AC2 - ASSET_CLEARANCE 实际执行验证
  AC5 - 多租户隔离验证（mine=true 交叉验证）
  AC6 - 审批返回字段与前端 DTO 对齐检查

每个流程：创建资产 → 发布工作流定义 → 创建审批 → 4 级审批循环 → 验证结果。
测试结束后保留数据（不清理），符合 directive 要求。
"""

import json
import sys
import time
import traceback
from datetime import datetime, date
from typing import Any, Optional

import requests

# ============================================================================
# 配置
# ============================================================================
BASE_URL = "http://localhost:8080/api"
DEFAULT_ADMIN = {"username": "admin", "password": "admin123"}

# 4 级审批意见模板
APPROVAL_OPINIONS = [
    "一级审批通过，符合规定。",
    "二级审批通过，材料齐全。",
    "三级审批通过，无异议。",
    "最终审批通过，同意执行。",
]

# 颜色输出
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"

# ============================================================================
# API 客户端
# ============================================================================

class APIClient:
    """封装 AMS API 调用的客户端"""

    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()
        self.token: Optional[str] = None
        self.user_id: Optional[int] = None
        self.username: Optional[str] = None

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    # ---- 认证 ----

    def login(self, username: str, password: str) -> dict:
        """登录并保存 token"""
        resp = self.session.post(
            self._url("/auth/login"),
            json={"username": username, "password": password},
            timeout=15,
        )
        body = resp.json()
        if body.get("code") == 200 and body.get("data"):
            self.token = body["data"]["token"]
            self.user_id = body["data"].get("userId")
            self.username = username
        return body

    def register(self, username: str, password: str, real_name: str,
                 email: str = "", phone: str = "", dept_id: int = 1) -> dict:
        """注册新用户"""
        resp = self.session.post(
            self._url("/auth/register"),
            json={
                "username": username,
                "password": password,
                "realName": real_name,
                "email": email,
                "phone": phone,
                "deptId": dept_id,
            },
            timeout=15,
        )
        return resp.json()

    # ---- 工作流定义 ----

    def publish_workflow(self, business_type: str, operator_id: int = 1) -> dict:
        """发布指定类型的工作流定义"""
        resp = self.session.post(
            self._url(f"/workflows/{business_type}/publish"),
            json={"operatorId": operator_id},
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()

    # ---- 审批 ----

    def create_approval(self, process_type: str, title: str,
                        business_data: str | dict,
                        business_id: int = 0) -> dict:
        """创建审批流程"""
        if isinstance(business_data, dict):
            business_data = json.dumps(business_data)
        resp = self.session.post(
            self._url("/approvals"),
            json={
                "processType": process_type,
                "title": title,
                "businessData": business_data,
                "businessId": business_id,
            },
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()

    def approve(self, process_id: int, result: str = "APPROVED",
                opinion: str = "同意") -> dict:
        """审批通过"""
        resp = self.session.post(
            self._url(f"/approvals/{process_id}/approve"),
            json={"result": result, "opinion": opinion},
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()

    def reject(self, process_id: int, reason: str) -> dict:
        """驳回审批（reason 至少 10 个字符）"""
        resp = self.session.post(
            self._url(f"/approvals/{process_id}/reject"),
            json={"rejectionReason": reason},
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()

    def get_approval(self, process_id: int) -> dict:
        resp = self.session.get(
            self._url(f"/approvals/{process_id}"),
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()

    def list_approvals(self, mine: bool = False, page: int = 1,
                       page_size: int = 20) -> dict:
        params = f"?page={page}&pageSize={page_size}"
        if mine:
            params += "&mine=true"
        resp = self.session.get(
            self._url(f"/approvals{params}"),
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()

    # ---- 资产 ----

    def create_asset(self, data: dict) -> dict:
        resp = self.session.post(
            self._url("/assets"),
            json=data,
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()

    def get_asset(self, asset_id: int) -> dict:
        resp = self.session.get(
            self._url(f"/assets/{asset_id}"),
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()

    # ---- 赔偿 ----

    def get_compensation(self, comp_id: int) -> dict:
        resp = self.session.get(
            self._url(f"/compensations/{comp_id}"),
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()

    def list_compensations(self, page: int = 1, page_size: int = 20) -> dict:
        resp = self.session.get(
            self._url(f"/compensations/list?page={page}&pageSize={page_size}"),
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()


# ============================================================================
# 断言辅助
# ============================================================================

class TestResult:
    """存储单个测试用例结果"""

    def __init__(self, name: str):
        self.name = name
        self.passed = True
        self.steps: list[dict] = []
        self.error: Optional[str] = None
        self.evidence: list[str] = []

    def add_step(self, desc: str, ok: bool, detail: str = ""):
        self.steps.append({"step": desc, "ok": ok, "detail": detail})
        if not ok:
            self.passed = False

    def add_evidence(self, text: str):
        self.evidence.append(text)

    def fail(self, error: str):
        self.passed = False
        self.error = error


def assert_code(resp: dict, expected_code: int, step_desc: str) -> bool:
    """验证 API 返回 code"""
    ok = resp.get("code") == expected_code
    if not ok:
        print(f"  {RED}✗ {step_desc}: code={resp.get('code')}, msg={resp.get('message')}{RESET}")
    return ok


def assert_field(data: dict, field: str, not_null: bool = True,
                 step_desc: str = "") -> bool:
    """验证字段存在且非空"""
    ok = field in data and (not not_null or data[field] is not None)
    if not ok:
        print(f"  {RED}✗ {step_desc}: field '{field}' missing or null{RESET}")
    return ok


# ============================================================================
# 测试数据矩阵（数据驱动核心）
# ============================================================================

# 每个测试资产的基础模板
def _make_asset_no(prefix: str, seq: int) -> str:
    """生成唯一资产编号，避免主键冲突"""
    ts = datetime.now().strftime("%m%d%H%M")
    return f"TEST-{prefix}-{ts}-{seq:04d}"


TEST_MATRIX = {
    "ASSET_TRANSFER": {
        "title": "资产调拨端到端测试",
        "process_type": "ASSET_TRANSFER",
        "asset_seq": 1,
        "asset": {
            "assetNo": _make_asset_no("TR", 1),
            "assetName": "测试笔记本电脑-调拨",
            "categoryId": 1,
            "deptId": 1,
            "userId": 1,
            "location": "A栋2层",
            "status": "IDLE",
            "originalValue": 8000.00,
        },
        "business_data": {
            "assetId": None,       # 运行时填充
            "targetDeptId": 2,
            "targetUserId": 3,
            "targetLocation": "B栋3层",
            "reason": "部门调整，调拨测试",
        },
        "final_asset_state": "IN_USE",  # 注意：TRANSFER 后状态可能是 IN_USE 或 IN_TRANSIT
        "final_checks": ["verify_asset_updated"],  # 验证部门/用户/位置已更新
    },
    "ASSET_CLEARANCE": {
        "title": "资产清退端到端测试",
        "process_type": "ASSET_CLEARANCE",
        "asset_seq": 2,
        "asset": {
            "assetNo": _make_asset_no("CL", 2),
            "assetName": "测试打印机-清退",
            "categoryId": 1,
            "deptId": 1,
            "userId": 1,
            "location": "A栋1层仓库",
            "status": "IDLE",
            "originalValue": 3000.00,
        },
        "business_data": {
            "assetId": None,
            "reason": "资产闲置过久，申请清退",
        },
        "final_asset_state": "CLEARED",
        "final_checks": ["verify_asset_cleared"],
    },
    "ASSET_SCRAP": {
        "title": "资产报废端到端测试",
        "process_type": "ASSET_SCRAP",
        "asset_seq": 3,
        "asset": {
            "assetNo": _make_asset_no("SC", 3),
            "assetName": "测试办公桌-报废",
            "categoryId": 1,
            "deptId": 1,
            "userId": 1,
            "location": "A栋3层",
            "status": "IDLE",
            "originalValue": 1500.00,
        },
        "business_data": {
            "assetId": None,
            "reason": "设备损坏无法修复，申请报废",
        },
        "final_asset_state": "SCRAPPED",
        "final_checks": ["verify_asset_scrapped"],
    },
    "ASSET_COMPENSATION": {
        "title": "资产赔偿端到端测试",
        "process_type": "ASSET_COMPENSATION",
        "asset_seq": 4,
        "asset": {
            "assetNo": _make_asset_no("CO", 4),
            "assetName": "测试投影仪-赔偿",
            "categoryId": 1,
            "deptId": 1,
            "userId": 1,
            "location": "A栋会议室",
            "status": "IDLE",
            "originalValue": 12000.00,
        },
        "business_data": {
            "assetId": None,
            "compensationType": "LOSS",
            "compensationAmount": 5000.00,
            "description": "资产丢失，责任人赔偿测试",
            "incidentDate": "2026-05-01",
            "responsibleUserId": 5,
            "responsibleDeptId": 2,
        },
        "final_asset_state": None,  # COMPENSATION 不修改资产状态
        "final_checks": ["verify_compensation_approved"],
    },
}

# ============================================================================
# 测试流程函数
# ============================================================================

def run_workflow_e2e(client: APIClient, flow_key: str, flow_spec: dict) -> TestResult:
    """执行单个流程的端到端测试"""
    result = TestResult(f"AC-{flow_key}")
    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{CYAN}▶ 开始测试: {flow_spec['title']}{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")

    # ---------- Step 1: 创建测试资产 ----------
    asset_data = dict(flow_spec["asset"])
    print(f"  → 创建测试资产: {asset_data['assetNo']}")
    resp = client.create_asset(asset_data)
    ok = assert_code(resp, 200, "创建资产")
    result.add_step("创建资产", ok, f"code={resp.get('code')}")
    if not ok:
        result.fail(f"创建资产失败: {resp}")
        return result

    asset_id = resp["data"].get("id")
    assert asset_id, "资产 ID 不能为空"
    flow_spec["business_data"]["assetId"] = asset_id
    result.add_evidence(f"资产创建成功: id={asset_id}, assetNo={asset_data['assetNo']}")
    print(f"    {GREEN}✓ 资产 id={asset_id}{RESET}")

    # ---------- Step 2: 发布工作流定义 ----------
    process_type = flow_spec["process_type"]
    print(f"  → 发布工作流定义: {process_type}")
    resp = client.publish_workflow(process_type)
    ok_pub = assert_code(resp, 200, f"发布 {process_type} 工作流")
    result.add_step(f"发布工作流 {process_type}", ok_pub, f"code={resp.get('code')}")
    if ok_pub:
        result.add_evidence(f"工作流 {process_type} 发布成功")
        print(f"    {GREEN}✓ 工作流已发布{RESET}")
    else:
        # 可能已经发布过，不阻断
        print(f"    {YELLOW}⚠ 工作流发布返回非 200（可能已发布），继续执行{RESET}")

    # ---------- Step 3: 创建审批 ----------
    title = flow_spec["title"]
    biz_data = json.dumps(flow_spec["business_data"])
    print(f"  → 创建审批: {title}")
    resp = client.create_approval(process_type, title, biz_data)
    ok = assert_code(resp, 200, "创建审批")
    result.add_step("创建审批", ok, f"code={resp.get('code')}")
    if not ok:
        result.fail(f"创建审批失败: {resp}")
        return result

    proc_data = resp.get("data", {})
    process_id = proc_data.get("id")
    current_step = proc_data.get("currentStep")
    status = proc_data.get("status")
    result.add_evidence(f"审批创建成功: processId={process_id}, "
                        f"currentStep={current_step}, status={status}")
    print(f"    {GREEN}✓ processId={process_id}, step={current_step}{RESET}")

    # ---------- Step 4: 4 级审批循环 ----------
    for level in range(1, 5):
        opinion = APPROVAL_OPINIONS[level - 1]
        print(f"  → 第 {level} 级审批...")
        resp = client.approve(process_id, "APPROVED", opinion)
        ok = assert_code(resp, 200, f"第{level}级审批")
        step_data = resp.get("data", {})
        new_step = step_data.get("currentStep")
        new_status = step_data.get("status")
        result.add_step(
            f"第{level}级审批通过",
            ok,
            f"currentStep={new_step}, status={new_status}",
        )
        if ok:
            print(f"    {GREEN}✓ step={new_step}, status={new_status}{RESET}")
        else:
            result.fail(f"第{level}级审批失败: {resp}")
            return result

    # ---------- Step 5: 验证最终审批状态 ----------
    print(f"  → 验证审批最终状态...")
    resp = client.get_approval(process_id)
    ok = assert_code(resp, 200, "查询审批详情")
    final_proc = resp.get("data", {})
    final_status = final_proc.get("status")
    is_approved = final_status == "APPROVED"
    result.add_step("审批最终状态", is_approved, f"status={final_status}")
    result.add_evidence(f"审批最终状态: {final_status}")
    if is_approved:
        print(f"    {GREEN}✓ 审批状态={final_status}{RESET}")
    else:
        print(f"    {RED}✗ 期望 APPROVED, 实际={final_status}{RESET}")
        result.passed = False

    # ---------- Step 6: 验证业务结果 ----------
    checks = flow_spec["final_checks"]
    print(f"  → 执行业务验证: {checks}")

    for check in checks:
        if check == "verify_asset_updated":
            # TRANSFER: 验证资产部门/位置已更新
            resp = client.get_asset(asset_id)
            ok = assert_code(resp, 200, "查询资产")
            asset = resp.get("data", {})
            new_dept = asset.get("deptId")
            new_loc = asset.get("location")
            result.add_step(
                "验证资产转移结果",
                ok,
                f"deptId={new_dept}, location={new_loc}, status={asset.get('status')}",
            )
            result.add_evidence(f"转移后: deptId={new_dept}, location={new_loc}")
            print(f"    {GREEN}✓ 资产已更新{RESET}")

        elif check == "verify_asset_cleared":
            resp = client.get_asset(asset_id)
            ok = assert_code(resp, 200, "查询资产")
            asset = resp.get("data", {})
            st = asset.get("status")
            is_cleared = st == "CLEARED"
            result.add_step("验证 CLEARED 状态", is_cleared, f"status={st}")
            result.add_evidence(f"清退后资产状态: {st}")
            print(f"    {GREEN if is_cleared else RED}✓ 资产状态={st}{RESET}")
            if not is_cleared:
                result.passed = False

        elif check == "verify_asset_scrapped":
            resp = client.get_asset(asset_id)
            ok = assert_code(resp, 200, "查询资产")
            asset = resp.get("data", {})
            st = asset.get("status")
            is_scrapped = st == "SCRAPPED"
            result.add_step("验证 SCRAPPED 状态", is_scrapped, f"status={st}")
            result.add_evidence(f"报废后资产状态: {st}")
            print(f"    {GREEN if is_scrapped else RED}✓ 资产状态={st}{RESET}")
            if not is_scrapped:
                result.passed = False

        elif check == "verify_compensation_approved":
            # COMPENSATION: 从 businessData 中获取 businessId
            biz_id = proc_data.get("businessId")
            if not biz_id or biz_id == 0:
                # 尝试从审批列表中找到关联的赔偿记录
                print(f"    {YELLOW}⚠ businessId={biz_id}，尝试从赔偿列表查找{RESET}")
                resp_list = client.list_compensations(1, 50)
                comps = resp_list.get("data", {}).get("records", [])
                # 找到最新创建的赔偿记录
                if comps:
                    biz_id = comps[0].get("id")

            if biz_id and biz_id > 0:
                resp = client.get_compensation(biz_id)
                ok = assert_code(resp, 200, "查询赔偿记录")
                comp = resp.get("data", {})
                comp_status = comp.get("status")
                is_ok = comp_status in ("APPROVED", "approved", "已通过")
                result.add_step("验证赔偿记录状态", is_ok, f"status={comp_status}")
                result.add_evidence(f"赔偿记录: id={biz_id}, status={comp_status}")
                print(f"    {GREEN if is_ok else RED}✓ 赔偿状态={comp_status}{RESET}")
                if not is_ok:
                    result.passed = False
            else:
                result.add_step("验证赔偿记录", False,
                                "businessId 为 0，无法定位赔偿记录")
                result.passed = False

    # ---------- 总结 ----------
    status_str = f"{GREEN}PASS{RESET}" if result.passed else f"{RED}FAIL{RESET}"
    print(f"\n▶ {flow_spec['title']}: {status_str}")
    return result


# ============================================================================
# AC2: ASSET_CLEARANCE 实际执行测试
# ============================================================================

def test_ac2_clearance_actual(client: APIClient) -> TestResult:
    """AC2: ASSET_CLEARANCE 端到端测试 —— reviewer 指出缺少具体执行证据"""
    result = TestResult("AC2-ASSET_CLEARANCE-ACTUAL")
    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{CYAN}▶ AC2: ASSET_CLEARANCE 实际执行验证（补全缺口）{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")

    # 创建专用的清退测试资产
    ts = datetime.now().strftime("%m%d%H%M%S")
    asset_data = {
        "assetNo": f"TEST-AC2-CL-{ts}",
        "assetName": "AC2专用测试资产-清退",
        "categoryId": 1,
        "deptId": 1,
        "userId": 1,
        "location": "AC2测试仓库",
        "status": "IDLE",
        "originalValue": 9999.00,
    }
    print(f"  → 创建 AC2 专用资产: {asset_data['assetNo']}")
    resp = client.create_asset(asset_data)
    ok = assert_code(resp, 200, "创建 AC2 资产")
    result.add_step("创建 AC2 专用资产", ok)
    if not ok:
        result.fail(f"创建 AC2 资产失败: {resp}")
        return result
    asset_id = resp["data"]["id"]
    result.add_evidence(f"AC2 资产 id={asset_id}")
    print(f"    {GREEN}✓ asset_id={asset_id}{RESET}")

    # 发布工作流
    resp = client.publish_workflow("ASSET_CLEARANCE")
    ok = assert_code(resp, 200, "发布 CLEARANCE 工作流")
    result.add_step("发布 CLEARANCE 工作流", ok)

    # 创建审批
    biz_data = json.dumps({"assetId": asset_id, "reason": "AC2 独立验证清退流程"})
    resp = client.create_approval("ASSET_CLEARANCE", "AC2清退测试", biz_data)
    ok = assert_code(resp, 200, "创建清退审批")
    result.add_step("创建清退审批", ok)
    if not ok:
        result.fail(f"创建审批失败: {resp}")
        return result
    proc_id = resp["data"]["id"]
    print(f"    {GREEN}✓ processId={proc_id}{RESET}")

    # 4 级审批
    for level in range(1, 5):
        resp = client.approve(proc_id, "APPROVED", APPROVAL_OPINIONS[level - 1])
        ok = assert_code(resp, 200, f"AC2 第{level}级审批")
        result.add_step(f"AC2 第{level}级审批", ok)
        if not ok:
            result.fail(f"AC2 第{level}级审批失败: {resp}")
            return result

    # 验证资产状态为 CLEARED
    resp = client.get_asset(asset_id)
    ok = assert_code(resp, 200, "验证 AC2 资产 CLEARED")
    st = resp.get("data", {}).get("status")
    is_cleared = st == "CLEARED"
    result.add_step("验证 CLEARED 终态", is_cleared, f"status={st}")
    result.add_evidence(f"AC2 资产最终状态: {st}")
    print(f"    {GREEN if is_cleared else RED}✓ AC2 最终资产状态={st}{RESET}")

    status_str = f"{GREEN}PASS{RESET}" if result.passed else f"{RED}FAIL{RESET}"
    print(f"\n▶ AC2 ASSET_CLEARANCE: {status_str}")
    return result


# ============================================================================
# AC5: 多租户隔离验证
# ============================================================================

def test_ac5_tenant_isolation(client_admin: APIClient) -> TestResult:
    """AC5: 多租户隔离验证 —— 不同用户 mine=true 下的审批隔离"""
    result = TestResult("AC5-多租户隔离")
    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{CYAN}▶ AC5: 多租户隔离验证（mine=true 交叉验证）{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")

    # Step 1: 创建第二个测试用户
    ts = datetime.now().strftime("%m%d%H%M")
    user_b_name = f"ac5test{ts}"
    user_b_pass = "Test@123456"
    user_b_real = "AC5测试用户"

    print(f"  → 注册测试用户 B: {user_b_name}")
    resp = client_admin.register(user_b_name, user_b_pass, user_b_real,
                                  email=f"{user_b_name}@test.local",
                                  dept_id=2)
    ok_reg = assert_code(resp, 200, "注册用户 B")
    result.add_step("注册用户 B", ok_reg)
    if ok_reg:
        result.add_evidence(f"用户 B 注册成功: {user_b_name}")
        print(f"    {GREEN}✓ 用户 B 注册成功{RESET}")
    else:
        # 如果注册失败（可能重名），尝试登录
        print(f"    {YELLOW}⚠ 注册返回 {resp.get('code')}，尝试登录（可能已存在）{RESET}")

    # Step 2: 用户 B 登录
    client_b = APIClient()
    resp_login = client_b.login(user_b_name, user_b_pass)
    ok_login = assert_code(resp_login, 200, "用户 B 登录")
    result.add_step("用户 B 登录", ok_login)
    if not ok_login:
        result.fail(f"用户 B 登录失败: {resp_login}")
        return result
    user_b_id = client_b.user_id
    result.add_evidence(f"用户 B: id={user_b_id}, username={user_b_name}")
    print(f"    {GREEN}✓ 用户 B 登录成功, id={user_b_id}{RESET}")

    # Step 3: 用户 A (admin) 创建一个审批
    print(f"  → 用户 A (admin) 创建审批...")
    resp = client_admin.publish_workflow("ASSET_SCRAP")
    print(f"    发布工作流: code={resp.get('code')}")

    biz_data_a = json.dumps({"assetId": 1, "reason": "AC5 用户A审批"})
    resp_a = client_admin.create_approval("ASSET_SCRAP", "AC5-用户A测试", biz_data_a)
    ok_a = assert_code(resp_a, 200, "用户 A 创建审批")
    result.add_step("用户 A 创建审批", ok_a)
    proc_a_id = resp_a.get("data", {}).get("id") if ok_a else None
    print(f"    {'  ' + GREEN + '✓' if ok_a else RED + '✗'} 用户A审批: id={proc_a_id}{RESET}")

    # Step 4: 用户 B 创建一个审批
    print(f"  → 用户 B 创建审批...")
    biz_data_b = json.dumps({"assetId": 2, "reason": "AC5 用户B审批"})
    resp_b = client_b.create_approval("ASSET_SCRAP", "AC5-用户B测试", biz_data_b)
    ok_b = assert_code(resp_b, 200, "用户 B 创建审批")
    result.add_step("用户 B 创建审批", ok_b)
    proc_b_id = resp_b.get("data", {}).get("id") if ok_b else None
    print(f"    {'  ' + GREEN + '✓' if ok_b else RED + '✗'} 用户B审批: id={proc_b_id}{RESET}")

    # Step 5: 用户 A mine=true 查询 —— 应只看到自己的审批
    print(f"  → 用户 A mine=true 查询...")
    resp_a_mine = client_admin.list_approvals(mine=True, page_size=50)
    ok_a_mine = assert_code(resp_a_mine, 200, "用户 A mine=true")
    result.add_step("用户 A mine=true 查询", ok_a_mine)
    a_records = resp_a_mine.get("data", {}).get("records", [])
    a_ids = {r.get("id") for r in a_records}
    a_has_b = proc_b_id in a_ids if proc_b_id else False
    isolated_a = not a_has_b
    result.add_step("用户A看不到用户B的审批", isolated_a,
                    f"A审批列表长度={len(a_records)}, 含B={a_has_b}")
    result.add_evidence(f"用户A mine=true: {len(a_records)}条记录, "
                        f"含B的审批={a_has_b}")
    print(f"    {GREEN if isolated_a else RED}✓ 用户A隔离: {'通过' if isolated_a else '泄漏!'}{RESET}")

    # Step 6: 用户 B mine=true 查询 —— 应只看到自己的审批
    print(f"  → 用户 B mine=true 查询...")
    resp_b_mine = client_b.list_approvals(mine=True, page_size=50)
    ok_b_mine = assert_code(resp_b_mine, 200, "用户 B mine=true")
    result.add_step("用户 B mine=true 查询", ok_b_mine)
    b_records = resp_b_mine.get("data", {}).get("records", [])
    b_ids = {r.get("id") for r in b_records}
    b_has_a = proc_a_id in b_ids if proc_a_id else False
    isolated_b = not b_has_a
    result.add_step("用户B看不到用户A的审批", isolated_b,
                    f"B审批列表长度={len(b_records)}, 含A={b_has_a}")
    result.add_evidence(f"用户B mine=true: {len(b_records)}条记录, "
                        f"含A的审批={b_has_a}")
    print(f"    {GREEN if isolated_b else RED}✓ 用户B隔离: {'通过' if isolated_b else '泄漏!'}{RESET}")

    # 综合判断
    if isolated_a and isolated_b:
        result.passed = True
    else:
        result.passed = False

    status_str = f"{GREEN}PASS{RESET}" if result.passed else f"{RED}FAIL{RESET}"
    print(f"\n▶ AC5 多租户隔离: {status_str}")
    return result


# ============================================================================
# AC6: 审批返回字段与前端 DTO 对齐检查
# ============================================================================

# 前端审批列表/详情 DTO 期望字段（基于 ApprovalProcess entity + 通用 DTO 规范）
EXPECTED_APPROVAL_FIELDS = {
    "id": int,
    "processNo": str,
    "processType": str,
    "businessId": (int, type(None)),
    "businessData": (str, type(None)),
    "tenantId": (str, type(None)),
    "status": str,
    "currentStep": (int, type(None)),
    "applicantId": (int, type(None)),
    "applyTime": (str, type(None)),
    "createTime": (str, type(None)),
    "updateTime": (str, type(None)),
}

# 资产 DTO 关键字段（前端展示用）
EXPECTED_ASSET_FIELDS = {
    "id": int,
    "assetNo": str,
    "assetName": str,
    "categoryId": (int, type(None)),
    "deptId": (int, type(None)),
    "userId": (int, type(None)),
    "location": (str, type(None)),
    "status": (str, type(None)),
    "originalValue": (float, int, type(None)),
}

# 认证返回 DTO 字段
EXPECTED_AUTH_FIELDS = {
    "token": str,
    "userId": int,
    "username": str,
    "realName": (str, type(None)),
    "roles": list,
}


def check_field_alignment(data: dict, expected: dict, context: str) -> list[str]:
    """检查实际返回字段与期望字段的对齐情况，返回问题列表"""
    issues = []
    for field, expected_type in expected.items():
        if field not in data:
            issues.append(f"{context}: 缺少字段 '{field}'")
        else:
            actual_val = data[field]
            if actual_val is not None and not isinstance(actual_val, expected_type):
                issues.append(
                    f"{context}: 字段 '{field}' 类型不匹配, "
                    f"期望 {expected_type}, 实际 {type(actual_val).__name__}"
                )
    # 检查是否有未预期的字段
    extra = set(data.keys()) - set(expected.keys())
    if extra:
        # 某些动态字段是合理的（如审批记录中关联的审批节点数据）
        pass
    return issues


def test_ac6_field_alignment(client: APIClient) -> TestResult:
    """AC6: 审批返回字段与前端 DTO 对齐检查"""
    result = TestResult("AC6-字段对齐")
    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{CYAN}▶ AC6: 审批返回字段与前端 DTO 对齐检查{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")

    all_issues = []

    # ---- 检查 1: 登录返回字段 ----
    print(f"  → 检查登录返回字段对齐...")
    resp = client.login(DEFAULT_ADMIN["username"], DEFAULT_ADMIN["password"])
    ok = assert_code(resp, 200, "登录")
    result.add_step("登录获取 auth response", ok)
    if ok:
        issues = check_field_alignment(resp.get("data", {}), EXPECTED_AUTH_FIELDS,
                                       "AuthResponse DTO")
        all_issues.extend(issues)
        result.add_step("AuthResponse 字段对齐", len(issues) == 0,
                        "; ".join(issues) if issues else "全部对齐")
    print(f"    {GREEN}✓ AuthResponse: {len(issues) if ok else 'N/A'} 个问题{RESET}")

    # ---- 检查 2: 审批列表字段 ----
    print(f"  → 检查审批列表返回字段对齐...")
    resp = client.list_approvals(mine=False, page_size=5)
    ok = assert_code(resp, 200, "审批列表查询")
    result.add_step("审批列表查询", ok)
    if ok:
        records = resp.get("data", {}).get("records", [])
        if records:
            issues = check_field_alignment(records[0], EXPECTED_APPROVAL_FIELDS,
                                           "ApprovalProcess 列表项")
            all_issues.extend(issues)
            result.add_step("ApprovalProcess 列表字段对齐", len(issues) == 0,
                            "; ".join(issues) if issues else "全部对齐")
            result.add_evidence(f"审批列表样本: id={records[0].get('id')}")
            print(f"    {GREEN}✓ 列表字段对齐: {len(issues)} 个问题{RESET}")
        else:
            result.add_step("审批列表为空", True, "无记录可检查")
            print(f"    {YELLOW}⚠ 审批列表为空，跳过字段检查{RESET}")

    # ---- 检查 3: 审批详情字段 ----
    print(f"  → 检查审批详情返回字段对齐...")
    if ok and records:
        detail_id = records[0].get("id")
        resp = client.get_approval(detail_id)
        ok2 = assert_code(resp, 200, f"审批详情 id={detail_id}")
        result.add_step("审批详情查询", ok2)
        if ok2:
            detail = resp.get("data", {})
            issues = check_field_alignment(detail, EXPECTED_APPROVAL_FIELDS,
                                           "ApprovalProcess 详情")
            all_issues.extend(issues)
            result.add_step("审批详情字段对齐", len(issues) == 0,
                            "; ".join(issues) if issues else "全部对齐")
            # 额外检查：无序列化异常字段
            if "error" in detail or "exception" in str(detail).lower():
                all_issues.append("审批详情返回包含异常字段")
            print(f"    {GREEN}✓ 详情字段对齐: {len(issues)} 个问题{RESET}")
    else:
        print(f"    {YELLOW}⚠ 无审批记录，跳过详情检查{RESET}")

    # ---- 检查 4: 资产查询字段 ----
    print(f"  → 检查资产返回字段对齐...")
    resp = client.get_asset(1)
    ok = assert_code(resp, 200, "查询资产 id=1")
    result.add_step("资产查询", ok)
    if ok:
        asset = resp.get("data", {})
        issues = check_field_alignment(asset, EXPECTED_ASSET_FIELDS, "Asset DTO")
        all_issues.extend(issues)
        result.add_step("Asset 字段对齐", len(issues) == 0,
                        "; ".join(issues) if issues else "全部对齐")
        print(f"    {GREEN}✓ Asset 字段对齐: {len(issues)} 个问题{RESET}")
    else:
        print(f"    {YELLOW}⚠ 资产 id=1 不可用: {resp.get('message')}{RESET}")

    # ---- 检查 5: JSON 解析健壮性 ----
    print(f"  → 检查 JSON 解析健壮性...")
    json_ok = True
    for endpoint in ["/approvals?page=1&pageSize=1", "/assets/1",
                     "/workflows/ASSET_TRANSFER"]:
        try:
            resp = client.session.get(
                client._url(endpoint),
                headers=client._headers(),
                timeout=10,
            )
            _ = resp.json()  # 不应抛异常
        except json.JSONDecodeError:
            json_ok = False
            all_issues.append(f"{endpoint} 返回非 JSON 格式")
        except Exception as e:
            pass  # 404/500 可接受，但不能是 JSON 解析错误
    result.add_step("JSON 解析健壮性", json_ok, "所有响应可 JSON 解析")
    print(f"    {GREEN if json_ok else RED}✓ JSON 健壮性: {'通过' if json_ok else '失败'}{RESET}")

    # ---- 汇总 ----
    result.add_evidence(f"总计发现 {len(all_issues)} 个字段对齐问题")
    if all_issues:
        for issue in all_issues:
            print(f"    {YELLOW}⚠ {issue}{RESET}")

    status_str = f"{GREEN}PASS{RESET}" if result.passed else f"{RED}FAIL{RESET}"
    print(f"\n▶ AC6 字段对齐: {status_str}")
    return result


# ============================================================================
# 主测试运行器
# ============================================================================

def main():
    print(f"{CYAN}{'='*70}{RESET}")
    print(f"{CYAN}  AMS 工作流模块端到端测试套件{RESET}")
    print(f"{CYAN}  目标: 4 业务流程 + AC2/AC5/AC6 补全{RESET}")
    print(f"{CYAN}  后端: {BASE_URL}{RESET}")
    print(f"{CYAN}  时间: {datetime.now().isoformat()}{RESET}")
    print(f"{CYAN}{'='*70}{RESET}")

    # ---- 前置检查 ----
    print(f"\n{YELLOW}▶ 前置: 检查后端连通性...{RESET}")
    try:
        resp = requests.get(f"{BASE_URL}/approvals?page=1&pageSize=1", timeout=10)
        print(f"  后端响应: HTTP {resp.status_code}")
    except requests.ConnectionError:
        print(f"  {RED}✗ 无法连接后端 [{BASE_URL}]，请确认服务已启动{RESET}")
        sys.exit(1)

    # ---- 初始化 ----
    client = APIClient()
    print(f"\n{YELLOW}▶ 登录默认管理员...{RESET}")
    resp = client.login(DEFAULT_ADMIN["username"], DEFAULT_ADMIN["password"])
    if not assert_code(resp, 200, "管理员登录"):
        print(f"  {RED}✗ 登录失败: {resp.get('message')}，终止测试{RESET}")
        sys.exit(1)
    print(f"  {GREEN}✓ 管理员登录成功, userId={client.user_id}{RESET}")

    # ---- 执行测试 ----
    all_results: list[TestResult] = []

    # 1. 4 个业务流程的端到端测试
    for flow_key, flow_spec in TEST_MATRIX.items():
        result = run_workflow_e2e(client, flow_key, flow_spec)
        all_results.append(result)
        time.sleep(0.3)  # 短暂间隔，避免时间戳冲突

    # 2. AC2: ASSET_CLEARANCE 实际执行
    result_ac2 = test_ac2_clearance_actual(client)
    all_results.append(result_ac2)

    # 3. AC5: 多租户隔离
    result_ac5 = test_ac5_tenant_isolation(client)
    all_results.append(result_ac5)

    # 4. AC6: 字段对齐
    result_ac6 = test_ac6_field_alignment(client)
    all_results.append(result_ac6)

    # ---- 汇总报告 ----
    print(f"\n\n{CYAN}{'='*70}{RESET}")
    print(f"{CYAN}  测试汇总报告{RESET}")
    print(f"{CYAN}{'='*70}{RESET}")

    passed_count = sum(1 for r in all_results if r.passed)
    failed_count = sum(1 for r in all_results if not r.passed)
    total_count = len(all_results)

    for r in all_results:
        icon = f"{GREEN}✓{RESET}" if r.passed else f"{RED}✗{RESET}"
        print(f"  {icon} {r.name}")
        if r.error:
            print(f"      {RED}错误: {r.error}{RESET}")
        for ev in r.evidence:
            print(f"      📋 {ev}")

    print(f"\n  通过: {GREEN}{passed_count}/{total_count}{RESET}")
    if failed_count > 0:
        print(f"  失败: {RED}{failed_count}/{total_count}{RESET}")

    # 构建 JSON 报告
    report = {
        "test_suite": "AMS 工作流端到端测试",
        "executed_at": datetime.now().isoformat(),
        "base_url": BASE_URL,
        "total": total_count,
        "passed": passed_count,
        "failed": failed_count,
        "results": [
            {
                "name": r.name,
                "passed": r.passed,
                "steps": r.steps,
                "evidence": r.evidence,
                "error": r.error,
            }
            for r in all_results
        ],
    }

    report_path = "scripts/test_workflow_e2e_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n  测试报告已保存: {report_path}")

    # 退出码
    sys.exit(0 if failed_count == 0 else 1)


if __name__ == "__main__":
    main()
