package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("approval_process")
public class ApprovalProcess implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String processNo;
    private String processType;
    private Long businessId;
    private String businessData;
    private String status;
    private Integer currentStep;
    private Long applicantId;
    private LocalDateTime applyTime;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
