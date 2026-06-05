package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("risk_assessment")
public class RiskAssessment {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long assetId;
    private Integer probability;
    private Integer impact;
    private String riskLevel;
    private String mitigationMeasures;
    private LocalDate reviewDate;
    private Long assessorId;
    private String status;  // PENDING, IN_PROGRESS, COMPLETED, CLOSED

    private String tenantId;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

    /**
     * 自动计算风险等级
     * CRITICAL: probability * impact >= 20
     * HIGH: probability * impact >= 10
     * MEDIUM: probability * impact >= 4
     * LOW: probability * impact < 4
     */
    public static String calculateRiskLevel(Integer probability, Integer impact) {
        if (probability == null || impact == null) return "LOW";
        int score = probability * impact;
        if (score >= 20) return "CRITICAL";
        if (score >= 10) return "HIGH";
        if (score >= 4) return "MEDIUM";
        return "LOW";
    }
}
