package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("custom_fieldset")
public class CustomFieldset {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String name;
    private String description;
    private Long categoryId;
    private Integer sortOrder;
    private Integer status;
    private String createBy;
    private LocalDateTime createTime;
    private String updateBy;
    private LocalDateTime updateTime;
    private Integer fieldCount;
}
