package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 检验模板实体
 * 支持自定义检查项、检验周期配置
 */
@Data
@TableName("inspection_template")
public class InspectionTemplate {
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 模板名称
     */
    private String templateName;

    /**
     * 检验类型：ANNUAL/PERIODIC/SPECIAL
     */
    private String type;

    /**
     * 检验周期（月数）
     */
    private Integer frequency;

    /**
     * 检验周期（月数，frequency 的别名，用于验收标准兼容性）
     */
    public Integer getIntervalMonths() {
        return frequency;
    }

    public void setIntervalMonths(Integer intervalMonths) {
        this.frequency = intervalMonths;
    }

    /**
     * 适用的资产类别ID列表（JSON数组）
     * 示例：[1, 2, 3]
     */
    private String categoryIds;

    /**
     * 检查项（JSON数组）
     * 示例：["外观检查", "性能测试", "安全检查"]
     */
    private String checkItems;

    /**
     * 状态：ACTIVE/DISABLED
     */
    private String status;

    /**
     * 租户ID
     */
    private String tenantId;

    /**
     * 创建人ID
     */
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}