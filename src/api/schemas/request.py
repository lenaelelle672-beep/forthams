"""
Request schemas for API endpoints.
"""
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class ApprovalActionRequest(BaseModel):
    """Request schema for approval actions (approve/reject)."""
    approver_id: int = Field(..., description="ID of the approver performing the action")
    comment: Optional[str] = Field(None, max_length=500, description="Optional comment for the approval action")
    reason: Optional[str] = Field(None, max_length=500, description="Reason for rejection (required for reject actions)")


class ApproveRequest(BaseModel):
    """Request schema for approving a retirement application."""
    approver_id: int = Field(..., description="ID of the approver")
    comment: Optional[str] = Field(None, max_length=500, description="Approval comment")


class RejectRequest(BaseModel):
    """Request schema for rejecting a retirement application."""
    approver_id: int = Field(..., description="ID of the approver")
    reason: str = Field(..., min_length=1, max_length=500, description="Rejection reason")


class RetirementApplicationCreateRequest(BaseModel):
    """Request schema for creating a new retirement application."""
    asset_id: int = Field(..., description="ID of the asset to retire")
    reason: str = Field(..., min_length=1, max_length=1000, description="Reason for retirement")
    expected_decommission_date: Optional[date] = Field(None, description="Expected date of decommission")
    estimated_value: Optional[float] = Field(None, ge=0, description="Estimated remaining value of the asset")
    approver_ids: Optional[List[int]] = Field(None, description="List of approver IDs for the approval chain")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "asset_id": 101,
                "reason": "设备老化，无法继续使用",
                "expected_decommission_date": "2025-12-31",
                "estimated_value": 15000.00,
                "approver_ids": [2, 3, 4]
            }
        }
    )


class RetirementApplicationUpdateRequest(BaseModel):
    """Request schema for updating a retirement application (in DRAFT or REJECTED state)."""
    reason: Optional[str] = Field(None, min_length=1, max_length=1000, description="Updated retirement reason")
    expected_decommission_date: Optional[date] = Field(None, description="Updated expected decommission date")
    estimated_value: Optional[float] = Field(None, ge=0, description="Updated estimated value")
    approver_ids: Optional[List[int]] = Field(None, description="Updated list of approver IDs")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "reason": "设备已完全报废，需立即退役",
                "expected_decommission_date": "2025-11-30"
            }
        }
    )


class SubmitRequest(BaseModel):
    """Request schema for submitting a retirement application for approval."""
    # No body required, but we allow optional approver override
    approver_ids: Optional[List[int]] = Field(None, description="Override approver IDs for this submission")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "approver_ids": [5, 6, 7]
            }
        }
    )


class DecommissionRequest(BaseModel):
    """Request schema for executing the decommission of an approved application."""
    actual_decommission_date: Optional[date] = Field(None, description="Actual date of decommission")
    decommission_notes: Optional[str] = Field(None, max_length=2000, description="Notes about the decommission process")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "actual_decommission_date": "2025-10-15",
                "decommission_notes": "资产已物理销毁，配件已回收"
            }
        }
    )


class ArchiveRequest(BaseModel):
    """Request schema for archiving a completed or cancelled application."""
    archive_reason: Optional[str] = Field(None, max_length=500, description="Reason for archiving")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "archive_reason": "流程已完成，归档存储"
            }
        }
    )


class ResubmitRequest(BaseModel):
    """Request schema for resubmitting a rejected application."""
    # Resubmit will use the existing application data, but we allow updating reason
    updated_reason: Optional[str] = Field(None, min_length=1, max_length=1000, description="Updated reason if changed")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "updated_reason": "补充了更多信息后重新提交"
            }
        }
    )