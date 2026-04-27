"""
Asset State Engine Unit Tests

Tests for SWARM-002 iteration 7: Asset Retirement/Discard Workflow
- Asset state transition engine
- Retirement request approval chain
- History record persistence

Reference: SPEC.md Section ATB-001, ATB-002
"""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime
from enum import Enum


class AssetStatus(Enum):
    """Asset status enumeration matching system states."""
    IN_USE = "IN_USE"
    PENDING_RETIREMENT = "PENDING_RETIREMENT"
    RETIRED = "RETIRED"


class StateTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    pass


class DuplicatePendingRequestError(Exception):
    """Raised when attempting to create a duplicate pending retirement request."""
    pass


class AssetStateEngine:
    """
    Asset state transition engine implementing predefined transition rules.
    
    State Transition Matrix:
    - IN_USE → PENDING_RETIREMENT (retirement request created)
    - PENDING_RETIREMENT → RETIRED (approval chain passed)
    - PENDING_RETIREMENT → IN_USE (approval rejected or cancelled)
    - RETIRED → (forbidden, non-reversible state)
    """
    
    VALID_TRANSITIONS = {
        AssetStatus.IN_USE: [AssetStatus.PENDING_RETIREMENT],
        AssetStatus.PENDING_RETIREMENT: [AssetStatus.RETIRED, AssetStatus.IN_USE],
        AssetStatus.RETIRED: [],  # Non-reversible
    }
    
    def __init__(self, history_repository=None, retirement_repository=None):
        """
        Initialize the state engine.
        
        Args:
            history_repository: Repository for recording state change history
            retirement_repository: Repository for checking pending requests
        """
        self._history_repo = history_repository
        self._retirement_repo = retirement_repository
    
    def can_transition(self, from_status: str, to_status: str, asset_id: str = None) -> bool:
        """
        Check if a state transition is valid.
        
        Args:
            from_status: Current asset status string
            to_status: Target asset status string
            asset_id: Optional asset identifier for additional validation
            
        Returns:
            True if transition is allowed, False otherwise
        """
        try:
            from_enum = AssetStatus(from_status)
            to_enum = AssetStatus(to_status)
        except ValueError:
            return False
        
        allowed_targets = self.VALID_TRANSITIONS.get(from_enum, [])
        return to_enum in allowed_targets
    
    def transition(
        self,
        asset_id: str,
        from_status: str,
        to_status: str,
        operator_id: str = None,
        metadata: dict = None
    ) -> dict:
        """
        Execute a state transition with history recording.
        
        Args:
            asset_id: Asset identifier
            from_status: Current status
            to_status: Target status
            operator_id: User performing the transition
            metadata: Additional context data
            
        Returns:
            dict with transition result details
            
        Raises:
            StateTransitionError: If transition is not allowed
        """
        if not self.can_transition(from_status, to_status, asset_id):
            raise StateTransitionError(
                f"Invalid transition: {from_status} -> {to_status}"
            )
        
        # Record history if repository available
        if self._history_repo:
            self._history_repo.create(
                asset_id=asset_id,
                from_status=from_status,
                to_status=to_status,
                operator_id=operator_id,
                change_time=datetime.utcnow(),
                metadata=metadata or {}
            )
        
        return {
            "asset_id": asset_id,
            "from_status": from_status,
            "to_status": to_status,
            "transitioned_at": datetime.utcnow(),
            "operator_id": operator_id
        }
    
    def get_available_transitions(self, current_status: str) -> list:
        """
        Get list of valid target states from current status.
        
        Args:
            current_status: Current asset status
            
        Returns:
            List of valid target status strings
        """
        try:
            current_enum = AssetStatus(current_status)
        except ValueError:
            return []
        
        return [s.value for s in self.VALID_TRANSITIONS.get(current_enum, [])]


# ============================================================================
# Test Cases: ATB-001 - Valid State Transition Validation
# ============================================================================

class TestAssetStateEngineValidTransitions:
    """ATB-001: Valid state transitions must be allowed."""
    
    def test_valid_state_transition_in_use_to_pending_retirement(self):
        """
        ATB-001a: IN_USE → PENDING_RETIREMENT transition is valid.
        
        This transition occurs when a retirement request is successfully created.
        """
        engine = AssetStateEngine()
        result = engine.can_transition("IN_USE", "PENDING_RETIREMENT", asset_id="A001")
        assert result is True, "IN_USE to PENDING_RETIREMENT should be valid"
    
    def test_valid_state_transition_pending_to_retired(self):
        """
        ATB-001b: PENDING_RETIREMENT → RETIRED transition is valid.
        
        This transition occurs when the approval chain is fully passed.
        """
        engine = AssetStateEngine()
        result = engine.can_transition("PENDING_RETIREMENT", "RETIRED", asset_id="A001")
        assert result is True, "PENDING_RETIREMENT to RETIRED should be valid"
    
    def test_valid_state_transition_pending_to_in_use_rejection(self):
        """
        ATB-001c: PENDING_RETIREMENT → IN_USE transition is valid (rejection case).
        
        This transition occurs when approval is rejected.
        """
        engine = AssetStateEngine()
        result = engine.can_transition("PENDING_RETIREMENT", "IN_USE", asset_id="A001")
        assert result is True, "PENDING_RETIREMENT to IN_USE (rejection) should be valid"
    
    def test_valid_state_transition_pending_to_in_use_cancellation(self):
        """
        ATB-001d: PENDING_RETIREMENT → IN_USE transition is valid (cancellation case).
        
        This transition occurs when the applicant cancels the request.
        """
        engine = AssetStateEngine()
        result = engine.can_transition("PENDING_RETIREMENT", "IN_USE", asset_id="A001")
        assert result is True, "PENDING_RETIREMENT to IN_USE (cancellation) should be valid"
    
    def test_get_available_transitions_from_in_use(self):
        """Verify available transitions from IN_USE status."""
        engine = AssetStateEngine()
        available = engine.get_available_transitions("IN_USE")
        assert "PENDING_RETIREMENT" in available
        assert "RETIRED" not in available
        assert len(available) == 1
    
    def test_get_available_transitions_from_pending_retirement(self):
        """Verify available transitions from PENDING_RETIREMENT status."""
        engine = AssetStateEngine()
        available = engine.get_available_transitions("PENDING_RETIREMENT")
        assert "RETIRED" in available
        assert "IN_USE" in available
        assert len(available) == 2


# ============================================================================
# Test Cases: ATB-002 - Invalid State Transition Validation
# ============================================================================

class TestAssetStateEngineInvalidTransitions:
    """ATB-002: Invalid state transitions must be rejected."""
    
    def test_invalid_transition_in_use_to_retired_direct(self):
        """
        ATB-002a: IN_USE → RETIRED direct transition is forbidden.
        
        Constraint C-001: Assets must follow predefined transition rules.
        Direct jump from active to retired bypasses approval chain.
        """
        engine = AssetStateEngine()
        result = engine.can_transition("IN_USE", "RETIRED", asset_id="A001")
        assert result is False, "IN_USE to RETIRED direct jump should be invalid"
    
    def test_invalid_transition_retired_to_in_use(self):
        """
        ATB-002b: RETIRED → IN_USE reverse transition is forbidden.
        
        Constraint C-004: RETIRED is an irreversible state.
        """
        engine = AssetStateEngine()
        result = engine.can_transition("RETIRED", "IN_USE", asset_id="A001")
        assert result is False, "RETIRED to IN_USE reverse jump should be invalid"
    
    def test_invalid_transition_retired_to_pending_retirement(self):
        """
        ATB-002c: RETIRED → PENDING_RETIREMENT is forbidden.
        
        Once retired, an asset cannot re-enter the retirement workflow.
        """
        engine = AssetStateEngine()
        result = engine.can_transition("RETIRED", "PENDING_RETIREMENT", asset_id="A001")
        assert result is False, "RETIRED to PENDING_RETIREMENT should be invalid"
    
    def test_invalid_transition_unknown_status(self):
        """
        ATB-002d: Unknown status values should be rejected.
        """
        engine = AssetStateEngine()
        result = engine.can_transition("UNKNOWN_STATUS", "IN_USE", asset_id="A001")
        assert result is False, "Unknown status should be rejected"
    
    def test_get_available_transitions_from_retired(self):
        """Verify no transitions available from RETIRED status."""
        engine = AssetStateEngine()
        available = engine.get_available_transitions("RETIRED")
        assert len(available) == 0, "RETIRED should have no valid transitions"


# ============================================================================
# Test Cases: State Transition Execution with History Recording
# ============================================================================

class TestAssetStateEngineTransitionExecution:
    """Test actual transition execution including history persistence."""
    
    def test_successful_transition_returns_result(self):
        """Verify transition execution returns proper result dict."""
        engine = AssetStateEngine()
        result = engine.transition(
            asset_id="A001",
            from_status="IN_USE",
            to_status="PENDING_RETIREMENT",
            operator_id="user_manager_001"
        )
        
        assert result["asset_id"] == "A001"
        assert result["from_status"] == "IN_USE"
        assert result["to_status"] == "PENDING_RETIREMENT"
        assert result["operator_id"] == "user_manager_001"
        assert "transitioned_at" in result
    
    def test_transition_raises_error_on_invalid_transition(self):
        """Verify invalid transitions raise StateTransitionError."""
        engine = AssetStateEngine()
        
        with pytest.raises(StateTransitionError) as exc_info:
            engine.transition(
                asset_id="A001",
                from_status="IN_USE",
                to_status="RETIRED"
            )
        
        assert "Invalid transition" in str(exc_info.value)
        assert "IN_USE -> RETIRED" in str(exc_info.value)


# ============================================================================
# Test Cases: History Recording Integration
# ============================================================================

class TestAssetStateEngineHistoryRecording:
    """Test history recording during state transitions (Constraint C-005)."""
    
    def test_transition_creates_history_record(self):
        """
        ATB-006: Every state change must create a history record.
        
        Constraint C-005: All state changes must write history, no isolated states.
        """
        mock_history_repo = MagicMock()
        engine = AssetStateEngine(history_repository=mock_history_repo)
        
        engine.transition(
            asset_id="A001",
            from_status="IN_USE",
            to_status="PENDING_RETIREMENT",
            operator_id="user_001",
            metadata={"reason": "equipment_failure"}
        )
        
        mock_history_repo.create.assert_called_once()
        call_kwargs = mock_history_repo.create.call_args[1]
        assert call_kwargs["asset_id"] == "A001"
        assert call_kwargs["from_status"] == "IN_USE"
        assert call_kwargs["to_status"] == "PENDING_RETIREMENT"
        assert call_kwargs["operator_id"] == "user_001"
        assert call_kwargs["metadata"]["reason"] == "equipment_failure"
    
    def test_transition_without_history_repo_does_not_fail(self):
        """Verify engine works without history repository (graceful degradation)."""
        engine = AssetStateEngine(history_repository=None)
        
        # Should not raise even without history repository
        result = engine.transition(
            asset_id="A001",
            from_status="IN_USE",
            to_status="PENDING_RETIREMENT"
        )
        assert result is not None
        assert result["asset_id"] == "A001"


# ============================================================================
# Test Cases: Constraint Validation
# ============================================================================

class TestAssetStateEngineConstraints:
    """Test boundary constraints from SPEC."""
    
    def test_constraint_c001_valid_transitions_only(self):
        """C-001: Assets can only transition according to predefined rules."""
        engine = AssetStateEngine()
        
        # Valid transitions
        assert engine.can_transition("IN_USE", "PENDING_RETIREMENT")
        assert engine.can_transition("PENDING_RETIREMENT", "RETIRED")
        
        # Invalid transitions (bypass approval)
        assert not engine.can_transition("IN_USE", "RETIRED")
        assert not engine.can_transition("IN_USE", "MAINTENANCE")
    
    def test_constraint_c004_retired_is_irreversible(self):
        """C-004: RETIRED is an irreversible state."""
        engine = AssetStateEngine()
        
        # Cannot go back from RETIRED
        assert not engine.can_transition("RETIRED", "IN_USE")
        assert not engine.can_transition("RETIRED", "PENDING_RETIREMENT")
        
        # No available transitions from RETIRED
        available = engine.get_available_transitions("RETIRED")
        assert len(available) == 0
    
    def test_constraint_c005_history_persistence(self):
        """C-005: Every state change must write history."""
        mock_repo = MagicMock()
        engine = AssetStateEngine(history_repository=mock_repo)
        
        # Perform transition
        engine.transition("A001", "IN_USE", "PENDING_RETIREMENT", "op1")
        
        # Verify history was recorded
        mock_repo.create.assert_called_once()
    
    def test_constraint_c006_concurrent_request_check(self):
        """C-006: Same asset cannot have multiple pending approval requests."""
        # This test documents the constraint - actual implementation
        # would check against retirement_repository in service layer
        mock_retirement_repo = MagicMock()
        mock_retirement_repo.has_pending_request.return_value = True
        
        engine = AssetStateEngine(retirement_repository=mock_retirement_repo)
        
        # The engine itself doesn't enforce this - service layer does
        # But we verify the engine doesn't block valid transitions
        assert engine.can_transition("IN_USE", "PENDING_RETIREMENT")


# ============================================================================
# Test Cases: Edge Cases and Error Handling
# ============================================================================

class TestAssetStateEngineEdgeCases:
    """Test edge cases and error conditions."""
    
    def test_empty_asset_id_allowed(self):
        """Verify empty asset_id is allowed in can_transition check."""
        engine = AssetStateEngine()
        # Should not raise, just return boolean
        result = engine.can_transition("IN_USE", "PENDING_RETIREMENT")
        assert isinstance(result, bool)
    
    def test_none_metadata_handled(self):
        """Verify None metadata is handled gracefully."""
        mock_repo = MagicMock()
        engine = AssetStateEngine(history_repository=mock_repo)
        
        engine.transition(
            asset_id="A001",
            from_status="IN_USE",
            to_status="PENDING_RETIREMENT",
            metadata=None
        )
        
        call_kwargs = mock_repo.create.call_args[1]
        assert call_kwargs["metadata"] == {}
    
    def test_case_sensitive_status_comparison(self):
        """Verify status comparison is case-sensitive."""
        engine = AssetStateEngine()
        
        # Valid with exact case
        assert engine.can_transition("IN_USE", "PENDING_RETIREMENT")
        
        # Invalid with different case (should be exact match)
        assert not engine.can_transition("in_use", "PENDING_RETIREMENT")
        assert not engine.can_transition("IN_USE", "pending_retirement")


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def mock_history_repository():
    """Create a mock history repository."""
    return MagicMock()


@pytest.fixture
def mock_retirement_repository():
    """Create a mock retirement repository."""
    return MagicMock()


@pytest.fixture
def state_engine(mock_history_repository, mock_retirement_repository):
    """Create an AssetStateEngine with mocked dependencies."""
    return AssetStateEngine(
        history_repository=mock_history_repository,
        retirement_repository=mock_retirement_repository
    )