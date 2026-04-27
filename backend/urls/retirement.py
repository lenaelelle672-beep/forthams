"""
URL routing for the asset retirement (retirement application) feature.

This module defines all RESTful endpoints for:
- Creating / querying / withdrawing retirement applications
- Approving / rejecting retirement applications (admin only)
- Querying retirement history per asset or globally
"""

from django.urls import include, path

from . import views

app_name = 'retirement'

urlpatterns = [
    # -- Retirement Application CRUD --
    path(
        'assets/<int:asset_id>/retirement/',
        views.RetirementApplicationViewSet.as_view({'post': 'create'}),
        name='retirement-apply'
    ),
    path(
        'retirements/',
        views.RetirementApplicationViewSet.as_view({'get': 'list'}),
        name='retirement-list'
    ),
    path(
        'retirements/<int:pk>/',
        views.RetirementApplicationViewSet.as_view({
            'get': 'retrieve',
            'patch': 'partial_update',
            'put': 'update',
        }),
        name='retirement-detail'
    ),
    # Withdraw (custom action on the application itself)
    path(
        'retirements/<int:pk>/withdraw/',
        views.RetirementApplicationViewSet.as_view({'post': 'withdraw'}),
        name='retirement-withdraw'
    ),

    # -- Approval endpoints (admin only) --
    path(
        'retirements/<int:pk>/approve/',
        views.ApprovalViewSet.as_view({'post': 'approve'}),
        name='retirement-approve'
    ),
    path(
        'retirements/<int:pk>/reject/',
        views.ApprovalViewSet.as_view({'post': 'reject'}),
        name='retirement-reject'
    ),

    # -- Retirement history --
    path(
        'retirement-history/',
        views.RetirementHistoryViewSet.as_view({'get': 'list'}),
        name='retirement-history-list'
    ),
    path(
        'retirement-history/<int:pk>/',
        views.RetirementHistoryViewSet.as_view({'get': 'retrieve'}),
        name='retirement-history-detail'
    ),
    # Per-asset history
    path(
        'assets/<int:asset_id>/retirement-history/',
        views.RetirementHistoryViewSet.as_view({'get': 'list'}),
        name='asset-retirement-history'
    ),
]