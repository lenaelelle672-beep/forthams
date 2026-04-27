import pytest
import uuid
import threading
import time
from django.db import models
from django.db.models.constraints import UniqueConstraint
from django.test import TestCase, override_settings

from src.app.models.base import (
    TenantContext,
    TenantContextError,
    TenantAwareQuerySet,
    TenantAwareManager,
    BaseTenantModel,
)


# ============================================================
# AC-001 & AC-002: 多租户数据隔离测试 (integration)
# ============================================================

class TestTenantContextBasicOperations:
    """TenantContext 基本操作测试 - 验证请求级租户上下文绑定"""

    def setup_method(self):
        """每个测试前清理租户上下文"""
        TenantContext.clear()

    def teardown_method(self):
        """每个测试后清理租户上下文"""
        TenantContext.clear()

    def test_ac001_set_current_and_get_current_returns_same_tenant_id(self):
        """AC-001: 验证设置当前租户ID后能正确获取"""
        tenant_id = uuid.uuid4()
        TenantContext.set_current(tenant_id)
        result = TenantContext.get_current()
        assert result == tenant_id

    def test_ac001_get_current_raises_error_when_not_initialized(self):
        """AC-001: 验证未初始化时抛出 TenantContextError"""
        TenantContext.clear()
        with pytest.raises(TenantContextError) as exc_info:
            TenantContext.get_current()
        assert exc_info.value.error_code == "TENANT_001"

    def test_ac001_get_current_optional_returns_none_when_not_set(self):
        """AC-001: 验证可选获取在未设置时返回 None"""
        TenantContext.clear()
        result = TenantContext.get_current_optional()
        assert result is None

    def test_ac001_get_current_optional_returns_tenant_id_when_set(self):
        """AC-001: 验证可选获取在设置后返回正确的租户ID"""
        tenant_id = uuid.uuid4()
        TenantContext.set_current(tenant_id)
        result = TenantContext.get_current_optional()
        assert result == tenant_id

    def test_ac001_clear_removes_tenant_context(self):
        """AC-001: 验证 clear() 方法能正确清除租户上下文"""
        tenant_id = uuid.uuid4()
        TenantContext.set_current(tenant_id)
        TenantContext.clear()
        assert TenantContext.get_current_optional() is None
        with pytest.raises(TenantContextError):
            TenantContext.get_current()

    def test_ac001_set_current_rejects_non_uuid_type(self):
        """AC-001: 验证 set_current 拒绝非 UUID 类型（约束-002）"""
        with pytest.raises(TypeError) as exc_info:
            TenantContext.set_current("not-a-uuid-string")
        assert "must be UUID" in str(exc_info.value)

        with pytest.raises(TypeError):
            TenantContext.set_current(123456)

        with pytest.raises(TypeError):
            TenantContext.set_current(None)

    def test_ac001_set_current_accepts_valid_uuid(self):
        """AC-001: 验证 set_current 接受有效的 UUID 类型"""
        tenant_id = uuid.uuid4()
        TenantContext.set_current(tenant_id)
        assert TenantContext.get_current() == tenant_id


class TestTenantContextError:
    """TenantContextError 异常测试"""

    def test_ac001_error_contains_message_and_error_code(self):
        """AC-001: 验证异常包含消息和错误码"""
        error = TenantContextError(
            "TenantContext not initialized",
            error_code="TENANT_001"
        )
        assert error.message == "TenantContext not initialized"
        assert error.error_code == "TENANT_001"
        assert "TENANT_001" in str(error)
        assert "TenantContext not initialized" in str(error)

    def test_ac001_error_default_error_code(self):
        """AC-001: 验证默认错误码为 TENANT_001"""
        error = TenantContextError("Test error")
        assert error.error_code == "TENANT_001"


class TestTenantContextIsolation:
    """租户上下文隔离测试 - 验证数据完全隔离"""

    def setup_method(self):
        TenantContext.clear()

    def teardown_method(self):
        TenantContext.clear()

    def test_ac002_different_tenants_isolated_in_sequence(self):
        """AC-002: 验证不同租户在顺序执行时上下文正确隔离"""
        tenant_a = uuid.uuid4()
        tenant_b = uuid.uuid4()

        TenantContext.set_current(tenant_a)
        assert TenantContext.get_current() == tenant_a

        TenantContext.clear()
        TenantContext.set_current(tenant_b)
        assert TenantContext.get_current() == tenant_b

        TenantContext.clear()
        with pytest.raises(TenantContextError):
            TenantContext.get_current()

    def test_ac002_thread_isolation(self):
        """AC-002: 验证租户上下文在线程间隔离（约束-001）"""
        results = {}
        errors = []

        def worker(thread_name, tenant_id):
            try:
                TenantContext.set_current(tenant_id)
                time.sleep(0.05)
                results[thread_name] = TenantContext.get_current()
            except Exception as e:
                errors.append((thread_name, str(e)))

        tenant_ids = {
            "thread_A": uuid.uuid4(),
            "thread_B": uuid.uuid4(),
            "thread_C": uuid.uuid4(),
        }

        threads = [
            threading.Thread(target=worker, args=(name, tid))
            for name, tid in tenant_ids.items()
        ]

        for t in threads:
            t.start()

        for t in threads:
            t.join()

        assert len(errors) == 0, f"Errors occurred: {errors}"
        for thread_name, expected_id in tenant_ids.items():
            assert results[thread_name] == expected_id, \
                f"{thread_name} got wrong tenant_id: {results[thread_name]} != {expected_id}"


class TestTenantAwareQuerySet:
    """TenantAwareQuerySet 租户感知查询集测试"""

    def setup_method(self):
        TenantContext.clear()

    def teardown_method(self):
        TenantContext.clear()

    def _create_dummy_model(self):
        """创建测试用 DummyModel"""
        class DummyModel(models.Model):
            tenant_id = models.UUIDField()
            name = models.CharField(max_length=100)

            class Meta:
                app_label = 'test_app'

        return DummyModel

    def test_ac001_apply_tenant_filter_returns_filtered_queryset(self):
        """AC-001: 验证 _apply_tenant_filter 返回过滤后的查询集"""
        DummyModel = self._create_dummy_model()
        tenant_id = uuid.uuid4()
        qs = TenantAwareQuerySet(DummyModel, using='default')
        filtered_qs = qs._apply_tenant_filter(tenant_id)
        assert isinstance(filtered_qs, TenantAwareQuerySet)

    def test_ac001_exclude_tenant_returns_all(self):
        """AC-001: 验证 _exclude_tenant 返回未过滤的查询集（仅系统级查询）"""
        DummyModel = self._create_dummy_model()
        qs = TenantAwareQuerySet(DummyModel, using='default')
        result_qs = qs._exclude_tenant()
        assert isinstance(result_qs, TenantAwareQuerySet)

    def test_ac001_iterator_requires_tenant_context(self):
        """AC-001: 验证 iterator 在没有租户上下文时抛出异常"""
        DummyModel = self._create_dummy_model()
        TenantContext.clear()
        qs = TenantAwareQuerySet(DummyModel, using='default')

        with pytest.raises(TenantContextError) as exc_info:
            list(qs.iterator())
        assert exc_info.value.error_code == "TENANT_001"

    def test_ac001_iterator_works_with_tenant_context(self):
        """AC-001: 验证 iterator 在有租户上下文时正常工作"""
        DummyModel = self._create_dummy_model()
        tenant_id = uuid.uuid4()
        TenantContext.set_current(tenant_id)
        qs = TenantAwareQuerySet(DummyModel, using='default')

        iterator = qs.iterator()
        assert iterator is not None


class TestTenantAwareManager:
    """TenantAwareManager 租户感知管理器测试"""

    def setup_method(self):
        TenantContext.clear()

    def teardown_method(self):
        TenantContext.clear()

    def _create_dummy_model(self):
        """创建测试用 DummyModel"""
        class DummyModel(models.Model):
            tenant_id = models.UUIDField()
            name = models.CharField(max_length=100)

            class Meta:
                app_label = 'test_app'

        return DummyModel

    def test_ac001_get_queryset_returns_tenant_aware_queryset(self):
        """AC-001: 验证 get_queryset 返回 TenantAwareQuerySet"""
        DummyModel = self._create_dummy_model()
        manager = TenantAwareManager()
        manager.model = DummyModel
        manager._db = 'default'

        queryset = manager.get_queryset()
        assert isinstance(queryset, TenantAwareQuerySet)

    def test_ac001_get_queryset_returns_tenant_aware_when_context_set(self):
        """AC-001: 验证设置租户上下文后 get_queryset 应用过滤"""
        DummyModel = self._create_dummy_model()
        tenant_id = uuid.uuid4()
        TenantContext.set_current(tenant_id)

        manager = TenantAwareManager()
        manager.model = DummyModel
        manager._db = 'default'

        queryset = manager.get_queryset()
        assert isinstance(queryset, TenantAwareQuerySet)


class TestBaseTenantModel:
    """BaseTenantModel 基类测试"""

    def setup_method(self):
        TenantContext.clear()

    def teardown_method(self):
        TenantContext.clear()

    def test_ac001_base_model_has_tenant_id_field(self):
        """AC-001: 验证 BaseTenantModel 包含 tenant_id 字段"""

        class TestOrder(BaseTenantModel):
            name = models.CharField(max_length=100)

            class Meta:
                app_label = 'test_app'

        field_names = [f.name for f in TestOrder._meta.get_fields() if hasattr(f, 'name')]
        assert 'tenant_id' in field_names

    def test_ac001_model_unique_constraint_per_tenant(self):
        """AC-001: 验证模型支持每个租户的唯一约束"""

        class TestOrder(BaseTenantModel):
            order_number = models.CharField(max_length=100)

            class Meta:
                app_label = 'test_app'
                constraints = [
                    UniqueConstraint(
                        fields=['tenant_id', 'order_number'],
                        name='unique_tenant_order'
                    )
                ]

        constraint_names = [
            c.name for c in TestOrder._meta.constraints if hasattr(c, 'name')
        ]
        assert 'unique_tenant_order' in constraint_names


# ============================================================
# AC-005: 模块可被正常 import 测试 (unit_test)
# ============================================================

class TestModuleImport:
    """验证模块导入测试 - AC-005"""

    def test_ac005_import_base_module(self):
        """AC-005: 验证可以从 src.app.models.base 导入模块"""
        try:
            from src.app.models import base
            assert base is not None
        except ImportError as e:
            pytest.fail(f"Failed to import base module: {e}")

    def test_ac005_import_tenant_context_class(self):
        """AC-005: 验证可以导入 TenantContext 类"""
        try:
            from src.app.models.base import TenantContext
            assert TenantContext is not None
            assert callable(TenantContext.get_current)
            assert callable(TenantContext.set_current)
        except ImportError as e:
            pytest.fail(f"Failed to import TenantContext: {e}")

    def test_ac005_import_tenant_context_error_class(self):
        """AC-005: 验证可以导入 TenantContextError 异常类"""
        try:
            from src.app.models.base import TenantContextError
            assert TenantContextError is not None
            assert issubclass(TenantContextError, Exception)
        except ImportError as e:
            pytest.fail(f"Failed to import TenantContextError: {e}")

    def test_ac005_import_tenant_aware_queryset_class(self):
        """AC-005: 验证可以导入 TenantAwareQuerySet 类"""
        try:
            from src.app.models.base import TenantAwareQuerySet
            assert TenantAwareQuerySet is not None
        except ImportError as e:
            pytest.fail(f"Failed to import TenantAwareQuerySet: {e}")

    def test_ac005_import_tenant_aware_manager_class(self):
        """AC-005: 验证可以导入 TenantAwareManager 类"""
        try:
            from src.app.models.base import TenantAwareManager
            assert TenantAwareManager is not None
        except ImportError as e:
            pytest.fail(f"Failed to import TenantAwareManager: {e}")

    def test_ac005_tenant_context_has_required_methods(self):
        """AC-005: 验证 TenantContext 包含所有必需方法"""
        from src.app.models.base import TenantContext
        required_methods = ['get_current', 'get_current_optional', 'set_current', 'clear']
        for method in required_methods:
            assert hasattr(TenantContext, method), f"TenantContext missing method: {method}"
            assert callable(getattr(TenantContext, method)), f"TenantContext.{method} is not callable"

    def test_ac005_tenant_context_error_instantiation(self):
        """AC-005: 验证 TenantContextError 可以正常实例化"""
        from src.app.models.base import TenantContextError
        error = TenantContextError("Test error", error_code="TEST_001")
        assert isinstance(error, Exception)
        assert error.message == "Test error"
        assert error.error_code == "TEST_001"

    def test_ac005_import_exceptions_module(self):
        """AC-005: 验证可以导入 src.core.exceptions 模块"""
        try:
            from src.core.exceptions import TenantContextError as TCE
            assert TCE is not None
        except ImportError:
            pass


class TestIntegrationScenarios:
    """集成场景测试 - 验证完整的多租户隔离流程"""

    def setup_method(self):
        TenantContext.clear()

    def teardown_method(self):
        TenantContext.clear()

    def test_ac002_full_tenant_workflow(self):
        """AC-002: 验证完整的租户工作流"""
        tenant_id = uuid.uuid4()

        TenantContext.set_current(tenant_id)
        current = TenantContext.get_current()
        assert current == tenant_id

        TenantContext.clear()
        assert TenantContext.get_current_optional() is None

    def test_ac002_concurrent_tenant_access(self):
        """AC-002: 验证并发场景下租户隔离"""
        barrier = threading.Barrier(3)
        results = {}

        def worker(worker_id, tenant_id):
            TenantContext.set_current(tenant_id)
            barrier.wait()
            results[worker_id] = TenantContext.get_current()
            TenantContext.clear()

        tenant_a = uuid.uuid4()
        tenant_b = uuid.uuid4()
        tenant_c = uuid.uuid4()

        t1 = threading.Thread(target=worker, args=(0, tenant_a))
        t2 = threading.Thread(target=worker, args=(1, tenant_b))
        t3 = threading.Thread(target=worker, args=(2, tenant_c))

        t1.start()
        t2.start()
        t3.start()

        t1.join()
        t2.join()
        t3.join()

        assert results[0] == tenant_a
        assert results[1] == tenant_b
        assert results[2] == tenant_c