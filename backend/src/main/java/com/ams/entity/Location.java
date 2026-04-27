package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import org.apache.ibatis.type.Alias;

@Data
@Alias("location")
@TableName("location")
public class Location {
    @TableId(type = IdType.AUTO)
    private Long id;
    @TableField("location_name")
    private String name;
    @TableField("parent_id")
    private Long parentId;
}
