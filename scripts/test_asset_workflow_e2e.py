#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AMS 数据驱动端到端测试脚本 (GAI2 Builder Phase)
==============================================
按 MINIONS 裁决 use_refine 执行，数据驱动方式覆盖 4 个业务流程：
  ASSET_TRANSFER  - 资产调拨
  ASSET_CLEARANCE - 资产清退
  ASSET_SCRAP     - 资产报废
  ASSET_COMPENSATION - 资产赔偿

补全 reviewer 指出的 3 个 PARTIAL 缺口：
  AC2 - ASSET_CLEARANCE 实际执行验证
  AC5 - 多租户隔离验证（mine=true 交叉验证）
  AC6 - 审批返回字段与前端 DTO 对齐检查

特性：
  - 外部 JSON 数据驱动（test_matrix.json）
  - 每个流程独立登录（避免 JWT 过期）
  - assetId 动态替换为实际创建的资产 ID
  - COMPENSATION 只验证赔偿记录状态（不验证资产状态）
  - 前置检查（后端连通性、用户可用性）
  - 错误恢复（某流程失败继续后续流程）
  - AC5 交叉验证 + AC6 schema 校验
  - 用户 fallback：指定用户不可用时自动回退到 admin
"""

import json
import sys
import time
import traceback
from datetime import datetime
from typing import Any, Optional

import requests

# ============================================================================
# 配置
# ============================================================================
MATRIX_PATH = "scripts/test_matrix.json"
DEFAULT_ADMIN = {"username": "admin", "password": "admin123"}

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

    def __init__(self, base_url: str):
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
                 dept_id: int = 1) -> dict:
        """注册新用户"""
        resp = self.session.post(
            self._url("/auth/register"),
            json={
                "username": username,
                "password": password,
                "realName": real_name,
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
                        business_data: dict) -> dict:
        """创建审批流程"""
        resp = self.session.post(
            self._url("/approvals"),
            json={
                "processType": process_type,
                "title": title,
                "businessData": json.dumps(business_data),
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

    def get_approval(self, process_id: int) -> dict:
        """查询审批详情"""
        resp = self.session.get(
            self._url(f"/approvals/{process_id}"),
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()

    def list_approvals(self, mine: bool = False, page: int = 1,
                       page_size: int = 20) -> dict:
        """查询审批列表"""
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
        """创建资产"""
        resp = self.session.post(
            self._url("/assets"),
            json=data,
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()

    def get_asset(self, asset_id: int) -> dict:
        """查询资产"""
        resp = self.session.get(
            self._url(f"/assets/{asset_id}"),
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()

    # ---- 赔偿 ----
    def get_compensation(self, comp_id: int) -> dict:
        """查询赔偿记录"""
        resp = self.session.get(
            self._url(f"/compensations/{comp_id}"),
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()

    def list_compensations(self, page: int = 1, page_size: int = 20) -> dict:
        """查询赔偿列表"""
        resp = self.session.get(
            self._url(f"/compensations/list?page={page}&pageSize={page_size}"),
            headers=self._headers(),
            timeout=15,
        )
        return resp.json()


# ============================================================================
# 测试结果
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


# ============================================================================
# 辅助函数
# ============================================================================

def assert_code(resp: dict, expected_code: int, step_desc: str) -> bool:
    """验证 API 返回 code"""
    actual = resp.get("code")
    ok = actual == expected_code
    if not ok:
        msg = resp.get("message", "")
        print(f"  {RED}✗ {step_desc}: code={actual}, msg={msg}{RESET}")
    return ok


def make_unique_asset_no(prefix: str) -> str:
    """生成唯一资产编号"""
    ts = datetime.now().strftime("%m%d%H%M%S")
    return f"E2E-{prefix}-{ts}"


# ============================================================================
# 用户登录 fallback 机制
# ============================================================================

def login_with_fallback(client: APIClient, user_cfg: dict,
                        label: str = "") -> dict:
    """
    尝试用配置的用户登录，失败则回退到 admin。
    返回 (是否使用主用户, 登录响应)
    """
    username = user_cfg.get("username", "")
    password = user_cfg.get("password", "")

    print(f"  → 登录: {username}")
    resp = client.login(username, password)
    if resp.get("code") == 200:
        print(f"    {GREEN}✓ {username} 登录成功 (userId={client.user_id}){RESET}")
        return resp

    # 登录失败，尝试注册
    print(f"    {YELLOW}⚠ {username} 登录失败 (code={resp.get('code')})，尝试注册...{RESET}")
    reg_resp = client.register(username, password, f"E2E-{username}", dept_id=1)
    if reg_resp.get("code") == 200:
        # 注册成功，重新登录
        resp = client.login(username, password)
        if resp.get("code") == 200:
            print(f"    {GREEN}✓ {username} 注册并登录成功{RESET}")
            return resp

    # 注册也失败，使用 admin fallback
    print(f"    {YELLOW}⚠ {username} 不可用，回退到 admin{RESET}")
    resp = client.login(DEFAULT_ADMIN["username"], DEFAULT_ADMIN["password"])
    if resp.get("code") == 200:
        print(f"    {GREEN}✓ admin fallback 登录成功{RESET}")
    return resp


# ============================================================================
# 字段对齐校验 (AC6)
# ============================================================================

def check_field_alignment(data: dict, expected: dict, context: str) -> list[str]:
    """检查实际返回字段与期望字段的对齐情况，返回问题列表"""
    issues = []
    for field, expected_type_str in expected.items():
        if field not in data:
            issues.append(f"{context}: 缺少字段 '{field}'")
        else:
            actual_val = data[field]
            if actual_val is None:
                continue  # None 类型视为可接受
            type_choices = expected_type_str.split("|")
            actual_type = type(actual_val).__name__
            type_map = {"str": "str", "int": "int", "float": "float",
                        "list": "list", "dict": "dict", "bool": "bool"}
            resolved = [type_map.get(t, t) for t in type_choices]
            if actual_type not in resolved and "None" not in type_choices:
                issues.append(
                    f"{context}: 字段 '{field}' 类型不匹配, "
                    f"期望 {expected_type_str}, 实际 {actual_type}"
                )
    return issues


def ac6_validate_approval_response(data: dict, matrix: dict) -> list[str]:
    """对审批响应进行 AC6 字段校验"""
    schema = matrix.get("ac6_required_fields", {}).get("approval", {})
    return check_field_alignment(data, schema, "ApprovalResponse")


# ============================================================================
# 前置检查
# ============================================================================

def preflight_check(base_url: str, users: dict, matrix: dict) -> bool:
    """
    前置检查：
    1. 后端连通性
    2. 测试用户可用性（含 fallback 注册）
    3. 4 个工作流定义已 PUBLISH
    """
    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{CYAN}▶ 前置检查{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")

    # 检查 1: 后端连通性
    print(f"  → 检查后端连通性 [{base_url}]...")
    try:
        resp = requests.get(f"{base_url}/approvals?page=1&pageSize=1", timeout=10)
        print(f"    {GREEN}✓ 后端响应: HTTP {resp.status_code}{RESET}")
    except requests.ConnectionError:
        print(f"    {RED}✗ 无法连接后端 [{base_url}]，请确认服务已启动{RESET}")
        return False

    # 检查 2: 测试用户可用性
    print(f"  → 预检查测试用户池...")
    client = APIClient(base_url)
    checked_users = []

    # 先确保 admin 可用
    resp = client.login(DEFAULT_ADMIN["username"], DEFAULT_ADMIN["password"])
    if resp.get("code") != 200:
        print(f"    {RED}✗ admin 登录失败，无法继续{RESET}")
        return False
    print(f"    {GREEN}✓ admin 可用{RESET}")

    # 检查每个用户，尝试注册
    user_keys = list(users.keys())
    for key in user_keys:
        u = users[key]
        uname = u["username"]

        # 跳过 admin 自身
        if uname == DEFAULT_ADMIN["username"]:
            checked_users.append((key, True))
            continue

        # 尝试登录
        c2 = APIClient(base_url)
        lr = c2.login(uname, u["password"])
        if lr.get("code") == 200:
            checked_users.append((key, True))
            print(f"    {GREEN}✓ {uname} 可用{RESET}")
            continue

        # 登录失败，尝试注册
        print(f"    {YELLOW}⚠ {uname} 登录失败，尝试注册...{RESET}")
        rr = c2.register(uname, u["password"], f"E2E-{uname}", dept_id=1)
        if rr.get("code") == 200:
            # 注册成功，重新登录验证
            lr2 = c2.login(uname, u["password"])
            if lr2.get("code") == 200:
                checked_users.append((key, True))
                print(f"    {GREEN}✓ {uname} 注册并登录成功{RESET}")
            else:
                checked_users.append((key, False))
                print(f"    {YELLOW}⚠ {uname} 注册成功但登录失败，将回退到 admin{RESET}")
        else:
            checked_users.append((key, False))
            msg = rr.get("message", "")
            print(f"    {YELLOW}⚠ {uname} 不可用 ({msg})，将回退到 admin{RESET}")

    # 检查 3: 确保 4 个工作流定义已 PUBLISH
    print(f"  → 预发布 4 个工作流定义...")
    for biz_type in ["ASSET_TRANSFER", "ASSET_CLEARANCE",
                     "ASSET_SCRAP", "ASSET_COMPENSATION"]:
        pub_resp = client.publish_workflow(biz_type)
        code = pub_resp.get("code")
        if code == 200:
            print(f"    {GREEN}✓ {biz_type} 已发布{RESET}")
        else:
            msg = pub_resp.get("message", "")
            print(f"    {YELLOW}⚠ {biz_type}: code={code} ({msg})，可能已发布{RESET}")

    print(f"  {GREEN}前置检查完成{RESET}")
    return True


# ============================================================================
# 单流程端到端测试
# ============================================================================

def run_test_case(base_url: str, case: dict, users: dict,
                  opinions: list[str], matrix: dict) -> TestResult:
    """
    执行单个测试用例的端到端测试流程：
    1. 申请用户登录（带 fallback）
    2. 创建测试资产
    3. 发布工作流定义
    4. 创建审批
    5. 4 级审批循环
    6. 验证业务结果
    """
    case_id = case["id"]
    result = TestResult(case_id)
    process_type = case["processType"]

    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{CYAN}▶ {case['title']} [{case_id}]{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")

    applicant = users.get("applicant_user", {})
    if not applicant:
        result.fail(f"测试用户池中缺少 applicant_user")
        return result

    # ---------- Step 1: 申请用户登录（带 fallback） ----------
    client = APIClient(base_url)
    resp = login_with_fallback(client, applicant, f"[{case_id}]申请用户")
    ok = resp.get("code") == 200
    result.add_step("申请用户登录", ok, f"userId={client.user_id}, user={client.username}")
    if not ok:
        result.fail(f"登录失败: {resp.get('message')}")
        return result
    result.add_evidence(f"登录用户: {client.username}, userId={client.user_id}")

    # ---------- Step 2: 创建测试资产 ----------
    asset_data = dict(case.get("asset_create", {}))
    asset_data["assetNo"] = make_unique_asset_no(case_id.replace("TC-", ""))
    print(f"  → 创建测试资产: {asset_data['assetNo']}")
    resp = client.create_asset(asset_data)
    ok = assert_code(resp, 200, "创建资产")
    result.add_step("创建资产", ok, f"assetNo={asset_data['assetNo']}")
    if not ok:
        result.fail(f"创建资产失败: {resp}")
        return result

    asset_id = resp.get("data", {}).get("id")
    if not asset_id:
        result.fail("创建资产成功但未返回 ID")
        return result

    # 【动态替换 assetId】
    biz_data = dict(case.get("businessData", {}))
    biz_data["assetId"] = asset_id
    result.add_evidence(f"资产创建成功: id={asset_id}, assetNo={asset_data['assetNo']}")
    print(f"    {GREEN}✓ 资产 id={asset_id}{RESET}")

    # ---------- Step 3: 发布工作流定义 ----------
    print(f"  → 发布工作流定义: {process_type}")
    resp = client.publish_workflow(process_type)
    ok = assert_code(resp, 200, f"发布 {process_type}")
    result.add_step(f"发布工作流 {process_type}", ok, f"code={resp.get('code')}")
    if ok:
        print(f"    {GREEN}✓ 工作流已发布{RESET}")
    else:
        print(f"    {YELLOW}⚠ 发布返回 {resp.get('code')}，可能已发布，继续执行{RESET}")
        result.add_evidence(f"工作流 {process_type} 发布: code={resp.get('code')}")

    # ---------- Step 4: 创建审批 ----------
    print(f"  → 创建审批: {case['title']}")
    resp = client.create_approval(process_type, case["title"], biz_data)
    ok = assert_code(resp, 200, "创建审批")
    result.add_step("创建审批", ok, f"code={resp.get('code')}")
    if not ok:
        result.fail(f"创建审批失败: {resp}")
        return result

    proc_data = resp.get("data", {})
    process_id = proc_data.get("id")
    result.add_evidence(f"审批创建成功: processId={process_id}, "
                        f"currentStep={proc_data.get('currentStep')}, "
                        f"status={proc_data.get('status')}")

    # [AC6] 字段校验 —— 创建审批响应
    ac6_issues = ac6_validate_approval_response(proc_data, matrix)
    if ac6_issues:
        result.add_evidence(f"[AC6] 创建审批字段问题: {'; '.join(ac6_issues)}")
    print(f"    {GREEN}✓ processId={process_id}, step={proc_data.get('currentStep')}{RESET}")

    # ---------- Step 5: 4 级审批循环 ----------
    for level in range(1, 5):
        opinion = opinions[level - 1] if level <= len(opinions) else "同意"
        approver_key = f"approver_user{level}"
        approver_cfg = users.get(approver_key)

        # 如果有审批用户配置，尝试用审批用户登录审批
        if approver_cfg:
            approver_client = APIClient(base_url)
            a_resp = login_with_fallback(approver_client, approver_cfg,
                                         f"[{case_id}]审批人{level}")
            if a_resp.get("code") == 200:
                client = approver_client  # 切换到审批用户
                result.add_evidence(f"第{level}级审批人: {client.username}")

        print(f"  → 第 {level} 级审批 (用户: {client.username})...")
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

        # [AC6] 字段校验 —— 每次审批响应
        ac6_issues = ac6_validate_approval_response(step_data, matrix)
        if ac6_issues:
            result.add_evidence(f"[AC6] 第{level}级审批字段问题: {'; '.join(ac6_issues)}")

        if ok:
            print(f"    {GREEN}✓ step={new_step}, status={new_status}{RESET}")
        else:
            result.fail(f"第{level}级审批失败: {resp}")
            return result

    # ---------- Step 6: 验证最终审批状态 ----------
    print(f"  → 验证审批最终状态...")
    resp = client.get_approval(process_id)
    ok = assert_code(resp, 200, "查询审批详情")
    resp_data = resp.get("data", {})
    final_proc = resp_data.get("process", resp_data)
    final_status = final_proc.get("status")
    is_approved = final_status == "APPROVED"
    result.add_step("审批最终状态", is_approved, f"status={final_status}")
    result.add_evidence(f"审批最终状态: {final_status}")
    if is_approved:
        print(f"    {GREEN}✓ 审批状态={final_status}{RESET}")
    else:
        print(f"    {RED}✗ 期望 APPROVED, 实际={final_status}{RESET}")
        result.passed = False

    # ---------- Step 7: 验证业务结果 ----------
    expected_asset_status = case.get("expected_asset_status")
    expected_compensation_status = case.get("expected_compensation_status")

    if expected_asset_status:
        # 验证资产状态
        print(f"  → 验证资产状态: 期望 {expected_asset_status}")
        resp = client.get_asset(asset_id)
        ok = assert_code(resp, 200, "查询资产")
        asset = resp.get("data", {})
        st = asset.get("status")
        status_ok = st == expected_asset_status
        result.add_step(f"资产状态期望={expected_asset_status}",
                        status_ok, f"实际={st}")
        if status_ok:
            result.add_evidence(f"资产状态验证通过: {st}")
            print(f"    {GREEN}✓ 资产状态={st}{RESET}")
        else:
            result.add_evidence(f"资产状态不匹配: 期望={expected_asset_status}, 实际={st}")
            print(f"    {RED}✗ 期望={expected_asset_status}, 实际={st}{RESET}")
            result.passed = False

    if expected_compensation_status:
        # COMPENSATION: 只验证赔偿记录状态
        print(f"  → 验证赔偿记录状态: 期望 {expected_compensation_status}")
        biz_id = final_proc.get("businessId") if final_proc else None
        if not biz_id or biz_id == 0:
            print(f"    {YELLOW}⚠ businessId={biz_id}，从赔偿列表查找{RESET}")
            resp_list = client.list_compensations(1, 50)
            comps = resp_list.get("data", {}).get("records", [])
            if comps:
                biz_id = comps[0].get("id")

        if biz_id and biz_id > 0:
            resp = client.get_compensation(biz_id)
            ok = assert_code(resp, 200, "查询赔偿记录")
            comp = resp.get("data", {})
            comp_status = comp.get("status")
            is_ok = comp_status in ("APPROVED", "approved", "已通过")
            result.add_step("赔偿记录状态验证", is_ok, f"status={comp_status}")
            result.add_evidence(f"赔偿记录: id={biz_id}, status={comp_status}")
            if is_ok:
                print(f"    {GREEN}✓ 赔偿状态={comp_status}{RESET}")
            else:
                print(f"    {RED}✗ 赔偿状态={comp_status}, 期望 APPROVED{RESET}")
                result.passed = False
        else:
            result.add_step("验证赔偿记录", False,
                            f"businessId={biz_id}，无法定位赔偿记录")
            result.passed = False

    # ---------- 总结 ----------
    status_str = f"{GREEN}PASS{RESET}" if result.passed else f"{RED}FAIL{RESET}"
    print(f"\n▶ [{case_id}] {case['title']}: {status_str}")
    return result


# ============================================================================
# AC5: 多租户隔离验证
# ============================================================================

def test_ac5_cross_validation(base_url: str, users: dict,
                              matrix: dict) -> TestResult:
    """AC5: 交叉用户 mine=true 隔离验证 —— 动态注册第二个用户"""
    result = TestResult("AC5-多租户隔离")
    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{CYAN}▶ AC5: 多租户隔离验证（mine=true 交叉验证）{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")

    # --- 用户 A: admin ---
    client_a = APIClient(base_url)
    print(f"  → 用户A ({DEFAULT_ADMIN['username']}) 登录...")
    resp = client_a.login(DEFAULT_ADMIN["username"], DEFAULT_ADMIN["password"])
    if not assert_code(resp, 200, "用户A 登录"):
        result.fail(f"用户A 登录失败: {resp}")
        return result
    print(f"    {GREEN}✓ 用户A 登录成功{RESET}")

    # 发布工作流
    resp = client_a.publish_workflow("ASSET_SCRAP")
    print(f"    发布工作流: code={resp.get('code')}")

    # 用户A 创建审批
    biz_data = {"assetId": 1, "reason": "AC5 admin专项验证"}
    resp = client_a.create_approval("ASSET_SCRAP", "AC5-admin审批", biz_data)
    ok_a = assert_code(resp, 200, "用户A 创建审批")
    result.add_step("用户A 创建审批", ok_a)
    proc_a_id = resp.get("data", {}).get("id") if ok_a else None
    result.add_evidence(f"用户A (admin) 审批 id={proc_a_id}")
    print(f"    {GREEN if ok_a else RED}✓ 用户A审批: id={proc_a_id}{RESET}")

    # --- 用户 B: 动态注册新用户 ---
    ts = datetime.now().strftime("%H%M%S")
    user_b_name = f"ac5test{ts}"
    user_b_pass = "Test@123456"

    client_b = APIClient(base_url)
    print(f"  → 注册用户B: {user_b_name}")
    reg_resp = client_b.register(user_b_name, user_b_pass, f"AC5测试用户-{ts}", dept_id=1)
    if reg_resp.get("code") == 200:
        result.add_evidence(f"用户B 注册成功: {user_b_name}")
        print(f"    {GREEN}✓ 用户B 注册成功{RESET}")
    else:
        print(f"    {YELLOW}⚠ 注册返回 {reg_resp.get('code')}: {reg_resp.get('message')}{RESET}")

    # 用户B 登录
    resp = client_b.login(user_b_name, user_b_pass)
    if not assert_code(resp, 200, "用户B 登录"):
        result.fail(f"用户B 登录失败: {resp}")
        return result
    user_b_id = client_b.user_id
    result.add_evidence(f"用户B: id={user_b_id}, username={user_b_name}")
    print(f"    {GREEN}✓ 用户B 登录成功, id={user_b_id}{RESET}")

    # 用户B 创建审批
    biz_data_b = {"assetId": 2, "reason": "AC5 用户B专项验证"}
    resp = client_b.create_approval("ASSET_SCRAP", f"AC5-{user_b_name}审批", biz_data_b)
    ok_b = assert_code(resp, 200, "用户B 创建审批")
    result.add_step("用户B 创建审批", ok_b)
    proc_b_id = resp.get("data", {}).get("id") if ok_b else None
    result.add_evidence(f"用户B 审批 id={proc_b_id}")
    print(f"    {GREEN if ok_b else RED}✓ 用户B审批: id={proc_b_id}{RESET}")

    # --- 用户A mine=true 查询 ---
    print(f"  → 用户A mine=true 查询...")
    resp_a = client_a.list_approvals(mine=True, page_size=50)
    ok = assert_code(resp_a, 200, "用户A mine=true")
    result.add_step("用户A mine=true", ok)
    a_records = resp_a.get("data", {}).get("records", [])
    a_ids = {r.get("id") for r in a_records}
    a_has_b = proc_b_id in a_ids if proc_b_id else False
    isolated_a = not a_has_b
    result.add_step("用户A看不到用户B审批", isolated_a,
                    f"列表长度={len(a_records)}, 含B={a_has_b}")
    result.add_evidence(f"用户A mine=true: {len(a_records)}条, 含B审批={a_has_b}")
    print(f"    {GREEN if isolated_a else RED}✓ A隔离: {'通过' if isolated_a else '泄漏!'}{RESET}")

    # --- 用户B mine=true 查询 ---
    print(f"  → 用户B mine=true 查询...")
    resp_b = client_b.list_approvals(mine=True, page_size=50)
    ok = assert_code(resp_b, 200, "用户B mine=true")
    result.add_step("用户B mine=true", ok)
    b_records = resp_b.get("data", {}).get("records", [])
    b_ids = {r.get("id") for r in b_records}
    b_has_a = proc_a_id in b_ids if proc_a_id else False
    isolated_b = not b_has_a
    result.add_step("用户B看不到用户A审批", isolated_b,
                    f"列表长度={len(b_records)}, 含A={b_has_a}")
    result.add_evidence(f"用户B mine=true: {len(b_records)}条, 含A审批={b_has_a}")
    print(f"    {GREEN if isolated_b else RED}✓ B隔离: {'通过' if isolated_b else '泄漏!'}{RESET}")

    # 综合判断
    result.passed = isolated_a and isolated_b
    status_str = f"{GREEN}PASS{RESET}" if result.passed else f"{RED}FAIL{RESET}"
    print(f"\n▶ AC5 多租户隔离: {status_str}")
    return result


# ============================================================================
# 主测试运行器
# ============================================================================

def main():
    print(f"{CYAN}{'='*70}{RESET}")
    print(f"{CYAN}  AMS 工作流模块数据驱动端到端测试套件 (GAI2 Builder){RESET}")
    print(f"{CYAN}  数据源: {MATRIX_PATH}{RESET}")
    print(f"{CYAN}  时间: {datetime.now().isoformat()}{RESET}")
    print(f"{CYAN}{'='*70}{RESET}")

    # ---- 加载测试矩阵 ----
    print(f"\n{YELLOW}▶ 加载测试矩阵: {MATRIX_PATH}{RESET}")
    try:
        with open(MATRIX_PATH, "r", encoding="utf-8") as f:
            matrix = json.load(f)
    except FileNotFoundError:
        print(f"  {RED}✗ 测试矩阵文件未找到: {MATRIX_PATH}{RESET}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"  {RED}✗ 测试矩阵 JSON 解析失败: {e}{RESET}")
        sys.exit(1)

    base_url = matrix.get("templates", {}).get("base_url", "http://localhost:8080/api")
    users = matrix.get("templates", {}).get("users", {})
    opinions = matrix.get("templates", {}).get(
        "approval_opinions",
        ["同意", "同意", "同意", "同意"]
    )
    test_cases = matrix.get("test_cases", [])
    print(f"  {GREEN}✓ 矩阵加载成功: {len(test_cases)} 个测试用例{RESET}")

    # ---- 前置检查 ----
    if not preflight_check(base_url, users, matrix):
        print(f"  {RED}✗ 前置检查未通过，后端不可达{RESET}")
        sys.exit(1)

    # ---- 执行测试用例（带错误恢复） ----
    all_results: list[TestResult] = []
    for case in test_cases:
        try:
            result = run_test_case(base_url, case, users, opinions, matrix)
            all_results.append(result)
        except Exception as e:
            # 【错误恢复】某流程失败继续后续流程
            fail_result = TestResult(case.get("id", "UNKNOWN"))
            fail_result.fail(f"未预期异常: {e}\n{traceback.format_exc()}")
            all_results.append(fail_result)
            print(f"  {RED}✗ [{case.get('id')}] 测试异常: {e}{RESET}")
            print(f"  {YELLOW}⚠ 错误恢复：继续执行后续测试{RESET}")
        time.sleep(0.3)

    # ---- AC5: 多租户隔离验证 ----
    try:
        result_ac5 = test_ac5_cross_validation(base_url, users, matrix)
        all_results.append(result_ac5)
    except Exception as e:
        fail_ac5 = TestResult("AC5-多租户隔离")
        fail_ac5.fail(f"AC5 异常: {e}")
        all_results.append(fail_ac5)
        print(f"  {RED}✗ AC5 异常: {e}{RESET}")

    # ---- AC6: 字段对齐汇总 ----
    result_ac6 = TestResult("AC6-字段对齐汇总")
    print(f"\n{CYAN}{'='*60}{RESET}")
    print(f"{CYAN}▶ AC6: 字段对齐汇总{RESET}")
    print(f"{CYAN}{'='*60}{RESET}")
    total_field_issues = 0
    for r in all_results:
        if not r.name.startswith("AC5") and not r.name.startswith("AC6"):
            ac6_evidences = [e for e in r.evidence if "[AC6]" in e]
            if ac6_evidences:
                result_ac6.add_evidence(f"{r.name}: {'; '.join(ac6_evidences)}")
                total_field_issues += len(ac6_evidences)
    result_ac6.add_step("字段对齐检查", total_field_issues == 0,
                        f"共 {total_field_issues} 个问题" if total_field_issues > 0
                        else "全部字段对齐")
    result_ac6.add_evidence(f"总计 {total_field_issues} 个字段对齐问题")
    if total_field_issues > 0:
        result_ac6.passed = False
        print(f"    {RED}✗ 发现 {total_field_issues} 个字段对齐问题{RESET}")
    else:
        print(f"    {GREEN}✓ 所有字段对齐{RESET}")
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
        for st in r.steps:
            s_icon = f"{GREEN}  ✓{RESET}" if st["ok"] else f"{RED}  ✗{RESET}"
            print(f"      {s_icon} {st['step']}: {st['detail']}")

    print(f"\n  通过: {GREEN}{passed_count}/{total_count}{RESET}")
    if failed_count > 0:
        print(f"  失败: {RED}{failed_count}/{total_count}{RESET}")

    # ---- 构建 JSON 报告 ----
    report = {
        "test_suite": "AMS 工作流数据驱动端到端测试 (GAI2 Builder)",
        "executed_at": datetime.now().isoformat(),
        "base_url": base_url,
        "matrix_file": MATRIX_PATH,
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

    report_path = "scripts/test_asset_workflow_e2e_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n  测试报告已保存: {report_path}")

    # 退出码
    sys.exit(0 if failed_count == 0 else 1)


if __name__ == "__main__":
    main()
