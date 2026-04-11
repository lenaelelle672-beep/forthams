package com.ams.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.List;

@Data
@TableName("location")
public class Location {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private Long parentId;
    private Long id;
    private String name;
    private Long parentId;
    private List<Location> children;
}
