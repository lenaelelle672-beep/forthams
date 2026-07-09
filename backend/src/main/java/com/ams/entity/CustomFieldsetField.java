package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("custom_fieldset_field")
public class CustomFieldsetField {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long fieldsetId;
    private Long fieldId;
    private Integer fieldOrder;
    private Integer status;
    private LocalDateTime createTime;
}
