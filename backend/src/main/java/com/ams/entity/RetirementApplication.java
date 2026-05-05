package com.ams.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("retirement_application")
public class RetirementApplication {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private String applicationNo;
    private Long assetId;
    private String assetName;
    private String assetCode;
    private Long applicantId;
    private String applicantName;
    private Long deptId;
    private String deptName;
    private String retirementType;  // SCRAP/RETIREMENT
    private String reason;
    private BigDecimal estimatedResidualValue;
    private String status;  // DRAFT/PENDING/APPROVING/APPROVED/COMPLETED/REJECTED/CANCELLED
    private Integer currentApprovalStep;
    private Integer totalApprovalSteps;
    private String attachments;
    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

    public enum RetirementType {
        SCRAP,
        RETIREMENT
    }

    public enum Status {
        DRAFT,
        PENDING,
        APPROVING,
        APPROVED,
        COMPLETED,
        REJECTED,
        CANCELLED
    }
}
