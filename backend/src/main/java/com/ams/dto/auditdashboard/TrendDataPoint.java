package com.ams.dto.auditdashboard;

/**
 * 操作日志趋势统计数据点 DTO。
 * <p>
 * 对应规格要求：API 响应字段使用 camelCase。
 * 日期格式取决于 granularity 参数：
 * <ul>
 *   <li>daily → "yyyy-MM-dd"（例："2025-01-01"）</li>
 *   <li>weekly → "yyyy-'W'ww"（例："2025-W02"）</li>
 *   <li>monthly → "yyyy-MM"（例："2025-01"）</li>
 * </ul>
 */
public record TrendDataPoint(
    String date,
    Long count
) {
    /**
     * 紧凑构造函数：校验数据点合法性。
     *
     * @throws IllegalArgumentException 当 date 为 null/空 或 count 为负数时
     */
    public TrendDataPoint {
        if (date == null || date.isBlank()) {
            throw new IllegalArgumentException("date must not be null or blank");
        }
        if (count != null && count < 0) {
            throw new IllegalArgumentException("count must not be negative");
        }
    }

    /**
     * 静态工厂方法：从数据库查询结果构建数据点，
     * 自动将 null count 转换为 0。
     *
     * @param date  日期或时间周期标识
     * @param count 该时段内的操作日志数量（可为 null，默认 0）
     * @return 构建完成的 TrendDataPoint 实例
     */
    public static TrendDataPoint from(String date, Long count) {
        return new TrendDataPoint(date, count == null ? 0L : count);
    }
}