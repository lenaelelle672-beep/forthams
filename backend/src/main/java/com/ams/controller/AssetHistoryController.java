package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetHistoryEvent;
import com.ams.service.AssetHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 资产履历时间线控制器
 */
@RestController
@RequestMapping("/asset-history")
@RequiredArgsConstructor
public class AssetHistoryController {

    private final AssetHistoryService assetHistoryService;

    /**
     * 查询资产履历时间线（按资产 ID）
     * 支持可选的事件类型筛选和时间范围筛选
     *
     * @param assetId    资产 ID
     * @param eventTypes 可选的事件类型列表，逗号分隔（如：CHANGE_LOG,WORK_ORDER,MAINTENANCE）
     * @param startTime  开始时间（可选，ISO 日期时间格式）
     * @param endTime    结束时间（可选，ISO 日期时间格式）
     * @return 资产履历事件列表（按时间倒序）
     */
    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/{assetId}")
    public Result<List<AssetHistoryEvent>> getAssetTimeline(
            @PathVariable Long assetId,
            @RequestParam(required = false) String eventTypes,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        List<AssetHistoryEvent> events;
        
        // 如果有时间范围参数，优先使用时间范围查询
        if (startTime != null || endTime != null) {
            events = assetHistoryService.getHistoryByTimeRange(assetId, startTime, endTime);
            // 如果同时有事件类型筛选，再过滤事件类型
            if (eventTypes != null && !eventTypes.isEmpty()) {
                List<String> types = List.of(eventTypes.split(","));
                events = events.stream()
                        .filter(event -> types.contains(event.getEventType()))
                        .collect(java.util.stream.Collectors.toList());
            }
        } else {
            // 没有时间范围参数，根据事件类型筛选
            if (eventTypes != null && !eventTypes.isEmpty()) {
                List<String> types = List.of(eventTypes.split(","));
                events = assetHistoryService.getHistoryByTypes(assetId, types);
            } else {
                events = assetHistoryService.getFullHistory(assetId);
            }
        }
        
        return Result.success(events);
    }
}