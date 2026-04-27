@@ create new schema file
 from pydantic import BaseModel, Field, validator
 from uuid import UUID
 from datetime import datetime
 from typing import Optional
 
 class TransferRequestSchema(BaseModel):
     asset_id: UUID
     source_location: str = Field(..., min_length=1)
     target_location: str = Field(..., min_length=1)
     requester_id: str
     reason: str = Field(..., min_length=5)
     remarks: Optional[str] = None
 
     @validator("target_location")
     def locations_must_differ(cls, v, values):
         if "source_location" in values and v == values["source_location"]:
             raise ValueError("SAME_LOCATION_REJECTED")
         return v
 
 class TransferResponseSchema(BaseModel):
     id: UUID
     asset_id: UUID
     source_location: str
     target_location: str
     status: str
     requester_id: str
     transfer_date: datetime
     approver_id: Optional[str] = None
     remarks: Optional[str] = None
