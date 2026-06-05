package com.ams.service;

import com.ams.dto.AssetHistoryEvent;

import java.time.LocalDateTime;
import java.util.List;

public interface AssetHistoryService {
    /**
     * 获取资产完整履历，聚合多来源事件，按时间降序排列
     */
    List<AssetHistoryEvent> getFullHistory(Long assetId);

    /**
     * 按事件类型筛选资产履历
     */
    List<AssetHistoryEvent> getHistoryByTypes(Long assetId, List<String> eventTypes);

    /**
     * 按时间范围筛选资产履历
     *
     * @param assetId   资产 ID
     * @param startTime 开始时间（可选，包含）
     * @param endTime   结束时间（可选，包含）
     * @return 资产履历事件列表（按时间倒序）
     */
    List<AssetHistoryEvent> getHistoryByTimeRange(Long assetId, LocalDateTime startTime, LocalDateTime endTime);
}
