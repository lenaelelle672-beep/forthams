package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * 统计概览响应 DTO
 *
 * <p>封装 /api/stats/overview 接口的返回数据。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StatsResponse {

    /** 用户总数 */
    private long totalUsers;

    /** 资产总数 */
    private long totalAssets;

    /** 待处理操作数 */
    private long pendingActions;

    /** 最后更新时间（ISO-8601） */
    private String lastUpdated;

    public static StatsResponse zeroed() {
        StatsResponse resp = new StatsResponse();
        resp.setTotalUsers(0);
        resp.setTotalAssets(0);
        resp.setPendingActions(0);
        resp.setLastUpdated(Instant.now().toString());
        return resp;
    }
}
