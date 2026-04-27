"""
Approval Chain Repository

Provides persistence operations for the multi-level approval chain system.
Handles approval record CRUD, work order status transitions with optimistic
locking, and role-based approval queries.

State Machine Flow:
    PENDING → APPROVING_LEVEL_1 → APPROVING_LEVEL_2 → APPROVED
    Any approval node → REJECTED
    Any non-terminal state → CANCELLED
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, update, and_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.approval_chain import ApprovalChain
from src.models.approval_record import ApprovalRecord
from src.models.approval_node import ApprovalNode
from src.models.workorder import WorkOrder
from src.models.enums import OrderStatus, ApprovalAction
from src.core.exceptions import (
    StateTransitionError,
    OptimisticLockError,
    ApprovalRecordNotFoundError,
)


class ApprovalChainRepository:
    """Repository for managing approval chain persistence operations.

    Encapsulates all database interactions related to the multi-level
    approval workflow, including approval record creation, work order
    status updates with optimistic locking, and role-based pending
    approval queries for data isolation.
    """

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository with database session.

        Args:
            session: The async database session for executing queries.
        """
        self._session = session

    # ------------------------------------------------------------------
    # Work Order Queries (with optimistic locking support)
    # ------------------------------------------------------------------

    async def get_work_order_by_id(
        self, order_id: UUID, *, for_update: bool = False
    ) -> Optional[WorkOrder]:
        """Fetch a work order by its primary key.

        Args:
            order_id: The UUID of the work order to retrieve.
            for_update: If True, acquire a row-level lock (SELECT FOR UPDATE).

        Returns:
            The WorkOrder instance, or None if not found.
        """
        stmt = select(WorkOrder).where(WorkOrder.id == order_id)
        if for_update:
            stmt = stmt.with_for_update()
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_work_order_status(
        self,
        order_id: UUID,
        new_status: OrderStatus,
        expected_version: int,
    ) -> WorkOrder:
        """Update work order status with optimistic locking.

        Uses the ``version`` column to detect concurrent modifications.
        If the current version in the database does not match
        ``expected_version``, an ``OptimisticLockError`` is raised.

        Args:
            order_id: The UUID of the work order to update.
            new_status: The target status to transition to.
            expected_version: The version the caller expects the row to have.

        Returns:
            The updated WorkOrder instance.

        Raises:
            OptimisticLockError: If the row version has changed since read.
        """
        stmt = (
            update(WorkOrder)
            .where(
                and_(
                    WorkOrder.id == order_id,
                    WorkOrder.version == expected_version,
                )
            )
            .values(
                status=new_status.value,
                version=expected_version + 1,
                updated_at=datetime.utcnow(),
            )
            .returning(WorkOrder)
        )
        result = await self._session.execute(stmt)
        updated_order = result.scalar_one_or_none()

        if updated_order is None:
            raise OptimisticLockError(
                f"Concurrent modification detected for work order {order_id}. "
                f"Expected version {expected_version} but row was modified by another transaction."
            )

        return updated_order

    # ------------------------------------------------------------------
    # Approval Chain CRUD
    # ------------------------------------------------------------------

    async def create_approval_chain(
        self,
        order_id: UUID,
        nodes: List[dict],
    ) -> ApprovalChain:
        """Create a new approval chain with its ordered approval nodes.

        Args:
            order_id: The UUID of the work order this chain belongs to.
            nodes: A list of dicts, each containing at least
                ``level`` (int), ``role`` (str), and optionally
                ``assignee_id`` (UUID).

        Returns:
            The newly created ApprovalChain instance (not yet flushed;
            caller must commit the session).
        """
        chain = ApprovalChain(
            order_id=order_id,
            created_at=datetime.utcnow(),
        )
        self._session.add(chain)
        await self._session.flush()

        for node_data in nodes:
            node = ApprovalNode(
                chain_id=chain.id,
                level=node_data["level"],
                role=node_data["role"],
                assignee_id=node_data.get("assignee_id"),
                status="PENDING",
                created_at=datetime.utcnow(),
            )
            self._session.add(node)

        return chain

    async def get_approval_chain_by_order_id(
        self, order_id: UUID
    ) -> Optional[ApprovalChain]:
        """Retrieve the approval chain associated with a work order.

        Args:
            order_id: The UUID of the work order.

        Returns:
            The ApprovalChain instance, or None if no chain exists.
        """
        stmt = select(ApprovalChain).where(ApprovalChain.order_id == order_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_approval_nodes_by_chain_id(
        self, chain_id: UUID
    ) -> List[ApprovalNode]:
        """Retrieve all approval nodes for a given chain, ordered by level.

        Args:
            chain_id: The UUID of the approval chain.

        Returns:
            A list of ApprovalNode instances sorted by ascending level.
        """
        stmt = (
            select(ApprovalNode)
            .where(ApprovalNode.chain_id == chain_id)
            .order_by(ApprovalNode.level.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_current_approval_node(
        self, order_id: UUID
    ) -> Optional[ApprovalNode]:
        """Get the current pending approval node for a work order.

        The current node is the first node whose status is still ``PENDING``,
        ordered by level ascending.

        Args:
            order_id: The UUID of the work order.

        Returns:
            The current pending ApprovalNode, or None if all nodes are
            processed or no chain exists.
        """
        chain = await self.get_approval_chain_by_order_id(order_id)
        if chain is None:
            return None

        nodes = await self.get_approval_nodes_by_chain_id(chain.id)
        for node in nodes:
            if node.status == "PENDING":
                return node
        return None

    async def update_approval_node_status(
        self,
        node_id: UUID,
        status: str,
        operator_id: Optional[UUID] = None,
    ) -> ApprovalNode:
        """Update the status of a specific approval node.

        Args:
            node_id: The UUID of the approval node.
            status: The new status string (e.g. ``"APPROVED"``, ``"REJECTED"``).
            operator_id: Optional UUID of the operator performing the action.

        Returns:
            The updated ApprovalNode instance.
        """
        stmt = (
            update(ApprovalNode)
            .where(ApprovalNode.id == node_id)
            .values(
                status=status,
                operator_id=operator_id,
                acted_at=datetime.utcnow(),
            )
            .returning(ApprovalNode)
        )
        result = await self._session.execute(stmt)
        node = result.scalar_one_or_none()
        if node is None:
            raise ApprovalRecordNotFoundError(
                f"Approval node {node_id} not found."
            )
        return node

    # ------------------------------------------------------------------
    # Approval Record CRUD
    # ------------------------------------------------------------------

    async def create_approval_record(
        self,
        order_id: UUID,
        operator_id: UUID,
        action: ApprovalAction,
        level: int,
        rejection_reason: Optional[str] = None,
        comment: Optional[str] = None,
    ) -> ApprovalRecord:
        """Persist a new approval record for audit trail purposes.

        Args:
            order_id: The UUID of the work order being acted upon.
            operator_id: The UUID of the user performing the action.
            action: The approval action taken (APPROVE / REJECT / CANCEL).
            level: The approval level at which this action was taken (1 or 2).
            rejection_reason: Required when action is REJECT; max 500 chars.
            comment: Optional free-text comment from the operator.

        Returns:
            The newly created ApprovalRecord instance.
        """
        record = ApprovalRecord(
            order_id=order_id,
            operator_id=operator_id,
            action=action.value,
            level=level,
            rejection_reason=rejection_reason,
            comment=comment,
            created_at=datetime.utcnow(),
        )
        self._session.add(record)
        await self._session.flush()
        return record

    async def get_approval_records_by_order_id(
        self,
        order_id: UUID,
        *,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ApprovalRecord]:
        """Retrieve approval records for a work order, newest first.

        Args:
            order_id: The UUID of the work order.
            limit: Maximum number of records to return.
            offset: Number of records to skip (for pagination).

        Returns:
            A list of ApprovalRecord instances ordered by creation time
            descending (most recent first).
        """
        stmt = (
            select(ApprovalRecord)
            .where(ApprovalRecord.order_id == order_id)
            .order_by(desc(ApprovalRecord.created_at))
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_approval_records_by_order_id(
        self, order_id: UUID
    ) -> int:
        """Count total approval records for a work order.

        Args:
            order_id: The UUID of the work order.

        Returns:
            The total number of approval records associated with the order.
        """
        stmt = (
            select(func.count(ApprovalRecord.id))
            .where(ApprovalRecord.order_id == order_id)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    # ------------------------------------------------------------------
    # Role-Based Pending Approval Queries (Data Isolation)
    # ------------------------------------------------------------------

    async def get_pending_work_orders_by_role(
        self,
        role: str,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> List[WorkOrder]:
        """Retrieve work orders pending approval for a specific role.

        Enforces data isolation: department managers (``DEPT_MANAGER``)
        only see ``APPROVING_LEVEL_1`` orders, and asset managers
        (``ASSET_MANAGER``) only see ``APPROVING_LEVEL_2`` orders.

        Args:
            role: The role name used to determine which approval level
                to query. Must be one of ``DEPT_MANAGER`` or
                ``ASSET_MANAGER``.
            limit: Maximum number of records to return.
            offset: Number of records to skip (for pagination).

        Returns:
            A list of WorkOrder instances matching the role's pending
            approval level.

        Raises:
            ValueError: If the role is not recognized.
        """
        role_to_status = {
            "DEPT_MANAGER": OrderStatus.APPROVING_LEVEL_1,
            "ASSET_MANAGER": OrderStatus.APPROVING_LEVEL_2,
        }

        target_status = role_to_status.get(role)
        if target_status is None:
            raise ValueError(
                f"Unrecognized role '{role}' for approval query. "
                f"Expected one of: {list(role_to_status.keys())}"
            )

        stmt = (
            select(WorkOrder)
            .where(WorkOrder.status == target_status.value)
            .order_by(WorkOrder.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_pending_work_orders_by_role(self, role: str) -> int:
        """Count work orders pending approval for a specific role.

        Args:
            role: The role name (``DEPT_MANAGER`` or ``ASSET_MANAGER``).

        Returns:
            The count of pending work orders for the given role.

        Raises:
            ValueError: If the role is not recognized.
        """
        role_to_status = {
            "DEPT_MANAGER": OrderStatus.APPROVING_LEVEL_1,
            "ASSET_MANAGER": OrderStatus.APPROVING_LEVEL_2,
        }

        target_status = role_to_status.get(role)
        if target_status is None:
            raise ValueError(
                f"Unrecognized role '{role}' for approval count query. "
                f"Expected one of: {list(role_to_status.keys())}"
            )

        stmt = (
            select(func.count(WorkOrder.id))
            .where(WorkOrder.status == target_status.value)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    # ------------------------------------------------------------------
    # Approval History / Audit Queries
    # ------------------------------------------------------------------

    async def get_approval_history_for_order(
        self, order_id: UUID
    ) -> List[dict]:
        """Get the full approval history for a work order as a list of dicts.

        Each dict contains: ``operator_id``, ``action``, ``level``,
        ``rejection_reason``, ``comment``, and ``created_at``.

        Args:
            order_id: The UUID of the work order.

        Returns:
            A list of dicts representing the chronological approval history.
        """
        records = await self.get_approval_records_by_order_id(order_id)
        return [
            {
                "operator_id": str(record.operator_id),
                "action": record.action,
                "level": record.level,
                "rejection_reason": record.rejection_reason,
                "comment": record.comment,
                "created_at": record.created_at.isoformat()
                if record.created_at
                else None,
            }
            for record in records
        ]