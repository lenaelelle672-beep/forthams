package com.ams.dto;

import lombok.Data;

@Data
public class FlowDesignerDraftDTO {
    private String name;
    private String description;
    private FlowDesignerGraphDTO graph;
    /** null 仅表示客户端确认当前不存在草稿；已有草稿必须携带其精确 revision。 */
    private Integer expectedRevision;
    private Long operatorId;
}
