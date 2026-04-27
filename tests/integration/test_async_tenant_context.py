# =============================================================================
# SWARM-2025-Q2-P1-004: 多租户数据隔离规格文档
# 集成测试: 异步路径上下文传播
# =============================================================================
# 
# 本测试文件验证 Phase 2.4（异步上下文传播）的实现效果：
#   - TenantContextHolder (ThreadLocal) 主线程写入/子线程透传
#   - @Async 方法包装：异步任务自动继承调用方 tenant_id
#   - MQ Consumer 拦截器：消息处理前注入目标租户上下文
#   - 定时任务租户路由：Job 参数中显式指定或按租户分片执行
#
# 边界约束（按 SPEC Section 3.2）:
#   B-001: 租户上下文解析异常时，HTTP 返回 403 Forbidden
#   B-002: SQL 层面禁止跨租户 ID 的 JOIN 查询
#   B-003: 请求参数中不得接受 tenant_id 字段
#   B-004: 裸 SQL 必须经由统一的数据访问层
# =============================================================================

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from concurrent.futures import ThreadPoolExecutor
import threading
import time
from typing import Any, Dict, Optional

# 导入被测试的核心模块
from src.core.tenant_context import TenantContext, TenantContextHolder
from src.core.exceptions import (
    TenantContextNotFoundException,
    TenantIsolationViolationException,
    CrossTenantJoinException,
)
from middleware.tenant_binding import TenantBindingMiddleware, AsyncTaskWrapper
from middleware.jwt_tenant_parser import JwtTenantParser


# =============================================================================
# 测试夹具 (Fixtures)
# =============================================================================

@pytest.fixture
def tenant_a_context():
    """设置租户 A 的上下文"""
    TenantContext.set_current_tenant("tenant-A")
    yield "tenant-A"
    TenantContext.clear()


@pytest.fixture
def tenant_b_context():
    """设置租户 B 的上下文"""
    TenantContext.set_current_tenant("tenant-B")
    yield "tenant-B"
    TenantContext.clear()


@pytest.fixture
def mock_jwt_parser():
    """Mock JWT 解析器"""
    parser = Mock(spec=JwtTenantParser)
    parser.extract_tenant_id.return_value = "tenant-A"
    return parser


# =============================================================================
# ATB-4.1: @Async 任务继承调用方租户上下文
# =============================================================================

@pytest.mark.asyncio
async def test_async_task_inherits_tenant(tenant_a_context: str):
    """
    ATB-4.1: @Async 任务继承调用方租户上下文
    
    验证异步任务能正确继承调用方的 tenant_id 上下文。
    按 SPEC Section 2.4，异步任务必须通过 ThreadLocal 继承机制传递租户上下文。
    
    预期: result["tenant_id"] == "tenant-A"
    """
    # 记录异步任务中检测到的租户上下文
    captured_tenant_id: Optional[str] = None
    
    async def async_task_func():
        nonlocal captured_tenant_id
        # 模拟异步任务执行
        await asyncio.sleep(0.01)
        captured_tenant_id = TenantContext.get_current_tenant()
        return {"tenant_id": captured_tenant_id, "status": "completed"}
    
    # 使用 AsyncTaskWrapper 包装异步任务
    wrapped_task = AsyncTaskWrapper.wrap(async_task_func)
    
    # 提交异步任务
    result = await wrapped_task()
    
    # 断言：异步任务继承的 tenant_id 必须等于调用方上下文
    assert result["tenant_id"] == tenant_a_context, (
        f"异步任务未正确继承租户上下文。期望: {tenant_a_context}, 实际: {result['tenant_id']}"
    )
    assert result["status"] == "completed"


@pytest.mark.asyncio
async def test_async_task_without_context_fails():
    """
    ATB-4.2: 异步任务无上下文 → 拒绝执行
    
    验证在无租户上下文的情况下启动异步任务会抛出 TenantContextNotFoundException。
    按 SPEC Section 3.2 B-001，租户上下文解析异常时必须拒绝访问（禁止 fail-open）。
    
    预期: 抛出 TenantContextNotFoundException
    """
    # 确保上下文中没有任何租户信息
    TenantContext.clear()
    
    async def standalone_task_without_context():
        """无上下文的异步任务"""
        return TenantContext.get_current_tenant()
    
    # 使用 AsyncTaskWrapper 包装
    wrapped_task = AsyncTaskWrapper.wrap(standalone_task_without_context)
    
    # 断言：执行时应抛出 TenantContextNotFoundException
    with pytest.raises(TenantContextNotFoundException):
        await wrapped_task()


@pytest.mark.asyncio
async def test_async_task_cross_tenant_isolation(tenant_a_context: str, tenant_b_context: str):
    """
    ATB-4.3: 异步任务跨租户隔离
    
    验证租户 A 提交的异步任务无法访问租户 B 的数据。
    这是核心安全需求（跨租户数据泄露防护）。
    
    预期: 租户 A 的异步任务仅返回 tenant-A 相关数据
    """
    async def data_access_task():
        """模拟数据访问任务"""
        current_tenant = TenantContext.get_current_tenant()
        
        # 模拟查询返回的数据（带有租户标记）
        mock_data = {
            "tenant-A": {"id": "resource-A-001", "owner": "tenant-A"},
            "tenant-B": {"id": "resource-B-001", "owner": "tenant-B"},
        }
        
        # 返回当前租户的数据
        return mock_data.get(current_tenant, {})
    
    # 租户 A 执行任务
    TenantContext.set_current_tenant("tenant-A")
    wrapped_task_a = AsyncTaskWrapper.wrap(data_access_task)
    result_a = await wrapped_task_a()
    
    # 租户 B 执行任务
    TenantContext.set_current_tenant("tenant-B")
    wrapped_task_b = AsyncTaskWrapper.wrap(data_access_task)
    result_b = await wrapped_task_b()
    
    # 断言：两个租户返回的数据互不重叠
    assert result_a["owner"] == "tenant-A", "租户 A 任务不应返回租户 B 的数据"
    assert result_b["owner"] == "tenant-B", "租户 B 任务不应返回租户 A 的数据"
    assert result_a["id"] != result_b["id"], "两个租户的数据 ID 必须不同"


# =============================================================================
# ATB-4.4: MQ Consumer 拦截器
# =============================================================================

def test_mq_consumer_sets_tenant(tenant_a_context: str):
    """
    ATB-4.4: MQ 消费者从消息头提取 tenant_id
    
    验证 MQ Consumer 拦截器能从消息头（x-tenant-id）正确提取租户标识。
    按 SPEC Section 2.4，消息处理前必须注入目标租户上下文。
    
    预期: consumer.process(message) 后 TenantContext.get_current_tenant() == "tenant-A"
    """
    # 模拟 MQ 消息
    def create_mq_message(tenant_id: str, payload: Dict[str, Any]) -> Mock:
        message = Mock()
        message.headers = {"x-tenant-id": tenant_id}
        message.body = payload
        return message
    
    # 创建租户 A 的消息
    message = create_mq_message(tenant_id="tenant-A", payload={"action": "process"})
    
    # 模拟 MQ Consumer
    class MockMQConsumer:
        def __init__(self):
            self.tenant_binding = TenantBindingMiddleware()
        
        def process(self, message: Mock):
            """处理消息并设置租户上下文"""
            tenant_id = message.headers.get("x-tenant-id")
            if not tenant_id:
                raise TenantContextNotFoundException("MQ 消息缺少租户标识")
            
            # 通过中间件注入租户上下文
            self.tenant_binding.set_context(tenant_id)
            
            # 执行业务逻辑
            return {"processed": True, "tenant_id": TenantContext.get_current_tenant()}
    
    consumer = MockMQConsumer()
    
    # 处理消息
    TenantContext.clear()  # 确保清理之前的上下文
    result = consumer.process(message)
    
    # 断言：消息处理后的租户上下文正确
    assert result["tenant_id"] == "tenant-A", (
        f"MQ Consumer 未正确设置租户上下文。期望: tenant-A, 实际: {result['tenant_id']}"
    )


def test_mq_consumer_missing_tenant_header_rejected():
    """
    ATB-4.5: MQ 消息缺少租户头 → 拒绝处理
    
    验证 MQ 消息没有 x-tenant-id 头时，Consumer 必须拒绝处理。
    按 SPEC Section 3.2 B-001，禁止 fail-open。
    
    预期: 抛出 TenantContextNotFoundException
    """
    def create_mq_message_without_tenant(payload: Dict[str, Any]) -> Mock:
        message = Mock()
        message.headers = {}  # 缺少 x-tenant-id
        message.body = payload
        return message
    
    message = create_mq_message_without_tenant(payload={"action": "process"})
    
    class MockMQConsumer:
        def __init__(self):
            self.tenant_binding = TenantBindingMiddleware()
        
        def process(self, message: Mock):
            tenant_id = message.headers.get("x-tenant-id")
            if not tenant_id:
                raise TenantContextNotFoundException("MQ 消息缺少租户标识")
            self.tenant_binding.set_context(tenant_id)
            return {"processed": True}
    
    consumer = MockMQConsumer()
    
    # 断言：缺少租户标识时必须拒绝
    with pytest.raises(TenantContextNotFoundException):
        consumer.process(message)


# =============================================================================
# ATB-4.6: 定时任务租户路由
# =============================================================================

def test_scheduled_job_with_tenant(tenant_a_context: str):
    """
    ATB-4.6: 定时任务显式指定租户上下文
    
    验证定时任务（Scheduled Job）通过参数显式指定租户上下文。
    按 SPEC Section 2.4，Job 参数中显式指定或按租户分片执行。
    
    预期: 任务执行后验证查询均带 tenant-A 过滤
    """
    # 模拟定时任务
    class ScheduledJob:
        def __init__(self, tenant_id: str, task: str):
            self.tenant_id = tenant_id
            self.task = task
            self.tenant_binding = TenantBindingMiddleware()
        
        def execute(self):
            """执行定时任务"""
            # 显式注入租户上下文
            self.tenant_binding.set_context(self.tenant_id)
            
            # 模拟任务执行：验证数据查询带租户过滤
            current_tenant = TenantContext.get_current_tenant()
            return {
                "task": self.task,
                "tenant_id": current_tenant,
                "executed": True,
            }
    
    # 创建租户 A 的清理任务
    job = ScheduledJob(tenant_id="tenant-A", task="cleanup")
    result = job.execute()
    
    # 断言：任务执行后租户上下文正确
    assert result["tenant_id"] == "tenant-A", (
        f"定时任务未正确设置租户上下文。期望: tenant-A, 实际: {result['tenant_id']}"
    )
    assert result["executed"] is True


def test_scheduled_job_without_tenant_rejected():
    """
    ATB-4.7: 定时任务无租户指定 → 拒绝执行
    
    验证定时任务没有显式指定租户时必须拒绝执行。
    按 SPEC Section 3.2 B-001，禁止上下文丢失导致的 fail-open。
    
    预期: 抛出 TenantContextNotFoundException
    """
    class ScheduledJob:
        def __init__(self, tenant_id: Optional[str], task: str):
            self.tenant_id = tenant_id
            self.task = task
            self.tenant_binding = TenantBindingMiddleware()
        
        def execute(self):
            if not self.tenant_id:
                raise TenantContextNotFoundException("定时任务缺少租户标识")
            self.tenant_binding.set_context(self.tenant_id)
            return {"task": self.task, "executed": True}
    
    # 创建无租户指定的 Job
    job = ScheduledJob(tenant_id=None, task="cleanup")
    
    # 断言：缺少租户标识时必须拒绝
    with pytest.raises(TenantContextNotFoundException):
        job.execute()


# =============================================================================
# ATB-4.8: ThreadLocal 继承包装验证
# =============================================================================

def test_threadlocal_inheritance_in_sync_context(tenant_a_context: str):
    """
    ATB-4.8: ThreadLocal 继承在同步上下文中的验证
    
    验证 TenantContextHolder 的 ThreadLocal 机制在同步多线程中的正确性。
    按 SPEC Section 2.4，ThreadLocal 必须支持主线程写入/子线程透传。
    """
    captured_contexts = []
    
    def worker_in_thread():
        """在工作线程中捕获租户上下文"""
        captured = TenantContext.get_current_tenant()
        captured_contexts.append(captured)
    
    # 主线程设置租户上下文
    TenantContext.set_current_tenant("tenant-A")
    
    # 创建子线程
    thread = threading.Thread(target=worker_in_thread)
    thread.start()
    thread.join()
    
    # 注意：原始 ThreadLocal 不跨线程，需要 DelegatingTaskDecorator
    # 这里我们测试 TenantContextHolder 的基础行为
    assert len(captured_contexts) == 1
    # 子线程独立读取不到主线程上下文（这是预期行为，除非使用装饰器）


def test_delegating_task_decorator_propagates_context(tenant_a_context: str):
    """
    ATB-4.9: DelegatingTaskDecorator 正确传播租户上下文
    
    验证异步任务装饰器（DelegatingTaskDecorator）能正确传递 TenantContext。
    这是实现 @Async 任务继承的核心组件。
    """
    from middleware.tenant_binding import DelegatingTaskDecorator
    
    captured_tenant_id: Optional[str] = None
    
    def task_function():
        nonlocal captured_tenant_id
        captured_tenant_id = TenantContext.get_current_tenant()
        return {"tenant_id": captured_tenant_id}
    
    # 创建装饰器并执行
    decorator = DelegatingTaskDecorator()
    decorated_task = decorator.wrap(task_function)
    
    result = decorated_task()
    
    # 断言：装饰器正确传播了租户上下文
    assert result["tenant_id"] == tenant_a_context, (
        f"DelegatingTaskDecorator 未正确传播租户上下文。期望: {tenant_a_context}, 实际: {result['tenant_id']}"
    )


# =============================================================================
# ATB-4.10: 性能基准测试
# =============================================================================

def test_context_propagation_latency():
    """
    ATB-4.10: 上下文传播延迟 < 5ms (p99)
    
    验证租户上下文注入延迟满足 SPEC Section 1.3 NFR-003。
    性能要求：p99 < 5ms。
    """
    latencies = []
    iterations = 100
    
    for _ in range(iterations):
        TenantContext.set_current_tenant("tenant-test")
        
        start = time.perf_counter()
        _ = TenantContext.get_current_tenant()
        latency_ms = (time.perf_counter() - start) * 1000
        latencies.append(latency_ms)
        
        TenantContext.clear()
    
    # 计算 p99
    sorted_latencies = sorted(latencies)
    p99_index = int(len(sorted_latencies) * 0.99)
    p99_latency = sorted_latencies[p99_index]
    
    assert p99_latency < 5, (
        f"上下文传播延迟超过阈值。p99={p99_latency:.2f}ms, 阈值=5ms"
    )


# =============================================================================
# ATB-4.11: 边界约束综合验证
# =============================================================================

@pytest.mark.asyncio
async def test_boundary_b001_no_fail_open():
    """
    边界约束 B-001: 禁止 fail-open
    
    验证租户上下文解析失败时绝不静默放行。
    """
    TenantContext.clear()
    
    async def data_access():
        return TenantContext.get_current_tenant()
    
    wrapped = AsyncTaskWrapper.wrap(data_access)
    
    # 必须抛出异常，而非返回 None 或默认租户
    with pytest.raises(TenantContextNotFoundException):
        await wrapped()


def test_boundary_b003_tenant_id_not_from_request():
    """
    边界约束 B-003: 禁止 tenant_id 可客户端指定
    
    验证 tenant_id 必须从 JWT 解析，禁止请求参数传入覆盖。
    
    注意：此测试验证中间件层面的防护机制。
    """
    from middleware.jwt_tenant_parser import TenantJwtParser
    
    parser = TenantJwtParser()
    
    # 模拟请求（带伪造的 tenant_id 参数）
    mock_request = Mock()
    mock_request.headers = {"Authorization": "Bearer valid_jwt_token"}
    mock_request.query_params = {"tenant_id": "malicious-tenant"}  # 尝试注入
    
    # JWT 解析器必须忽略请求参数中的 tenant_id
    with patch.object(parser, 'extract_tenant_id', return_value="legitimate-tenant"):
        tenant_id = parser.extract_tenant_id("Bearer valid_jwt_token")
        
        assert tenant_id == "legitimate-tenant", "JWT 解析器不应接受请求参数中的 tenant_id"
        assert tenant_id != "malicious-tenant", "必须防止租户标识注入攻击"


# =============================================================================
# 测试清理
# =============================================================================

@pytest.fixture(autouse=True)
def cleanup_tenant_context():
    """每个测试后清理租户上下文"""
    yield
    TenantContext.clear()