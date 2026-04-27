"""
Dashboard Statistics Service Module.

This module provides statistics and analytics for the asset management dashboard,
including retirement workflow statistics, approval chain metrics, and historical
data aggregation.

Features:
- Retirement request statistics (pending, approved, rejected counts)
- Approval chain performance metrics (average approval time, completion rates)
- Historical event aggregation and trend analysis
- User activity statistics for workflow participation

Designed to support Phase 3: Flow engine and approval chain implementation.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

# Type definitions for clarity
Timestamp = datetime
UserId = int
AssetId = int


class RetirementStatus(str, Enum):
    """Enumeration of retirement application statuses."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class ApprovalStage(str, Enum):
    """Enumeration of approval stages in the chain."""
    SUBMITTED = "submitted"
    FIRST_APPROVAL = "first_approval"
    SECOND_APPROVAL = "second_approval"
    FINAL_APPROVAL = "final_approval"
    COMPLETED = "completed"


@dataclass
class RetirementStats:
    """Statistics for retirement requests."""
    total_requests: int = 0
    pending_requests: int = 0
    approved_requests: int = 0
    rejected_requests: int = 0
    withdrawn_requests: int = 0
    average_processing_time_days: float = 0.0
    completion_rate: float = 0.0


@dataclass
class ApprovalChainMetrics:
    """Metrics for approval chain performance."""
    total_chains: int = 0
    active_chains: int = 0
    completed_chains: int = 0
    average_approval_time_hours: float = 0.0
    approval_rates: float = 0.0
    rejection_rates: float = 0.0


@dataclass
class WorkflowEvent:
    """Represents a workflow event for history tracking."""
    event_id: str
    asset_id: AssetId
    event_type: str
    from_state: Optional[str]
    to_state: Optional[str]
    actor_id: Optional[UserId]
    timestamp: Timestamp
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary representation."""
        return {
            "event_id": self.event_id,
            "asset_id": self.asset_id,
            "event_type": self.event_type,
            "from_state": self.from_state,
            "to_state": self.to_state,
            "actor_id": self.actor_id,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class DashboardMetrics:
    """Complete dashboard statistics container."""
    retirement_stats: RetirementStats = field(default_factory=RetirementStats)
    approval_metrics: ApprovalChainMetrics = field(default_factory=ApprovalChainMetrics)
    recent_events: List[WorkflowEvent] = field(default_factory=list)
    asset_status_distribution: Dict[str, int] = field(default_factory=dict)
    generated_at: Timestamp = field(default_factory=datetime.utcnow)


class DashboardStatisticsService:
    """
    Service for computing and aggregating dashboard statistics.

    This service provides aggregated statistics for the asset management
    dashboard, including retirement workflow metrics, approval chain
    performance, and historical event data. It supports the Phase 3
    deliverables for flow engine and approval chain implementation.

    Attributes:
        _db_session: Database session for queries
        _history_repository: Repository for workflow history events
        _retirement_repository: Repository for retirement requests
        _approval_repository: Repository for approval chain records

    Example:
        >>> service = DashboardStatisticsService(db_session)
        >>> metrics = service.get_comprehensive_metrics()
        >>> print(f"Pending retirements: {metrics.retirement_stats.pending_requests}")
    """

    def __init__(
        self,
        db_session: Any,
        history_repository: Optional[Any] = None,
        retirement_repository: Optional[Any] = None,
        approval_repository: Optional[Any] = None,
    ) -> None:
        """
        Initialize the DashboardStatisticsService.

        Args:
            db_session: Database session for executing queries
            history_repository: Optional custom history repository
            retirement_repository: Optional custom retirement repository
            approval_repository: Optional custom approval repository
        """
        self._db_session = db_session
        self._history_repository = history_repository
        self._retirement_repository = retirement_repository
        self._approval_repository = approval_repository

    def get_retirement_statistics(
        self,
        start_date: Optional[Timestamp] = None,
        end_date: Optional[Timestamp] = None,
        asset_category: Optional[str] = None,
    ) -> RetirementStats:
        """
        Get retirement request statistics for the specified period.

        Args:
            start_date: Start of the reporting period (default: 30 days ago)
            end_date: End of the reporting period (default: now)
            asset_category: Filter by asset category (optional)

        Returns:
            RetirementStats: Aggregated retirement statistics
        """
        if end_date is None:
            end_date = datetime.utcnow()
        if start_date is None:
            start_date = end_date - timedelta(days=30)

        stats = RetirementStats()

        # Query retirement requests from repository or database
        if self._retirement_repository is not None:
            requests = self._retirement_repository.query_by_date_range(
                start_date, end_date, asset_category
            )
        else:
            requests = self._query_retirement_requests(
                start_date, end_date, asset_category
            )

        stats.total_requests = len(requests)

        for req in requests:
            status = req.get("status", "")
            if status == RetirementStatus.PENDING.value:
                stats.pending_requests += 1
            elif status == RetirementStatus.APPROVED.value:
                stats.approved_requests += 1
            elif status == RetirementStatus.REJECTED.value:
                stats.rejected_requests += 1
            elif status == RetirementStatus.WITHDRAWN.value:
                stats.withdrawn_requests += 1

        # Calculate derived metrics
        if stats.total_requests > 0:
            completed = stats.approved_requests + stats.rejected_requests + stats.withdrawn_requests
            stats.completion_rate = completed / stats.total_requests

            # Calculate average processing time
            processing_times = [
                (req.get("completed_at", datetime.utcnow()) - req.get("created_at", datetime.utcnow())).days
                for req in requests
                if req.get("completed_at") and req.get("status") != RetirementStatus.PENDING.value
            ]
            if processing_times:
                stats.average_processing_time_days = sum(processing_times) / len(processing_times)

        return stats

    def get_approval_chain_metrics(
        self,
        start_date: Optional[Timestamp] = None,
        end_date: Optional[Timestamp] = None,
    ) -> ApprovalChainMetrics:
        """
        Get approval chain performance metrics.

        Args:
            start_date: Start of the reporting period (default: 30 days ago)
            end_date: End of the reporting period (default: now)

        Returns:
            ApprovalChainMetrics: Approval chain performance metrics
        """
        if end_date is None:
            end_date = datetime.utcnow()
        if start_date is None:
            start_date = end_date - timedelta(days=30)

        metrics = ApprovalChainMetrics()

        if self._approval_repository is not None:
            chains = self._approval_repository.query_by_date_range(start_date, end_date)
        else:
            chains = self._query_approval_chains(start_date, end_date)

        metrics.total_chains = len(chains)

        for chain in chains:
            if chain.get("completed"):
                metrics.completed_chains += 1
            else:
                metrics.active_chains += 1

            if chain.get("final_decision") == "approved":
                metrics.approval_rates += 1
            elif chain.get("final_decision") == "rejected":
                metrics.rejection_rates += 1

        # Calculate derived metrics
        if metrics.total_chains > 0:
            total_time_hours = sum(
                chain.get("total_approval_time_hours", 0) for chain in chains
            )
            metrics.average_approval_time_hours = total_time_hours / metrics.total_chains

            total_decisions = metrics.approval_rates + metrics.rejection_rates
            if total_decisions > 0:
                metrics.approval_rates /= total_decisions
                metrics.rejection_rates /= total_decisions

        return metrics

    def get_workflow_events(
        self,
        asset_id: Optional[AssetId] = None,
        event_types: Optional[List[str]] = None,
        start_date: Optional[Timestamp] = None,
        end_date: Optional[Timestamp] = None,
        limit: int = 100,
    ) -> List[WorkflowEvent]:
        """
        Get workflow events with optional filtering.

        Args:
            asset_id: Filter by specific asset ID (optional)
            event_types: Filter by event types (optional)
            start_date: Start of the reporting period (optional)
            end_date: End of the reporting period (optional)
            limit: Maximum number of events to return (default: 100)

        Returns:
            List[WorkflowEvent]: List of workflow events sorted by timestamp
        """
        events: List[WorkflowEvent] = []

        if self._history_repository is not None:
            raw_events = self._history_repository.query_events(
                asset_id=asset_id,
                event_types=event_types,
                start_date=start_date,
                end_date=end_date,
                limit=limit,
            )
        else:
            raw_events = self._query_workflow_events(
                asset_id=asset_id,
                event_types=event_types,
                start_date=start_date,
                end_date=end_date,
                limit=limit,
            )

        for raw in raw_events:
            event = WorkflowEvent(
                event_id=raw.get("event_id", ""),
                asset_id=raw.get("asset_id", 0),
                event_type=raw.get("event_type", ""),
                from_state=raw.get("from_state"),
                to_state=raw.get("to_state"),
                actor_id=raw.get("actor_id"),
                timestamp=raw.get("timestamp", datetime.utcnow()),
                metadata=raw.get("metadata", {}),
            )
            events.append(event)

        # Sort by timestamp descending (most recent first)
        events.sort(key=lambda e: e.timestamp, reverse=True)

        return events

    def get_comprehensive_metrics(
        self,
        start_date: Optional[Timestamp] = None,
        end_date: Optional[Timestamp] = None,
    ) -> DashboardMetrics:
        """
        Get comprehensive dashboard metrics including all statistics.

        This method aggregates all available metrics into a single
        DashboardMetrics object for dashboard display.

        Args:
            start_date: Start of the reporting period (default: 30 days ago)
            end_date: End of the reporting period (default: now)

        Returns:
            DashboardMetrics: Comprehensive dashboard metrics
        """
        if end_date is None:
            end_date = datetime.utcnow()
        if start_date is None:
            start_date = end_date - timedelta(days=30)

        metrics = DashboardMetrics()

        # Gather retirement statistics
        metrics.retirement_stats = self.get_retirement_statistics(
            start_date=start_date, end_date=end_date
        )

        # Gather approval chain metrics
        metrics.approval_metrics = self.get_approval_chain_metrics(
            start_date=start_date, end_date=end_date
        )

        # Get recent events
        metrics.recent_events = self.get_workflow_events(
            start_date=start_date, end_date=end_date, limit=50
        )

        # Get asset status distribution
        metrics.asset_status_distribution = self._get_asset_status_distribution()

        metrics.generated_at = datetime.utcnow()

        return metrics

    def get_asset_lifecycle_summary(
        self,
        asset_id: AssetId,
    ) -> Dict[str, Any]:
        """
        Get complete lifecycle summary for a specific asset.

        Args:
            asset_id: The ID of the asset to query

        Returns:
            Dict containing asset lifecycle information and state transitions
        """
        # Get all events for this asset
        events = self.get_workflow_events(asset_id=asset_id, limit=1000)

        summary: Dict[str, Any] = {
            "asset_id": asset_id,
            "total_events": len(events),
            "current_state": None,
            "state_transitions": [],
            "approval_history": [],
            "first_event_date": None,
            "last_event_date": None,
        }

        if not events:
            return summary

        # Sort events chronologically
        sorted_events = sorted(events, key=lambda e: e.timestamp)

        summary["first_event_date"] = sorted_events[0].timestamp.isoformat()
        summary["last_event_date"] = sorted_events[-1].timestamp.isoformat()
        summary["current_state"] = sorted_events[-1].to_state

        # Build state transitions list
        for event in sorted_events:
            if event.event_type == "state_change":
                summary["state_transitions"].append({
                    "from_state": event.from_state,
                    "to_state": event.to_state,
                    "timestamp": event.timestamp.isoformat(),
                    "actor_id": event.actor_id,
                })

            if event.event_type in ("approval_submitted", "approval_approved", "approval_rejected"):
                summary["approval_history"].append({
                    "event_type": event.event_type,
                    "timestamp": event.timestamp.isoformat(),
                    "actor_id": event.actor_id,
                    "metadata": event.metadata,
                })

        return summary

    def get_approval_timeline(
        self,
        workflow_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Get timeline of approval actions for a specific workflow.

        Args:
            workflow_id: The workflow/retirement request ID

        Returns:
            List of approval timeline entries
        """
        events = self.get_workflow_events(
            event_types=["approval_submitted", "approval_approved", "approval_rejected"],
            limit=500,
        )

        timeline: List[Dict[str, Any]] = []
        for event in events:
            if event.metadata.get("workflow_id") == workflow_id:
                timeline.append({
                    "stage": event.metadata.get("stage", "unknown"),
                    "action": event.event_type,
                    "timestamp": event.timestamp.isoformat(),
                    "actor_id": event.actor_id,
                    "comment": event.metadata.get("comment", ""),
                })

        return sorted(timeline, key=lambda t: t["timestamp"])

    def _query_retirement_requests(
        self,
        start_date: Timestamp,
        end_date: Timestamp,
        asset_category: Optional[str],
    ) -> List[Dict[str, Any]]:
        """
        Query retirement requests from database.

        Args:
            start_date: Start of date range
            end_date: End of date range
            asset_category: Optional category filter

        Returns:
            List of retirement request dictionaries
        """
        # Default implementation using db_session
        # In production, this would execute actual database queries
        try:
            query = f"""
                SELECT id, status, created_at, completed_at, category
                FROM retirement_requests
                WHERE created_at BETWEEN :start_date AND :end_date
            """
            params: Dict[str, Any] = {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            }

            if asset_category:
                query += " AND category = :category"
                params["category"] = asset_category

            # Execute query using db_session
            results = self._db_session.execute(query, params)
            return [
                {
                    "id": row[0],
                    "status": row[1],
                    "created_at": row[2],
                    "completed_at": row[3],
                    "category": row[4],
                }
                for row in results
            ]
        except Exception:
            # Return empty list if query fails (e.g., table doesn't exist)
            return []

    def _query_approval_chains(
        self,
        start_date: Timestamp,
        end_date: Timestamp,
    ) -> List[Dict[str, Any]]:
        """
        Query approval chains from database.

        Args:
            start_date: Start of date range
            end_date: End of date range

        Returns:
            List of approval chain dictionaries
        """
        try:
            query = """
                SELECT id, workflow_id, completed, final_decision,
                       created_at, completed_at
                FROM approval_chains
                WHERE created_at BETWEEN :start_date AND :end_date
            """
            params = {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            }

            results = self._db_session.execute(query, params)
            chains = []
            for row in results:
                total_time = 0.0
                if row[4] and row[5]:
                    delta = (row[5] - row[4]).total_seconds() / 3600
                    total_time = float(delta)

                chains.append({
                    "id": row[0],
                    "workflow_id": row[1],
                    "completed": row[2],
                    "final_decision": row[3],
                    "total_approval_time_hours": total_time,
                })

            return chains
        except Exception:
            return []

    def _query_workflow_events(
        self,
        asset_id: Optional[AssetId],
        event_types: Optional[List[str]],
        start_date: Optional[Timestamp],
        end_date: Optional[Timestamp],
        limit: int,
    ) -> List[Dict[str, Any]]:
        """
        Query workflow events from database.

        Args:
            asset_id: Optional asset ID filter
            event_types: Optional event type filter
            start_date: Optional start date filter
            end_date: Optional end date filter
            limit: Maximum results to return

        Returns:
            List of workflow event dictionaries
        """
        try:
            conditions = []
            params: Dict[str, Any] = {"limit": limit}

            if asset_id is not None:
                conditions.append("asset_id = :asset_id")
                params["asset_id"] = asset_id

            if event_types:
                placeholders = ", ".join([f":type_{i}" for i in range(len(event_types))])
                conditions.append(f"event_type IN ({placeholders})")
                for i, etype in enumerate(event_types):
                    params[f"type_{i}"] = etype

            if start_date:
                conditions.append("timestamp >= :start_date")
                params["start_date"] = start_date.isoformat()

            if end_date:
                conditions.append("timestamp <= :end_date")
                params["end_date"] = end_date.isoformat()

            where_clause = " AND ".join(conditions) if conditions else "1=1"

            query = f"""
                SELECT event_id, asset_id, event_type, from_state, to_state,
                       actor_id, timestamp, metadata
                FROM workflow_events
                WHERE {where_clause}
                ORDER BY timestamp DESC
                LIMIT :limit
            """

            results = self._db_session.execute(query, params)
            return [
                {
                    "event_id": row[0],
                    "asset_id": row[1],
                    "event_type": row[2],
                    "from_state": row[3],
                    "to_state": row[4],
                    "actor_id": row[5],
                    "timestamp": row[6],
                    "metadata": row[7] if len(row) > 7 else {},
                }
                for row in results
            ]
        except Exception:
            return []

    def _get_asset_status_distribution(self) -> Dict[str, int]:
        """
        Get distribution of assets by status.

        Returns:
            Dictionary mapping status names to counts
        """
        distribution: Dict[str, int] = {
            "in_use": 0,
            "idle": 0,
            "maintenance": 0,
            "retired": 0,
            "scrapped": 0,
        }

        try:
            query = """
                SELECT status, COUNT(*) as count
                FROM assets
                GROUP BY status
            """
            results = self._db_session.execute(query, {})

            for row in results:
                status_name = row[0]
                count = row[1]
                if status_name in distribution:
                    distribution[status_name] = count

        except Exception:
            # Return default distribution if query fails
            pass

        return distribution

    def record_workflow_event(
        self,
        event_type: str,
        asset_id: AssetId,
        from_state: Optional[str] = None,
        to_state: Optional[str] = None,
        actor_id: Optional[UserId] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> WorkflowEvent:
        """
        Record a new workflow event for tracking.

        Args:
            event_type: Type of the event (e.g., 'state_change', 'approval_submitted')
            asset_id: ID of the asset related to this event
            from_state: Previous state (for state transitions)
            to_state: New state (for state transitions)
            actor_id: User who performed the action
            metadata: Additional event metadata

        Returns:
            WorkflowEvent: The created event record
        """
        import uuid

        event = WorkflowEvent(
            event_id=str(uuid.uuid4()),
            asset_id=asset_id,
            event_type=event_type,
            from_state=from_state,
            to_state=to_state,
            actor_id=actor_id,
            timestamp=datetime.utcnow(),
            metadata=metadata or {},
        )

        # Persist the event
        if self._history_repository is not None:
            self._history_repository.insert_event(event)
        else:
            self._persist_workflow_event(event)

        return event

    def _persist_workflow_event(self, event: WorkflowEvent) -> None:
        """
        Persist workflow event to database.

        Args:
            event: The event to persist
        """
        try:
            query = """
                INSERT INTO workflow_events
                (event_id, asset_id, event_type, from_state, to_state,
                 actor_id, timestamp, metadata)
                VALUES
                (:event_id, :asset_id, :event_type, :from_state, :to_state,
                 :actor_id, :timestamp, :metadata)
            """
            params = {
                "event_id": event.event_id,
                "asset_id": event.asset_id,
                "event_type": event.event_type,
                "from_state": event.from_state,
                "to_state": event.to_state,
                "actor_id": event.actor_id,
                "timestamp": event.timestamp.isoformat(),
                "metadata": event.metadata,
            }

            self._db_session.execute(query, params)
            self._db_session.commit()

        except Exception as e:
            self._db_session.rollback()
            raise RuntimeError(f"Failed to persist workflow event: {e}")

    def get_trend_data(
        self,
        metric: str,
        period_days: int = 30,
        granularity: str = "daily",
    ) -> List[Dict[str, Any]]:
        """
        Get trend data for a specific metric over time.

        Args:
            metric: The metric to analyze ('retirements', 'approvals', 'events')
            period_days: Number of days to analyze (default: 30)
            granularity: Time granularity ('daily', 'weekly', 'monthly')

        Returns:
            List of trend data points with timestamp and value
        """
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=period_days)

        trend_data: List[Dict[str, Any]] = []

        if metric == "retirements":
            stats = self.get_retirement_statistics(start_date=start_date, end_date=end_date)
            # Generate daily breakdown
            current = start_date
            while current <= end_date:
                next_day = current + timedelta(days=1)
                daily_stats = self.get_retirement_statistics(
                    start_date=current, end_date=next_day
                )
                trend_data.append({
                    "date": current.date().isoformat(),
                    "value": daily_stats.total_requests,
                    "approved": daily_stats.approved_requests,
                    "rejected": daily_stats.rejected_requests,
                })
                current = next_day

        elif metric == "approvals":
            chains = self._query_approval_chains(start_date, end_date)
            # Aggregate by period
            period_counts: Dict[str, Dict[str, int]] = {}
            for chain in chains:
                # Group by granularity
                timestamp = chain.get("created_at", datetime.utcnow())
                if granularity == "daily":
                    key = timestamp.date().isoformat()
                elif granularity == "weekly":
                    week = timestamp.isocalendar()[1]
                    key = f"{timestamp.year}-W{week:02d}"
                else:
                    key = f"{timestamp.year}-{timestamp.month:02d}"

                if key not in period_counts:
                    period_counts[key] = {"total": 0, "approved": 0, "rejected": 0}

                period_counts[key]["total"] += 1
                if chain.get("final_decision") == "approved":
                    period_counts[key]["approved"] += 1
                elif chain.get("final_decision") == "rejected":
                    period_counts[key]["rejected"] += 1

            for date_key, counts in sorted(period_counts.items()):
                trend_data.append({
                    "date": date_key,
                    "value": counts["total"],
                    "approved": counts["approved"],
                    "rejected": counts["rejected"],
                })

        elif metric == "events":
            events = self.get_workflow_events(
                start_date=start_date, end_date=end_date, limit=10000
            )
            # Count events by date
            event_counts: Dict[str, int] = {}
            for event in events:
                date_key = event.timestamp.date().isoformat()
                event_counts[date_key] = event_counts.get(date_key, 0) + 1

            for date_key in sorted(event_counts.keys()):
                trend_data.append({
                    "date": date_key,
                    "value": event_counts[date_key],
                })

        return trend_data


# Module-level convenience functions


def create_statistics_service(db_session: Any) -> DashboardStatisticsService:
    """
    Factory function to create a DashboardStatisticsService instance.

    Args:
        db_session: Database session

    Returns:
        Configured DashboardStatisticsService instance
    """
    return DashboardStatisticsService(db_session=db_session)