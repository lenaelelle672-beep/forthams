package com.ams.dto.auditdashboard;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * 操作日志趋势统计请求参数 DTO。
 * <p>
 * 对应 SWARM-P1-005-BE 规格文档中趋势统计接口的参数定义，
 * 支持按天 (daily)、按周 (weekly)、按月 (monthly) 三种聚合粒度。
 * </p>
 *
 * @see com.ams.service.AuditDashboardService
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrendRequest {

    /**
     * 开始日期 (ISO-8601: yyyy-MM-dd)。
     * 默认值由 Service 层处理为最近 30 天。
     */
    @NotNull(message = "startDate must not be null")
    private LocalDate startDate;

    /**
     * 结束日期 (ISO-8601: yyyy-MM-dd)。
     * 默认值由 Service 层处理为当前日期。
     */
    @NotNull(message = "endDate must not be null")
    private LocalDate endDate;

    /**
     * 聚合粒度枚举，限定为 daily / weekly / monthly。
     * 使用枚举替代 SPEC 中的 String + @Pattern，提供编译期类型安全。
     */
    @NotNull(message = "granularity must not be null")
    private Granularity granularity;

    /**
     * 聚合粒度枚举定义。
     */
    public enum Granularity {
        /** 按天聚合 — 返回格式 "yyyy-MM-dd" */
        DAILY,
        /** 按周聚合 — 返回格式 "yyyy-'W'ww" */
        WEEKLY,
        /** 按月聚合 — 返回格式 "yyyy-MM" */
        MONTHLY;

        /**
         * 将字符串安全转换为 Granularity 枚举值（不区分大小写）。
         *
         * @param value 字符串值，如 "daily"
         * @return 对应的枚举值
         * @throws IllegalArgumentException 当值不匹配任何枚举常量时抛出
         */
        public static Granularity fromString(String value) {
            if (value == null) {
                throw new IllegalArgumentException("granularity must not be null");
            }
            return valueOf(value.toUpperCase());
        }
    }

    /**
     * Bean Validation 跨字段校验：开始日期必须早于或等于结束日期。
     * 当任一字段为 null 时跳过（由 {@code @NotNull} 单独处理）。
     *
     * @return true 表示日期范围合法
     */
    @AssertTrue(message = "startDate must be before or equal to endDate")
    public boolean isValidDateRange() {
        if (startDate == null || endDate == null) {
            return true;
        }
        return !startDate.isAfter(endDate);
    }

    /**
     * Bean Validation 跨字段校验：查询时间跨度不得超过 365 天。
     * <p>
     * 根据 ATB-004 验收标准，startDate=2025-01-01 &amp; endDate=2026-01-01
     * （恰好 365 天间隔）应判定为超出范围，因此采用严格小于 365 天的判定逻辑。
     * </p>
     *
     * @return true 表示时间跨度在允许范围内
     */
    @AssertTrue(message = "Date range must not exceed 365 days")
    public boolean isWithinOneYear() {
        if (startDate == null || endDate == null) {
            return true;
        }
        return startDate.plusDays(365).isAfter(endDate);
    }
}