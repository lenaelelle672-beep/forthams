package com.ams.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("system_config")
public class SystemConfig implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private String configGroup;
    private String configKey;
    private String configValue;
    private String configName;
    private String configType;
    private Integer status;
    private String remark;
    private Boolean sensitiveMasked;
    private Long lastOperatorId;
    private String lastOperation;
    private String lastOperationReason;
    private String auditEvidenceSummary;
    private Integer removed;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
