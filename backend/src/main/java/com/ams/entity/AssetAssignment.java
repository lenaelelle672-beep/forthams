package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 资产领用归还实体。
 * <p>对应表 asset_assignment，管理资产领用申请、审批、签收、归还全流程。</p>
 */
@Data
@TableName("asset_assignment")
public class AssetAssignment implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 资产 ID */
    private Long assetId;

    /** 申请人 ID */
    private Long applicantId;

    /** 申请部门 ID */
    private Long applicantDeptId;

    /** 签收人 ID（领用目标人） */
    private Long assignedToUserId;

    /** 签收部门 ID */
    private Long assignedToDeptId;

    /** 预计归还日期 */
    private LocalDate expectedReturnDate;

    /** 实际归还日期 */
    private LocalDate actualReturnDate;

    /**
     * 状态: DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CHECKED_OUT/RETURN_REQUESTED/RETURNED/CANCELLED
     */
    private String status;

    /** 签收（领用）日期 */
    private LocalDate assignmentDate;

    /** 归还时状况说明 */
    private String returnCondition;

    /** 领用类型: ASSIGNMENT/BORROW/RETURN/TRANSFER */
    @TableField("allocation_type")
    private String allocationType;

    /** 审批人 ID */
    @TableField("approver_id")
    private Long approverId;

    /** 审批时间 */
    @TableField("approval_time")
    private LocalDateTime approvalTime;

    /** 审批备注/驳回原因 */
    @TableField("approval_remark")
    private String approvalRemark;

    /** 备注 */
    private String remark;

    /** 租户 ID */
    private String tenantId;

    /** 创建人 */
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

    // ── 非数据库字段 ──

    /** 资产编号（冗余展示） */
    @TableField(exist = false)
    private String assetNo;

    /** 资产名称（冗余展示） */
    @TableField(exist = false)
    private String assetName;
}
