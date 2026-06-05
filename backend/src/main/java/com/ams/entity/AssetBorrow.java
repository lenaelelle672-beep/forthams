package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 资产借用实体。
 * <p>对应表 asset_borrow，管理借用申请、审批、借出、归还、到期提醒。</p>
 */
@Data
@TableName("asset_borrow")
public class AssetBorrow implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 资产 ID */
    private Long assetId;

    /** 借用人 ID */
    private Long borrowerId;

    /** 借用部门 ID */
    private Long borrowerDeptId;

    /** 借用日期 */
    private LocalDate borrowDate;

    /** 预计归还日期 */
    private LocalDate expectedReturnDate;

    /** 实际归还日期 */
    private LocalDate actualReturnDate;

    /**
     * 状态: DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/BORROWED/OVERDUE/RETURNED/CANCELLED
     */
    private String status;

    /** 借用用途 */
    private String purpose;

    /** 备注 */
    private String remark;

    /** 到期已通知标记(0=未通知, 1=已通知) */
    private Integer notified;

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

    @TableField(exist = false)
    private String assetNo;

    @TableField(exist = false)
    private String assetName;
}
