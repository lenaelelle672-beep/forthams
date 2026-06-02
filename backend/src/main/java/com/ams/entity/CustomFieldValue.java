package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("sys_custom_field_value")
public class CustomFieldValue implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long assetId;
    private Long fieldId;
    private String fieldValue;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
