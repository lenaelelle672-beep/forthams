package com.ams.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("workflow_definition_version")
public class WorkflowDefinitionVersion implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private Long definitionId;
    private String businessType;
    private Integer version;
    private String actionType;
    private String status;
    private String name;
    private String description;
    private String definitionJson;
    private String publishNote;
    private String impactScope;
    private String rollbackPlan;
    private Long rollbackSourceVersion;
    private Long operatorId;
    private LocalDateTime publishedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
