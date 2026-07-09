package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("custom_field")
public class CustomField {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String fieldName;
    private String fieldLabel;
    private String fieldType;
    private String fieldOptions;
    private String validationPattern;
    private Integer fieldOrder;
    private Integer required;
    private Integer encrypted;
    private Integer status;
    private String createBy;
    private LocalDateTime createTime;
    private String updateBy;
    private LocalDateTime updateTime;
}
