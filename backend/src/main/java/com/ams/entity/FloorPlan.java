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

    private String tenantId;

    private String name;
    private String building;
    private String floor;
    private String imageUrl;
    private Integer imageWidth;
    private Integer imageHeight;
    private String description;
    private Long createdBy;

    /**
     * 关联 Location.id（gai2 W8 — FloorPlan locationId FK 关联 Location.id）。
     * 替代/补充 building/floor 字符串匹配；W9 V3_20 migration 添加列 + 索引。
     * building/floor 字符串保留作为冗余展示。
     */
    @TableField("location_id")
    private Long locationId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
