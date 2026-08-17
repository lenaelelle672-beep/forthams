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
import java.util.Locale;

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
    private String status;  // DRAFT/PENDING/APPROVING/APPROVED/COMPLETED/REJECTED/CANCELLED_REQUIRES_RESUBMISSION/CANCELLED
    private Integer currentApprovalStep;
    private Integer totalApprovalSteps;
    private Integer version;
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
        RETIREMENT;

        public static RetirementType fromStoredValue(String value) {
            if (value == null || value.isBlank()) {
                throw new IllegalArgumentException("Retirement type must not be blank");
            }
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        }
    }

    public enum Status {
        DRAFT,
        PENDING,
        APPROVING,
        APPROVED,
        COMPLETED,
        REJECTED,
        CANCELLED_REQUIRES_RESUBMISSION,
        CANCELLED;

        public boolean canTransitionTo(Status target) {
            if (target == null || this == target) {
                return false;
            }
            return switch (this) {
                case DRAFT -> target == PENDING || target == CANCELLED;
                case PENDING -> target == APPROVING || target == APPROVED || target == REJECTED
                        || target == CANCELLED_REQUIRES_RESUBMISSION || target == CANCELLED;
                case APPROVING -> target == APPROVED || target == REJECTED
                        || target == CANCELLED_REQUIRES_RESUBMISSION || target == CANCELLED;
                case APPROVED -> target == COMPLETED;
                case REJECTED -> target == PENDING || target == CANCELLED;
                case CANCELLED_REQUIRES_RESUBMISSION -> target == PENDING || target == CANCELLED;
                case COMPLETED, CANCELLED -> false;
            };
        }

        public static Status fromStoredValue(String value) {
            if (value == null || value.isBlank()) {
                throw new IllegalArgumentException("Retirement status must not be blank");
            }
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        }
    }
}
