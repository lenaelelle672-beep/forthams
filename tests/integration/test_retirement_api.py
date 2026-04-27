"""
Integration tests for the Asset Retirement API (SWARM-002).

Covers:
- Asset status change & approval chain
- Retirement application submission
- Admin approval handling
- Tracking asset retirement history
"""
import pytest
from django.urls import reverse
from rest_framework import status
@pytest.mark.django_db
class TestRetirementApplicationCreate:
    """AC-001: Create retirement application"""

    def test_create_success(self, api_client, regular_user, asset):
        """Submit a valid retirement application -> 201, status=pending_retirement"""
        url = reverse("retirement-apply", kwargs={"pk": asset.pk})
        response = api_client.post(
            url,
            data={"reason": "End of life", "expected_date": "2025-12-01"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        asset.refresh_from_db()
        assert asset.status == "pending_retirement"
        assert RetirementApplication.objects.filter(asset=asset).exists()

    def test_non_owning_user_forbidden(self, api_client, regular_user, asset):
        """User not in owning department -> 403"""
        other_user = User.objects.create_user(
            username="other", password="pass", department="HR"
        )
        asset.owning_department = "HR"
        asset.save()
        url = reverse("retirement-apply", kwargs={"pk": asset.pk})
        api_client.force_authenticate(user=other_user)
        response = api_client.post(
            url,
            data={"reason": "test", "expected_date": "2025-12-01"},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_duplicate_application(self, api_client, regular_user, asset):
        """Existing pending application -> 400"""
        RetirementApplication.objects.create(
            asset=asset,
            applicant=regular_user,
            reason="first",
            status="pending",
        )
        url = reverse("retirement-apply", kwargs={"pk": asset.pk})
        response = api_client.post(
            url,
            data={"reason": "second", "expected_date": "2025-12-01"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_already_retired_asset(self, api_client, regular_user, asset):
        """Asset already retired -> 400"""
        asset.status = "retired"
        asset.save()
        url = reverse("retirement-apply", kwargs={"pk": asset.pk})
        response = api_client.post(
            url,
            data={"reason": "test", "expected_date": "2025-12-01"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_reason(self, api_client, regular_user, asset):
        """Missing required reason -> 400"""
        url = reverse("retirement-apply", kwargs={"pk": asset.pk})
        response = api_client.post(
            url,
            data={"expected_date": "2025-12-01"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "reason" in response.json()
@pytest.mark.django_db
class TestRetirementApplicationApprove:
    """AC-004: Admin approval handling"""

    def test_admin_approve(self, api_client, admin_user, asset, retirement_application):
        """Admin approves -> 200, asset.status=retired"""
        url = reverse("retirement-approve", kwargs={"pk": retirement_application.pk})
        api_client.force_authenticate(user=admin_user)
        response = api_client.post(
            url,
            data={"comment": "Approved after review"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        asset.refresh_from_db()
        assert asset.status == "retired"
        history = RetirementHistory.objects.filter(asset=asset).latest("created_at")
        assert history.action == "approved"
        assert history.performed_by == admin_user

    def test_admin_reject(self, api_client, admin_user, asset, retirement_application):
        """Admin rejects -> 200, asset.status=original"""
        original_status = asset.status
        url = reverse("retirement-reject", kwargs={"pk": retirement_application.pk})
        api_client.force_authenticate(user=admin_user)
        response = api_client.post(
            url,
            data={"comment": "Not viable"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        asset.refresh_from_db()
        assert asset.status == original_status
        history = RetirementHistory.objects.filter(asset=asset).latest("created_at")
        assert history.action == "rejected"

    def test_non_admin_forbidden(self, api_client, regular_user, asset, retirement_application):
        """Non-admin cannot approve -> 403"""
        url = reverse("retirement-approve", kwargs={"pk": retirement_application.pk})
        api_client.force_authenticate(user=regular_user)
        response = api_client.post(url, data={"comment": "x"}, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_already_processed(self, api_client, admin_user, retirement_application):
        """Already approved/rejected -> 400"""
        url = reverse("retirement-approve", kwargs={"pk": retirement_application.pk})
        api_client.force_authenticate(user=admin_user)
        api_client.post(url, data={"comment": "ok"}, format="json")
        response = api_client.post(url, data={"comment": "again"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
@pytest.mark.django_db
class TestRetirementHistoryTracking:
    """AC-003: History tracking"""

    def test_application_history(self, api_client, regular_user, asset):
        """GET application detail includes history"""
        app = RetirementApplication.objects.create(
            asset=asset,
            applicant=regular_user,
            reason="test",
            status="pending",
        )
        url = reverse("retirement-detail", kwargs={"pk": app.pk})
        api_client.force_authenticate(user=regular_user)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert "history" in response.json()

    def test_asset_retirement_history(self, api_client, regular_user, asset):
        """Asset retirement history endpoint"""
        url = reverse("asset-retirement-history", kwargs={"pk": asset.pk})
        api_client.force_authenticate(user=regular_user)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)

    def test_admin_see_all_history(self, api_client, admin_user, asset):
        """Admin can view all retirement history"""
        url = reverse("retirement-history-list")
        api_client.force_authenticate(user=admin_user)
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK