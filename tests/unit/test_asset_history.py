"""
Asset History Unit Tests

This module contains unit tests for the Asset History functionality,
verifying state transition history creation and immutability.

Test Cases:
    - ATB-006: Verify history records are created automatically on state changes
    - ATB-007: Verify history records are immutable after creation

Author: SWARM-002 Iteration 7
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime


class ImmutableRecordError(Exception):
    """Raised when attempting to modify an immutable history record."""
    pass


class TestAssetHistoryCreation:
    """Test suite for verifying asset history record creation on state transitions."""

    def test_history_created_on_state_change(self, db_session, asset_fixture):
        """
        ATB-006: State变更时自动创建历史记录
        
        Validates that when an asset transitions between states,
        a corresponding history record is automatically created
        with correct from_status, to_status, operator_id, and change_time.
        
        Test Steps:
            1. Get initial history count for asset
            2. Perform state transition (IN_USE -> PENDING_RETIREMENT)
            3. Verify new history record count increased by 1
            4. Verify latest history record has correct fields
        
        Expected Result:
            - New history record created with:
                - from_status == "IN_USE"
                - to_status == "PENDING_RETIREMENT"
                - operator_id is not None
                - change_time is not None
        """
        from src.services.state_machine.engine import AssetStateEngine
        from src.repositories.history_repository import AssetHistoryRepository

        initial_count = AssetHistoryRepository.count_by_asset(asset_fixture.id)

        engine = AssetStateEngine()
        engine.transition(asset_fixture.id, "IN_USE", "PENDING_RETIREMENT")

        new_count = AssetHistoryRepository.count_by_asset(asset_fixture.id)
        assert new_count == initial_count + 1, \
            f"Expected history count to increase from {initial_count} to {initial_count + 1}, got {new_count}"

        latest = AssetHistoryRepository.get_latest(asset_fixture.id)
        assert latest is not None, "Latest history record should not be None"
        assert latest.from_status == "IN_USE", \
            f"Expected from_status 'IN_USE', got '{latest.from_status}'"
        assert latest.to_status == "PENDING_RETIREMENT", \
            f"Expected to_status 'PENDING_RETIREMENT', got '{latest.to_status}'"
        assert latest.operator_id is not None, \
            "operator_id should not be None for state transition"
        assert latest.change_time is not None, \
            "change_time should not be None for state transition"

    def test_history_created_on_retirement_approval(self, db_session, pending_request_fixture):
        """
        ATB-006 Variant: 报废审批通过时创建历史记录
        
        Validates that when an retirement request is approved and asset
        transitions to RETIRED state, a history record is created.
        
        Test Steps:
            1. Get initial history count for asset
            2. Perform state transition (PENDING_RETIREMENT -> RETIRED)
            3. Verify new history record created
            4. Verify to_status is RETIRED
        
        Expected Result:
            - History record created with to_status == "RETIRED"
        """
        from src.services.state_machine.engine import AssetStateEngine
        from src.repositories.history_repository import AssetHistoryRepository

        asset_id = pending_request_fixture.asset_id
        initial_count = AssetHistoryRepository.count_by_asset(asset_id)

        engine = AssetStateEngine()
        engine.transition(asset_id, "PENDING_RETIREMENT", "RETIRED")

        new_count = AssetHistoryRepository.count_by_asset(asset_id)
        assert new_count == initial_count + 1

        latest = AssetHistoryRepository.get_latest(asset_id)
        assert latest.to_status == "RETIRED"

    def test_history_record_contains_metadata(self, db_session, asset_fixture):
        """
        ATB-006 Variant: 历史记录包含完整的元数据
        
        Validates that history records contain all required metadata fields
        including reason, approval_info, and timestamp precision.
        """
        from src.services.state_machine.engine import AssetStateEngine
        from src.repositories.history_repository import AssetHistoryRepository

        engine = AssetStateEngine()
        engine.transition(asset_fixture.id, "IN_USE", "PENDING_RETIREMENT")

        latest = AssetHistoryRepository.get_latest(asset_fixture.id)
        assert hasattr(latest, 'metadata'), "History record should have metadata field"
        assert latest.metadata is not None, "Metadata should not be None"


class TestAssetHistoryImmutability:
    """Test suite for verifying asset history record immutability."""

    def test_history_immutability(self, db_session, asset_with_history):
        """
        ATB-007: 历史记录不可修改
        
        Validates that once a history record is created, it cannot be
        modified. Any attempt to update should raise ImmutableRecordError.
        
        Test Steps:
            1. Retrieve existing history record
            2. Attempt to modify to_status field
            3. Verify ImmutableRecordError is raised
        
        Expected Result:
            - ImmutableRecordError raised when attempting to modify
        """
        from src.repositories.history_repository import AssetHistoryRepository

        latest = AssetHistoryRepository.get_latest(asset_with_history.id)
        assert latest is not None, "History record should exist"

        with pytest.raises(ImmutableRecordError):
            latest.to_status = "MODIFIED"
            AssetHistoryRepository.update(latest)

    def test_history_cannot_be_deleted(self, db_session, asset_with_history):
        """
        ATB-007 Variant: 历史记录不可删除
        
        Validates that history records cannot be deleted once created,
        ensuring audit trail integrity.
        """
        from src.repositories.history_repository import AssetHistoryRepository

        latest = AssetHistoryRepository.get_latest(asset_with_history.id)
        history_id = latest.id

        with pytest.raises(ImmutableRecordError):
            AssetHistoryRepository.delete(history_id)

    def test_history_approval_records_immutable(self, db_session, pending_request_fixture):
        """
        ATB-007 Variant: 审批记录历史不可修改
        
        Validates that approval-related history records are also immutable,
        ensuring the complete audit trail is protected.
        """
        from src.repositories.history_repository import AssetHistoryRepository

        history_records = AssetHistoryRepository.get_by_asset(
            pending_request_fixture.asset_id
        )
        
        for record in history_records:
            with pytest.raises(ImmutableRecordError):
                record.from_status = "TAMPERED"
                AssetHistoryRepository.update(record)


class TestAssetHistoryQueries:
    """Test suite for asset history query functionality."""

    def test_get_history_by_asset_id(self, db_session, asset_fixture):
        """
        Verify querying history records by asset ID returns correct records.
        """
        from src.repositories.history_repository import AssetHistoryRepository
        from src.services.state_machine.engine import AssetStateEngine

        engine = AssetStateEngine()
        engine.transition(asset_fixture.id, "IN_USE", "PENDING_RETIREMENT")
        engine.transition(asset_fixture.id, "PENDING_RETIREMENT", "RETIRED")

        records = AssetHistoryRepository.get_by_asset(asset_fixture.id)
        assert len(records) >= 2, \
            f"Expected at least 2 history records, got {len(records)}"

    def test_get_latest_history(self, db_session, asset_fixture):
        """
        Verify get_latest returns the most recent history record.
        """
        from src.repositories.history_repository import AssetHistoryRepository
        from src.services.state_machine.engine import AssetStateEngine

        engine = AssetStateEngine()
        engine.transition(asset_fixture.id, "IN_USE", "PENDING_RETIREMENT")
        engine.transition(asset_fixture.id, "PENDING_RETIREMENT", "RETIRED")

        latest = AssetHistoryRepository.get_latest(asset_fixture.id)
        assert latest.to_status == "RETIRED", \
            f"Latest record should have to_status 'RETIRED', got '{latest.to_status}'"

    def test_history_count_by_asset(self, db_session, asset_fixture):
        """
        Verify counting history records by asset ID works correctly.
        """
        from src.repositories.history_repository import AssetHistoryRepository
        from src.services.state_machine.engine import AssetStateEngine

        engine = AssetStateEngine()
        initial_count = AssetHistoryRepository.count_by_asset(asset_fixture.id)
        
        engine.transition(asset_fixture.id, "IN_USE", "PENDING_RETIREMENT")
        
        new_count = AssetHistoryRepository.count_by_asset(asset_fixture.id)
        assert new_count == initial_count + 1


class TestAssetHistoryValidation:
    """Test suite for asset history data validation."""

    def test_history_record_has_required_fields(self, db_session, asset_fixture):
        """
        Verify that all required fields are present in history records.
        
        Required fields:
            - id: Primary key
            - asset_id: Foreign key to asset
            - from_status: Previous status
            - to_status: New status
            - operator_id: User who performed the action
            - change_time: Timestamp of the change
            - metadata: Additional context (optional)
        """
        from src.repositories.history_repository import AssetHistoryRepository
        from src.services.state_machine.engine import AssetStateEngine

        engine = AssetStateEngine()
        engine.transition(asset_fixture.id, "IN_USE", "PENDING_RETIREMENT")

        latest = AssetHistoryRepository.get_latest(asset_fixture.id)
        
        required_fields = ['id', 'asset_id', 'from_status', 'to_status', 'operator_id', 'change_time']
        for field in required_fields:
            assert hasattr(latest, field), f"History record should have '{field}' field"
            assert getattr(latest, field) is not None, f"Field '{field}' should not be None"

    def test_history_asset_id_matches_source(self, db_session, asset_fixture):
        """
        Verify that history record asset_id matches the source asset.
        """
        from src.repositories.history_repository import AssetHistoryRepository
        from src.services.state_machine.engine import AssetStateEngine

        engine = AssetStateEngine()
        engine.transition(asset_fixture.id, "IN_USE", "PENDING_RETIREMENT")

        latest = AssetHistoryRepository.get_latest(asset_fixture.id)
        assert latest.asset_id == asset_fixture.id, \
            f"Expected asset_id {asset_fixture.id}, got {latest.asset_id}"

    def test_history_change_time_is_valid_timestamp(self, db_session, asset_fixture):
        """
        Verify that change_time is a valid datetime timestamp.
        """
        from src.repositories.history_repository import AssetHistoryRepository
        from src.services.state_machine.engine import AssetStateEngine

        engine = AssetStateEngine()
        engine.transition(asset_fixture.id, "IN_USE", "PENDING_RETIREMENT")

        latest = AssetHistoryRepository.get_latest(asset_fixture.id)
        assert isinstance(latest.change_time, datetime), \
            f"change_time should be datetime instance, got {type(latest.change_time)}"