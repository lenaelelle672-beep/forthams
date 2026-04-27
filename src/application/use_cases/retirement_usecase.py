"""
资产报废退役用例模块

提供资产报废申请提交、审批处理及退役历史查询的核心业务逻辑。
符合 SWARM-002 规格：用户提交资产报废申请、管理员审批处理、追踪资产退役历史。

状态机约束:
    [在用] --提交报废申请--> [待审批] --审批通过--> [已报废]
                                ↑
                           审批驳回
                                ↓
                           [在用] (状态不变)

边界约束:
    - 报废原因: 必填，最大 500 字符
    - 预估残值: 数值型，允许 0，最小 0
    - 同一资产同一时间只允许一条待审批记录
    - [已报废] 状态资产不可再次提交报废申请
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import uuid4

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from src.models.asset import Asset
from src.models.retirement import RetirementApplication, RetirementHistory, RetirementStatus
from src.schemas.retirement_request import RetirementApplicationCreate
from src.schemas.retirement_response import RetirementApplicationResponse, RetirementApprovalResponse


class RetirementUseCase:
    """
    资产报废退役业务用例类
    
    提供资产报废申请生命周期管理，包括申请提交、审批处理、历史查询。
    """
    
    # 资产状态常量
    ASSET_STATUS_IN_USE = "in_use"
    ASSET_STATUS_PENDING_RETIREMENT = "pending_retirement"
    ASSET_STATUS_RETIRED = "retired"
    
    def __init__(self, session: Session):
        """
        初始化报废用例
        
        Args:
            session: SQLAlchemy 数据库会话
        """
        self.session = session
    
    def submit_retirement_application(
        self,
        application_data: RetirementApplicationCreate,
        applicant_id: str
    ) -> RetirementApplicationResponse:
        """
        提交资产报废申请
        
        Args:
            application_data: 报废申请数据，包含资产ID、报废原因、预估残值
            applicant_id: 申请人ID
        
        Returns:
            RetirementApplicationResponse: 创建的报废申请响应
        
        Raises:
            ValueError: 资产不存在、资产已报废或存在待审批申请
        """
        # 查询资产
        asset = self.session.query(Asset).filter(
            Asset.id == application_data.asset_id
        ).first()
        
        if not asset:
            raise ValueError(f"Asset with id '{application_data.asset_id}' not found")
        
        # 检查资产状态约束
        if asset.status == self.ASSET_STATUS_RETIRED:
            raise ValueError(
                f"Asset {application_data.asset_id} is already retired, "
                "cannot submit retirement application"
            )
        
        # 检查是否有待审批的申请（幂等性约束）
        pending_application = self.session.query(RetirementApplication).filter(
            RetirementApplication.asset_id == application_data.asset_id,
            RetirementApplication.status == RetirementStatus.PENDING
        ).first()
        
        if pending_application:
            raise ValueError(
                f"Asset {application_data.asset_id} already has pending retirement application"
            )
        
        # 验证报废原因长度
        if len(application_data.reason) > 500:
            raise ValueError("Retirement reason must not exceed 500 characters")
        
        # 生成唯一申请ID
        application_id = str(uuid4())
        
        # 创建报废申请
        application = RetirementApplication(
            id=application_id,
            asset_id=application_data.asset_id,
            reason=application_data.reason,
            estimated_residual_value=application_data.estimated_residual_value or 0.0,
            applicant_id=applicant_id,
            status=RetirementStatus.PENDING,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # 更新资产状态为待审批
        asset.status = self.ASSET_STATUS_PENDING_RETIREMENT
        asset.updated_at = datetime.utcnow()
        
        try:
            self.session.add(application)
            self.session.commit()
            
            return RetirementApplicationResponse(
                application_id=application_id,
                asset_id=application_data.asset_id,
                reason=application_data.reason,
                estimated_residual_value=application_data.estimated_residual_value or 0.0,
                status=RetirementStatus.PENDING,
                applicant_id=applicant_id,
                created_at=application.created_at.isoformat(),
                updated_at=application.updated_at.isoformat()
            )
        except SQLAlchemyError as e:
            self.session.rollback()
            raise ValueError(f"Failed to submit retirement application: {str(e)}")
    
    def approve_retirement(
        self,
        application_id: str,
        approver_id: str,
        comment: Optional[str] = None
    ) -> RetirementApprovalResponse:
        """
        审批通过报废申请
        
        Args:
            application_id: 报废申请ID
            approver_id: 审批人ID
            comment: 审批意见
        
        Returns:
            RetirementApprovalResponse: 审批结果响应
        
        Raises:
            ValueError: 申请不存在或申请状态不是待审批
        """
        # 查询报废申请
        application = self.session.query(RetirementApplication).filter(
            RetirementApplication.id == application_id
        ).first()
        
        if not application:
            raise ValueError(f"Retirement application with id '{application_id}' not found")
        
        if application.status != RetirementStatus.PENDING:
            raise ValueError(
                f"Application status is '{application.status}', expected 'pending'"
            )
        
        # 查询关联资产
        asset = self.session.query(Asset).filter(
            Asset.id == application.asset_id
        ).first()
        
        if not asset:
            raise ValueError(f"Associated asset with id '{application.asset_id}' not found")
        
        # 更新申请状态为已批准
        application.status = RetirementStatus.APPROVED
        application.approver_id = approver_id
        application.approval_comment = comment
        application.approved_at = datetime.utcnow()
        application.updated_at = datetime.utcnow()
        
        # 触发资产状态变更
        asset.status = self.ASSET_STATUS_RETIRED
        asset.updated_at = datetime.utcnow()
        
        # 创建退役历史记录
        history_record = RetirementHistory(
            id=str(uuid4()),
            application_id=application_id,
            asset_id=application.asset_id,
            action="approved",
            operator_id=approver_id,
            operator_type="admin",
            comment=comment or "Approved retirement application",
            residual_value=application.estimated_residual_value,
            created_at=datetime.utcnow()
        )
        
        try:
            self.session.add(history_record)
            self.session.commit()
            
            return RetirementApprovalResponse(
                application_id=application_id,
                asset_id=application.asset_id,
                result="approved",
                approved_by=approver_id,
                approved_at=application.approved_at.isoformat(),
                asset_status=asset.status
            )
        except SQLAlchemyError as e:
            self.session.rollback()
            raise ValueError(f"Failed to approve retirement application: {str(e)}")
    
    def reject_retirement(
        self,
        application_id: str,
        rejector_id: str,
        comment: Optional[str] = None
    ) -> RetirementApprovalResponse:
        """
        驳回报废申请
        
        Args:
            application_id: 报废申请ID
            rejector_id: 驳回操作人ID
            comment: 驳回原因
        
        Returns:
            RetirementApprovalResponse: 驳回结果响应
        
        Raises:
            ValueError: 申请不存在或申请状态不是待审批
        """
        # 查询报废申请
        application = self.session.query(RetirementApplication).filter(
            RetirementApplication.id == application_id
        ).first()
        
        if not application:
            raise ValueError(f"Retirement application with id '{application_id}' not found")
        
        if application.status != RetirementStatus.PENDING:
            raise ValueError(
                f"Application status is '{application.status}', expected 'pending'"
            )
        
        # 查询关联资产
        asset = self.session.query(Asset).filter(
            Asset.id == application.asset_id
        ).first()
        
        if not asset:
            raise ValueError(f"Associated asset with id '{application.asset_id}' not found")
        
        # 更新申请状态为已驳回
        application.status = RetirementStatus.REJECTED
        application.approver_id = rejector_id
        application.approval_comment = comment
        application.approved_at = datetime.utcnow()
        application.updated_at = datetime.utcnow()
        
        # 资产状态回滚为"在用"（不触发状态变更，保持原状态）
        asset.status = self.ASSET_STATUS_IN_USE
        asset.updated_at = datetime.utcnow()
        
        # 创建驳回历史记录
        history_record = RetirementHistory(
            id=str(uuid4()),
            application_id=application_id,
            asset_id=application.asset_id,
            action="rejected",
            operator_id=rejector_id,
            operator_type="admin",
            comment=comment or "Rejected retirement application",
            residual_value=application.estimated_residual_value,
            created_at=datetime.utcnow()
        )
        
        try:
            self.session.add(history_record)
            self.session.commit()
            
            return RetirementApprovalResponse(
                application_id=application_id,
                asset_id=application.asset_id,
                result="rejected",
                approved_by=rejector_id,
                approved_at=application.approved_at.isoformat(),
                asset_status=asset.status
            )
        except SQLAlchemyError as e:
            self.session.rollback()
            raise ValueError(f"Failed to reject retirement application: {str(e)}")
    
    def get_retirement_history(
        self,
        asset_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        获取资产退役历史记录
        
        Args:
            asset_id: 资产ID，如果为 None 则返回所有历史
        
        Returns:
            List[Dict[str, Any]]: 退役历史记录列表
        
        Raises:
            SQLAlchemyError: 数据库查询失败
        """
        try:
            query = self.session.query(RetirementHistory)
            
            if asset_id:
                query = query.filter(RetirementHistory.asset_id == asset_id)
            
            records = query.order_by(RetirementHistory.created_at.desc()).all()
            
            return [
                {
                    "id": record.id,
                    "application_id": record.application_id,
                    "asset_id": record.asset_id,
                    "action": record.action,
                    "operator_id": record.operator_id,
                    "operator_type": record.operator_type,
                    "comment": record.comment,
                    "residual_value": record.residual_value,
                    "retired_at": record.created_at.isoformat() if record.created_at else None
                }
                for record in records
            ]
        except SQLAlchemyError as e:
            raise ValueError(f"Failed to get retirement history: {str(e)}")
    
    def get_applications_by_status(
        self,
        asset_id: Optional[str] = None,
        status: Optional[str] = None,
        applicant_id: Optional[str] = None,
        approver_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        根据条件查询报废申请列表
        
        Args:
            asset_id: 资产ID筛选条件
            status: 申请状态筛选条件
            applicant_id: 申请人ID筛选条件
            approver_id: 审批人ID筛选条件
        
        Returns:
            List[Dict[str, Any]]: 符合条件的报废申请列表
        """
        try:
            query = self.session.query(RetirementApplication)
            
            if asset_id:
                query = query.filter(RetirementApplication.asset_id == asset_id)
            if status:
                query = query.filter(RetirementApplication.status == status)
            if applicant_id:
                query = query.filter(RetirementApplication.applicant_id == applicant_id)
            if approver_id:
                query = query.filter(RetirementApplication.approver_id == approver_id)
            
            applications = query.order_by(RetirementApplication.created_at.desc()).all()
            
            return [
                {
                    "application_id": app.id,
                    "asset_id": app.asset_id,
                    "reason": app.reason,
                    "estimated_residual_value": app.estimated_residual_value,
                    "status": app.status,
                    "applicant_id": app.applicant_id,
                    "approver_id": app.approver_id,
                    "approval_comment": app.approval_comment,
                    "created_at": app.created_at.isoformat() if app.created_at else None,
                    "approved_at": app.approved_at.isoformat() if app.approved_at else None,
                    "updated_at": app.updated_at.isoformat() if app.updated_at else None
                }
                for app in applications
            ]
        except SQLAlchemyError as e:
            raise ValueError(f"Failed to query applications: {str(e)}")
    
    def get_pending_applications(self) -> List[Dict[str, Any]]:
        """
        获取所有待审批的报废申请
        
        Returns:
            List[Dict[str, Any]]: 待审批的报废申请列表
        """
        return self.get_applications_by_status(status=RetirementStatus.PENDING)