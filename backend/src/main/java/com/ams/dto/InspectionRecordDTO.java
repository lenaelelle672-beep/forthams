package com.ams.dto;

import lombok.Data;

import java.time.LocalDate;

/**
 * 检验记录传输对象
 */
@Data
public class InspectionRecordDTO {

    /**
     * 记录ID
     */
    private Long id;

    /**
     * 记录编号
     */
    private String recordNo;

    /**
     * 资产ID
     */
    private Long assetId;

    /**
     * 资产名称（关联查询）
     */
    private String assetName;

    /**
     * 模板ID
     */
    private Long templateId;

    /**
     * 模板名称（关联查询）
     */
    private String templateName;

    /**
     * 检验类型
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
     * 检验结果
     */
    private String result;

    /**
     * 检查结果
     */
    private String checkResults;

    /**
     * 附件列表
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
     * 状态
     */
    private String status;

    /**
     * 租户ID
     */
    private String tenantId;
}