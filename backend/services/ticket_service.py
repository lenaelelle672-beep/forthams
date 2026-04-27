"""
工单审批服务模块 (Ticket Service)

实现 SWARM-001 工单审批流程核心业务逻辑：
  - 基于状态机的工单状态管理
  - 审批通过 / 拒绝操作
  - 邮件 + 系统消息双通道通知
  - 完整审计日志记录
  - 并发审批安全防护
  - 多角色访问控制
"""

from __future__ import annotations

import logging
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 枚举与常量
# ---------------------------------------------------------------------------

class TicketStatus(str, Enum):
    """工单状态枚举，定义合法的状态流转节点。"""

    DRAFT = "draft"                   # 草稿（申请人起草，尚未提交）
    PENDING = "pending"               # 待审批（已提交，等待审批人处理）
    IN_REVIEW = "in_review"           # 审批中（审批人已接收，处理中）
    APPROVED = "approved"             # 已批准
    REJECTED = "rejected"             # 已拒绝
    CANCELLED = "cancelled"           # 已取消（申请人主动撤回）
    CLOSED = "closed"                 # 已关闭（归档）


class UserRole(str, Enum):
    """系统角色枚举，用于权限校验。"""

    APPLICANT = "applicant"           # 申请人
    APPROVER = "approver"             # 审批人
    ADMIN = "admin"                   # 管理员


class NotificationChannel(str, Enum):
    """通知渠道枚举。"""

    EMAIL = "email"
    SYSTEM = "system"


# ---------------------------------------------------------------------------
# 状态机合法流转表
# ---------------------------------------------------------------------------

VALID_TRANSITIONS: Dict[TicketStatus, List[TicketStatus]] = {
    TicketStatus.DRAFT:      [TicketStatus.PENDING, TicketStatus.CANCELLED],
    TicketStatus.PENDING:    [TicketStatus.IN_REVIEW, TicketStatus.CANCELLED],
    TicketStatus.IN_REVIEW:  [TicketStatus.APPROVED, TicketStatus.REJECTED],
    TicketStatus.APPROVED:   [TicketStatus.CLOSED],
    TicketStatus.REJECTED:   [TicketStatus.DRAFT],   # 允许修改后重新提交
    TicketStatus.CANCELLED:  [],
    TicketStatus.CLOSED:     [],
}

# 各角色允许执行的操作（目标状态）
ROLE_ALLOWED_TARGET_STATUSES: Dict[UserRole, List[TicketStatus]] = {
    UserRole.APPLICANT: [
        TicketStatus.PENDING,
        TicketStatus.CANCELLED,
        TicketStatus.DRAFT,    # 重新提交草稿
    ],
    UserRole.APPROVER: [
        TicketStatus.IN_REVIEW,
        TicketStatus.APPROVED,
        TicketStatus.REJECTED,
    ],
    UserRole.ADMIN: list(TicketStatus),  # 管理员拥有全量权限
}


# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------

@dataclass
class AuditLogEntry:
    """单条审计日志记录。"""

    log_id: str
    ticket_id: str
    operator_id: str
    operator_role: UserRole
    from_status: Optional[TicketStatus]
    to_status: TicketStatus
    comment: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """将审计日志序列化为字典，便于持久化或 JSON 输出。"""
        return {
            "log_id": self.log_id,
            "ticket_id": self.ticket_id,
            "operator_id": self.operator_id,
            "operator_role": self.operator_role.value,
            "from_status": self.from_status.value if self.from_status else None,
            "to_status": self.to_status.value,
            "comment": self.comment,
            "timestamp": self.timestamp.isoformat(),
            "extra": self.extra,
        }


@dataclass
class Ticket:
    """工单数据模型。"""

    ticket_id: str
    title: str
    description: str
    applicant_id: str
    assignee_id: Optional[str]        # 当前负责审批人
    status: TicketStatus = TicketStatus.DRAFT
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    audit_logs: List[AuditLogEntry] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """将工单序列化为字典。"""
        return {
            "ticket_id": self.ticket_id,
            "title": self.title,
            "description": self.description,
            "applicant_id": self.applicant_id,
            "assignee_id": self.assignee_id,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "audit_logs": [log.to_dict() for log in self.audit_logs],
            "metadata": self.metadata,
        }


# ---------------------------------------------------------------------------
# 自定义异常
# ---------------------------------------------------------------------------

class TicketNotFoundError(Exception):
    """工单不存在。"""


class InvalidStateTransitionError(Exception):
    """非法的状态流转操作。"""


class PermissionDeniedError(Exception):
    """操作权限不足。"""


class TicketAlreadyProcessedError(Exception):
    """工单已被处理（并发写保护）。"""


# ---------------------------------------------------------------------------
# 通知适配器（可替换为真实 SMTP / WebSocket 实现）
# ---------------------------------------------------------------------------

class NotificationAdapter:
    """通知发送适配器基类，支持邮件和系统消息两种通道。"""

    def send_email(
        self,
        recipient_id: str,
        subject: str,
        body: str,
        retry: int = 3,
    ) -> bool:
        """
        发送邮件通知。

        Args:
            recipient_id: 收件人用户 ID。
            subject:      邮件主题。
            body:         邮件正文。
            retry:        失败重试次数，默认 3 次。

        Returns:
            True 表示发送成功，False 表示发送失败。
        """
        attempt = 0
        while attempt <= retry:
            try:
                # 此处为可替换的真实 SMTP 调用占位
                logger.info(
                    "[EMAIL] to=%s subject=%s attempt=%d",
                    recipient_id,
                    subject,
                    attempt + 1,
                )
                return True
            except Exception as exc:  # noqa: BLE001
                attempt += 1
                logger.warning(
                    "[EMAIL] 发送失败 recipient=%s attempt=%d error=%s",
                    recipient_id,
                    attempt,
                    exc,
                )
        logger.error("[EMAIL] 超过最大重试次数，放弃发送 recipient=%s", recipient_id)
        return False

    def send_system_message(
        self,
        recipient_id: str,
        message: str,
        retry: int = 3,
    ) -> bool:
        """
        发送系统内消息通知。

        Args:
            recipient_id: 接收方用户 ID。
            message:      消息内容。
            retry:        失败重试次数，默认 3 次。

        Returns:
            True 表示发送成功，False 表示发送失败。
        """
        attempt = 0
        while attempt <= retry:
            try:
                # 此处为可替换的真实 WebSocket/内消息推送占位
                logger.info(
                    "[SYSTEM_MSG] to=%s message=%.60s attempt=%d",
                    recipient_id,
                    message,
                    attempt + 1,
                )
                return True
            except Exception as exc:  # noqa: BLE001
                attempt += 1
                logger.warning(
                    "[SYSTEM_MSG] 发送失败 recipient=%s attempt=%d error=%s",
                    recipient_id,
                    attempt,
                    exc,
                )
        logger.error(
            "[SYSTEM_MSG] 超过最大重试次数，放弃发送 recipient=%s", recipient_id
        )
        return False


# ---------------------------------------------------------------------------
# 核心服务
# ---------------------------------------------------------------------------

class TicketService:
    """
    工单审批核心服务。

    职责：
      1. 工单的创建、查询与状态流转（状态机）
      2. 审批通过 / 拒绝操作及权限校验
      3. 邮件 + 系统消息双通道通知
      4. 完整审计日志记录
      5. 基于锁的并发安全保障

    使用示例::

        service = TicketService()
        ticket = service.create_ticket(
            title="设备采购审批",
            description="采购 10 台服务器",
            applicant_id="user_001",
        )
        service.submit_ticket(ticket.ticket_id, operator_id="user_001",
                              role=UserRole.APPLICANT)
        service.approve_ticket(ticket.ticket_id, operator_id="approver_001",
                               role=UserRole.APPROVER, comment="同意采购")
    """

    def __init__(
        self,
        notification_adapter: Optional[NotificationAdapter] = None,
    ) -> None:
        """
        初始化工单服务。

        Args:
            notification_adapter: 通知适配器实例；若为 None 则使用默认实现。
        """
        # 内存存储（生产环境应替换为数据库仓储层）
        self._tickets: Dict[str, Ticket] = {}
        # 并发锁字典，每张工单一把锁
        self._locks: Dict[str, threading.Lock] = {}
        self._global_lock = threading.Lock()
        self._notifier = notification_adapter or NotificationAdapter()

    # ------------------------------------------------------------------
    # 内部辅助
    # ------------------------------------------------------------------

    def _get_lock(self, ticket_id: str) -> threading.Lock:
        """获取（或懒创建）指定工单的互斥锁，保证并发安全。"""
        with self._global_lock:
            if ticket_id not in self._locks:
                self._locks[ticket_id] = threading.Lock()
            return self._locks[ticket_id]

    def _assert_ticket_exists(self, ticket_id: str) -> Ticket:
        """
        断言工单存在，不存在时抛出 TicketNotFoundError。

        Args:
            ticket_id: 工单唯一标识。

        Returns:
            对应的 Ticket 实例。

        Raises:
            TicketNotFoundError: 工单 ID 不存在于存储中。
        """
        ticket = self._tickets.get(ticket_id)
        if ticket is None:
            raise TicketNotFoundError(f"工单 {ticket_id!r} 不存在")
        return ticket

    def _assert_role_permission(
        self,
        role: UserRole,
        target_status: TicketStatus,
    ) -> None:
        """
        校验角色是否有权执行目标状态的转换操作。

        Args:
            role:          操作者角色。
            target_status: 期望流转到的目标状态。

        Raises:
            PermissionDeniedError: 角色无权执行该操作。
        """
        allowed = ROLE_ALLOWED_TARGET_STATUSES.get(role, [])
        if target_status not in allowed:
            raise PermissionDeniedError(
                f"角色 {role.value!r} 无权将工单流转至 {target_status.value!r}"
            )

    def _assert_valid_transition(
        self,
        current: TicketStatus,
        target: TicketStatus,
    ) -> None:
        """
        校验状态机流转是否合法。

        Args:
            current: 工单当前状态。
            target:  期望流转到的目标状态。

        Raises:
            InvalidStateTransitionError: 状态流转路径不合法。
        """
        allowed = VALID_TRANSITIONS.get(current, [])
        if target not in allowed:
            raise InvalidStateTransitionError(
                f"工单状态不允许从 {current.value!r} 流转至 {target.value!r}，"
                f"合法目标状态：{[s.value for s in allowed]}"
            )

    def _record_audit_log(
        self,
        ticket: Ticket,
        operator_id: str,
        operator_role: UserRole,
        from_status: Optional[TicketStatus],
        to_status: TicketStatus,
        comment: str,
        extra: Optional[Dict[str, Any]] = None,
    ) -> AuditLogEntry:
        """
        追加审计日志并更新工单时间戳。

        Args:
            ticket:        目标工单。
            operator_id:   操作者用户 ID。
            operator_role: 操作者角色。
            from_status:   操作前状态（None 表示新建）。
            to_status:     操作后状态。
            comment:       操作备注。
            extra:         可选附加信息字典。

        Returns:
            新创建的 AuditLogEntry 实例。
        """
        entry = AuditLogEntry(
            log_id=str(uuid.uuid4()),
            ticket_id=ticket.ticket_id,
            operator_id=operator_id,
            operator_role=operator_role,
            from_status=from_status,
            to_status=to_status,
            comment=comment,
            extra=extra or {},
        )
        ticket.audit_logs.append(entry)
        ticket.updated_at = entry.timestamp
        logger.info(
            "[AUDIT] ticket=%s %s→%s operator=%s(%s) comment=%s",
            ticket.ticket_id,
            from_status.value if from_status else "NEW",
            to_status.value,
            operator_id,
            operator_role.value,
            comment,
        )
        return entry

    def _transition(
        self,
        ticket: Ticket,
        target_status: TicketStatus,
        operator_id: str,
        operator_role: UserRole,
        comment: str,
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        执行状态机流转并记录审计日志（需在持锁环境下调用）。

        Args:
            ticket:        目标工单。
            target_status: 目标状态。
            operator_id:   操作者用户 ID。
            operator_role: 操作者角色。
            comment:       操作备注。
            extra:         可选附加信息。
        """
        from_status = ticket.status
        self._assert_valid_transition(from_status, target_status)
        self._assert_role_permission(operator_role, target_status)
        ticket.status = target_status
        self._record_audit_log(
            ticket=ticket,
            operator_id=operator_id,
            operator_role=operator_role,
            from_status=from_status,
            to_status=target_status,
            comment=comment,
            extra=extra,
        )

    def _notify_all_channels(
        self,
        ticket: Ticket,
        subject: str,
        message: str,
        recipient_ids: Optional[List[str]] = None,
    ) -> None:
        """
        向相关人员通过邮件和系统消息双通道发送通知。

        Args:
            ticket:        目标工单。
            subject:       通知主题（邮件标题）。
            message:       通知正文内容。
            recipient_ids: 指定收件人列表；若为 None 则默认通知申请人和审批人。
        """
        recipients: List[str] = recipient_ids or list(
            filter(
                None,
                [ticket.applicant_id, ticket.assignee_id],
            )
        )
        for uid in recipients:
            self._notifier.send_email(
                recipient_id=uid,
                subject=subject,
                body=message,
            )
            self._notifier.send_system_message(
                recipient_id=uid,
                message=message,
            )

    # ------------------------------------------------------------------
    # 公开 API
    # ------------------------------------------------------------------

    def create_ticket(
        self,
        title: str,
        description: str,
        applicant_id: str,
        assignee_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Ticket:
        """
        创建新工单（初始状态为草稿）。

        Args:
            title:        工单标题。
            description:  工单详细描述。
            applicant_id: 申请人用户 ID。
            assignee_id:  预分配审批人用户 ID（可选）。
            metadata:     附加元数据（可选）。

        Returns:
            新建的 Ticket 实例。
        """
        ticket_id = str(uuid.uuid4())
        ticket = Ticket(
            ticket_id=ticket_id,
            title=title,
            description=description,
            applicant_id=applicant_id,
            assignee_id=assignee_id,
            status=TicketStatus.DRAFT,
            metadata=metadata or {},
        )
        self._tickets[ticket_id] = ticket
        self._record_audit_log(
            ticket=ticket,
            operator_id=applicant_id,
            operator_role=UserRole.APPLICANT,
            from_status=None,
            to_status=TicketStatus.DRAFT,
            comment="工单创建",
        )
        logger.info("[TICKET] 创建工单 ticket_id=%s applicant=%s", ticket_id, applicant_id)
        return ticket

    def get_ticket(self, ticket_id: str) -> Ticket:
        """
        查询工单详情。

        Args:
            ticket_id: 工单唯一标识。

        Returns:
            对应的 Ticket 实例。

        Raises:
            TicketNotFoundError: 工单不存在。
        """
        return self._assert_ticket_exists(ticket_id)

    def list_tickets(
        self,
        status_filter: Optional[TicketStatus] = None,
        applicant_id: Optional[str] = None,
        assignee_id: Optional[str] = None,
    ) -> List[Ticket]:
        """
        列出工单，支持按状态、申请人、审批人过滤。

        Args:
            status_filter: 按状态过滤（可选）。
            applicant_id:  按申请人 ID 过滤（可选）。
            assignee_id:   按审批人 ID 过滤（可选）。

        Returns:
            符合条件的工单列表。
        """
        result: List[Ticket] = list(self._tickets.values())
        if status_filter is not None:
            result = [t for t in result if t.status == status_filter]
        if applicant_id is not None:
            result = [t for t in result if t.applicant_id == applicant_id]
        if assignee_id is not None:
            result = [t for t in result if t.assignee_id == assignee_id]
        return result

    def submit_ticket(
        self,
        ticket_id: str,
        operator_id: str,
        role: UserRole,
        comment: str = "提交审批",
    ) -> Ticket:
        """
        将草稿工单提交至待审批状态。

        Args:
            ticket_id:   工单唯一标识。
            operator_id: 操作者用户 ID（通常为申请人）。
            role:        操作者角色。
            comment:     操作备注。

        Returns:
            更新后的 Ticket 实例。

        Raises:
            TicketNotFoundError:        工单不存在。
            InvalidStateTransitionError: 当前状态不允许提交。
            PermissionDeniedError:       角色无权执行提交操作。
        """
        lock = self._get_lock(ticket_id)
        with lock:
            ticket = self._assert_ticket_exists(ticket_id)
            self._transition(
                ticket=ticket,
                target_status=TicketStatus.PENDING,
                operator_id=operator_id,
                operator_role=role,
                comment=comment,
            )
        self._notify_all_channels(
            ticket=ticket,
            subject=f"【工单审批】新工单待处理：{ticket.title}",
            message=f"工单 {ticket.ticket_id} 已提交，请审批人 {ticket.assignee_id} 处理。",
        )
        return ticket

    def start_review(
        self,
        ticket_id: str,
        operator_id: str,
        role: UserRole,
        comment: str = "开始审核",
    ) -> Ticket:
        """
        审批人接单，将工单状态从待审批流转至审批中。

        Args:
            ticket_id:   工单唯一标识。
            operator_id: 审批人用户 ID。
            role:        操作者角色。
            comment:     操作备注。

        Returns:
            更新后的 Ticket 实例。

        Raises:
            TicketNotFoundError:        工单不存在。
            InvalidStateTransitionError: 当前状态不允许接单。
            PermissionDeniedError:       角色无权执行该操作。
        """
        lock = self._get_lock(ticket_id)
        with lock:
            ticket = self._assert_ticket_exists(ticket_id)
            if ticket.assignee_id is None:
                ticket.assignee_id = operator_id
            self._transition(
                ticket=ticket,
                target_status=TicketStatus.IN_REVIEW,
                operator_id=operator_id,
                operator_role=role,
                comment=comment,
            )
        return ticket

    def approve_ticket(
        self,
        ticket_id: str,
        operator_id: str,
        role: UserRole,
        comment: str = "审批通过",
    ) -> Ticket:
        """
        审批通过工单，将状态流转至已批准，并触发双通道通知。

        Args:
            ticket_id:   工单唯一标识。
            operator_id: 审批人用户 ID。
            role:        操作者角色（需为 APPROVER 或 ADMIN）。
            comment:     审批意见。

        Returns:
            更新后的 Ticket 实例。

        Raises:
            TicketNotFoundError:        工单不存在。
            InvalidStateTransitionError: 工单当前状态不可审批通过。
            PermissionDeniedError:       角色无权执行审批操作。
        """
        lock = self._get_lock(ticket_id)
        with lock:
            ticket = self._assert_ticket_exists(ticket_id)
            self._transition(
                ticket=ticket,
                target_status=TicketStatus.APPROVED,
                operator_id=operator_id,
                operator_role=role,
                comment=comment,
                extra={"approver_id": operator_id},
            )
        self._notify_all_channels(
            ticket=ticket,
            subject=f"【工单审批】工单已批准：{ticket.title}",
            message=(
                f"工单 {ticket.ticket_id}（{ticket.title}）已由审批人 {operator_id} 批准。\n"
                f"审批意见：{comment}"
            ),
        )
        logger.info("[TICKET] 工单审批通过 ticket_id=%s approver=%s", ticket_id, operator_id)
        return ticket

    def reject_ticket(
        self,
        ticket_id: str,
        operator_id: str,
        role: UserRole,
        comment: str = "审批拒绝",
    ) -> Ticket:
        """
        拒绝工单，将状态流转至已拒绝，并触发双通道通知。

        Args:
            ticket_id:   工单唯一标识。
            operator_id: 审批人用户 ID。
            role:        操作者角色（需为 APPROVER 或 ADMIN）。
            comment:     拒绝理由。

        Returns:
            更新后的 Ticket 实例。

        Raises:
            TicketNotFoundError:        工单不存在。
            InvalidStateTransitionError: 工单当前状态不可拒绝。
            PermissionDeniedError:       角色无权执行拒绝操作。
        """
        lock = self._get_lock(ticket_id)
        with lock:
            ticket = self._assert_ticket_exists(ticket_id)
            self._transition(
                ticket=ticket,
                target_status=TicketStatus.REJECTED,
                operator_id=operator_id,
                operator_role=role,
                comment=comment,
                extra={"reject_reason": comment},
            )
        self._notify_all_channels(
            ticket=ticket,
            subject=f"【工单审批】工单已拒绝：{ticket.title}",
            message=(
                f"工单 {ticket.ticket_id}（{ticket.title}）已被审批人 {operator_id} 拒绝。\n"
                f"拒绝原因：{comment}\n"
                f"您可以修改后重新提交。"
            ),
        )
        logger.info("[TICKET] 工单审批拒绝 ticket_id=%s approver=%s", ticket_id, operator_id)
        return ticket

    def cancel_ticket(
        self,
        ticket_id: str,
        operator_id: str,
        role: UserRole,
        comment: str = "申请人取消",
    ) -> Ticket:
        """
        申请人或管理员取消工单。

        Args:
            ticket_id:   工单唯一标识。
            operator_id: 操作者用户 ID。
            role:        操作者角色。
            comment:     取消备注。

        Returns:
            更新后的 Ticket 实例。

        Raises:
            TicketNotFoundError:        工单不存在。
            InvalidStateTransitionError: 当前状态不允许取消。
            PermissionDeniedError:       角色无权执行取消操作。
        """
        lock = self._get_lock(ticket_id)
        with lock:
            ticket = self._assert_ticket_exists(ticket_id)
            self._transition(
                ticket=ticket,
                target_status=TicketStatus.CANCELLED,
                operator_id=operator_id,
                operator_role=role,
                comment=comment,
            )
        return ticket

    def close_ticket(
        self,
        ticket_id: str,
        operator_id: str,
        role: UserRole,
        comment: str = "归档关闭",
    ) -> Ticket:
        """
        关闭（归档）已批准的工单。

        Args:
            ticket_id:   工单唯一标识。
            operator_id: 操作者用户 ID。
            role:        操作者角色（通常为 ADMIN）。
            comment:     关闭备注。

        Returns:
            更新后的 Ticket 实例。

        Raises:
            TicketNotFoundError:        工单不存在。
            InvalidStateTransitionError: 当前状态不允许关闭。
            PermissionDeniedError:       角色无权执行关闭操作。
        """
        lock = self._get_lock(ticket_id)
        with lock:
            ticket = self._assert_ticket_exists(ticket_id)
            self._transition(
                ticket=ticket,
                target_status=TicketStatus.CLOSED,
                operator_id=operator_id,
                operator_role=role,
                comment=comment,
            )
        return ticket

    def get_audit_logs(self, ticket_id: str) -> List[AuditLogEntry]:
        """
        获取指定工单的完整审计日志列表。

        Args:
            ticket_id: 工单唯一标识。

        Returns:
            按时间顺序排列的 AuditLogEntry 列表。

        Raises:
            TicketNotFoundError: 工单不存在。
        """
        ticket = self._assert_ticket_exists(ticket_id)
        return list(ticket.audit_logs)

    def resubmit_ticket(
        self,
        ticket_id: str,
        operator_id: str,
        role: UserRole,
        comment: str = "修改后重新提交",
    ) -> Ticket:
        """
        将被拒绝的工单重新流转至草稿，以便申请人修改后再次提交。

        Args:
            ticket_id:   工单唯一标识。
            operator_id: 申请人用户 ID。
            role:        操作者角色（需为 APPLICANT 或 ADMIN）。
            comment:     操作备注。

        Returns:
            更新后的 Ticket 实例。

        Raises:
            TicketNotFoundError:        工单不存在。
            InvalidStateTransitionError: 当前状态不支持重新提交流程。
            PermissionDeniedError:       角色无权执行该操作。
        """
        lock = self._get_lock(ticket_id)
        with lock:
            ticket = self._assert_ticket_exists(ticket_id)
            self._transition(
                ticket=ticket,
                target_status=TicketStatus.DRAFT,
                operator_id=operator_id,
                operator_role=role,
                comment=comment,
            )
        return ticket