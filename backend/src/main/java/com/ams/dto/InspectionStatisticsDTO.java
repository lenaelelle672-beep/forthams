package com.ams.dto;

import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 检验统计传输对象
 */
@Data
public class InspectionStatisticsDTO {

    /**
     * 统计时间范围
     */
    private String dateRange;

    /**
     * 总检验数
     */
    private Long totalCount;

    /**
     * 通过数
     */
    private Long passCount;

    /**
     * 不通过数
     */
    private Long failCount;

    /**
     * 待检验数
     */
    private Long pendingCount;

    /**
     * 开始日期
     */
    private LocalDate startDate;

    /**
     * 结束日期
     */
    private LocalDate endDate;

    /**
     * 已完成数
     */
    private Long completedCount;

    /**
     * 超期数
     */
    private Long overdueCount;

    /**
     * 完成率
     */
    private Double completionRate;

    /**
     * 超期率
     */
    private Double overdueRate;

    /**
     * 通过率
     */
    private Double passRate;

    /**
     * 按检验类型统计
     */
    private List<Map<String, Object>> statisticsByType;

    /**
     * 按资产分类统计
     */
    private List<Map<String, Object>> statisticsByCategory;
}