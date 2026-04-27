@@ create new routes file
 from fastapi import APIRouter, HTTPException, Depends, status
 from typing import List
 from uuid import UUID
 from ..domain.entities import AssetTransferRecord, TransferStatus
 from ..domain.schemas import TransferRequestSchema, TransferResponseSchema
 
 # Mock repository for demonstration as per spec constraints (minimalist)
 _transfer_db = {}
 
 router = APIRouter(prefix="/transfers", tags=["asset-transfer"])
 
 @router.post("/", response_model=TransferResponseSchema, status_code=201)
 async def create_transfer_request(payload: TransferRequestSchema):
     # Validation logic embedded as per spec requirements
     if payload.source_location == payload.target_location:
         raise HTTPException(status_code=400, detail="SAME_LOCATION_REJECTED")
     
     # In real implementation, validate locations exist in location service here
     # For now, we assume valid if not identical per spec P3-011 validation rules
 
     record = AssetTransferRecord(
         asset_id=payload.asset_id,
         source_location=payload.source_location,
         target_location=payload.target_location,
         requester_id=payload.requester_id,
         reason=payload.reason,
         remarks=payload.remarks
     )
     
     # In real implementation: check if asset is at source location
     # For now, we simulate success per spec requirements
     
     _transfer_db[str(record.id)] = record
     return record
 
 @router.get("/{transfer_id}", response_model=TransferResponseSchema)
 async def get_transfer(transfer_id: UUID):
     record = _transfer_db.get(str(transfer_id))
     if not record:
         raise HTTPException(status_code=404, detail="TRANSFER_NOT_FOUND")
     return record
