package com.ams.dto;

import lombok.Data;

@Data
public class FlowDesignerDraftDTO {
    private String name;
    private String description;
    private FlowDesignerGraphDTO graph;
    private Long operatorId;
}
