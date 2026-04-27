from pydantic import BaseModel, Field, field_validator
from typing import Optional


class RejectRequest(BaseModel):
    """Request schema for rejecting a work order.

    Used by POST /api/work-orders/{id}/reject.
    """

    reason: str = Field(..., min_length=1, description="Reason for rejection")

    @field_validator("reason")
    @classmethod
    def reason_is_required(cls, v: Optional[str]) -> str:
        if v is None or (isinstance(v, str) and v.strip() == ""):
            raise ValueError("rejection reason is required")
        return v.strip()