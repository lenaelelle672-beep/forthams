package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 资产履历事件 DTO — 统一多种来源事件的返回结构
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssetHistoryEvent {
    /** 事件类型: CHANGE_LOG / WORK_ORDER / MAINTENANCE / ASSIGNMENT / BORROW / INSPECTION / RETIREMENT / INVENTORY / INTAKE */
    private String eventType;

    /** 事件发生时间 */
    private LocalDateTime eventTime;

    /** 事件标题 */
    private String title;

    /** 事件描述 */
    private String description;

    /** 操作人 */
    private String operatorName;

    /** 关联记录ID */
    private Long refId;

    /** 关联记录类型 */
    private String refType;

    /** 前端跳转链接（可选） */
    private String linkUrl;

    /** 事件级别: INFO / WARNING / ERROR */
    @Builder.Default
    private String level = "INFO";
}
