package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("sys_custom_field")
public class CustomField implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String fieldName;
    private String fieldLabel;
    private String fieldType;
    private String fieldOptions;
    private String validationPattern;
    private Integer fieldOrder;
    private Integer required;
    private Integer encrypted;
    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
