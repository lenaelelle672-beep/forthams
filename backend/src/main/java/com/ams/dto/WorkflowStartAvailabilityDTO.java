package com.ams.dto;

import lombok.Data;

/**
 * 流程发起可用性。
 *
 * <p>用于 /workflow-runtime/{businessType}/start-availability，回答"某业务类型当前能否发起流程"。
 * 判定基于流程定义状态：只有 PUBLISHED 状态才允许发起；UNCONFIGURED/DRAFT/DISABLED 一律阻断。
 * 这是只读查询，不修改任何流程定义或运行实例。</p>
 */
@Data
public class WorkflowStartAvailabilityDTO {
    private String businessType;
    private boolean canStart;
    private String status;
    private Integer version;
    private Long definitionId;
    private String entryUrl;
    private String blockReason;

    public static WorkflowStartAvailabilityDTO block(String businessType, String status, Integer version,
                                                      Long definitionId, String blockReason) {
        WorkflowStartAvailabilityDTO dto = new WorkflowStartAvailabilityDTO();
        dto.setBusinessType(businessType);
        dto.setCanStart(false);
        dto.setStatus(status == null ? "UNCONFIGURED" : status);
        dto.setVersion(version == null ? 0 : version);
        dto.setDefinitionId(definitionId);
        dto.setEntryUrl("");
        dto.setBlockReason(blockReason);
        return dto;
    }

    public static WorkflowStartAvailabilityDTO allow(String businessType, Integer version, Long definitionId) {
        WorkflowStartAvailabilityDTO dto = new WorkflowStartAvailabilityDTO();
        dto.setBusinessType(businessType);
        dto.setCanStart(true);
        dto.setStatus("PUBLISHED");
        dto.setVersion(version == null ? 0 : version);
        dto.setDefinitionId(definitionId);
        dto.setEntryUrl("/fixed-assets/workbench?menu=system-flow-definition");
        dto.setBlockReason("");
        return dto;
    }
}
