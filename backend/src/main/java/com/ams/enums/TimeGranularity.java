package com.ams.enums;

/**
 * 操作日志仪表板趋势统计的时间粒度枚举。
 *
 * <p>对应 API 参数 granularity，取值范围为 daily / weekly / monthly。</p>
 *
 * <ul>
 *   <li>{@link #DAILY}  — 按天聚合，对应 SQL {@code DATE(created_at)}，日期标签格式 {@code yyyy-MM-dd}</li>
 *   <li>{@link #WEEKLY} — 按周聚合，对应 ISO 周，日期标签格式 {@code yyyy-'W'ww}</li>
 *   <li>{@link #MONTHLY} — 按月聚合，对应 SQL {@code DATE_FORMAT(created_at, '%Y-%m')}，日期标签格式 {@code yyyy-MM}</li>
 * </ul>
 */
public enum TimeGranularity {

    /**
     * 按天聚合 — period label 格式: "yyyy-MM-dd"
     */
    DAILY("daily"),

    /**
     * 按周聚合 — period label 格式: "yyyy-'W'ww"
     */
    WEEKLY("weekly"),

    /**
     * 按月聚合 — period label 格式: "yyyy-MM"
     */
    MONTHLY("monthly");

    /** 与 API 请求/响应中使用的字符串值（全小写） */
    private final String value;

    TimeGranularity(String value) {
        this.value = value;
    }

    /**
     * 获取与 API 对应的小写字符串值。
     *
     * @return 小写粒度标识，例如 "daily"、"weekly"、"monthly"
     */
    public String getValue() {
        return value;
    }

    /**
     * 从 API 字符串值解析为枚举实例。
     *
     * @param value 小写粒度字符串，例如 "daily"
     * @return 对应的 {@link TimeGranularity} 枚举
     * @throws IllegalArgumentException 如果传入值不是 daily / weekly / monthly
     */
    public static TimeGranularity fromValue(String value) {
        if (value == null) {
            throw new IllegalArgumentException("granularity must not be null");
        }
        for (TimeGranularity g : values()) {
            if (g.value.equalsIgnoreCase(value)) {
                return g;
            }
        }
        throw new IllegalArgumentException(
                "granularity must be one of: daily, weekly, monthly");
    }
}