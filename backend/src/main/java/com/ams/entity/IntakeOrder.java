package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 入库验收主单实体。
 * <p>对应表 intake_order，管理资产入库验收全流程。</p>
 */
@Data
@TableName("intake_order")
public class IntakeOrder implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 验收单号 */
    private String orderNo;

    /** 供应商 ID */
    private Long vendorId;

    /** 验收日期 */
    private LocalDate orderDate;

    /** 状态: DRAFT/PENDING_INSPECT/INSPECTING/PARTIAL_ACCEPTED/ACCEPTED/REJECTED/CANCELLED */
    private String status;

    /** 总金额 */
    private BigDecimal totalAmount;

    /** 备注 */
    private String remark;

    /** 驳回原因 */
    private String rejectReason;

    /** 租户 ID */
    private String tenantId;

    /** 创建人 ID */
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

    // ── 非数据库字段 ──

    /** 验收检查项列表 */
    @TableField(exist = false)
    private List<IntakeCheckItem> checkItems;

    /** 入库资产列表 */
    @TableField(exist = false)
    private List<IntakeAsset> intakeAssets;
}
