package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("asset_compensation")
public class AssetCompensation implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String compensationNo;
    private Long assetId;
    private String compensationType;
    private BigDecimal compensationAmount;
    private Long responsibleUserId;
    private Long responsibleDeptId;
    private LocalDate incidentDate;
    private String description;
    private String status;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
