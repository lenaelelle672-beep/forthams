package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 待办响应 DTO
 */
@Data
public class TodoResponse {

    private Long id;

    /** 用户 ID */
    private Long userId;

    /** 标题 */
    private String title;

    /** 内容 */
    private String content;

    /** 引用类型 */
    private String refType;

    /** 引用 ID */
    private String refId;

    /** 优先级 */
    private String priority;

    /** 截止时间 */
    private LocalDateTime dueAt;

    /** 状态 */
    private String status;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 读取时间 */
    private LocalDateTime readAt;

    /** 完成时间 */
    private LocalDateTime completedAt;
}
