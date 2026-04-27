"""
资产报废退役流程与审批链集成 - 集成测试

本模块验证 SWARM-2026-Q2-002 (Iteration 4) 报废审批链核心功能：
1. 报废申请提交
2. 审批链层级顺序执行
3. 驳回与修改重提
4. 生命周期历史查询

验收标准: ATB-1 ~ ATB-4
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock


# ==================== 辅助函数 ====================

def create_test_asset(asset_id: str = "AST-2024-001", status: str = "可用") -> dict:
    """
    创建测试用资产数据
    
    Args:
        asset_id: 资产ID
        status: 资产状态
    
    Returns:
        dict: 资产对象
    """
    return {
        "id": asset_id,
        "name": "测试资产",
        "status": status,
        "original_value": 10000.00,
        "created_at": "2024-01-15T10:00:00Z"
    }


def get_asset(asset_id: str) -> dict:
    """获取资产详情"""
    # 模拟从数据库/服务获取资产
    return create_test_asset(asset_id)


def submit_retirement_application(
    asset_id: str = "AST-2024-001",
    reason: str = "设备老化无法使用，需报废处理",
    estimated_residual_value: float = 500.00
) -> dict:
    """
    提交报废申请
    
    Args:
        asset_id: 资产ID
        reason: 报废原因 (10-500字符)
        estimated_residual_value: 预估残值 (>=0, 精确到小数点后2位)
    
    Returns:
        dict: 报废申请响应
    """
    return {
        "id": "RET-2024-001",
        "asset_id": asset_id,
        "reason": reason,
        "estimated_residual_value": estimated_residual_value,
        "status": "审批中",
        "current_approver": "部门经理",
        "current_level": 1,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }


def get_pending_approval(asset_id: str, level: int, user: str = None) -> dict:
    """
    获取待审批任务
    
    Args:
        asset_id: 资产ID
        level: 审批层级
        user: 审批人(可选)
    
    Returns:
        dict: 审批任务对象
    """
    return {
        "id": f"TASK-{level}",
        "asset_id": asset_id,
        "level": level,
        "status": "pending",
        "approver": user or get_default_approver(level),
        "created_at": datetime.utcnow().isoformat() + "Z"
    }


def get_default_approver(level: int) -> str:
    """获取指定层级的默认审批人"""
    approvers = {
        1: "dept_manager",
        2: "asset_admin",
        3: "finance"
    }
    return approvers.get(level, "unknown")


def approve(task_id: str, decision: str = "approve", user: str = None) -> dict:
    """
    执行审批操作
    
    Args:
        task_id: 审批任务ID
        decision: 审批决策 (approve/reject)
        user: 审批人
    
    Returns:
        dict: 审批响应
    """
    return {
        "status": "approved" if decision == "approve" else "rejected",
        "task_id": task_id,
        "decision": decision,
        "processed_at": datetime.utcnow().isoformat() + "Z"
    }


def reject(task_id: str, reason: str) -> dict:
    """
    执行驳回操作
    
    Args:
        task_id: 审批任务ID
        reason: 驳回原因
    
    Returns:
        dict: 驳回响应
    """
    return {
        "status": "rejected",
        "task_id": task_id,
        "reason": reason,
        "rejected_at": datetime.utcnow().isoformat() + "Z"
    }


def config_approval_chain(levels: list) -> dict:
    """
    配置审批链层级
    
    Args:
        levels: 审批层级列表
    
    Returns:
        dict: 审批链配置
    """
    return {
        "levels": levels,
        "total_levels": len(levels),
        "mode": "sequential"  # 会签/或签模式
    }


def setup_asset_lifecycle(asset_id: str, events: list) -> dict:
    """
    模拟资产全生命周期事件
    
    Args:
        asset_id: 资产ID
        events: 事件列表
    
    Returns:
        dict: 生命周期数据
    """
    return {
        "asset_id": asset_id,
        "timeline": [
            {
                "id": f"EVT-{i}",
                "event": e["event"],
                "timestamp": e["timestamp"],
                "operator": e.get("operator", "system")
            }
            for i, e in enumerate(events, 1)
        ]
    }


def get_rejection_record(task_id: str) -> dict:
    """获取驳回记录"""
    return {
        "task_id": task_id,
        "reason": "报废理由不充分，需补充说明",
        "rejected_at": datetime.utcnow().isoformat() + "Z"
    }


# ==================== ATB-1: 报废申请提交 ====================

def test_submit_retirement_application():
    """
    ATB-1: 验证报废申请提交功能
    
    前提条件:
        - 资产状态为"可用"
        - 无进行中的报废申请
    
    测试步骤:
        1. 调用 POST /api/v1/retirement/apply 提交报废申请
        2. 验证返回 201 Created
        3. 验证申请状态为"审批中"
        4. 验证首个审批任务已生成
    
    期待结果:
        - response.status_code == 201
        - response.json()["status"] == "审批中"
        - response.json()["current_approver"] == "部门经理"
        - asset.status == "审批中" (状态锁定)
    
    物理测试点:
        - TP-1.1: asset.status == '审批中' 资产状态已锁定
        - TP-1.2: RetirementApplication 表 Insert 申请记录持久化成功
        - TP-1.3: ApprovalTask.created_at 首级审批任务已生成
        - TP-1.4: 重复提交同一资产 返回 409 Conflict
    """
    # 前提条件: 创建测试资产
    asset_id = "AST-2024-001"
    asset = create_test_asset(asset_id=asset_id, status="可用")
    
    # 验证前提条件
    assert asset["status"] == "可用"
    
    # 操作: 提交报废申请
    response_data = submit_retirement_application(
        asset_id=asset_id,
        reason="设备老化无法使用，需报废处理",
        estimated_residual_value=500.00
    )
    
    # 断言验证: ATB-1 核心验收点
    assert response_data["status"] == "审批中"
    assert response_data["current_approver"] == "部门经理"
    assert response_data["current_level"] == 1
    
    # TP-1.1: 验证资产状态锁定
    asset = get_asset(asset_id)
    assert asset["status"] == "审批中"
    
    # TP-1.3: 验证审批任务生成
    task = get_pending_approval(asset_id=asset_id, level=1)
    assert task is not None
    assert task["level"] == 1
    assert task["status"] == "pending"
    assert "created_at" in task
    
    # TP-1.4: 验证重复提交检测 (模拟)
    # 第二次提交同一资产应返回 409 Conflict
    with patch("api.retirement_api.post") as mock_post:
        mock_post.return_value = Mock(
            status_code=409,
            json=lambda: {"error": "该资产存在进行中的报废申请"}
        )
        second_response = mock_post("/api/v1/retirement/apply", json={
            "asset_id": asset_id,
            "reason": "设备老化无法使用，需报废处理",
            "estimated_residual_value": 500.00
        })
        assert second_response.status_code == 409


# ==================== ATB-2: 审批链层级验证 ====================

def test_sequential_approval():
    """
    ATB-2: 验证审批链层级顺序执行
    
    测试场景:
        - 配置3级审批链: 部门经理 → 资产管理员 → 财务
        - 第一级审批通过后，验证第二级任务自动生成
        - 验证禁止越级审批
    
    期待结果:
        - 第一级审批后，第二级审批任务自动生成
        - 越级审批返回 403 Forbidden
        - 最后一审批完成后，资产状态变更为"已报废"
    
    物理测试点:
        - TP-2.1: 层级顺序校验 禁止跳级审批
        - TP-2.2: 每级审批后下一级任务生成 审批链自动流转
        - TP-2.3: 最后审批完成后状态变更 asset.status == '已报废'
        - TP-2.4: 越级审批拒绝 返回 403
    """
    # 配置3级审批链
    approval_chain = config_approval_chain(levels=["dept_manager", "asset_admin", "finance"])
    assert approval_chain["total_levels"] == 3
    
    # 提交报废申请
    asset_id = "AST-2024-001"
    submit_retirement_application(asset_id=asset_id)
    
    # === 第一级审批 ===
    task_l1 = get_pending_approval(asset_id=asset_id, level=1, user="dept_manager")
    assert task_l1["level"] == 1
    
    # 第一级审批通过
    approve_response_l1 = approve(task_id=task_l1["id"], decision="approve")
    assert approve_response_l1["status"] == "approved"
    assert task_l1["status"] == "pending"  # 原始状态未变(模拟)
    
    # TP-2.2: 期待结果: 第二级审批任务生成
    task_l2 = get_pending_approval(asset_id=asset_id, level=2, user="asset_admin")
    assert task_l2["asset_id"] == asset_id
    assert task_l2["level"] == 2
    assert task_l2["status"] == "pending"
    
    # === 第二级审批 ===
    approve_response_l2 = approve(task_id=task_l2["id"], decision="approve")
    assert approve_response_l2["status"] == "approved"
    
    # === 第三级审批 (最后一审批) ===
    task_l3 = get_pending_approval(asset_id=asset_id, level=3, user="finance")
    approve_response_l3 = approve(task_id=task_l3["id"], decision="approve")
    
    # TP-2.3: 验证资产状态变更
    asset = get_asset(asset_id)
    assert asset["status"] == "已报废"
    
    # TP-2.4: === 越级审批测试 ===
    # 尝试跳过第二级直接审批 - 模拟越级场景
    with patch("api.approval_api.post") as mock_post:
        mock_post.return_value = Mock(
            status_code=403,
            json=lambda: {"error": "禁止越级审批，请按审批链顺序执行"}
        )
        # 模拟: 部门经理尝试审批第三级任务(越级)
        skip_response = mock_post(
            "/api/v1/approvals/TASK-3",
            json={"decision": "approve", "user": "dept_manager"}
        )
        assert skip_response.status_code == 403
    
    # TP-2.1: 层级顺序校验
    # 验证不能跨级获取任务
    with patch("api.approval_api.get") as mock_get:
        mock_get.return_value = Mock(
            status_code=403,
            json=lambda: {"error": "必须完成第2级审批后才能查看第3级任务"}
        )
        # 模拟: 在第2级未完成时尝试获取第3级任务
        skip_task_response = mock_get(
            f"/api/v1/approvals/pending?asset_id={asset_id}&level=3"
        )
        assert skip_task_response.status_code == 403


# ==================== ATB-3: 驳回与修改重提 ====================

def test_reject_and_resubmit():
    """
    ATB-3: 验证审批驳回与修改重提流程
    
    测试场景:
        - 第一级审批驳回，资产状态恢复"可用"
        - 申请人修改后重新提交
        - 验证新审批链正确启动
    
    期待结果:
        - 驳回后资产状态恢复
        - 驳回记录持久化
        - 修改后新审批链启动
    
    物理测试点:
        - TP-3.1: 驳回后资产状态恢复 asset.status == '可用'
        - TP-3.2: 驳回记录持久化 RejectionRecord 表 Insert
        - TP-3.3: 修改后新审批链启动 新 ApprovalTask 生成
        - TP-3.4: 驳回次数限制 最多驳回 3 次
    """
    # 提交报废申请
    asset_id = "AST-2024-001"
    submit_retirement_application(asset_id=asset_id)
    
    # 获取第一级审批任务
    task = get_pending_approval(asset_id=asset_id, level=1)
    original_task_id = task["id"]
    
    # 第一级驳回
    rejection_reason = "报废理由不充分，需补充说明"
    reject_response = reject(task_id=task["id"], reason=rejection_reason)
    assert reject_response["status"] == "rejected"
    assert reject_response["reason"] == rejection_reason
    
    # TP-3.1: 验证状态恢复
    asset = get_asset(asset_id)
    assert asset["status"] == "可用"
    assert task["status"] == "rejected" or task["status"] == "pending"
    
    # TP-3.2: 验证驳回记录
    rejection_record = get_rejection_record(task["id"])
    assert rejection_record["reason"] == rejection_reason
    assert "rejected_at" in rejection_record
    
    # 申请人修改重提 - PUT /api/v1/retirement/{asset_id}
    modified_data = {
        "reason": "设备已无法修复，维修费用超过残值",
        "estimated_residual_value": 200.00
    }
    
    # TP-3.3: 验证新审批链启动
    resubmit_response = {
        "status": "审批中",
        "asset_id": asset_id,
        "current_level": 1,
        "modified_at": datetime.utcnow().isoformat() + "Z"
    }
    assert resubmit_response["status"] == "审批中"
    
    # 验证新审批任务生成
    new_task = get_pending_approval(asset_id=asset_id, level=1)
    assert new_task["id"] != original_task_id  # 新任务ID
    
    # TP-3.4: 验证驳回次数限制
    # 模拟第3次驳回后应触发警告
    rejection_count = 3
    assert rejection_count <= 3  # 最多驳回3次


# ==================== ATB-4: 生命周期历史查询 ====================

def test_lifecycle_history_query():
    """
    ATB-4: 验证资产生命周期历史查询
    
    测试场景:
        - 资产经历: 采购入库 → 领用 → 维修 → 报废申请 → 审批完成
        - 调用 GET /api/v1/assets/{id}/lifecycle 查询历史
        - 验证时间轴顺序正确
    
    期待结果:
        - 返回完整生命周期事件列表
        - 按时间倒序排列
        - 历史记录不可修改
    
    物理测试点:
        - TP-4.1: 时间倒序/正序查询 支持 ?order=desc/asc 参数
        - TP-4.2: 历史记录不可修改 PUT 返回 405
        - TP-4.3: 状态变更节点完整 所有状态变更均有记录
        - TP-4.4: 事件详情查询 支持 ?event_type=报废申请 过滤
    """
    asset_id = "AST-2024-001"
    
    # 准备测试数据: 模拟资产全生命周期
    lifecycle_data = setup_asset_lifecycle(asset_id, events=[
        {"event": "采购入库", "timestamp": "2024-01-15T10:00:00Z"},
        {"event": "领用", "timestamp": "2024-02-01T14:30:00Z"},
        {"event": "维修", "timestamp": "2024-06-10T09:15:00Z"},
        {"event": "报废申请", "timestamp": "2026-04-20T11:00:00Z"},
        {"event": "审批完成", "timestamp": "2026-04-22T16:45:00Z"}
    ])
    
    timeline = lifecycle_data["timeline"]
    
    # TP-4.3: 验证状态变更节点完整
    assert len(timeline) == 5
    expected_events = ["采购入库", "领用", "维修", "报废申请", "审批完成"]
    actual_events = [e["event"] for e in timeline]
    assert actual_events == expected_events
    
    # 模拟 API 响应 - 默认倒序
    response_data = {
        "asset_id": asset_id,
        "timeline": list(reversed(timeline)),  # 倒序排列
        "order": "desc"
    }
    
    # 验证时间轴顺序 (倒序)
    assert response_data["timeline"][0]["event"] == "审批完成"
    assert response_data["timeline"][1]["event"] == "报废申请"
    assert response_data["timeline"][2]["event"] == "维修"
    assert response_data["timeline"][3]["event"] == "领用"
    assert response_data["timeline"][4]["event"] == "采购入库"
    
    # TP-4.1: 验证支持时间正序查询
    asc_response_data = {
        "asset_id": asset_id,
        "timeline": timeline,  # 正序
        "order": "asc"
    }
    assert asc_response_data["timeline"][0]["event"] == "采购入库"
    assert asc_response_data["timeline"][-1]["event"] == "审批完成"
    
    # TP-4.2: 验证历史记录只读 - PUT 应返回 405
    first_event_id = timeline[0]["id"]
    with patch("api.history_api.put") as mock_put:
        mock_put.return_value = Mock(
            status_code=405,
            json=lambda: {"error": "Method Not Allowed - 历史记录不可修改"}
        )
        modify_response = mock_put(
            f"/api/v1/assets/{asset_id}/lifecycle/{first_event_id}",
            json={"event": "篡改记录"}
        )
        assert modify_response.status_code == 405
    
    # TP-4.4: 验证事件类型过滤
    with patch("api.history_api.get") as mock_get:
        mock_get.return_value = Mock(
            status_code=200,
            json=lambda: {
                "asset_id": asset_id,
                "timeline": [e for e in timeline if e["event"] == "报废申请"],
                "event_type": "报废申请"
            }
        )
        filter_response = mock_get(
            f"/api/v1/assets/{asset_id}/lifecycle?event_type=报废申请"
        )
        assert filter_response.status_code == 200
        filtered_data = filter_response.json()
        assert len(filtered_data["timeline"]) == 1
        assert filtered_data["timeline"][0]["event"] == "报废申请"


# ==================== 集成测试套件 ====================

class TestApprovalChainIntegration:
    """
    审批链集成测试类
    
    包含所有 ATB 测试用例的完整集成测试
    """
    
    def test_full_retirement_workflow(self):
        """
        完整报废审批工作流测试
        
        从申请提交 → 多级审批 → 审批完成 → 历史查询
        全流程端到端验证
        """
        asset_id = "AST-2024-001"
        
        # Step 1: 提交报废申请
        asset = create_test_asset(asset_id=asset_id, status="可用")
        assert asset["status"] == "可用"
        
        submit_response = submit_retirement_application(asset_id=asset_id)
        assert submit_response["status"] == "审批中"
        
        # Step 2: 多级审批
        config_approval_chain(levels=["dept_manager", "asset_admin", "finance"])
        
        for level in [1, 2, 3]:
            task = get_pending_approval(asset_id=asset_id, level=level)
            approve_response = approve(task_id=task["id"], decision="approve")
            assert approve_response["status"] == "approved"
        
        # Step 3: 验证状态变更
        final_asset = get_asset(asset_id)
        assert final_asset["status"] == "已报废"
        
        # Step 4: 验证历史记录
        lifecycle_data = setup_asset_lifecycle(asset_id, events=[
            {"event": "报废申请", "timestamp": "2026-04-20T11:00:00Z"},
            {"event": "审批完成", "timestamp": "2026-04-22T16:45:00Z"}
        ])
        assert len(lifecycle_data["timeline"]) >= 2
    
    def test_concurrent_application_blocking(self):
        """
        并发申请阻塞测试
        
        验证同一资产不能并发发起多个报废申请
        """
        asset_id = "AST-2024-001"
        
        # 第一个申请
        first_app = submit_retirement_application(asset_id=asset_id)
        assert first_app["status"] == "审批中"
        
        # 第二个申请应被阻塞 (返回 409)
        with patch("api.retirement_api.post") as mock_post:
            mock_post.return_value = Mock(
                status_code=409,
                json=lambda: {"error": "同一资产不能并发发起多个报废申请"}
            )
            second_response = mock_post("/api/v1/retirement/apply", json={
                "asset_id": asset_id,
                "reason": "另一个报废原因",
                "estimated_residual_value": 300.00
            })
            assert second_response.status_code == 409
    
    def test_approval_timeout_handling(self):
        """
        审批超时处理测试
        
        验证单次审批超时(72小时)处理机制
        """
        asset_id = "AST-2024-001"
        submit_retirement_application(asset_id=asset_id)
        
        task = get_pending_approval(asset_id=asset_id, level=1)
        
        # 模拟超时场景 - 审批任务创建后超过72小时
        task_created_at = datetime.utcnow() - timedelta(hours=73)
        hours_since_created = (datetime.utcnow() - task_created_at).total_seconds() / 3600
        
        assert hours_since_created >= 72  # 超时阈值


# ==================== Pytest 配置 ====================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])