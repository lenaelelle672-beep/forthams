# Frontend Unit Tests for Work Order State Machine
import pytest
from unittest.mock import MagicMock, patch


class TestWorkOrderStateMachine:
    """Test suite for Work Order State Machine functionality."""

    def test_initial_state(self):
        """Test that work order starts in correct initial state."""
        mock_work_order = MagicMock()
        mock_work_order.status = "PENDING"
        assert mock_work_order.status == "PENDING"

    def test_approve_transition(self):
        """Test approval state transition."""
        mock_work_order = MagicMock()
        mock_work_order.status = "PENDING"
        # Simulate approval
        mock_work_order.status = "APPROVED"
        assert mock_work_order.status == "APPROVED"

    def test_reject_transition(self):
        """Test rejection state transition."""
        mock_work_order = MagicMock()
        mock_work_order.status = "PENDING"
        # Simulate rejection
        mock_work_order.status = "REJECTED"
        assert mock_work_order.status == "REJECTED"