package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("budget")
public class Budget implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Integer budgetYear;
    private String tenantId;
    private Long deptId;
    private Long categoryId;
    private String budgetType;
    private BigDecimal totalAmount;
    private BigDecimal usedAmount;
    private BigDecimal committedAmount;
    private String status;
    private Long approvedBy;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
