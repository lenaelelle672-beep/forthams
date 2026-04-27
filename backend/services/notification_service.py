"""
Notification Service Module
===========================

Provides an event-driven, asynchronous In-App notification mechanism for the
approval workflow.  Notifications are generated when approval actions occur
(submit, approve level-1, approve level-2, reject, cancel) and are persisted
as immutable records.  All notification dispatch is performed asynchronously
so that the main approval transaction is never blocked.

Design notes
------------
* Only In-App notifications are supported – no email / SMS channels.
* Notification records are append-only (create-only); they must never be
  updated or deleted after creation to satisfy the data-immutable constraint.
* The service exposes both a synchronous public API (for controllers) and an
  internal async listener that reacts to ``ApprovalNotificationEvent`` objects
  published by the ``ApprovalService``.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from backend.models.notification import NotificationRecord, NotificationStatus

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Notification type enumeration
# ---------------------------------------------------------------------------

class NotificationType(str, Enum):
    """Enumeration of all notification types produced by the approval flow."""

    # Approval chain notifications
    ORDER_SUBMITTED = "ORDER_SUBMITTED"
    """Emitted when a work order transitions from PENDING to APPROVING_LEVEL_1."""

    LEVEL1_APPROVED = "LEVEL1_APPROVED"
    """Emitted when the department manager approves (L1 → L2)."""

    LEVEL2_APPROVED = "LEVEL2_APPROVED"
    """Emitted when the asset administrator approves (L2 → APPROVED)."""

    ORDER_APPROVED = "ORDER_APPROVED"
    """Emitted when the work order reaches the final APPROVED state."""

    ORDER_REJECTED = "ORDER_REJECTED"
    """Emitted when any approver rejects the work order (→ REJECTED)."""

    ORDER_CANCELLED = "ORDER_CANCELLED"
    """Emitted when the applicant cancels the work order (→ CANCELLED)."""

    # Reminder / informational
    PENDING_APPROVAL_REMINDER = "PENDING_APPROVAL_REMINDER"
    """Periodic reminder for approvers who have pending tasks."""


# ---------------------------------------------------------------------------
# Notification payload (lightweight DTO)
# ---------------------------------------------------------------------------

class NotificationPayload:
    """Immutable data-transfer object that describes a single notification.

    Attributes:
        notification_type: The category of notification.
        work_order_id: Identifier of the related work order.
        recipient_user_id: The user who should receive this notification.
        title: Short human-readable title.
        body: Detailed description (may include rejection reason, etc.).
        related_approval_level: Optional – which approval level triggered this.
        metadata: Arbitrary extra key-value pairs (e.g. rejection_reason).
    """

    __slots__ = (
        "notification_type",
        "work_order_id",
        "recipient_user_id",
        "title",
        "body",
        "related_approval_level",
        "metadata",
    )

    def __init__(
        self,
        notification_type: NotificationType,
        work_order_id: str,
        recipient_user_id: str,
        title: str,
        body: str,
        related_approval_level: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.notification_type = notification_type
        self.work_order_id = work_order_id
        self.recipient_user_id = recipient_user_id
        self.title = title
        self.body = body
        self.related_approval_level = related_approval_level
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        """Return a plain dictionary representation of the payload."""
        return {
            "notification_type": self.notification_type.value,
            "work_order_id": self.work_order_id,
            "recipient_user_id": self.recipient_user_id,
            "title": self.title,
            "body": self.body,
            "related_approval_level": self.related_approval_level,
            "metadata": self.metadata,
        }


# ---------------------------------------------------------------------------
# Notification Service
# ---------------------------------------------------------------------------

class NotificationService:
    """Core service responsible for creating, persisting, and querying
    In-App notifications related to the approval workflow.

    The service is designed to be used in two modes:

    1. **Synchronous API** – called by controllers / other services to
       create notifications or query them for a given user.
    2. **Asynchronous event listener** – reacts to ``ApprovalNotificationEvent``
       objects dispatched by ``ApprovalService`` after a successful state
       transition.  The listener runs inside an asyncio task so that it never
       blocks the caller.

    Thread-safety
    -------------
    All public methods are safe to call from multiple threads / coroutines.
    The internal persistence layer is expected to handle its own concurrency
    (e.g. via database-level locking).
    """

    def __init__(self, db_session=None) -> None:
        """Initialise the NotificationService.

        Args:
            db_session: An optional database session.  When *None* the service
                will obtain a session lazily from the application's session
                factory on each operation.
        """
        self._db_session = db_session
        self._event_queue: asyncio.Queue = asyncio.Queue()
        self._listener_task: Optional[asyncio.Task] = None
        logger.info("NotificationService initialised.")

    # ------------------------------------------------------------------
    # Public synchronous API
    # ------------------------------------------------------------------

    def create_notification(self, payload: NotificationPayload) -> NotificationRecord:
        """Persist a new notification record from the given *payload*.

        This method is **synchronous** and is typically called by the
        ``ApprovalService`` after an approval action has been committed.

        Args:
            payload: Fully-populated :class:`NotificationPayload`.

        Returns:
            The newly created :class:`NotificationRecord` with its generated
            ``id`` and ``created_at`` timestamp.
        """
        record = NotificationRecord(
            id=str(uuid.uuid4()),
            notification_type=payload.notification_type.value,
            work_order_id=payload.work_order_id,
            recipient_user_id=payload.recipient_user_id,
            title=payload.title,
            body=payload.body,
            related_approval_level=payload.related_approval_level,
            metadata=payload.metadata,
            status=NotificationStatus.UNREAD.value,
            created_at=datetime.now(timezone.utc),
        )

        session = self._get_session()
        try:
            session.add(record)
            session.commit()
            logger.info(
                "Notification created: id=%s type=%s work_order=%s recipient=%s",
                record.id,
                record.notification_type,
                record.work_order_id,
                record.recipient_user_id,
            )
        except Exception:
            session.rollback()
            logger.exception(
                "Failed to persist notification for work_order=%s recipient=%s",
                payload.work_order_id,
                payload.recipient_user_id,
            )
            raise

        return record

    def get_notifications_for_user(
        self,
        user_id: str,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[NotificationRecord]:
        """Retrieve notification records for a specific user.

        Args:
            user_id: The target user's identifier.
            status: Optional filter – ``"UNREAD"`` or ``"READ"``.  When
                *None* all notifications are returned.
            limit: Maximum number of records to return.
            offset: Number of records to skip (for pagination).

        Returns:
            A list of :class:`NotificationRecord` instances, ordered by
            ``created_at`` descending (most recent first).
        """
        session = self._get_session()
        query = (
            session.query(NotificationRecord)
            .filter(NotificationRecord.recipient_user_id == user_id)
            .order_by(NotificationRecord.created_at.desc())
        )

        if status is not None:
            query = query.filter(NotificationRecord.status == status)

        return query.offset(offset).limit(limit).all()

    def get_notification_by_id(
        self, notification_id: str
    ) -> Optional[NotificationRecord]:
        """Fetch a single notification by its unique identifier.

        Args:
            notification_id: UUID string of the target notification.

        Returns:
            The matching :class:`NotificationRecord`, or *None* if not found.
        """
        session = self._get_session()
        return (
            session.query(NotificationRecord)
            .filter(NotificationRecord.id == notification_id)
            .first()
        )

    def mark_as_read(self, notification_id: str) -> bool:
        """Mark a notification as read.

        .. note::
            This mutates the *status* field of the notification record but
            does **not** modify the original notification content (title, body,
            metadata), preserving the immutability constraint on the
            notification payload itself.

        Args:
            notification_id: UUID string of the target notification.

        Returns:
            ``True`` if the notification was found and updated, ``False``
            otherwise.
        """
        session = self._get_session()
        record = (
            session.query(NotificationRecord)
            .filter(NotificationRecord.id == notification_id)
            .first()
        )
        if record is None:
            logger.warning("Notification %s not found for mark-as-read.", notification_id)
            return False

        record.status = NotificationStatus.READ.value
        record.read_at = datetime.now(timezone.utc)
        try:
            session.commit()
            logger.info("Notification %s marked as read.", notification_id)
            return True
        except Exception:
            session.rollback()
            logger.exception("Failed to mark notification %s as read.", notification_id)
            return False

    def mark_all_as_read(self, user_id: str) -> int:
        """Mark **all** unread notifications for a user as read.

        Args:
            user_id: The target user's identifier.

        Returns:
            The number of notifications that were updated.
        """
        session = self._get_session()
        now = datetime.now(timezone.utc)
        count = (
            session.query(NotificationRecord)
            .filter(
                NotificationRecord.recipient_user_id == user_id,
                NotificationRecord.status == NotificationStatus.UNREAD.value,
            )
            .update(
                {
                    NotificationRecord.status: NotificationStatus.READ.value,
                    NotificationRecord.read_at: now,
                },
                synchronize_session="fetch",
            )
        )
        try:
            session.commit()
            logger.info("Marked %d notifications as read for user %s.", count, user_id)
        except Exception:
            session.rollback()
            logger.exception(
                "Failed to bulk-mark notifications as read for user %s.", user_id
            )
            raise
        return count

    def get_unread_count(self, user_id: str) -> int:
        """Return the number of unread notifications for a user.

        Args:
            user_id: The target user's identifier.

        Returns:
            Integer count of unread notifications.
        """
        session = self._get_session()
        return (
            session.query(NotificationRecord)
            .filter(
                NotificationRecord.recipient_user_id == user_id,
                NotificationRecord.status == NotificationStatus.UNREAD.value,
            )
            .count()
        )

    def get_notifications_by_work_order(
        self, work_order_id: str
    ) -> List[NotificationRecord]:
        """Retrieve all notifications associated with a specific work order.

        Useful for building an audit trail of who was notified and when.

        Args:
            work_order_id: The work order identifier.

        Returns:
            List of :class:`NotificationRecord` instances ordered by
            ``created_at`` ascending.
        """
        session = self._get_session()
        return (
            session.query(NotificationRecord)
            .filter(NotificationRecord.work_order_id == work_order_id)
            .order_by(NotificationRecord.created_at.asc())
            .all()
        )

    # ------------------------------------------------------------------
    # Async event-driven notification dispatch
    # ------------------------------------------------------------------

    async def enqueue_notification(self, payload: NotificationPayload) -> None:
        """Enqueue a notification payload for asynchronous processing.

        This method is **non-blocking** – it simply places the payload onto
        an internal asyncio queue and returns immediately.  The actual
        persistence is handled by the background listener task.

        Args:
            payload: The notification to dispatch.
        """
        await self._event_queue.put(payload)
        logger.debug(
            "Notification enqueued: type=%s work_order=%s recipient=%s",
            payload.notification_type.value,
            payload.work_order_id,
            payload.recipient_user_id,
        )

    def enqueue_notification_sync(self, payload: NotificationPayload) -> None:
        """Synchronous wrapper around :meth:`enqueue_notification`.

        Creates a new event loop if none is running, otherwise schedules the
        coroutine on the running loop.  This is the recommended entry-point
        for non-async callers (e.g. Flask route handlers).

        Args:
            payload: The notification to dispatch.
        """
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.enqueue_notification(payload))
        except RuntimeError:
            # No running loop – safe to create a new one for fire-and-forget.
            asyncio.run(self.enqueue_notification(payload))

    async def start_listener(self) -> None:
        """Start the background notification listener coroutine.

        The listener continuously pulls payloads from the internal queue and
        persists them via :meth:`create_notification`.  If persistence fails
        for a single notification the error is logged but the listener
        continues processing subsequent items.

        This method should be called once during application startup.
        """
        if self._listener_task is not None and not self._listener_task.done():
            logger.warning("Notification listener is already running.")
            return

        self._listener_task = asyncio.create_task(self._listener_loop())
        logger.info("Notification listener started.")

    async def stop_listener(self) -> None:
        """Gracefully stop the background notification listener.

        The listener will finish processing any payload already dequeued
        before shutting down.
        """
        if self._listener_task is None:
            return
        self._listener_task.cancel()
        try:
            await self._listener_task
        except asyncio.CancelledError:
            pass
        self._listener_task = None
        logger.info("Notification listener stopped.")

    async def _listener_loop(self) -> None:
        """Internal coroutine that drains the notification queue."""
        while True:
            try:
                payload: NotificationPayload = await self._event_queue.get()
                try:
                    # Run the blocking DB write in a thread to avoid
                    # blocking the event loop.
                    await asyncio.to_thread(self.create_notification, payload)
                except Exception:
                    logger.exception(
                        "Error persisting notification (type=%s, work_order=%s). "
                        "Continuing with next item.",
                        payload.notification_type.value,
                        payload.work_order_id,
                    )
                finally:
                    self._event_queue.task_done()
            except asyncio.CancelledError:
                logger.info("Notification listener loop cancelled.")
                break

    # ------------------------------------------------------------------
    # Approval-event → notification mapping helpers
    # ------------------------------------------------------------------

    @staticmethod
    def build_payload_for_approval_event(event: Dict[str, Any]) -> List[NotificationPayload]:
        """Translate an ``ApprovalNotificationEvent`` dictionary into one or
        more :class:`NotificationPayload` instances.

        The *event* dict is expected to contain at least the following keys:

        * ``event_type`` – one of ``"SUBMITTED"``, ``"LEVEL1_APPROVED"``,
          ``"LEVEL2_APPROVED"``, ``"APPROVED"``, ``"REJECTED"``,
          ``"CANCELLED"``.
        * ``work_order_id`` – the work order identifier.
        * ``actor_user_id`` – the user who performed the action.
        * ``applicant_user_id`` – the user who originally submitted the order.
        * ``current_status`` – the new status after the transition.
        * ``rejection_reason`` – (optional) present only for reject events.
        * ``next_approver_id`` – (optional) the user who should act next.

        Returns:
            A list of :class:`NotificationPayload` objects.  Typically one
            payload is returned, but certain transitions (e.g. L1 approval)
            may generate notifications for multiple recipients.
        """
        payloads: List[NotificationPayload] = []

        event_type: str = event.get("event_type", "")
        work_order_id: str = event.get("work_order_id", "")
        actor_id: str = event.get("actor_user_id", "")
        applicant_id: str = event.get("applicant_user_id", "")
        current_status: str = event.get("current_status", "")
        rejection_reason: Optional[str] = event.get("rejection_reason")
        next_approver_id: Optional[str] = event.get("next_approver_id")

        # --- SUBMITTED (PENDING → APPROVING_LEVEL_1) ---
        if event_type == "SUBMITTED":
            # Notify the L1 approver (department manager)
            if next_approver_id:
                payloads.append(
                    NotificationPayload(
                        notification_type=NotificationType.ORDER_SUBMITTED,
                        work_order_id=work_order_id,
                        recipient_user_id=next_approver_id,
                        title="新工单待审批",
                        body=(
                            f"工单 {work_order_id} 已由用户 {actor_id} 提交，"
                            f"等待您的部门主管审批。"
                        ),
                        related_approval_level=1,
                        metadata={"applicant_user_id": applicant_id},
                    )
                )
            # Also notify the applicant that submission was successful
            payloads.append(
                NotificationPayload(
                    notification_type=NotificationType.ORDER_SUBMITTED,
                    work_order_id=work_order_id,
                    recipient_user_id=applicant_id,
                    title="工单提交成功",
                    body=(
                        f"您的工单 {work_order_id} 已成功提交，"
                        f"当前状态：{current_status}。"
                    ),
                    related_approval_level=1,
                    metadata={"actor_user_id": actor_id},
                )
            )

        # --- LEVEL1_APPROVED (APPROVING_LEVEL_1 → APPROVING_LEVEL_2) ---
        elif event_type == "LEVEL1_APPROVED":
            # Notify the L2 approver (asset administrator)
            if next_approver_id:
                payloads.append(
                    NotificationPayload(
                        notification_type=NotificationType.LEVEL1_APPROVED,
                        work_order_id=work_order_id,
                        recipient_user_id=next_approver_id,
                        title="工单一级审批通过",
                        body=(
                            f"工单 {work_order_id} 已通过部门主管审批，"
                            f"等待您的资产管理员审批。"
                        ),
                        related_approval_level=2,
                        metadata={"l1_approver_id": actor_id},
                    )
                )
            # Notify the applicant
            payloads.append(
                NotificationPayload(
                    notification_type=NotificationType.LEVEL1_APPROVED,
                    work_order_id=work_order_id,
                    recipient_user_id=applicant_id,
                    title="工单一级审批通过",
                    body=(
                        f"您的工单 {work_order_id} 已通过部门主管审批，"
                        f"当前状态：{current_status}。"
                    ),
                    related_approval_level=2,
                    metadata={"l1_approver_id": actor_id},
                )
            )

        # --- LEVEL2_APPROVED / APPROVED (APPROVING_LEVEL_2 → APPROVED) ---
        elif event_type in ("LEVEL2_APPROVED", "APPROVED"):
            # Notify the applicant of final approval
            payloads.append(
                NotificationPayload(
                    notification_type=NotificationType.ORDER_APPROVED,
                    work_order_id=work_order_id,
                    recipient_user_id=applicant_id,
                    title="工单审批通过",
                    body=(
                        f"您的工单 {work_order_id} 已全部审批通过，"
                        f"当前状态：{current_status}。"
                    ),
                    related_approval_level=2,
                    metadata={"l2_approver_id": actor_id},
                )
            )

        # --- REJECTED (any approval level → REJECTED) ---
        elif event_type == "REJECTED":
            reason_display = rejection_reason or "未提供原因"
            payloads.append(
                NotificationPayload(
                    notification_type=NotificationType.ORDER_REJECTED,
                    work_order_id=work_order_id,
                    recipient_user_id=applicant_id,
                    title="工单被驳回",
                    body=(
                        f"您的工单 {work_order_id} 已被驳回。"
                        f"驳回原因：{reason_display}"
                    ),
                    related_approval_level=event.get("approval_level"),
                    metadata={
                        "rejection_reason": rejection_reason,
                        "rejector_id": actor_id,
                    },
                )
            )

        # --- CANCELLED (any → CANCELLED) ---
        elif event_type == "CANCELLED":
            payloads.append(
                NotificationPayload(
                    notification_type=NotificationType.ORDER_CANCELLED,
                    work_order_id=work_order_id,
                    recipient_user_id=applicant_id,
                    title="工单已取消",
                    body=f"您的工单 {work_order_id} 已被取消。",
                    metadata={"cancelled_by": actor_id},
                )
            )

        else:
            logger.warning(
                "Unknown approval event_type '%s' for work_order=%s. "
                "No notification payloads generated.",
                event_type,
                work_order_id,
            )

        return payloads

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _get_session(self):
        """Return the database session to use for the current operation.

        If an explicit session was provided at construction time it is
        returned; otherwise a new session is obtained from the application's
        session factory (lazy import to avoid circular dependencies).
        """
        if self._db_session is not None:
            return self._db_session
        # Lazy import to avoid circular dependency at module level.
        from backend.models.base import get_session  # type: ignore[attr-defined]

        return get_session()