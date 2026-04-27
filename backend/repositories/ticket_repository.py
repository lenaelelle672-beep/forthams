"""
Ticket Repository Module.

Provides data access layer for work-order (ticket) entities and their
associated approval records.  All mutating operations that change ticket
status use **optimistic locking** (via the ``version`` column) to prevent
concurrent approval conflicts.

Design decisions
----------------
* Queries that return tickets for the approval workbench accept a
  ``status_filter`` parameter so the service layer can enforce role-based
  data isolation (department managers see only ``APPROVING_LEVEL_1``,
  asset administrators see only ``APPROVING_LEVEL_2``).
* Approval records are persisted atomically together with the ticket
  status update inside the same transaction (managed by the service layer).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import and_, func, select, update
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.approval_history import ApprovalRecord
from backend.models.ticket import Ticket

logger = logging.getLogger(__name__)


class TicketRepository:
    """Async repository for :class:`~backend.models.ticket.Ticket` entities.

    All public methods accept an ``AsyncSession`` as their first argument so
    that callers (typically service-layer code wrapped in ``@Transactional``)
    control the unit-of-work boundary.
    """

    # ------------------------------------------------------------------
    # Basic CRUD
    # ------------------------------------------------------------------

    async def get_by_id(self, session: AsyncSession, ticket_id: int) -> Optional[Ticket]:
        """Return a single ticket by its primary key, or ``None`` if not found.

        Args:
            session: The SQLAlchemy async session.
            ticket_id: Primary key of the ticket.

        Returns:
            The :class:`Ticket` instance, or ``None``.
        """
        result = await session.execute(select(Ticket).where(Ticket.id == ticket_id))
        return result.scalar_one_or_none()

    async def get_by_id_with_lock(
        self, session: AsyncSession, ticket_id: int
    ) -> Optional[Ticket]:
        """Fetch a ticket with a ``FOR UPDATE`` row-level lock.

        This is useful when the caller needs to serialize concurrent
        modifications without relying solely on the optimistic-lock
        ``version`` column.

        Args:
            session: The SQLAlchemy async session.
            ticket_id: Primary key of the ticket.

        Returns:
            The locked :class:`Ticket` instance, or ``None``.
        """
        result = await session.execute(
            select(Ticket).where(Ticket.id == ticket_id).with_for_update()
        )
        return result.scalar_one_or_none()

    async def list_tickets(
        self,
        session: AsyncSession,
        *,
        status_filter: Optional[Sequence[str]] = None,
        applicant_id: Optional[int] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> List[Ticket]:
        """Return a paginated list of tickets, optionally filtered.

        Args:
            session: The SQLAlchemy async session.
            status_filter: If provided, only tickets whose ``status`` is in
                this sequence are returned.  Used for role-based workbench
                filtering (e.g. ``["APPROVING_LEVEL_1"]`` for department
                managers).
            applicant_id: If provided, only tickets created by this user
                are returned.
            offset: Number of rows to skip (pagination).
            limit: Maximum number of rows to return.

        Returns:
            A list of :class:`Ticket` instances.
        """
        stmt = select(Ticket).order_by(Ticket.created_at.desc())
        conditions: List[Any] = []
        if status_filter:
            conditions.append(Ticket.status.in_(status_filter))
        if applicant_id is not None:
            conditions.append(Ticket.applicant_id == applicant_id)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.offset(offset).limit(limit)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def count_tickets(
        self,
        session: AsyncSession,
        *,
        status_filter: Optional[Sequence[str]] = None,
        applicant_id: Optional[int] = None,
    ) -> int:
        """Return the total count of tickets matching the given filters.

        Args:
            session: The SQLAlchemy async session.
            status_filter: Optional status values to filter by.
            applicant_id: Optional applicant user id to filter by.

        Returns:
            The integer count of matching tickets.
        """
        stmt = select(func.count()).select_from(Ticket)
        conditions: List[Any] = []
        if status_filter:
            conditions.append(Ticket.status.in_(status_filter))
        if applicant_id is not None:
            conditions.append(Ticket.applicant_id == applicant_id)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        result = await session.scalar(stmt)
        return result or 0

    async def create(self, session: AsyncSession, ticket: Ticket) -> Ticket:
        """Persist a new ticket and return it with the generated ``id``.

        Args:
            session: The SQLAlchemy async session.
            ticket: The :class:`Ticket` instance to insert.

        Returns:
            The persisted :class:`Ticket` (with ``id`` populated).
        """
        session.add(ticket)
        await session.flush()
        await session.refresh(ticket)
        return ticket

    # ------------------------------------------------------------------
    # Status transition (optimistic locking)
    # ------------------------------------------------------------------

    async def update_status(
        self,
        session: AsyncSession,
        ticket_id: int,
        new_status: str,
        expected_version: int,
        *,
        rejection_reason: Optional[str] = None,
    ) -> Optional[Ticket]:
        """Atomically transition a ticket's status using optimistic locking.

        The ``UPDATE`` statement includes a ``WHERE version = :expected_version``
        clause.  If zero rows are affected it means another concurrent request
        already changed the ticket, and the method returns ``None`` so the
        caller can raise an HTTP 409 Conflict.

        Args:
            session: The SQLAlchemy async session.
            ticket_id: Primary key of the ticket.
            new_status: The target status (must be a valid
                :class:`~backend.models.ticket.TicketStatus` member name).
            expected_version: The ``version`` value the caller read before
                attempting the transition.
            rejection_reason: Optional rejection reason string (required
                when ``new_status`` is ``"REJECTED"``).

        Returns:
            The refreshed :class:`Ticket` on success, or ``None`` if the
            optimistic-lock check failed (concurrent modification detected).
        """
        values: Dict[str, Any] = {
            "status": new_status,
            "version": expected_version + 1,
            "updated_at": datetime.now(timezone.utc),
        }
        if rejection_reason is not None:
            values["rejection_reason"] = rejection_reason

        stmt = (
            update(Ticket)
            .where(
                and_(
                    Ticket.id == ticket_id,
                    Ticket.version == expected_version,
                )
            )
            .values(**values)
            .returning(Ticket)
        )
        try:
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()
            if row is not None:
                await session.refresh(row)
            return row
        except OperationalError as exc:
            logger.warning(
                "Optimistic-lock update failed for ticket %s: %s",
                ticket_id,
                exc,
            )
            return None

    async def cancel_ticket(
        self,
        session: AsyncSession,
        ticket_id: int,
        expected_version: int,
    ) -> Optional[Ticket]:
        """Set a ticket's status to ``CANCELLED`` using optimistic locking.

        Only tickets in ``PENDING``, ``APPROVING_LEVEL_1``, or
        ``APPROVING_LEVEL_2`` may be cancelled.  The caller (service layer)
        is responsible for validating the current status before invoking
        this method.

        Args:
            session: The SQLAlchemy async session.
            ticket_id: Primary key of the ticket.
            expected_version: The ``version`` value the caller read before
                attempting the cancellation.

        Returns:
            The refreshed :class:`Ticket` on success, or ``None`` if the
            optimistic-lock check failed.
        """
        return await self.update_status(
            session,
            ticket_id=ticket_id,
            new_status="CANCELLED",
            expected_version=expected_version,
        )

    # ------------------------------------------------------------------
    # Approval records
    # ------------------------------------------------------------------

    async def add_approval_record(
        self,
        session: AsyncSession,
        *,
        ticket_id: int,
        operator_id: int,
        action: str,
        comment: Optional[str] = None,
        rejection_reason: Optional[str] = None,
    ) -> ApprovalRecord:
        """Persist an approval record for a ticket.

        Args:
            session: The SQLAlchemy async session.
            ticket_id: Foreign key to the associated ticket.
            operator_id: The user who performed the action.
            action: One of ``"APPROVE"``, ``"REJECT"``, ``"SUBMIT"``,
                or ``"CANCEL"``.
            comment: Free-text comment from the operator.
            rejection_reason: Mandatory when *action* is ``"REJECT"``.

        Returns:
            The persisted :class:`ApprovalRecord`.
        """
        record = ApprovalRecord(
            ticket_id=ticket_id,
            operator_id=operator_id,
            action=action,
            comment=comment,
            rejection_reason=rejection_reason,
            created_at=datetime.now(timezone.utc),
        )
        session.add(record)
        await session.flush()
        await session.refresh(record)
        return record

    async def get_approval_records(
        self,
        session: AsyncSession,
        ticket_id: int,
    ) -> List[ApprovalRecord]:
        """Return all approval records for a given ticket, newest first.

        Args:
            session: The SQLAlchemy async session.
            ticket_id: Primary key of the ticket.

        Returns:
            A list of :class:`ApprovalRecord` instances ordered by
            ``created_at`` descending.
        """
        stmt = (
            select(ApprovalRecord)
            .where(ApprovalRecord.ticket_id == ticket_id)
            .order_by(ApprovalRecord.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def get_latest_approval_record(
        self,
        session: AsyncSession,
        ticket_id: int,
    ) -> Optional[ApprovalRecord]:
        """Return the most recent approval record for a ticket.

        Args:
            session: The SQLAlchemy async session.
            ticket_id: Primary key of the ticket.

        Returns:
            The latest :class:`ApprovalRecord`, or ``None`` if no records
            exist for this ticket.
        """
        stmt = (
            select(ApprovalRecord)
            .where(ApprovalRecord.ticket_id == ticket_id)
            .order_by(ApprovalRecord.created_at.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # Approval workbench queries (role-based filtering)
    # ------------------------------------------------------------------

    async def list_pending_for_level1(
        self,
        session: AsyncSession,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> List[Ticket]:
        """Return tickets awaiting Level-1 (department manager) approval.

        This is the data source for the department-manager approval
        workbench.  Only tickets with status ``APPROVING_LEVEL_1`` are
        returned.

        Args:
            session: The SQLAlchemy async session.
            offset: Pagination offset.
            limit: Pagination limit.

        Returns:
            A list of :class:`Ticket` instances in ``APPROVING_LEVEL_1``
            status.
        """
        return await self.list_tickets(
            session,
            status_filter=["APPROVING_LEVEL_1"],
            offset=offset,
            limit=limit,
        )

    async def list_pending_for_level2(
        self,
        session: AsyncSession,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> List[Ticket]:
        """Return tickets awaiting Level-2 (asset administrator) approval.

        This is the data source for the asset-administrator approval
        workbench.  Only tickets with status ``APPROVING_LEVEL_2`` are
        returned.

        Args:
            session: The SQLAlchemy async session.
            offset: Pagination offset.
            limit: Pagination limit.

        Returns:
            A list of :class:`Ticket` instances in ``APPROVING_LEVEL_2``
            status.
        """
        return await self.list_tickets(
            session,
            status_filter=["APPROVING_LEVEL_2"],
            offset=offset,
            limit=limit,
        )

    async def count_pending_for_level1(
        self,
        session: AsyncSession,
    ) -> int:
        """Return the count of tickets in ``APPROVING_LEVEL_1`` status.

        Args:
            session: The SQLAlchemy async session.

        Returns:
            Integer count of Level-1 pending tickets.
        """
        return await self.count_tickets(
            session,
            status_filter=["APPROVING_LEVEL_1"],
        )

    async def count_pending_for_level2(
        self,
        session: AsyncSession,
    ) -> int:
        """Return the count of tickets in ``APPROVING_LEVEL_2`` status.

        Args:
            session: The SQLAlchemy async session.

        Returns:
            Integer count of Level-2 pending tickets.
        """
        return await self.count_tickets(
            session,
            status_filter=["APPROVING_LEVEL_2"],
        )

    # ------------------------------------------------------------------
    # Utility helpers
    # ------------------------------------------------------------------

    async def exists_by_id(
        self,
        session: AsyncSession,
        ticket_id: int,
    ) -> bool:
        """Check whether a ticket with the given ID exists.

        Args:
            session: The SQLAlchemy async session.
            ticket_id: Primary key of the ticket.

        Returns:
            ``True`` if the ticket exists, ``False`` otherwise.
        """
        stmt = select(func.count()).select_from(Ticket).where(Ticket.id == ticket_id)
        count = await session.scalar(stmt)
        return (count or 0) > 0