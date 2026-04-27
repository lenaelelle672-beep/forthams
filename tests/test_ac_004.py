import pytest


def test_ac_004_import_approval_binding_module():
    """AC-004: 变更后的模块可被正常 import 不抛出 ImportError"""
    from src.composables.use_approval_binding import (
        canTransition,
        getAllowedTransitions,
        canUserApprove,
        isWithinIdempotencyWindow,
        useApprovalBinding,
    )
    assert canTransition is not None
    assert getAllowedTransitions is not None
    assert canUserApprove is not None
    assert isWithinIdempotencyWindow is not None
    assert useApprovalBinding is not None


def test_ac_004_import_approval_types_module():
    """AC-004: 变更后的模块可被正常 import 不抛出 ImportError"""
    from src.types.approval import (
        WorkOrderStatus,
        WorkOrderApprovalDTO,
        ApprovalState,
        ApprovalResult,
        ApprovalHistoryItem,
    )
    assert WorkOrderStatus is not None
    assert WorkOrderApprovalDTO is not None
    assert ApprovalState is not None


def test_ac_004_import_approval_service_module():
    """AC-004: 变更后的模块可被正常 import 不抛出 ImportError"""
    from src.services.approval_service import (
        approveWorkOrder,
        rejectWorkOrder,
        transferWorkOrder,
        getApprovalHistory,
    )
    assert approveWorkOrder is not None
    assert rejectWorkOrder is not None
    assert transferWorkOrder is not None
    assert getApprovalHistory is not None


def test_ac_004_import_log_dashboard_module():
    """AC-004: 变更后的模块可被正常 import 不抛出 ImportError"""
    from src.services.log_dashboard import (
        validateTimeSpan,
        buildLogQuery,
        fetchAuditLogs,
        fetchLogTrend,
    )
    assert validateTimeSpan is not None
    assert buildLogQuery is not None
    assert fetchAuditLogs is not None
    assert fetchLogTrend is not None