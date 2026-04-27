@@ create new entity file
 from datetime import datetime
 from uuid import UUID, uuid4
 from enum import Enum
 from typing import Optional, List
 from pydantic import BaseModel, Field
 
 class TransferStatus(str, Enum):
     PENDING = "pending"
     APPROVED = "approved"
     REJECTED = "rejected"
     EXECUTED = "executed"
     CANCELLED = "cancelled"
 
 class AssetTransferRecord:
     def __init__(
         self,
         asset_id: UUID,
         source_location: str,
         target_location: str,
         requester_id: str,
         reason: str,
         transfer_date: datetime = None,
         approver_id: Optional[str] = None,
         status: TransferStatus = TransferStatus.PENDING,
         remarks: Optional[str] = None,
         id: UUID = None
     ):
         self.id = id or uuid4()
         self.asset_id = asset_id
         self.source_location = source_location
         self.target_location = target_location
         self.requester_id = requester_id
         self.reason = reason
         self.transfer_date = transfer_date or datetime.now()
         self.approver_id = approver_id
         self.status = status
         self.remarks = remarks
 
     def to_dict(self):
         return {
             "id": str(self.id),
             "asset_id": str(self.asset_id),
             "source_location": self.source_location,
             "target_location": self.target_location,
             "requester_id": self.requester_id,
             "reason": self.reason,
             "transfer_date": self.transfer_date.isoformat(),
             "approver_id": self.approver_id,
             "status": self.status.value,
             "remarks": self.remarks
         }
