package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 系统待办实体
 */
@Data
@TableName("sys_todo")
public class SysTodo implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 用户 ID */
    private Long userId;

    /** 标题 */
    private String title;

    /** 内容 */
    private String content;

    /** 引用类型（如 APPROVAL_PROCESS） */
    private String refType;

    /** 引用 ID */
    private String refId;

    /** 优先级：LOW / MEDIUM / HIGH */
    private String priority;

    /** 截止时间 */
    private LocalDateTime dueAt;

    /** 状态：PENDING / READ / COMPLETED */
    private String status;

    /** 租户 ID */
    private String tenantId;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 读取时间 */
    private LocalDateTime readAt;

    /** 完成时间 */
    private LocalDateTime completedAt;
}
