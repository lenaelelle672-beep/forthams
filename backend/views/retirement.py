"""
API 视图：资产报废退役流程
- 报废申请管理（创建、查询、撤回）
- 审批处理（通过/驳回）
- 资产状态变更与历史追踪
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.core.db import get_db
from backend.core.security import get_current_user
from backend.models import (
    Asset,
    RetirementApplication,
    RetirementHistory,
    User,
)
from backend.schemas.retirement import (
    RetirementApplicationCreate,
    RetirementApplicationDetail,
    RetirementHistoryItem,
    RetirementRequestResponse,
)

router = APIRouter(prefix="/api/retirement", tags=["retirement"])


@router.post("/applications", status_code=status.HTTP_201_CREATED)
def create_retirement_application(
    payload: RetirementApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RetirementRequestResponse:
    """
    提交资产报废申请
    校验：
      - 资产存在且状态为 normal
      - 申请人为资产所属部门用户
      - 当前无活跃申请（draft / pending）
    """
    asset = db.query(Asset).filter(Asset.id == payload.asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="资产不存在",
        )

    if asset.status != "normal":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"资产状态为 {asset.status}，无法提交报废申请",
        )

    # 同一资产同一时刻只能有一条活跃申请
    existing = (
        db.query(RetirementApplication)
        .filter(
            RetirementApplication.asset_id == asset.id,
            RetirementApplication.status.in_(("draft", "pending")),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该资产存在待处理的报废申请",
        )

    # 仅资产所属部门用户可提交
    if current_user.department != asset.owning_department:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅资产所属部门用户可提交报废申请",
        )

    application = RetirementApplication(
        asset_id=asset.id,
        applicant_id=current_user.id,
        reason=payload.reason,
        expected_date=payload.expected_date or date.today(),
        status="pending",
    )
    db.add(application)
    db.flush()

    # 更新资产状态为待退役
    asset.status = "pending_retirement"

    # 写入历史记录
    history = RetirementHistory(
        asset_id=asset.id,
        application_id=application.id,
        action="created",
        previous_status="normal",
        new_status="pending_retirement",
        performed_by=current_user,
    )
    db.add(history)
    db.commit()
    db.refresh(application)

    return {
        "id": application.id,
        "asset_id": application.asset_id,
        "status": application.status,
        "created_at": application.created_at,
    }


@router.get("/applications/me", response_model=list[RetirementApplicationDetail])
def list_my_applications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RetirementApplicationDetail]:
    """查询当前用户提交的报废申请列表"""
    applications = (
        db.query(RetirementApplication)
        .filter(RetirementApplication.applicant_id == current_user.id)
        .order_by(RetirementApplication.created_at.desc())
        .all()
    )
    return applications


@router.get("/applications/{application_id}", response_model=RetirementApplicationDetail)
def get_retirement_application_detail(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RetirementApplicationDetail:
    """查询单条申请详情（含审批历史）"""
    application = (
        db.query(RetirementApplication)
        .filter(RetirementApplication.id == application_id)
        .first()
    )
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="申请不存在",
        )

    # 非申请人且非管理员不可查看
    if current_user.role != "admin" and application.applicant_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="无权限查看该申请",
        )

    histories = (
        db.query(RetirementHistory)
        .filter(RetirementHistory.application_id == application_id)
        .order_by(RetirementHistory.created_at.asc())
        .all()
    )
    return {
        "id": application.id,
        "asset": {
            "id": application.asset_id,
            "asset_code": application.asset.asset_code,
            "name": application.asset.name,
            "status": application.asset.status,
            "owning_department": application.asset.owning_department,
        },
        "applicant": {"id": application.applicant_id, "username": application.applicant.username},
        "reason": application.reason,
        "expected_date": application.expected_date,
        "status": application.status,
        "created_at": application.created_at,
        "updated_at": application.updated_at,
        "histories": [
            {
                "action": h.action,
                "previous_status": h.previous_status,
                "new_status": h.new_status,
                "performed_by": {
                    "id": h.performed_by_id,
                    "username": h.performed_by.username,
                },
                "comment": h.comment,
                "created_at": h.created_at,
            }
            for h in histories
        ],
    }


@router.post("/applications/{application_id}/withdraw")
def withdraw_retirement_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RetirementRequestResponse:
    """
    申请人撤回待审批的报废申请
    状态回退：pending -> draft；资产状态回退：pending_retirement -> normal
    """
    application = db.query(RetirementApplication).filter(
        RetirementApplication.id == application_id
    ).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="申请不存在",
        )

    # 仅申请人或管理员可撤回
    if current_user.role != "admin" and application.applicant_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限撤回他人申请",
        )

    if application.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅待审批状态的申请可撤回",
        )

    application.status = "withdrawn"
    asset = db.query(Asset).filter(Asset.id == application.asset_id).first()
    asset.status = "normal"

    history = RetirementHistory(
        asset_id=asset.id,
        application_id=application.id,
        action="withdrawn",
        previous_status="pending_retirement",
        new_status="normal",
        performed_by=current_user,
    )
    db.add(history)
    db.commit()
    db.refresh(application)

    return {
        "id": application.id,
        "status": application.status,
        "message": "申请已撤回",
    }


@router.post("/approvals/{retirement_id}/approve")
def approve_retirement(
    retirement_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RetirementRequestResponse:
    """
    管理员审批通过：资产状态 normal -> retired
    幂等：已处理（approved/rejected）的申请不可重复审批
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅管理员可执行审批",
        )

    application = db.query(RetirementApplication).filter(
        RetirementApplication.id == retirement_id
    ).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="申请不存在",
        )

    if application.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="申请已处理完成，无法重复审批",
        )

    comment: Optional[str] = payload.get("comment", "")
    asset = db.query(Asset).filter(Asset.id == application.asset_id).with_for_update().first()
    if asset.status != "pending_retirement":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="资产状态异常，无法审批",
        )

    application.status = "approved"
    asset.status = "retired"

    history = RetirementHistory(
        asset_id=asset.id,
        application_id=application.id,
        action="approved",
        previous_status="pending_retirement",
        new_status="retired",
        performed_by=current_user,
        comment=comment,
    )
    db.add(history)
    db.commit()
    db.refresh(application)

    return {
        "id": application.id,
        "status": application.status,
        "asset_status": asset.status,
        "message": "审批通过",
    }


@router.post("/approvals/{retirement_id}/reject")
def reject_retirement(
    retirement_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RetirementRequestResponse:
    """
    管理员审批驳回：资产状态 retired -> normal
    必须提供驳回原因
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅管理员可执行审批",
        )

    application = db.query(RetirementApplication).filter(
        RetirementApplication.id == retirement_id
    ).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="申请不存在",
        )

    if application.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="申请已处理完成，无法重复审批",
        )

    reason = payload.get("reason")
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="驳回原因必填",
        )

    asset = db.query(Asset).filter(Asset.id == application.asset_id).with_for_update().first()
    asset.status = "normal"
    application.status = "rejected"

    history = RetirementHistory(
        asset_id=asset.id,
        application_id=application.id,
        action="rejected",
        previous_status="pending_retirement",
        new_status="normal",
        performed_by=current_user,
        comment=reason,
    )
    db.add(history)
    db.commit()
    db.refresh(application)

    return {
        "id": application.id,
        "status": application.status,
        "asset_status": asset.status,
        "message": "审批驳回",
    }