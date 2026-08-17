package com.ams.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("disposal_application")
public class DisposalApplication {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private String applicationNo;
    private Long assetId;
    private String disposalType;
    private Long targetDeptId;
    private Long targetUserId;
    private String targetLocation;
    private String reason;
    private Long applicantId;
    private String status;
    private Integer version;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

    @TableField(exist = false)
    private String assetNo;

    @TableField(exist = false)
    private String assetName;

    @TableField(exist = false)
    private String applicantName;
}
