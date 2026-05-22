package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.StatsResponse;
import com.ams.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 统计查询控制器
 *
 * <p>提供系统级别统计概览的 REST API。
 * <ul>
 *   <li>STAT-01: GET /api/stats/overview — 系统统计概览</li>
 * </ul>
 */
@RestController
@RequestMapping("/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    /**
     * STAT-01: 获取系统统计概览。
     *
     * <p>返回格式：
     * <pre>{@code
     * {
     *   "code": 200,
     *   "data": {
     *     "totalUsers": 0,
     *     "totalAssets": 0,
     *     "pendingActions": 0,
     *     "lastUpdated": "2026-04-01T12:00:00Z"
     *   }
     * }</pre>
     *
     * @return 系统统计概览数据
     */
    @GetMapping("/overview")
    public Result<StatsResponse> getOverview() {
        return Result.success(statsService.getOverview());
    }
}
