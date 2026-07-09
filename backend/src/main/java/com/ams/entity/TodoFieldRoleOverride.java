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
@TableName("todo_field_role_override")
public class TodoFieldRoleOverride implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String roleCode;
    private String fieldKey;
    private Boolean overrideVisible;
    private Integer overrideSortOrder;
    private String explanation;
    private String auditSummary;
    private Long updatedBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    private Integer deleted;
}
