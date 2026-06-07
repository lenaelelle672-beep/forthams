package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 待办创建请求 DTO
 */
@Data
public class TodoCreateRequest {

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
}
