package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 风险矩阵配置实体
 * 用于管理风险评估的概率维度、严重度维度和等级映射规则
 */
@Data
@TableName("risk_matrix")
public class RiskMatrix {
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 矩阵名称
     */
    private String matrixName;

    /**
     * 概率维度配置 JSON
     * 格式: [{"value":1,"label":"极低"},{"value":2,"label":"较低"},...]
     */
    private String probabilityDimension;

    /**
     * 严重度维度配置 JSON
     * 格式: [{"value":1,"label":"轻微"},{"value":2,"label":"一般"},...]
     */
    private String severityDimension;

    /**
     * 风险等级映射规则 JSON
     * 格式: [{"minScore":20,"level":"CRITICAL"},{"minScore":10,"level":"HIGH"},...]
     */
    private String levelMapping;

    /**
     * 是否启用：0禁用/1启用
     */
    private Integer isActive;

    /**
     * 租户ID
     */
    private String tenantId;

    /**
     * 创建人ID
     */
    private Long createBy;

    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /**
     * 软删除标记
     */
    @TableLogic
    private Integer deleted;
}