package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("workflow_node")
public class WorkflowNode implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long definitionId;

    private String nodeId;

    private String nodeName;

    private String nodeType;

    private String assigneeType;

    private String assigneeValue;

    private BigDecimal positionX;

    private BigDecimal positionY;

    private String config;

    private Integer sortOrder;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
