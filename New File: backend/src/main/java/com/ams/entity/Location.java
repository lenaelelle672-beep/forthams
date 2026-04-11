package com.ams.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("location")
public class Location {
    private Long id;
    private String name;
    private Long parentId;
}
