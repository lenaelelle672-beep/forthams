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
@TableName("form_attachment")
public class FormAttachment implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long instanceId;
    private String formKey;
    private String fileName;
    private String contentType;
    private Long fileSize;
    private String referenceKey;
    private String storageRefHash;
    private String maskedStorageKey;
    private String maskedUrl;
    private String status;
    private String auditSummary;
    private Long createdBy;
    private Long deletedBy;
    private LocalDateTime deletedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    private Integer deleted;
}
