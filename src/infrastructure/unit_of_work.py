"""
Unit of Work Pattern Implementation for Asset Retirement Flow
==============================================================

This module implements the Unit of Work pattern to ensure transactional
consistency between asset state changes and audit log writes.

Key Components:
- Atomic transaction management
- State transition with logging in single transaction
- Rollback compensation on failure

References:
- SWARM-002 Iteration 8 Specification
- Phase 4: Historical Record Persistence
"""

from contextlib import contextmanager
from datetime import datetime
from typing import Optional, Dict, Any, Generator
from dataclasses import dataclass, field
from uuid import UUID, uuid4
import hashlib
import json

from sqlalchemy.orm import Session
from sqlalchemy import Column, String, DateTime, JSON, Integer, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from src.infrastructure.database.models import Base, db_session


class StateTransitionLog(Base):
    """
    State Transition Log Model
    
    Records every asset status change for audit purposes.
    Implements hash chain for tamper detection.
    
    Attributes:
        id: Primary key UUID
        asset_id: Foreign key to asset being transitioned
        from_status: Previous status value
        to_status: New status value  
        trigger_type: How the transition was triggered (manual/auto/approval)
        operator_id: User who initiated the transition (nullable for auto)
        metadata: Additional context as JSON
        hash_value: SHA-256 hash for chain integrity
        previous_hash: Hash of the previous log entry (for chain)
        created_at: Timestamp of the transition
    """
    
    __tablename__ = 'state_transition_logs'
    
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    asset_id = Column(PG_UUID(as_uuid=True), nullable=False, index=True)
    from_status = Column(String(32), nullable=True)
    to_status = Column(String(32), nullable=False)
    trigger_type = Column(
        SQLEnum('manual', 'auto', 'approval', name='trigger_type_enum'),
        nullable=False,
        default='manual'
    )
    operator_id = Column(PG_UUID(as_uuid=True), nullable=True)
    metadata = Column(JSON, nullable=True)
    hash_value = Column(String(64), nullable=False)
    previous_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class AuditHashChain:
    """
    Audit Hash Chain Utility
    
    Provides tamper-evident logging by maintaining a SHA-256 hash chain.
    Each log entry's hash includes the previous entry's hash, creating
    a chain that breaks if any entry is modified.
    
    Usage:
        chain = AuditHashChain()
        entry_hash = chain.compute_hash(
            asset_id=uuid,
            from_status='idle',
            to_status='pending',
            timestamp=datetime.utcnow(),
            previous_hash='abc123...'
        )
    """
    
    HASH_ALGORITHM = 'sha256'
    
    @staticmethod
    def compute_hash(
        asset_id: str,
        from_status: Optional[str],
        to_status: str,
        timestamp: datetime,
        operator_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
        previous_hash: Optional[str] = None
    ) -> str:
        """
        Compute SHA-256 hash for a state transition entry.
        
        Args:
            asset_id: UUID of the asset
            from_status: Previous status or None
            to_status: New status
            timestamp: When the transition occurred
            operator_id: UUID of operator (optional)
            metadata: Additional context dict (optional)
            previous_hash: Hash of previous entry in chain
        
        Returns:
            64-character hex string (SHA-256 digest)
        """
        content = f"{asset_id}|{from_status or ''}|{to_status}|{timestamp.isoformat()}"
        if operator_id:
            content += f"|{operator_id}"
        if metadata:
            content += f"|{json.dumps(metadata, sort_keys=True)}"
        if previous_hash:
            content += f"|{previous_hash}"
        
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    @staticmethod
    def verify_chain(logs: list) -> bool:
        """
        Verify the integrity of a hash chain.
        
        Args:
            logs: List of StateTransitionLog entries ordered by created_at
        
        Returns:
            True if chain is intact, False if tampered
        """
        if not logs:
            return True
        
        previous_hash = None
        for log in logs:
            expected_hash = AuditHashChain.compute_hash(
                asset_id=str(log.asset_id),
                from_status=log.from_status,
                to_status=log.to_status,
                timestamp=log.created_at,
                operator_id=str(log.operator_id) if log.operator_id else None,
                metadata=log.metadata,
                previous_hash=previous_hash
            )
            
            if log.hash_value != expected_hash:
                return False
            previous_hash = log.hash_value
        
        return True


@dataclass
class TransitionRecord:
    """
    Data Transfer Object for State Transition Operations.
    
    Encapsulates all information needed to record a state change.
    """
    asset_id: UUID
    from_status: Optional[str]
    to_status: str
    trigger_type: str
    operator_id: Optional[UUID] = None
    metadata: Optional[Dict[str, Any]] = None


class UnitOfWork:
    """
    Unit of Work Implementation for Asset Retirement
    
    Ensures atomic operations between:
    - Asset status updates
    - State transition log writes
    - Hash chain maintenance
    
    Example:
        with UnitOfWork() as uow:
            uow.record_transition(record)
            asset = uow.assets.get(asset_id)
            asset.status = new_status
            uow.commit()
    """
    
    def __init__(self, session: Optional[Session] = None):
        """
        Initialize Unit of Work.
        
        Args:
            session: Optional existing SQLAlchemy session.
                    If not provided, uses default session from db_session.
        """
        self._session = session
        self._transactions: list[TransitionRecord] = []
        self._committed = False
    
    def __enter__(self) -> 'UnitOfWork':
        """Context manager entry - start transaction."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """
        Context manager exit - rollback on exception, close on success.
        
        If an exception occurs during the block, the transaction is rolled back.
        If commit() was called, the transaction is committed.
        """
        if exc_type is not None and not self._committed:
            self.rollback()
        self.close()
    
    @contextmanager
    def transaction(self) -> Generator['UnitOfWork', None, None]:
        """
        Nested transaction context manager.
        
        Yields:
            UnitOfWork instance for the nested transaction
        """
        nested = UnitOfWork(self._session)
        try:
            yield nested
            nested.commit()
        except Exception:
            nested.rollback()
            raise
    
    def record_transition(self, record: TransitionRecord) -> StateTransitionLog:
        """
        Record a state transition and compute its hash.
        
        Args:
            record: TransitionRecord containing transition details
        
        Returns:
            StateTransitionLog entity ready to be committed
        
        Raises:
            ValueError: If required fields are missing
        """
        if not record.asset_id:
            raise ValueError("asset_id is required for transition record")
        if not record.to_status:
            raise ValueError("to_status is required for transition record")
        
        # Get the previous hash for chain linking
        previous_hash = self._get_last_hash(record.asset_id)
        
        # Compute current entry hash
        current_hash = AuditHashChain.compute_hash(
            asset_id=str(record.asset_id),
            from_status=record.from_status,
            to_status=record.to_status,
            timestamp=datetime.utcnow(),
            operator_id=str(record.operator_id) if record.operator_id else None,
            metadata=record.metadata,
            previous_hash=previous_hash
        )
        
        log_entry = StateTransitionLog(
            asset_id=record.asset_id,
            from_status=record.from_status,
            to_status=record.to_status,
            trigger_type=record.trigger_type,
            operator_id=record.operator_id,
            metadata=record.metadata,
            hash_value=current_hash,
            previous_hash=previous_hash,
            created_at=datetime.utcnow()
        )
        
        self._transactions.append(record)
        return log_entry
    
    def _get_last_hash(self, asset_id: UUID) -> Optional[str]:
        """
        Get the hash of the most recent transition log for an asset.
        
        Args:
            asset_id: UUID of the asset
        
        Returns:
            Hash string of last entry, or None if no prior entries
        """
        session = self._session or db_session.get_session()
        
        last_log = (
            session.query(StateTransitionLog)
            .filter(StateTransitionLog.asset_id == asset_id)
            .order_by(StateTransitionLog.created_at.desc())
            .first()
        )
        
        return last_log.hash_value if last_log else None
    
    def commit(self) -> None:
        """
        Commit all pending changes to the database.
        
        Persists:
        - All recorded state transitions
        - Hash chain integrity
        
        Raises:
            Exception: If commit fails, transaction is rolled back
        """
        if self._committed:
            return
        
        session = self._session or db_session.get_session()
        
        try:
            session.commit()
            self._committed = True
        except Exception as e:
            session.rollback()
            raise e
    
    def rollback(self) -> None:
        """
        Rollback all uncommitted changes.
        
        Clears pending transactions and reverts session state.
        """
        session = self._session or db_session.get_session()
        session.rollback()
        self._transactions.clear()
    
    def close(self) -> None:
        """
        Close the session and release resources.
        """
        if self._session:
            self._session.close()
    
    def verify_asset_chain(self, asset_id: UUID) -> bool:
        """
        Verify the hash chain integrity for a specific asset.
        
        Args:
            asset_id: UUID of the asset to verify
        
        Returns:
            True if chain is intact, False if tampering detected
        """
        session = self._session or db_session.get_session()
        
        logs = (
            session.query(StateTransitionLog)
            .filter(StateTransitionLog.asset_id == asset_id)
            .order_by(StateTransitionLog.created_at.asc())
            .all()
        )
        
        return AuditHashChain.verify_chain(logs)


class StateTransitionService:
    """
    High-level service for managing state transitions with audit logging.
    
    Combines UnitOfWork pattern with business logic for asset state changes.
    
    Example:
        service = StateTransitionService()
        service.transition(
            asset_id=uuid,
            from_status='idle',
            to_status='pending',
            trigger='manual',
            operator_id=user_uuid
        )
    """
    
    def __init__(self, session: Optional[Session] = None):
        """
        Initialize State Transition Service.
        
        Args:
            session: Optional SQLAlchemy session
        """
        self._session = session
    
    def transition(
        self,
        asset_id: UUID,
        from_status: Optional[str],
        to_status: str,
        trigger_type: str = 'manual',
        operator_id: Optional[UUID] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> StateTransitionLog:
        """
        Execute a state transition with full audit logging.
        
        Args:
            asset_id: UUID of the asset
            from_status: Current status (None for new assets)
            to_status: Target status
            trigger_type: How transition was triggered
            operator_id: UUID of user initiating change
            metadata: Additional context information
        
        Returns:
            StateTransitionLog entry that was created
        
        Raises:
            Exception: If transition fails, entire operation rolls back
        """
        record = TransitionRecord(
            asset_id=asset_id,
            from_status=from_status,
            to_status=to_status,
            trigger_type=trigger_type,
            operator_id=operator_id,
            metadata=metadata
        )
        
        with UnitOfWork(self._session) as uow:
            log_entry = uow.record_transition(record)
            uow.commit()
        
        return log_entry
    
    def get_transition_history(
        self,
        asset_id: UUID,
        limit: Optional[int] = None
    ) -> list[StateTransitionLog]:
        """
        Retrieve transition history for an asset.
        
        Args:
            asset_id: UUID of the asset
            limit: Maximum number of records to return
        
        Returns:
            List of StateTransitionLog entries, newest first
        """
        session = self._session or db_session.get_session()
        
        query = (
            session.query(StateTransitionLog)
            .filter(StateTransitionLog.asset_id == asset_id)
            .order_by(StateTransitionLog.created_at.desc())
        )
        
        if limit:
            query = query.limit(limit)
        
        return query.all()
    
    def verify_chain_integrity(self, asset_id: UUID) -> Dict[str, Any]:
        """
        Verify and report on hash chain integrity.
        
        Args:
            asset_id: UUID of the asset
        
        Returns:
            Dict with 'valid' boolean and 'break_point' if invalid
        """
        session = self._session or db_session.get_session()
        
        logs = (
            session.query(StateTransitionLog)
            .filter(StateTransitionLog.asset_id == asset_id)
            .order_by(StateTransitionLog.created_at.asc())
            .all()
        )
        
        if not logs:
            return {'valid': True, 'message': 'No history records'}
        
        result = {'valid': True, 'break_point': None}
        
        for i, log in enumerate(logs):
            expected_hash = AuditHashChain.compute_hash(
                asset_id=str(log.asset_id),
                from_status=log.from_status,
                to_status=log.to_status,
                timestamp=log.created_at,
                operator_id=str(log.operator_id) if log.operator_id else None,
                metadata=log.metadata,
                previous_hash=logs[i - 1].hash_value if i > 0 else None
            )
            
            if log.hash_value != expected_hash:
                result['valid'] = False
                result['break_point'] = str(log.id)
                result['message'] = f'Tampering detected at entry {i + 1}'
                break
        
        return result