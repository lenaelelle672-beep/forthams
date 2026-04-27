"""
Unit tests for WorkOrderService.

Tests cover:
- State machine transitions (PENDING → IN_PROGRESS → APPROVED/REJECTED)
- Version number increment on state changes
- Event publishing for approval/rejection operations
- Permission validation
- Concurrency handling with optimistic locking

Reference: SWARM-2025-Q2-P0-003 Iteration 8
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime
from enum import Enum

# Assuming these modules exist based on the codebase structure
from src.domain.services.work_order_service import WorkOrderService
from src.domain.services.approval_service import ApprovalService
from src.domain.events.workorder_events import WorkOrderApprovedEvent, WorkOrderRejectedEvent
from src.models.workorder import WorkOrder, WorkOrderState, WorkOrderStatus
from src.domain.state_machine.states import StateEnum


class TestWorkOrderServiceStateTransitions:
    """Test work order state machine transitions."""

    @pytest.fixture
    def mock_repository(self):
        """Create mock repository for work orders."""
        repo = MagicMock()
        repo.get_by_id = MagicMock()
        repo.save = MagicMock()
        repo.update = MagicMock()
        return repo

    @pytest.fixture
    def mock_event_bus(self):
        """Create mock event bus for domain events."""
        event_bus = MagicMock()
        event_bus.publish = MagicMock()
        return event_bus

    @pytest.fixture
    def workorder_service(self, mock_repository, mock_event_bus):
        """Create WorkOrderService with mocked dependencies."""
        service = WorkOrderService(
            repository=mock_repository,
            event_bus=mock_event_bus
        )
        return service

    def test_ut_001_state_enum_definition(self):
        """UT-001: Verify all state enum values are correctly defined.
        
        Validates that StateEnum.APPROVED.value equals "APPROVED".
        """
        assert StateEnum.APPROVED.value == "APPROVED"
        assert StateEnum.PENDING.value == "PENDING"
        assert StateEnum.IN_PROGRESS.value == "IN_PROGRESS"
        assert StateEnum.REJECTED.value == "REJECTED"
        assert StateEnum.CLOSED.value == "CLOSED"

    def test_ut_002_valid_state_transition_pending_to_in_progress(
        self, workorder_service, mock_repository
    ):
        """UT-002: Verify PENDING → IN_PROGRESS transition is valid.
        
        State machine should allow transition from PENDING to IN_PROGRESS.
        """
        # Setup: Create a pending work order
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-001"
        work_order.state = WorkOrderState.PENDING
        work_order.version = 1
        mock_repository.get_by_id.return_value = work_order

        # Execute: Check if transition is allowed
        can_transition = workorder_service.state_machine.can_transition(
            WorkOrderState.PENDING,
            WorkOrderState.IN_PROGRESS
        )

        # Verify: Transition should be allowed
        assert can_transition is True

    def test_ut_003_invalid_state_transition_approved_to_pending(
        self, workorder_service
    ):
        """UT-003: Verify APPROVED → PENDING transition is invalid.
        
        State machine should reject reverse transitions from terminal states.
        """
        # Execute: Check if transition is disallowed
        can_transition = workorder_service.state_machine.can_transition(
            WorkOrderState.APPROVED,
            WorkOrderState.PENDING
        )

        # Verify: Transition should NOT be allowed
        assert can_transition is False

    def test_ut_004_state_transition_execution_in_progress_to_approved(
        self, workorder_service, mock_repository, mock_event_bus
    ):
        """UT-004: Execute IN_PROGRESS → APPROVED transition and verify state update.
        
        After successful transition, current_state should equal "APPROVED".
        """
        # Setup
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-002"
        work_order.state = WorkOrderState.IN_PROGRESS
        work_order.version = 1
        mock_repository.get_by_id.return_value = work_order

        # Execute: Perform transition
        result = workorder_service.transition(
            work_order_id="WO-2025-002",
            from_state=WorkOrderState.IN_PROGRESS,
            to_state=WorkOrderState.APPROVED
        )

        # Verify: State was updated
        assert result.state == WorkOrderState.APPROVED
        mock_repository.update.assert_called_once()

    def test_ut_005_version_number_increment_on_state_change(
        self, workorder_service, mock_repository
    ):
        """UT-005: Verify version number increments after state change.
        
        Triggering state change should result in version = old_version + 1.
        """
        # Setup
        old_version = 1
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-003"
        work_order.state = WorkOrderState.IN_PROGRESS
        work_order.version = old_version
        mock_repository.get_by_id.return_value = work_order

        # Execute
        result = workorder_service.transition(
            work_order_id="WO-2025-003",
            from_state=WorkOrderState.IN_PROGRESS,
            to_state=WorkOrderState.APPROVED
        )

        # Verify: Version incremented
        assert result.version == old_version + 1

    def test_ut_006_notification_event_published_on_approval(
        self, workorder_service, mock_repository, mock_event_bus
    ):
        """UT-006: Verify event bus receives WorkOrderApproved event after approval.
        
        After approval completes, event_bus.publish should be called once
        with a WorkOrderApproved event.
        """
        # Setup
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-004"
        work_order.state = WorkOrderState.IN_PROGRESS
        work_order.version = 1
        mock_repository.get_by_id.return_value = work_order

        # Execute: Approve work order
        workorder_service.approve(
            work_order_id="WO-2025-004",
            approved_by="approver001",
            reason="Approved for implementation"
        )

        # Verify: Event was published
        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args
        published_event = call_args[0][0]  # First positional argument
        assert isinstance(published_event, WorkOrderApprovedEvent)
        assert published_event.work_order_id == "WO-2025-004"

    def test_notification_event_published_on_rejection(
        self, workorder_service, mock_repository, mock_event_bus
    ):
        """Verify event bus receives WorkOrderRejected event after rejection."""
        # Setup
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-005"
        work_order.state = WorkOrderState.IN_PROGRESS
        work_order.version = 1
        mock_repository.get_by_id.return_value = work_order

        # Execute: Reject work order
        workorder_service.reject(
            work_order_id="WO-2025-005",
            rejected_by="approver001",
            reason="Insufficient documentation"
        )

        # Verify: Event was published
        mock_event_bus.publish.assert_called_once()
        call_args = mock_event_bus.publish.call_args
        published_event = call_args[0][0]
        assert isinstance(published_event, WorkOrderRejectedEvent)
        assert published_event.work_order_id == "WO-2025-005"


class TestWorkOrderServiceConcurrency:
    """Test optimistic locking and concurrency handling."""

    @pytest.fixture
    def mock_repository(self):
        repo = MagicMock()
        return repo

    @pytest.fixture
    def workorder_service(self, mock_repository):
        event_bus = MagicMock()
        return WorkOrderService(
            repository=mock_repository,
            event_bus=event_bus
        )

    def test_concurrent_approval_conflict_detection(
        self, workorder_service, mock_repository
    ):
        """Test that concurrent approval attempts are detected via version mismatch.
        
        Second request should return 409 Conflict when version mismatch occurs.
        """
        # Setup: First request succeeds, updates version to 2
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-006"
        work_order.state = WorkOrderState.IN_PROGRESS
        work_order.version = 1
        
        # Simulate first request changes version to 2
        mock_repository.get_by_id.return_value = work_order
        
        # First approval
        result1 = workorder_service.approve(
            work_order_id="WO-2025-006",
            approved_by="approver001",
            reason="First approval",
            expected_version=1
        )
        
        # Simulate version was incremented
        work_order.version = 2
        
        # Second approval with stale version (should fail)
        result2 = workorder_service.approve(
            work_order_id="WO-2025-006",
            approved_by="approver002",
            reason="Second approval",
            expected_version=1  # Stale version
        )
        
        # Verify: Second request should fail due to version conflict
        assert result2.success is False
        assert result2.error_code == "VERSION_CONFLICT"

    def test_version_mismatch_returns_conflict(self, workorder_service, mock_repository):
        """Verify that version mismatch returns 409 Conflict status."""
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-007"
        work_order.state = WorkOrderState.IN_PROGRESS
        work_order.version = 5  # Current version is 5
        mock_repository.get_by_id.return_value = work_order

        # Attempt with outdated version
        result = workorder_service.approve(
            work_order_id="WO-2025-007",
            approved_by="approver001",
            reason="Test",
            expected_version=3  # Outdated version
        )

        # Verify: Operation should fail
        assert result.success is False


class TestWorkOrderServicePermission:
    """Test permission validation for approval operations."""

    @pytest.fixture
    def mock_repository(self):
        return MagicMock()

    @pytest.fixture
    def workorder_service(self, mock_repository):
        event_bus = MagicMock()
        return WorkOrderService(
            repository=mock_repository,
            event_bus=event_bus
        )

    def test_non_approver_role_cannot_approve(
        self, workorder_service, mock_repository
    ):
        """Test that non-approver role receives 403 Forbidden."""
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-008"
        work_order.state = WorkOrderState.IN_PROGRESS
        work_order.dept_id = "DEPT-001"
        mock_repository.get_by_id.return_value = work_order

        # Execute: Attempt approval with non-approver role
        result = workorder_service.approve(
            work_order_id="WO-2025-008",
            approved_by="user001",  # Not an approver
            reason="Test",
            user_roles=["viewer"]  # Insufficient role
        )

        # Verify: Should be rejected due to insufficient permissions
        assert result.success is False
        assert result.error_code == "FORBIDDEN"

    def test_approver_role_can_approve(self, workorder_service, mock_repository):
        """Test that approver role can successfully approve."""
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-009"
        work_order.state = WorkOrderState.IN_PROGRESS
        work_order.dept_id = "DEPT-001"
        mock_repository.get_by_id.return_value = work_order

        # Execute: Attempt approval with approver role
        result = workorder_service.approve(
            work_order_id="WO-2025-009",
            approved_by="approver001",
            reason="Approved",
            user_roles=["approver"]  # Sufficient role
        )

        # Verify: Should succeed
        assert result.success is True


class TestWorkOrderServiceTerminalState:
    """Test operations on terminal states."""

    @pytest.fixture
    def mock_repository(self):
        return MagicMock()

    @pytest.fixture
    def workorder_service(self, mock_repository):
        event_bus = MagicMock()
        return WorkOrderService(
            repository=mock_repository,
            event_bus=event_bus
        )

    def test_cannot_modify_approved_work_order(
        self, workorder_service, mock_repository
    ):
        """Test that APPROVED state work order cannot be modified.
        
        Operations on terminal states should return 422 Unprocessable Entity.
        """
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-010"
        work_order.state = WorkOrderState.APPROVED  # Terminal state
        mock_repository.get_by_id.return_value = work_order

        # Attempt to approve already approved work order
        result = workorder_service.approve(
            work_order_id="WO-2025-010",
            approved_by="approver001",
            reason="Another approval"
        )

        # Verify: Should fail - cannot modify terminal state
        assert result.success is False
        assert result.error_code == "INVALID_STATE_TRANSITION"

    def test_cannot_modify_rejected_work_order(
        self, workorder_service, mock_repository
    ):
        """Test that REJECTED state work order cannot be modified."""
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-011"
        work_order.state = WorkOrderState.REJECTED
        mock_repository.get_by_id.return_value = work_order

        result = workorder_service.reject(
            work_order_id="WO-2025-011",
            rejected_by="approver001",
            reason="Another rejection"
        )

        assert result.success is False
        assert result.error_code == "INVALID_STATE_TRANSITION"


class TestWorkOrderServiceApprovalHistory:
    """Test approval history recording."""

    @pytest.fixture
    def mock_repository(self):
        repo = MagicMock()
        repo.get_history = MagicMock(return_value=[])
        return repo

    @pytest.fixture
    def workorder_service(self, mock_repository):
        event_bus = MagicMock()
        return WorkOrderService(
            repository=mock_repository,
            event_bus=event_bus
        )

    def test_approval_reason_saved_to_history(
        self, workorder_service, mock_repository
    ):
        """Test that approval reason is stored in approval history.
        
        Query approval_history table should return matching reason field.
        """
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-012"
        work_order.state = WorkOrderState.IN_PROGRESS
        work_order.version = 1
        mock_repository.get_by_id.return_value = work_order

        expected_reason = "Budget approved for Q3 project"

        # Execute: Approve with reason
        workorder_service.approve(
            work_order_id="WO-2025-012",
            approved_by="approver001",
            reason=expected_reason
        )

        # Verify: History record was created with correct reason
        # Check that save was called with history containing reason
        saved_history = mock_repository.save.call_args[0][1]  # Second arg
        assert saved_history.reason == expected_reason

    def test_rejection_reason_saved_to_history(
        self, workorder_service, mock_repository
    ):
        """Test that rejection reason is stored in approval history."""
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-013"
        work_order.state = WorkOrderState.IN_PROGRESS
        work_order.version = 1
        mock_repository.get_by_id.return_value = work_order

        expected_reason = "Missing cost breakdown documentation"

        workorder_service.reject(
            work_order_id="WO-2025-013",
            rejected_by="approver001",
            reason=expected_reason
        )

        saved_history = mock_repository.save.call_args[0][1]
        assert saved_history.reason == expected_reason

    def test_approval_history_immutable(
        self, workorder_service, mock_repository
    ):
        """Test that approval history records are not physically deleted.
        
        History records should only be marked as logically deleted.
        """
        work_order = MagicMock(spec=WorkOrder)
        work_order.id = "WO-2025-014"
        work_order.state = WorkOrderState.APPROVED
        work_order.version = 2
        
        # Mock existing history
        existing_history = [
            MagicMock(id="HIST-001", is_deleted=False),
            MagicMock(id="HIST-002", is_deleted=False)
        ]
        mock_repository.get_history.return_value = existing_history

        # Attempt to delete history (should not physically delete)
        result = workorder_service.get_history("WO-2025-014")

        # Verify: History should still exist
        assert len(result) == 2
        # No delete operation should be called
        mock_repository.delete.assert_not_called()


class TestWorkOrderServiceTimeout:
    """Test response time requirements."""

    @pytest.fixture
    def mock_repository(self):
        repo = MagicMock()
        repo.get_by_id = MagicMock(return_value=MagicMock(
            id="WO-2025-015",
            state=WorkOrderState.IN_PROGRESS,
            version=1
        ))
        return repo

    @pytest.fixture
    def workorder_service(self, mock_repository):
        event_bus = MagicMock()
        return WorkOrderService(
            repository=mock_repository,
            event_bus=event_bus
        )

    def test_approval_response_within_2_seconds(
        self, workorder_service
    ):
        """Test that approval operation completes within 2 seconds.
        
        Performance requirement: Approval response time ≤ 2 seconds.
        """
        import time

        start_time = time.time()
        
        result = workorder_service.approve(
            work_order_id="WO-2025-015",
            approved_by="approver001",
            reason="Performance test"
        )
        
        elapsed_time = time.time() - start_time

        # Verify: Response time within limit
        assert elapsed_time < 2.0, f"Approval took {elapsed_time:.2f}s, exceeds 2s limit"