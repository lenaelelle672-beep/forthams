package com.ams.dto;

import com.ams.entity.WorkflowEdge;
import com.ams.entity.WorkflowNode;
import lombok.Data;

import java.util.List;

@Data
public class WorkflowDesignerSaveDTO {
    private List<WorkflowNode> nodes;
    private List<WorkflowEdge> edges;
}
