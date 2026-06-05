package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("stocktaking_task")
public class StocktakingTask implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long cycleId;

    private Long assetId;

    private Long locationId;

    private Integer actualQuantity;

    private Integer expectedQuantity;

    private Integer variance;

    /** 状态: PENDING-待盘点, COUNTED-已盘点, ADJUSTED-已调整 */
    private String status;

    private Long countedBy;

    private LocalDateTime countTime;

    private String photoUrl;

    private String tenantId;

    private String createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

}