package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("floor_plan")
public class FloorPlan implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;
    private String building;
    private String floor;
    private String imageUrl;
    private Integer imageWidth;
    private Integer imageHeight;
    private String description;
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
