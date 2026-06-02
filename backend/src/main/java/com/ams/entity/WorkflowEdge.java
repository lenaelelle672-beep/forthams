package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("workflow_edge")
public class WorkflowEdge implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long definitionId;

    private String edgeId;

    private String sourceNodeId;

    private String targetNodeId;

    private String conditionExpr;

    private String label;

    private Integer sortOrder;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
