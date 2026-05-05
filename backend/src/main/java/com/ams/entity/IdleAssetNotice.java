package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("idle_asset_notice")
public class IdleAssetNotice implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private Long assetId;
    private Integer idleDays;
    private LocalDate noticeDate;
    private String status;
    private Long claimantId;
    private LocalDate claimDate;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
