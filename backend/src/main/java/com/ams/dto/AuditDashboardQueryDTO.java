package com.ams.dto;

import lombok.*;

import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

/**
 * 审计仪表板查询参数 DTO。
 * 用于趋势统计接口和操作人排行榜接口的公共查询参数封装。
 *
 * <p>参数校验规则（由 Service 层执行）：
 * <ul>
 *   <li>趋势统计接口：startDate、endDate 必填，startDate 必须早于 endDate</li>
 *   <li>日期范围不得超过 365 天</li>
 *   <li>granularity 必须为 daily、weekly 或 monthly 之一</li>
 *   <li>操作人排行榜接口：startDate、endDate 可选，用于过滤时间范围</li>
 * </ul>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditDashboardQueryDTO {

    /**
     * 查询开始日期。
     * 趋势统计接口必填，操作人排行榜接口可选。
     */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate startDate;

    /**
     * 查询结束日期。
     * 趋势统计接口必填，操作人排行榜接口可选。
     */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate endDate;

    /**
     * 时间聚合粒度，仅用于趋势统计接口。
     * 可选值: daily, weekly, monthly
     * 默认值: daily
     */
    @Builder.Default
    private String granularity = "daily";

}