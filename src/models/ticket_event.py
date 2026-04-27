"""
工单事件模型模块

定义工单相关的状态变更事件类型，包括提交、审批、驳回、转交、关闭等操作事件。
用于记录工单生命周期中的所有状态转换，便于审计追踪和通知触发。

状态转换规则:
    - PENDING → APPROVED (approve): 审批通过
    - PENDING → REJECTED (reject): 审批驳回
    - PENDING → TRANSFERRED (transfer): 工单转交
    - TRANSFERRED → APPROVED (approve): 转交后审批通过
    - TRANSFERRED → REJECTED (reject): 转交后审批驳回
    - APPROVED → CLOSED (close): 审批通过后关闭
    - REJECTED → CLOSED (close): 审批驳回后关闭

使用场景:
    - 状态机状态转换
    - 操作日志记录
    - 通知事件触发
"""

from enum import Enum


class TicketEvent(Enum):
    """
    工单事件枚举类
    
    定义工单生命周期中所有可能的事件类型，支撑状态机转换和事件追踪。
    
    事件类型:
        SUBMIT: 工单提交（创建或重新提交）
        APPROVE: 审批通过（从 PENDING 或 TRANSFERRED 状态进入 APPROVED）
        REJECT: 审批驳回（从 PENDING 或 TRANSFERRED 状态进入 REJECTED）
        TRANSFER: 工单转交（从 PENDING 状态转交给其他审批人）
        CLOSE: 工单关闭（从 APPROVED 或 REJECTED 状态关闭）
    """
    
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    TRANSFER = "transfer"
    CLOSE = "close"
    
    def __str__(self) -> str:
        """
        返回事件的字符串表示
        
        Returns:
            事件类型的小写字符串表示
        """
        return self.value
    
    @classmethod
    def from_string(cls, value: str) -> "TicketEvent":
        """
        从字符串创建事件枚举实例
        
        Args:
            value: 事件类型的字符串值
            
        Returns:
            对应的 TicketEvent 枚举成员
            
        Raises:
            ValueError: 当字符串值不匹配任何事件类型时
        """
        value_lower = value.lower()
        for event in cls:
            if event.value == value_lower:
                return event
        raise ValueError(f"Invalid event type: {value}")