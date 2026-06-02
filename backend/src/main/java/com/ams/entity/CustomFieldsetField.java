package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;

@Data
@TableName("sys_custom_fieldset_field")
public class CustomFieldsetField implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long fieldsetId;
    private Long fieldId;
    private Integer fieldOrder;
}
