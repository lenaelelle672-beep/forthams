package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("form_definition_version")
public class FormDefinitionVersion implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long definitionId;
    private String formKey;
    private Integer version;
    private String actionType;
    private String status;
    private String name;
    private String description;
    private String schemaJson;
    private String auditReason;
    private String impactScope;
    private String rollbackPlan;
    private Integer rollbackSourceVersion;
    private Long operatorId;
    private LocalDateTime publishedAt;
    private LocalDateTime createTime;
}
