package com.ams.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 审批流程创建时冻结的节点处理人快照。 */
@Data
@TableName("approval_node_assignment")
public class ApprovalNodeAssignment {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private Long processId;
    private Integer stepNo;
    private Long assigneeId;
    private String status;
    private Long workflowDefinitionId;
    private Integer workflowVersion;
    private LocalDateTime decidedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
