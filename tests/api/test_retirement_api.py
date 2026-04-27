"""
Tests for the retirement API (SWARM-002 asset报废退役流程).
"""
import pytest
from django.urls import reverse
from rest_framework import status
@pytest.mark.django_db
def test_create_retirement_application_success(api_client, regular_user, asset):
    """ATB-01-01: Normal user can submit a retirement application."""
    api_client.force_authenticate(user=regular_user)
    response = api_client.post(
        reverse('retirement:create'),
        data={
            'asset': asset.id,
            'reason': '设备老化，无法修复',
            'expected_date': '2025-02-01'
        },
        format='json'
    )
    assert response.status_code == status.HTTP_201_CREATED
    asset.refresh_from_db()
    assert asset.status == 'pending_retirement'
@pytest.mark.django_db
def test_create_retirement_application_forbidden_non_owning_user(api_client, regular_user, asset):
    """ATB-01-02: Non-owning department user cannot submit."""
    other_user = pytest.User.objects.create_user(
        username='other', password='other123', role='operator'
    )
    api_client.force_authenticate(user=other_user)
    response = api_client.post(
        reverse('retirement:create'),
        data={'asset': asset.id, 'reason': 'test', 'expected_date': '2025-02-01'},
        format='json'
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
@pytest.mark.django_db
def test_create_retirement_application_duplicate_pending(api_client, regular_user, asset, retirement_application):
    """ATB-01-03: Duplicate pending application returns 400."""
    api_client.force_authenticate(user=regular_user)
    response = api_client.post(
        reverse('retirement:create'),
        data={'asset': asset.id, 'reason': 'test', 'expected_date': '2025-02-01'},
        format='json'
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
@pytest.mark.django_db
def test_create_retirement_application_already_retired(api_client, regular_user, asset):
    """ATB-01-04: Already retired asset cannot submit."""
    asset.status = 'retired'
    asset.save()
    api_client.force_authenticate(user=regular_user)
    response = api_client.post(
        reverse('retirement:create'),
        data={'asset': asset.id, 'reason': 'test', 'expected_date': '2025-02-01'},
        format='json'
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
@pytest.mark.django_db
def test_create_retirement_application_validation(api_client, regular_user, asset):
    """ATB-01-05: Missing required field returns 400."""
    api_client.force_authenticate(user=regular_user)
    response = api_client.post(
        reverse('retirement:create'),
        data={'asset': asset.id},  # missing reason & expected_date
        format='json'
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'reason' in response.json()
@pytest.mark.django_db
def test_withdraw_retirement_application(api_client, regular_user, retirement_application):
    """ATB-03-01: Applicant can withdraw a pending application."""
    api_client.force_authenticate(user=regular_user)
    response = api_client.post(
        reverse('retirement:withdraw', kwargs={'pk': retirement_application.pk}),
        format='json'
    )
    assert response.status_code == status.HTTP_200_OK
    retirement_application.refresh_from_db()
    assert retirement_application.status == 'withdrawn'
    asset = retirement_application.asset
    asset.refresh_from_db()
    assert asset.status == 'normal'
@pytest.mark.django_db
def test_withdraw_non_applicant(api_client, regular_user, retirement_application):
    """ATB-03-03: Non-applicant cannot withdraw."""
    other_user = pytest.User.objects.create_user(
        username='other', password='other123', role='operator'
    )
    api_client.force_authenticate(user=other_user)
    response = api_client.post(
        reverse('retirement:withdraw', kwargs={'pk': retirement_application.pk}),
        format='json'
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
@pytest.mark.django_db
def test_approve_retirement_by_admin(api_client, admin_user, asset, retirement_application):
    """ATB-04-01: Admin can approve a retirement application."""
    api_client.force_authenticate(user=admin_user)
    response = api_client.post(
        reverse('retirement:approve', kwargs={'pk': retirement_application.pk}),
        data={'comment': '确认报废，设备已使用10年'},
        format='json'
    )
    assert response.status_code == status.HTTP_200_OK
    asset.refresh_from_db()
    assert asset.status == 'retired'
    history = asset.retirement_histories.order_by('-created_at').first()
    assert history.action == 'approved'
    assert history.performed_by == admin_user
@pytest.mark.django_db
def test_approve_already_processed(api_client, admin_user, retirement_application):
    """ATB-04-04: Already processed application cannot be approved again."""
    api_client.force_authenticate(user=admin_user)
    retirement_application.status = 'approved'
    retirement_application.save()
    response = api_client.post(
        reverse('retirement:approve', kwargs={'pk': retirement_application.pk}),
        data={'comment': 'test'},
        format='json'
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
@pytest.mark.django_db
def test_reject_retirement_by_admin(api_client, admin_user, asset, retirement_application):
    """ATB-04-02: Admin can reject a retirement application."""
    api_client.force_authenticate(user=admin_user)
    response = api_client.post(
        reverse('retirement:reject', kwargs={'pk': retirement_application.pk}),
        data={'comment': '驳回申请'},
        format='json'
    )
    assert response.status_code == status.HTTP_200_OK
    asset.refresh_from_db()
    assert asset.status == 'normal'
    history = asset.retirement_histories.order_by('-created_at').first()
    assert history.action == 'rejected'
@pytest.mark.django_db
def test_retirement_history_tracking(api_client, admin_user, asset, retirement_application):
    """ATB-06-01: Asset retirement history is tracked and queryable."""
    api_client.force_authenticate(user=admin_user)
    api_client.post(
        reverse('retirement:approve', kwargs={'pk': retirement_application.pk}),
        data={'comment': 'approved'},
        format='json'
    )
    history_url = reverse('retirement:history', kwargs={'asset_pk': asset.pk})
    response = api_client.get(history_url)
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) >= 1
    assert response.json()[0]['action'] == 'approved'