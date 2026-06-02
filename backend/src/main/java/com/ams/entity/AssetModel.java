package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("asset_model")
public class AssetModel implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;
    private String modelNo;
    private Long categoryId;
    private Long manufacturerId;
    private Long fieldsetId;
    private String specifications;
    private String description;

    private Integer status;
    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
