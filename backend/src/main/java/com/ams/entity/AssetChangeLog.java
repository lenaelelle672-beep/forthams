package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("asset_change_log")
public class AssetChangeLog implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long assetId;
    private String changeType;
    private String oldValue;
    private String newValue;
    private String reason;
    private Long operatorId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
