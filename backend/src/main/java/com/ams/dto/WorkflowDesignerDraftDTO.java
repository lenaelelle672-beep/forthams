package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

/** 仅供流程设计器读取和编辑的草稿，不代表运行时已发布定义。 */
@Data
public class WorkflowDesignerDraftDTO {
    private Long id;
    private String businessType;
    private String name;
    private String description;
    private Map<String, Object> definition;
    private String status;
    private Integer version;
    /** 草稿 CAS revision；没有草稿编辑基线时为 null，不能以 0 绕过创建检测。 */
    private Integer revision;
    private Long updatedBy;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private Long publishedDefinitionId;
    private Integer publishedVersion;
    private String publishedStatus;
    private LocalDateTime publishedAt;
}
