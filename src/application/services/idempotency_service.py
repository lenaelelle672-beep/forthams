"""
幂等性服务 (Idempotency Service)

本模块实现工单审批操作的幂等性保障机制，确保在 5 分钟时间窗口内的重复操作
仅执行一次状态写入。

幂等 Key 生成规则:
    key = sha256(work_order_id + operator_id + operation_type + timestamp // 300s)

状态迁移规则矩阵:
    +---------+---------+---------+---------+
    | 当前状态   | 允许操作   | 目标状态   | 权限要求   |
    +---------+---------+---------+---------+
    | DRAFT   | submit  | PENDING | 申请人本人 |
    | PENDING | approve | APPROVED| 审批人本人 |
    | PENDING | reject  | REJECTED| 审批人本人 |
    | PENDING | return  | RETURNED| 审批人本人 |
    | RETURNED| resubmit| PENDING | 申请人本人 |
    | PENDING | cancel  | CANCELLED| 申请人本人|
    +---------+---------+---------+---------+

禁止项:
    - APPROVED / REJECTED / CANCELLED 不可做任何状态迁移
    - 审批人对自己提交的工单无审批权限（自审禁止）

参考规格: SPEC # 工单审批流程 (Iteration 7) Phase 2
"""

import hashlib
import time
from typing import Optional, Any, Dict, Tuple
from dataclasses import dataclass


# 幂等 key 缓存（生产环境应替换为 Redis 等分布式存储）
_IDEMPOTENCY_CACHE: Dict[str, Tuple[Any, float]] = {}
_CACHE_TTL_SECONDS = 300  # 5 分钟 = 300 秒


@dataclass
class IdempotencyResult:
    """幂等操作结果"""
    is_duplicate: bool
    cached_result: Optional[Any] = None
    key: Optional[str] = None


class IdempotencyService:
    """
    幂等性服务
    
    确保在 5 分钟时间窗口内的重复操作仅执行一次状态写入。
    
    幂等 Key 生成规则:
        key = sha256(work_order_id + operator_id + operation_type + timestamp // 300s)
    
    Attributes:
        cache_ttl: 缓存过期时间（秒），默认 300（5 分钟）
    """
    
    # 时间窗口大小（秒）
    TIME_WINDOW_SECONDS = 300  # 5 分钟
    
    def __init__(self, cache_ttl: int = _CACHE_TTL_SECONDS):
        """
        初始化幂等性服务
        
        Args:
            cache_ttl: 缓存过期时间（秒），默认 300（5 分钟）
        """
        self.cache_ttl = cache_ttl
    
    @staticmethod
    def generate_idempotency_key(
        work_order_id: str,
        operator_id: str,
        operation_type: str,
        timestamp: Optional[float] = None
    ) -> str:
        """
        生成幂等 key
        
        规则: key = sha256(work_order_id + operator_id + operation_type + timestamp // 300s)
        
        Args:
            work_order_id: 工单 ID
            operator_id: 操作人 ID
            operation_type: 操作类型 (approve/reject/return/resubmit/cancel/submit)
            timestamp: 时间戳（秒），默认使用当前时间
        
        Returns:
            str: SHA256 哈希后的幂等 key
        
        Example:
            >>> key = IdempotencyService.generate_idempotency_key(
            ...     "WO-2025-0001", "user_002", "approve"
            ... )
            >>> len(key)
            64
        """
        if timestamp is None:
            timestamp = time.time()
        
        # 计算时间窗口起点
        window_timestamp = int(timestamp // IdempotencyService.TIME_WINDOW_SECONDS)
        
        # 拼接原始字符串
        raw_key = f"{work_order_id}{operator_id}{operation_type}{window_timestamp}"
        
        # 生成 SHA256 哈希
        hashed = hashlib.sha256(raw_key.encode('utf-8')).hexdigest()
        
        return hashed
    
    def check(self, key: str) -> bool:
        """
        检查幂等 key 是否已存在（未过期）
        
        Args:
            key: 幂等 key
        
        Returns:
            bool: True 如果 key 存在且未过期，False 否则
        
        Note:
            生产环境应使用 Redis/Memcached 等分布式缓存
        """
        current_time = time.time()
        
        if key not in _IDEMPOTENCY_CACHE:
            return False
        
        _, expiry_time = _IDEMPOTENCY_CACHE[key]
        
        # 检查是否过期
        if current_time > expiry_time:
            # 清理过期条目
            del _IDEMPOTENCY_CACHE[key]
            return False
        
        return True
    
    def check_with_generated_key(
        self,
        work_order_id: str,
        operator_id: str,
        operation_type: str,
        timestamp: Optional[float] = None
    ) -> IdempotencyResult:
        """
        生成 key 并检查幂等性
        
        Args:
            work_order_id: 工单 ID
            operator_id: 操作人 ID
            operation_type: 操作类型
            timestamp: 时间戳（秒），默认使用当前时间
        
        Returns:
            IdempotencyResult: 包含检查结果的元组 (is_duplicate, cached_result, key)
        """
        key = self.generate_idempotency_key(
            work_order_id, operator_id, operation_type, timestamp
        )
        
        if self.check(key):
            cached_result, _ = _IDEMPOTENCY_CACHE[key]
            return IdempotencyResult(
                is_duplicate=True,
                cached_result=cached_result,
                key=key
            )
        
        return IdempotencyResult(
            is_duplicate=False,
            cached_result=None,
            key=key
        )
    
    def record(
        self,
        key: str,
        result: Any,
        ttl: Optional[int] = None
    ) -> None:
        """
        记录幂等操作结果
        
        Args:
            key: 幂等 key
            result: 操作结果（任意类型）
            ttl: 过期时间（秒），默认使用 self.cache_ttl
        
        Note:
            生产环境应使用 Redis/Memcached 等分布式缓存
        """
        if ttl is None:
            ttl = self.cache_ttl
        
        expiry_time = time.time() + ttl
        _IDEMPOTENCY_CACHE[key] = (result, expiry_time)
    
    def clear(self, key: str) -> bool:
        """
        清除指定的幂等记录
        
        Args:
            key: 幂等 key
        
        Returns:
            bool: True 如果 key 存在并被清除，False 如果 key 不存在
        """
        if key in _IDEMPOTENCY_CACHE:
            del _IDEMPOTENCY_CACHE[key]
            return True
        return False
    
    def clear_expired(self) -> int:
        """
        清除所有过期的幂等记录
        
        Returns:
            int: 清除的记录数量
        """
        current_time = time.time()
        expired_keys = [
            key for key, (_, expiry) in _IDEMPOTENCY_CACHE.items()
            if current_time > expiry
        ]
        
        for key in expired_keys:
            del _IDEMPOTENCY_CACHE[key]
        
        return len(expired_keys)


# 模块级单例
_default_idempotency_service: Optional[IdempotencyService] = None


def get_idempotency_service() -> IdempotencyService:
    """
    获取默认的幂等性服务实例（单例）
    
    Returns:
        IdempotencyService: 默认幂等性服务实例
    """
    global _default_idempotency_service
    if _default_idempotency_service is None:
        _default_idempotency_service = IdempotencyService()
    return _default_idempotency_service