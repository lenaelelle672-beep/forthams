package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("stocktaking_cycle")
public class StocktakingCycle implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String cycleName;

    /** 盘点类型: FULL-全盘点, ABC-ABC分类盘点, PARTIAL-部分盘点 */
    private String cycleType;

    private LocalDateTime startDate;

    private LocalDateTime endDate;

    /** 状态: PLANNED-已计划, IN_PROGRESS-进行中, PAUSED-已暂停, COMPLETED-已完成, CANCELLED-已取消 */
    private String status;

    private Long creatorId;

    private String tenantId;

    private String createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

}