package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("location")
public class Location {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("location_name")
    private String name;

    private String locationCode;

    @TableField("parent_id")
    private Long parentId;

    private Integer sortOrder;

    private String description;

    private Integer status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    private Integer deleted;
}