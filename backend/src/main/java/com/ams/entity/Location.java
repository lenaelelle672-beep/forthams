package com.ams.entity;

import lombok.Data;
import org.apache.ibatis.type.Alias;

@Data
@Alias("location")
public class Location {
    private Long id;
    private String name;
    private Long parentId; // Parent ID for hierarchical structure
}
