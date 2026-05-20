package com.ams.service;

import com.ams.dto.StatsResponse;
import com.ams.entity.Asset;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.UserMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * 统计服务
 *
 * <p>提供系统级别的统计概览查询能力。
 * 当 UserMapper 或 AssetMapper 不可用时，对应指标返回零值以保证系统可用性。
 */
@Slf4j
@Service
public class StatsService {

    @Autowired(required = false)
    private UserMapper userMapper;

    @Autowired(required = false)
    private AssetMapper assetMapper;

    /**
     * 获取系统统计概览。
     *
     * <p>统计指标包括：
     * <ul>
     *   <li>totalUsers — 用户总数</li>
     *   <li>totalAssets — 资产总数</li>
     *   <li>pendingActions — 待处理操作数（status = PENDING_APPROVAL）</li>
     *   <li>lastUpdated — ISO-8601 时间戳</li>
     * </ul>
     *
     * @return StatsResponse 统计数据
     */
    public StatsResponse getOverview() {
        StatsResponse response = StatsResponse.zeroed();

        try {
            if (userMapper != null) {
                response.setTotalUsers(userMapper.selectCount(null));
            } else {
                log.warn("UserMapper not available, returning zero for totalUsers");
            }
        } catch (Exception e) {
            log.error("Failed to query user count", e);
        }

        try {
            if (assetMapper != null) {
                response.setTotalAssets(assetMapper.selectCount(null));

                QueryWrapper<Asset> pendingWrapper = new QueryWrapper<>();
                pendingWrapper.eq("status", "PENDING_APPROVAL");
                response.setPendingActions(assetMapper.selectCount(pendingWrapper));
            } else {
                log.warn("AssetMapper not available, returning zero for totalAssets and pendingActions");
            }
        } catch (Exception e) {
            log.error("Failed to query asset counts", e);
        }

        response.setLastUpdated(Instant.now().toString());
        return response;
    }
}
