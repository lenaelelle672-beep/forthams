package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 操作趋势统计响应 DTO。
 * <p>
 * 对应审计仪表板趋势统计接口（按天 / 周 / 月聚合）的返回结构。
 * 无数据时 {@code data} 返回空列表 {@code []}，禁止返回 {@code null}。
 *
 * @see DataPoint
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuditTrendResp {

    /** 聚合粒度：daily / weekly / monthly */
    private String granularity;

    /** 查询起始日期 */
    private LocalDate startDate;

    /** 查询结束日期 */
    private LocalDate endDate;

    /** 时序数据点列表，无数据时返回空列表 */
    @Builder.Default
    private List<DataPoint> data = new ArrayList<>();

    /**
     * 趋势数据点，包含时段标签和操作计数。
     * <p>
     * {@code date} 格式因 {@code granularity} 而异：
     * <ul>
     *   <li>daily → {@code "yyyy-MM-dd"}（如 {@code "2025-01-01"}）</li>
     *   <li>weekly → {@code "yyyy-'W'ww"}（如 {@code "2025-W02"}）</li>
     *   <li>monthly → {@code "yyyy-MM"}（如 {@code "2025-01"}）</li>
     * </ul>
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DataPoint {

        /** 时段标签，格式取决于聚合粒度 */
        private String date;

        /** 该时段内的操作次数 */
        private Long count;
    }
}