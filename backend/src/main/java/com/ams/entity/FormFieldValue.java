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
@TableName("form_field_value")
public class FormFieldValue implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long instanceId;
    private String formKey;
    private String fieldKey;
    private String fieldLabel;
    private String valueType;
    private String valueText;
    private String valueJson;
    private Boolean sensitive;
    private String maskedValue;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
