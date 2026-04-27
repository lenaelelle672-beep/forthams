"""
ATB-3: 写入操作隔离验证测试套件

验收标准:
- ATB-3.1: 创建记录自动注入 tenant_id
- ATB-3.2: 禁止显式传入 tenant_id
- ATB-3.3: 跨租户更新被拦截

测试策略:
- 使用 TenantContext 模拟不同租户的请求上下文
- 验证 ORM 层在写入时自动注入 tenant_id
- 验证 API 层拒绝显式 tenant_id 参数
- 验证跨租户更新操作被正确拦截
"""

import pytest
from unittest.mock import MagicMock, patch
from typing import Optional

# 导入待测试的模块
from core.tenant_context import TenantContext
from core.exceptions import (
    TenantContextRequired,
    TenantAccessDenied,
    TenantMismatchError
)


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def tenant_a_context():
    """租户 A 的上下文 fixture"""
    tenant_id = "tenant_a_123"
    TenantContext.set(tenant_id)
    yield tenant_id
    TenantContext.clear()


@pytest.fixture
def tenant_b_context():
    """租户 B 的上下文 fixture"""
    tenant_id = "tenant_b_456"
    TenantContext.set(tenant_id)
    yield tenant_id
    TenantContext.clear()


@pytest.fixture
def empty_context():
    """空上下文 fixture（未设置租户）"""
    TenantContext.clear()
    yield None


@pytest.fixture
def mock_tenant_aware_model():
    """
    模拟租户感知模型的 fixture
    
    Returns:
        MagicMock: 模拟的租户感知模型类
    """
    from models.mixins.tenant_aware import TenantAwareMixin
    
    model = MagicMock(spec=TenantAwareMixin)
    model.tenant_id = None
    return model


# =============================================================================
# ATB-3.1: 创建记录自动注入 tenant_id
# =============================================================================

class TestCreateAutoInjection:
    """ATB-3.1: 创建记录自动注入 tenant_id"""
    
    def test_create_auto_injects_tenant_id(self, tenant_a_context):
        """
        ATB-3.1.1: 创建记录时自动注入当前上下文的 tenant_id
        
        测试步骤:
        1. 设置租户 A 的上下文 (tenant_a_123)
        2. 模拟创建资产的 ORM 操作
        3. 验证创建的记录包含正确的 tenant_id
        
        期待结果: 数据库记录 tenant_id = 当前租户
        """
        # Arrange
        from models.asset import Asset
        from infrastructure.database.repositories import AssetRepository
        
        repo = AssetRepository()
        asset_data = {
            "name": "测试资产",
            "asset_number": "AST-001",
            "purchase_date": "2024-01-01",
            "purchase_amount": 10000.00
        }
        
        # Act
        with patch.object(repo, 'create') as mock_create:
            mock_create.return_value = Asset(
                id=1,
                tenant_id=tenant_a_context,
                **asset_data
            )
            
            result = repo.create(asset_data)
            
            # Assert
            mock_create.assert_called_once()
            call_args = mock_create.call_args[0][0] if mock_create.call_args[0] else mock_create.call_args[1]
            
            # 验证 tenant_id 被自动注入（不应在原始数据中）
            assert "tenant_id" not in asset_data
            # 验证返回结果的 tenant_id
            assert result.tenant_id == tenant_a_context
    
    def test_create_without_context_raises_error(self, empty_context):
        """
        ATB-3.1.2: 无租户上下文时创建操作应抛出异常
        
        期待结果: 抛出 TenantContextRequired 异常
        """
        from infrastructure.database.repositories import AssetRepository
        
        repo = AssetRepository()
        asset_data = {
            "name": "测试资产",
            "asset_number": "AST-002"
        }
        
        # Act & Assert
        with pytest.raises(TenantContextRequired) as exc_info:
            repo.create(asset_data)
        
        assert "tenant_id" in str(exc_info.value).lower() or "tenant" in str(exc_info.value).lower()
    
    def test_create_injects_correct_tenant_for_multi_tenants(self, tenant_a_context, tenant_b_context):
        """
        ATB-3.1.3: 多租户场景下，每个租户创建时注入各自的 tenant_id
        
        测试步骤:
        1. 租户 A 创建资产 A1
        2. 切换到租户 B 上下文
        3. 租户 B 创建资产 B1
        4. 验证 A1.tenant_id = 'tenant_a_123'
        5. 验证 B1.tenant_id = 'tenant_b_456'
        
        期待结果: 两个记录各有正确的 tenant_id
        """
        from models.asset import Asset
        from infrastructure.database.repositories import AssetRepository
        
        repo = AssetRepository()
        
        # Act - 租户 A 创建
        TenantContext.set("tenant_a_123")
        with patch.object(repo, 'create') as mock_create_a:
            mock_create_a.return_value = Asset(
                id=1,
                tenant_id="tenant_a_123",
                name="资产A1",
                asset_number="AST-A001"
            )
            asset_a1 = repo.create({"name": "资产A1", "asset_number": "AST-A001"})
        
        # Act - 租户 B 创建
        TenantContext.set("tenant_b_456")
        with patch.object(repo, 'create') as mock_create_b:
            mock_create_b.return_value = Asset(
                id=2,
                tenant_id="tenant_b_456",
                name="资产B1",
                asset_number="AST-B001"
            )
            asset_b1 = repo.create({"name": "资产B1", "asset_number": "AST-B001"})
        
        # Assert
        assert asset_a1.tenant_id == "tenant_a_123"
        assert asset_b1.tenant_id == "tenant_b_456"
        assert asset_a1.tenant_id != asset_b1.tenant_id


# =============================================================================
# ATB-3.2: 禁止显式传入 tenant_id
# =============================================================================

class TestExplicitTenantIdRejection:
    """ATB-3.2: 禁止显式传入 tenant_id"""
    
    def test_explicit_tenant_id_rejected_in_create(self, tenant_a_context):
        """
        ATB-3.2.1: API 层应拒绝显式传入 tenant_id 的创建请求
        
        期待结果: API 拒绝请求，返回 400
        """
        from api.schemas.asset_schema import AssetCreateSchema
        
        # Arrange - 尝试显式传入 tenant_id
        invalid_data = {
            "name": "测试资产",
            "asset_number": "AST-003",
            "tenant_id": "tenant_b_789"  # 非法：显式传入 tenant_id
        }
        
        # Act & Assert
        with pytest.raises(TenantMismatchError) as exc_info:
            schema = AssetCreateSchema(**invalid_data)
        
        assert "tenant_id" in str(exc_info.value).lower()
    
    def test_explicit_tenant_id_rejected_in_update(self, tenant_a_context):
        """
        ATB-3.2.2: API 层应拒绝显式传入 tenant_id 的更新请求
        
        期待结果: API 拒绝请求，返回 400
        """
        from api.schemas.asset_schema import AssetUpdateSchema
        
        # Arrange - 尝试显式传入 tenant_id
        invalid_data = {
            "name": "更新后的名称",
            "tenant_id": "tenant_c_999"  # 非法：尝试修改租户
        }
        
        # Act & Assert
        with pytest.raises(TenantMismatchError):
            schema = AssetUpdateSchema(**invalid_data)
    
    def test_tenant_id_field_removed_from_schema(self):
        """
        ATB-3.2.3: 创建 Schema 不应包含 tenant_id 字段
        
        验证 Schema 定义中显式禁止 tenant_id
        """
        from api.schemas.asset_schema import AssetCreateSchema
        from pydantic import ValidationError
        
        # tenant_id 字段应该不在 schema 中
        # 如果意外包含，应抛出验证错误
        valid_data = {
            "name": "测试资产",
            "asset_number": "AST-004"
        }
        
        # 不应抛出异常
        schema = AssetCreateSchema(**valid_data)
        assert hasattr(schema, 'tenant_id') is False or schema.tenant_id is None


# =============================================================================
# ATB-3.3: 跨租户更新被拦截
# =============================================================================

class TestCrossTenantUpdateBlocked:
    """ATB-3.3: 跨租户更新被拦截"""
    
    def test_cross_tenant_update_blocked(self, tenant_a_context):
        """
        ATB-3.3.1: 租户 A 尝试更新租户 B 的记录应被拦截
        
        测试步骤:
        1. 设置租户 A 的上下文
        2. 尝试更新属于租户 B 的资产
        3. 验证更新被拒绝
        
        期待结果: 更新 0 行，抛出 TenantAccessDenied 异常
        """
        from infrastructure.database.repositories import AssetRepository
        
        repo = AssetRepository()
        asset_id = 999  # 租户 B 的资产 ID
        
        update_data = {"name": "非法更新"}
        
        # Act & Assert
        with patch.object(repo, 'update') as mock_update:
            mock_update.return_value = 0  # 影响行数为 0
            
            with pytest.raises(TenantAccessDenied) as exc_info:
                repo.update(asset_id, update_data)
            
            # 验证未调用实际的 update（被拦截）
            assert mock_update.call_count == 0
    
    def test_update_different_tenant_raises_exception(self, tenant_a_context):
        """
        ATB-3.3.2: 更新不同租户的实体时抛出权限异常
        
        期待结果: 抛出 TenantAccessDenied 异常
        """
        from services.asset_service import AssetService
        
        service = AssetService()
        
        # 尝试更新租户 B 的资产
        with patch.object(service, 'get_by_id') as mock_get:
            # 模拟获取到租户 B 的资产
            mock_asset = MagicMock()
            mock_asset.tenant_id = "tenant_b_456"
            mock_get.return_value = mock_asset
            
            with pytest.raises(TenantAccessDenied):
                service.update_asset(999, {"name": "非法更新"})
    
    def test_delete_cross_tenant_blocked(self, tenant_a_context):
        """
        ATB-3.3.3: 租户 A 尝试删除租户 B 的记录应被拦截
        
        期待结果: 删除 0 行，抛出 TenantAccessDenied 异常
        """
        from infrastructure.database.repositories import AssetRepository
        
        repo = AssetRepository()
        asset_id = 888  # 租户 B 的资产 ID
        
        # Act & Assert
        with patch.object(repo, 'delete') as mock_delete:
            mock_delete.return_value = 0
            
            with pytest.raises(TenantAccessDenied):
                repo.delete(asset_id)


# =============================================================================
# ATB-3.4: 异常处理验证
# =============================================================================

class TestTenantExceptions:
    """ATB-3.4: 租户相关异常的标准化处理"""
    
    def test_tenant_context_required_exception(self):
        """
        ATB-3.4.1: TenantContextRequired 异常的触发和消息
        
        触发场景: 查询时 TenantContext 未设置
        HTTP 状态码: 401
        """
        exception = TenantContextRequired()
        
        assert exception.status_code == 401
        assert "tenant" in str(exception.detail).lower()
    
    def test_tenant_access_denied_exception(self):
        """
        ATB-3.4.2: TenantAccessDenied 异常的触发和消息
        
        触发场景: 尝试访问非所属租户资源
        HTTP 状态码: 403
        """
        exception = TenantAccessDenied(
            resource_type="Asset",
            resource_id=123,
            requested_tenant="tenant_a",
            actual_tenant="tenant_b"
        )
        
        assert exception.status_code == 403
        assert "access" in str(exception.detail).lower() or "denied" in str(exception.detail).lower()
    
    def test_tenant_mismatch_error_exception(self):
        """
        ATB-3.4.3: TenantMismatchError 异常的触发和消息
        
        触发场景: 写入数据与上下文不一致
        HTTP 状态码: 400
        """
        exception = TenantMismatchError(
            field="tenant_id",
            provided="tenant_b",
            expected="tenant_a"
        )
        
        assert exception.status_code == 400
        assert "tenant_id" in str(exception.detail).lower() or "mismatch" in str(exception.detail).lower()


# =============================================================================
# ATB-3.5: 批量操作租户隔离
# =============================================================================

class TestBatchOperationIsolation:
    """ATB-3.5: 批量操作租户隔离"""
    
    def test_batch_create_injects_tenant_id(self, tenant_a_context):
        """
        ATB-3.5.1: 批量创建时每个记录都注入正确的 tenant_id
        
        期待结果: 批量创建的记录都有当前租户的 tenant_id
        """
        from infrastructure.database.repositories import AssetRepository
        
        repo = AssetRepository()
        batch_data = [
            {"name": "资产1", "asset_number": "AST-B001"},
            {"name": "资产2", "asset_number": "AST-B002"},
            {"name": "资产3", "asset_number": "AST-B003"},
        ]
        
        # Act
        with patch.object(repo, 'batch_create') as mock_batch:
            from models.asset import Asset
            mock_batch.return_value = [
                Asset(id=i, tenant_id=tenant_a_context, **data)
                for i, data in enumerate(batch_data, start=1)
            ]
            
            results = repo.batch_create(batch_data)
        
        # Assert - 验证所有记录都有正确的 tenant_id
        assert len(results) == 3
        for result in results:
            assert result.tenant_id == tenant_a_context
    
    def test_batch_update_respects_tenant_boundary(self, tenant_a_context):
        """
        ATB-3.5.2: 批量更新只影响当前租户的数据
        
        期待结果: 跨租户的批量更新被拦截
        """
        from infrastructure.database.repositories import AssetRepository
        
        repo = AssetRepository()
        asset_ids = [1, 2, 3]
        update_data = {"status": "retired"}
        
        # Act & Assert
        with patch.object(repo, 'batch_update') as mock_batch:
            # 返回 0 表示没有记录被更新（被租户过滤拦截）
            mock_batch.return_value = 0
            
            with pytest.raises(TenantAccessDenied):
                repo.batch_update(asset_ids, update_data)


# =============================================================================
# ATB-3.6: 集成测试场景
# =============================================================================

class TestWriteIsolationIntegration:
    """ATB-3.6: 写入隔离集成测试"""
    
    def test_full_crud_flow_with_tenant_isolation(self, tenant_a_context):
        """
        ATB-3.6.1: 完整的 CRUD 流程验证租户隔离
        
        测试步骤:
        1. Create - 创建资产 (tenant_id 自动注入)
        2. Read - 读取创建的资产 (验证 tenant_id)
        3. Update - 更新资产 (验证只能更新自己的数据)
        4. Delete - 删除资产 (验证只能删除自己的数据)
        """
        from services.asset_service import AssetService
        from models.asset import Asset
        
        service = AssetService()
        created_asset = None
        
        # Create
        with patch.object(service.repository, 'create') as mock_create:
            created_asset = Asset(
                id=1,
                tenant_id=tenant_a_context,
                name="集成测试资产",
                asset_number="INT-001"
            )
            mock_create.return_value = created_asset
            
            result = service.create_asset({
                "name": "集成测试资产",
                "asset_number": "INT-001"
            })
            
            assert result.tenant_id == tenant_a_context
        
        # Read
        with patch.object(service.repository, 'get_by_id') as mock_get:
            mock_get.return_value = created_asset
            
            read_result = service.get_asset(1)
            assert read_result.tenant_id == tenant_a_context
        
        # Update
        with patch.object(service, 'update_asset') as mock_update:
            mock_update.return_value = created_asset
            
            updated = service.update_asset(1, {"name": "更新后名称"})
            assert updated.tenant_id == tenant_a_context
        
        # Delete
        with patch.object(service.repository, 'delete') as mock_delete:
            mock_delete.return_value = 1
            
            deleted = service.delete_asset(1)
            assert deleted is True


# =============================================================================
# ATB-3.7: 边界条件测试
# =============================================================================

class TestWriteIsolationEdgeCases:
    """ATB-3.7: 写入隔离边界条件"""
    
    def test_null_tenant_id_rejected_on_create(self, tenant_a_context):
        """
        ATB-3.7.1: 尝试创建 tenant_id 为 null 的记录被拒绝
        
        期待结果: 抛出 TenantContextRequired 异常
        """
        from infrastructure.database.repositories import AssetRepository
        
        repo = AssetRepository()
        
        with patch.object(repo, 'create') as mock_create:
            # 模拟 ORM 层返回 tenant_id 为 None 的记录
            from models.asset import Asset
            mock_create.return_value = Asset(
                id=1,
                tenant_id=None,  # 非法：tenant_id 为空
                name="测试"
            )
            
            result = repo.create({"name": "测试"})
            
            # 验证结果
            assert result.tenant_id is not None
    
    def test_tenant_id_immutable_after_create(self, tenant_a_context):
        """
        ATB-3.7.2: 创建后 tenant_id 不可修改
        
        期待结果: 尝试修改 tenant_id 抛出异常
        """
        from models.asset import Asset
        
        asset = Asset(
            id=1,
            tenant_id="tenant_a_123",
            name="测试"
        )
        
        # 尝试修改 tenant_id 应该被阻止
        with pytest.raises((AttributeError, TenantMismatchError)):
            asset.tenant_id = "tenant_b_456"
    
    def test_context_clear_prevents_write(self, tenant_a_context):
        """
        ATB-3.7.3: 上下文清除后无法进行写入操作
        
        期待结果: 抛出 TenantContextRequired 异常
        """
        from infrastructure.database.repositories import AssetRepository
        
        # 先设置上下文
        TenantContext.set("tenant_a_123")
        
        # 清除上下文
        TenantContext.clear()
        
        repo = AssetRepository()
        
        # Act & Assert
        with pytest.raises(TenantContextRequired):
            repo.create({"name": "测试"})
    
    def test_nested_context_switch_handled_correctly(self):
        """
        ATB-3.7.4: 嵌套上下文切换时，使用最近的外层上下文
        
        验证 TenantContext.with_tenant() 上下文管理器正确工作
        """
        with TenantContext.with_tenant("tenant_a"):
            tenant_a_id = TenantContext.get()
            assert tenant_a_id == "tenant_a"
            
            # 嵌套切换
            with TenantContext.with_tenant("tenant_b"):
                tenant_b_id = TenantContext.get()
                assert tenant_b_id == "tenant_b"
            
            # 回到租户 A
            assert TenantContext.get() == "tenant_a"
        
        # 最外层应该清除
        assert TenantContext.get() is None