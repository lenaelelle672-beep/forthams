package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("approval_record")
public class ApprovalRecord implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long processId;
    private Integer stepNo;
    private Long approverId;
    private String approveResult;
    private String approveOpinion;
    private LocalDateTime approveTime;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
