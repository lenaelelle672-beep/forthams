"""
资产历史记录集成测试

本模块验证资产状态变更时历史记录的自动创建和不可变性，
对应 SWARM-002 Phase 3 核心业务逻辑实现。

验收标准:
- ATB-006: 状态变更时自动创建历史记录
- ATB-007: 历史记录不可修改（ImmutableRecordError）
"""

import pytest
from datetime import datetime
from typing import Optional

# 导入被测模块 (假设已在 conftest.py 中配置)
# 如模块不存在，此测试将触发 ImportError，验证 AC-004


class TestAssetHistoryCreation:
    """ATB-006: 状态变更历史自动记录测试套件"""

    def test_history_created_on_state_change(self, db_session, asset_fixture):
        """
        状态变更时自动创建历史记录
        
        验证:
        1. 状态变更前历史记录数量
        2. 执行状态转换
        3. 历史记录数量 +1
        4. 最新记录包含正确的 from_status, to_status, operator_id, change_time
        """
        # Step 1: 获取初始历史记录数量
        initial_count = AssetHistoryRepository.count_by_asset(asset_fixture.id)
        
        # Step 2: 执行状态转换
        AssetStateEngine().transition(
            asset_id=asset_fixture.id,
            from_status="IN_USE",
            to_status="PENDING_RETIREMENT",
            operator_id="user_manager_001"
        )
        
        # Step 3: 验证历史记录数量增加
        new_count = AssetHistoryRepository.count_by_asset(asset_fixture.id)
        assert new_count == initial_count + 1, \
            f"历史记录数量应从 {initial_count} 增加到 {initial_count + 1}，实际为 {new_count}"
        
        # Step 4: 验证最新记录内容
        latest = AssetHistoryRepository.get_latest(asset_fixture.id)
        assert latest.from_status == "IN_USE", \
            f"from_status 应为 'IN_USE'，实际为 '{latest.from_status}'"
        assert latest.to_status == "PENDING_RETIREMENT", \
            f"to_status 应为 'PENDING_RETIREMENT'，实际为 '{latest.to_status}'"
        assert latest.operator_id == "user_manager_001", \
            f"operator_id 应为 'user_manager_001'，实际为 '{latest.operator_id}'"
        assert latest.change_time is not None, \
            "change_time 不应为 None"
        assert isinstance(latest.change_time, datetime), \
            f"change_time 应为 datetime 类型，实际为 {type(latest.change_time)}"

    def test_history_created_on_approval_completion(self, db_session, pending_request_fixture):
        """
        审批完成时创建历史记录
        
        验证审批链完成后的状态变更历史
        """
        asset_id = pending_request_fixture.asset_id
        
        # 记录审批前状态
        before_count = AssetHistoryRepository.count_by_asset(asset_id)
        
        # 执行审批流程
        RetirementApprovalWorkflow.approve(
            request_id=pending_request_fixture.id,
            approver_id="user_director_001",
            level=1
        )
        RetirementApprovalWorkflow.approve(
            request_id=pending_request_fixture.id,
            approver_id="user_cfo_001",
            level=2
        )
        
        # 验证历史记录增加
        after_count = AssetHistoryRepository.count_by_asset(asset_id)
        assert after_count > before_count, \
            "审批完成后应有新的历史记录"

    def test_history_not_created_on_failed_transition(self, db_session, asset_fixture):
        """
        非法的状态转换不创建历史记录
        
        验证无效状态转换被拒绝且不产生历史
        """
        initial_count = AssetHistoryRepository.count_by_asset(asset_fixture.id)
        
        # 尝试非法转换: IN_USE -> RETIRED (禁止直接跳转)
        result = AssetStateEngine().can_transition(
            asset_id=asset_fixture.id,
            from_status="IN_USE",
            to_status="RETIRED"
        )
        assert result is False, "IN_USE -> RETIRED 应被禁止"
        
        # 验证无新增历史记录
        new_count = AssetHistoryRepository.count_by_asset(asset_fixture.id)
        assert new_count == initial_count, \
            f"非法转换不应创建历史记录，数量应保持为 {initial_count}"


class TestAssetHistoryImmutability:
    """ATB-007: 历史记录完整性验证测试套件"""

    def test_history_immutability(self, db_session, asset_with_history):
        """
        历史记录不可修改
        
        验证尝试修改历史记录时抛出 ImmutableRecordError
        """
        latest = AssetHistoryRepository.get_latest(asset_with_history.id)
        original_to_status = latest.to_status
        
        # 尝试修改 to_status
        with pytest.raises(ImmutableRecordError) as exc_info:
            latest.to_status = "MODIFIED"
            AssetHistoryRepository.update(latest)
        
        assert "immutable" in str(exc_info.value).lower() or \
               "cannot modify" in str(exc_info.value).lower(), \
            f"异常消息应包含 'immutable' 或 'cannot modify'，实际为: {exc_info.value}"
        
        # 验证数据未被修改
        current = AssetHistoryRepository.get_latest(asset_with_history.id)
        assert current.to_status == original_to_status, \
            "历史记录内容不应被修改"

    def test_history_deletion_prevented(self, db_session, asset_with_history):
        """
        历史记录不允许删除
        
        验证删除历史记录时抛出异常
        """
        latest = AssetHistoryRepository.get_latest(asset_with_history.id)
        
        with pytest.raises((ImmutableRecordError, ProtectedRecordError)):
            AssetHistoryRepository.delete(latest)

    def test_history_metadata_integrity(self, db_session, asset_fixture):
        """
        历史记录元数据完整性
        
        验证每条历史记录包含必需字段:
        - asset_id
        - from_status
        - to_status
        - operator_id
        - change_time
        - metadata (可选)
        """
        # 执行状态转换
        AssetStateEngine().transition(
            asset_id=asset_fixture.id,
            from_status="IN_USE",
            to_status="PENDING_RETIREMENT",
            operator_id="user_manager_001"
        )
        
        latest = AssetHistoryRepository.get_latest(asset_fixture.id)
        
        # 验证必需字段
        assert latest.asset_id == asset_fixture.id, \
            f"asset_id 应为 {asset_fixture.id}"
        assert latest.from_status is not None, \
            "from_status 不应为 None"
        assert latest.to_status is not None, \
            "to_status 不应为 None"
        assert latest.operator_id is not None, \
            "operator_id 不应为 None"
        assert latest.change_time is not None, \
            "change_time 不应为 None"


class TestAssetHistoryQuery:
    """历史记录查询功能测试"""

    def test_get_history_by_asset_id(self, db_session, asset_with_history):
        """
        按资产 ID 查询历史记录
        
        验证能正确获取指定资产的所有历史记录
        """
        history_list = AssetHistoryRepository.find_by_asset_id(
            asset_id=asset_with_history.id
        )
        
        assert len(history_list) >= 1, \
            "应至少返回一条历史记录"
        for record in history_list:
            assert record.asset_id == asset_with_history.id, \
                f"所有记录应属于资产 {asset_with_history.id}"

    def test_get_history_by_date_range(self, db_session, asset_with_history):
        """
        按时间范围查询历史记录
        
        验证能正确过滤指定时间段内的历史记录
        """
        now = datetime.now()
        start_time = now - timedelta(days=365)
        end_time = now + timedelta(days=1)
        
        history_list = AssetHistoryRepository.find_by_date_range(
            asset_id=asset_with_history.id,
            start_date=start_time,
            end_date=end_time
        )
        
        # 验证所有记录在时间范围内
        for record in history_list:
            assert start_time <= record.change_time <= end_time, \
                f"记录 {record.id} 的 change_time 不在指定范围内"

    def test_get_latest_history(self, db_session, asset_with_history):
        """
        获取最新历史记录
        
        验证返回的记录是时间最新的
        """
        latest = AssetHistoryRepository.get_latest(asset_with_history.id)
        
        all_history = AssetHistoryRepository.find_by_asset_id(asset_with_history.id)
        
        if len(all_history) > 1:
            # 验证 latest 是最新的
            sorted_history = sorted(all_history, key=lambda x: x.change_time, reverse=True)
            assert latest.id == sorted_history[0].id, \
                "get_latest 应返回 change_time 最大的记录"


# Fixtures 定义
@pytest.fixture
def asset_fixture(db_session):
    """
    通用测试资产
    
    状态: IN_USE
    用途: 状态转换测试
    """
    from src.models.asset import Asset
    from src.repositories.asset_repository import AssetRepository
    
    asset = Asset(
        id="TEST_ASSET_001",
        name="测试资产",
        status="IN_USE",
        asset_code="A001",
        category_id="CAT_001"
    )
    db_session.add(asset)
    db_session.commit()
    
    return asset


@pytest.fixture
def pending_request_fixture(db_session, asset_fixture):
    """
    待审批的报废申请
    
    状态: PENDING_APPROVAL
    用途: 审批流程测试
    """
    from src.models.retirement import RetirementRequest
    from src.services.retirement_service import RetirementRequestService
    
    request = RetirementRequestService.create(
        asset_id=asset_fixture.id,
        reason="设备老化报废",
        applicant_id="user_manager_001"
    )
    
    return request


@pytest.fixture
def asset_with_history(db_session):
    """
    带历史记录的资产
    
    状态: 至少 3 条历史记录
    用途: 历史查询和不可变性测试
    """
    from src.models.asset import Asset
    from src.repositories.asset_repository import AssetRepository
    from datetime import timedelta
    
    # 创建资产
    asset = Asset(
        id="TEST_ASSET_HISTORY_001",
        name="带历史的测试资产",
        status="IN_USE",
        asset_code="A002",
        category_id="CAT_001"
    )
    db_session.add(asset)
    
    # 创建初始历史记录
    now = datetime.now()
    histories = [
        AssetHistoryRepository.create(
            asset_id=asset.id,
            from_status=None,
            to_status="IN_USE",
            operator_id="system",
            change_time=now - timedelta(days=30),
            metadata={}
        ),
        AssetHistoryRepository.create(
            asset_id=asset.id,
            from_status="IN_USE",
            to_status="PENDING_RETIREMENT",
            operator_id="user_manager_001",
            change_time=now - timedelta(days=15),
            metadata={"reason": "维修申请"}
        ),
        AssetHistoryRepository.create(
            asset_id=asset.id,
            from_status="PENDING_RETIREMENT",
            to_status="IN_USE",
            operator_id="user_director_001",
            change_time=now - timedelta(days=7),
            metadata={"reason": "审批驳回"}
        )
    ]
    
    for h in histories:
        db_session.add(h)
    
    db_session.commit()
    
    return asset


@pytest.fixture
def db_session():
    """
    数据库会话
    
    从 conftest.py 共享的会话 fixture
    """
    # 此 fixture 应在 tests/conftest.py 中定义
    # 此处引用以满足静态分析
    pass


# 需要导入的模块（用于静态分析验证）
# 这些导入在运行时由 pytest 解析
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.repositories.asset_history_repository import AssetHistoryRepository
    from src.services.state_machine.asset_state_engine import AssetStateEngine
    from src.services.retirement.approval_workflow import RetirementApprovalWorkflow
    from src.models.asset import Asset
    from src.common.exceptions import ImmutableRecordError, ProtectedRecordError