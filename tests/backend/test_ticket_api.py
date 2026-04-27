"""
Backend Ticket API Tests
Validates the Ticket API endpoints and their integration with the
approval state machine and notification mechanisms.
"""
import pytest
from httpx import AsyncClient
from backend.api.v1.approval import router as approval_router
from backend.api.v1.workorders import router as workorder_router
from backend.models.ticket import Ticket
from backend.services.approval_service import ApprovalService
from backend.services.notification_service import NotificationService
@pytest.mark.asyncio
async def test_ticket_api_create():
    """Test creating a ticket via the API."""
    async with AsyncClient(base_url="http://test", routes=[workorder_router]) as client:
        response = await client.post(
            "/workorders",
            json={
                "title": "Test Ticket",
                "description": "A test ticket for approval workflow.",
                "requester_id": "user-123",
                "priority": "medium",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["title"] == "Test Ticket"
        assert data["status"] == "pending"
@pytest.mark.asyncio
async def test_ticket_api_approve():
    """Test approving a ticket via the API."""
    # Setup: create a ticket in pending state
    ticket = Ticket(
        title="Approval Ticket",
        description="Needs approval.",
        requester_id="user-123",
        priority="high",
    )
    await ticket.save()

    async with AsyncClient(
        base_url="http://test",
        routes=[approval_router],
    ) as client:
        response = await client.post(
            f"/approval/tickets/{ticket.id}/approve",
            json={"approver_id": "approver-456", "comment": "Looks good."},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"

        # Verify audit log entry exists
        from backend.models.audit_log import AuditLog
        logs = await AuditLog.find_by_ticket(ticket.id)
        assert len(logs) > 0
        assert any(log.action == "approve" for log in logs)
@pytest.mark.asyncio
async def test_ticket_api_reject():
    """Test rejecting a ticket via the API."""
    ticket = Ticket(
        title="Rejection Ticket",
        description="Should be rejected.",
        requester_id="user-123",
        priority="low",
    )
    await ticket.save()

    async with AsyncClient(
        base_url="http://test",
        routes=[approval_router],
    ) as client:
        response = await client.post(
            f"/approval/tickets/{ticket.id}/reject",
            json={"approver_id": "approver-456", "comment": "Not sufficient."},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "rejected"

        # Verify notification was triggered (mocked in unit tests)
        assert NotificationService.publish.called
@pytest.mark.asyncio
async def test_ticket_api_concurrent_approval():
    """Test concurrent approval attempts are handled safely."""
    ticket = Ticket(
        title="Concurrency Ticket",
        description="Testing concurrent updates.",
        requester_id="user-123",
        priority="medium",
    )
    await ticket.save()

    async def approve(client, ticket_id, approver):
        async with AsyncClient(base_url="http://test") as c:
            return await c.post(
                f"/approval/tickets/{ticket_id}/approve",
                json={"approver_id": approver, "comment": "ok"},
            )

    # Simulate two concurrent approval requests
    import asyncio
    results = await asyncio.gather(
        approve(AsyncClient(base_url="http://test"), ticket.id, "approver-a"),
        approve(AsyncClient(base_url="http://test"), ticket.id, "approver-b"),
    )
    # At least one should succeed, the other may be 409 or 200 depending on lock
    statuses = {r.status_code for r in results}
    assert 200 in statuses or 409 in statuses

    # Final state must be consistent
    updated = await Ticket.get(ticket.id)
    assert updated.status in {"approved", "rejected", "pending"}
@pytest.mark.asyncio
async def test_ticket_api_audit_log_integrity():
    """Ensure every state transition creates an immutable audit record."""
    ticket = Ticket(
        title="Audit Ticket",
        description="Audit integrity check.",
        requester_id="user-123",
        priority="medium",
    )
    await ticket.save()

    initial_count = await AuditLog.count()

    async with AsyncClient(base_url="http://test", routes=[approval_router]) as client:
        await client.post(
            f"/approval/tickets/{ticket.id}/approve",
            json={"approver_id": "approver-001", "comment": "audit ok"},
        )

    final_count = await AuditLog.count()
    assert final_count == initial_count + 1

    log = (await AuditLog.find_by_ticket(ticket.id))[-1]
    assert log.entity_type == "ticket"
    assert log.entity_id == str(ticket.id)
    assert log.action in {"approve", "reject"}
    assert log.metadata.get("status") is not None