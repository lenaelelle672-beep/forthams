"""Reject request schema for work order approval rejection.

This module defines the Pydantic model used to validate incoming
rejection payloads on the approval endpoints.  Per business rules the
``rejection_reason`` field is **mandatory** and must contain at least
10 characters so that reviewers provide meaningful feedback.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class RejectRequest(BaseModel):
    """Schema for rejecting a work order at any approval level.

    Attributes:
        rejection_reason: Mandatory human-readable explanation of why
            the work order is being rejected.  Must be at least 10
            characters long to ensure substantive feedback.
    """

    rejection_reason: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description=(
            "The reason for rejecting the work order. "
            "Must be at least 10 characters and at most 2000 characters."
        ),
        examples=[
            "The asset depreciation calculation method does not comply "
            "with the latest accounting standards issued in 2024."
        ],
    )

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------

    @field_validator("rejection_reason")
    @classmethod
    def rejection_reason_must_be_meaningful(cls, v: str) -> str:
        """Ensure the rejection reason is not just whitespace.

        Args:
            v: The raw string value supplied by the caller.

        Returns:
            The stripped rejection reason string.

        Raises:
            ValueError: If the stripped string is empty or shorter than
                10 characters.
        """
        stripped = v.strip()
        if len(stripped) < 10:
            raise ValueError(
                "rejection_reason must contain at least 10 non-whitespace "
                f"characters (got {len(stripped)})."
            )
        return stripped

    # ------------------------------------------------------------------
    # Pydantic configuration
    # ------------------------------------------------------------------

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "rejection_reason": (
                        "The requested asset transfer does not have the "
                        "required department head sign-off documentation."
                    ),
                }
            ]
        }
    }