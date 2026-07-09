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
@TableName("form_instance")
public class FormInstance implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String formKey;
    private Integer definitionVersion;
    private String businessKey;
    private String status;
    private String fieldSummary;
    private String attachmentSummary;
    private String auditSummary;
    private Long createdBy;
    private Long updatedBy;
    private Long archivedBy;
    private LocalDateTime archivedAt;
    private String archiveReason;
    private Long deletedBy;
    private LocalDateTime deletedAt;
    private String deleteReason;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    private Integer deleted;
}
