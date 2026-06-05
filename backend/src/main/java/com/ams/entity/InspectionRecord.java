package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 检验记录实体
 * 用于记录每次检验的执行情况、结果和附件
 */
@Data
@TableName("inspection_record")
public class InspectionRecord {
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 租户ID
     */
    private String tenantId;

    /**
     * 检验记录编号
     */
    private String recordNo;

    /**
     * 资产ID
     */
    private Long assetId;

    /**
     * 关联模板ID
     */
    private Long templateId;

    /**
     * 检验类型（ANNUAL/PERIODIC/SPECIAL）
     */
    private String inspectionType;

    /**
     * 检验日期
     */
    private LocalDate inspectionDate;

    /**
     * 下次检验日期
     */
    private LocalDate nextInspectionDate;

    /**
     * 检验结果（PASS/FAIL/CONDITIONAL/PENDING/OVERDUE）
     */
    private String result;

    /**
     * 检查结果（JSON数组）
     * 示例：[{"itemId":1,"result":"pass","notes":"正常","attachments":[]}]
     */
    private String checkResults;

    /**
     * 附件列表（JSON数组）
     */
    private String attachments;

    /**
     * 检验人ID
     */
    private Long inspectorId;

    /**
     * 检验人姓名
     */
    private String inspectorName;

    /**
     * 备注
     */
    private String notes;

    /**
     * 状态（pending/in_progress/completed/cancelled）
     */
    private String status;

    /**
     * 创建人ID
     */
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdTime;

    /**
     * 更新人ID
     */
    private Long updatedBy;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedTime;

    @TableLogic
    private Integer deleted;
}