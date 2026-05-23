package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 系统配置 KV 实体
 *
 * <p>采用单表 KV + config_group 分区模式存储系统配置和安全配置。
 * config_group 字段区分 SystemConfig（系统配置）和 SecurityConfig（安全设置），
 * config_key / config_value 存储具体配置项。
 * 预留 tenant_id 列支持未来租户隔离。
 */
@Data
@TableName("sys_config")
public class SystemConfig implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 租户 ID（预留，当前为 'GLOBAL'） */
    private String tenantId;

    /** 配置分组：SYSTEM 或 SECURITY */
    private String configGroup;

    /** 配置键 */
    private String configKey;

    /** 配置值 */
    private String configValue;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
