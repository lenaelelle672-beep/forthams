"""Approval request schema module.

Defines Pydantic models for the work order approval endpoint
(`POST /api/orders/{id}/approve`).  The two-level approval chain
requires the caller to be either a department manager (Level 1) or
an asset manager (Level 2).  The actual approval level is resolved
by the backend based on the current work order status, so this
schema intentionally does **not** expose an ``approval_level`` field
to the caller — preventing cross-level / out-of-order approvals.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ApproveRequest(BaseModel):
    """Request body for approving a work order.

    Attributes:
        comment: Optional remark left by the approver.  Unlike
            rejection reasons, approval comments are not mandatory
            but are persisted for audit traceability.
    """

    comment: Optional[str] = Field(
        default=None,
        description=(
            "Optional approval comment.  Persisted as part of the "
            "approval record for audit traceability."
        ),
        max_length=1000,
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "comment": "Budget verified, proceed to asset manager review.",
                },
                {
                    "comment": "Asset allocation confirmed.",
                },
            ],
        },
    }