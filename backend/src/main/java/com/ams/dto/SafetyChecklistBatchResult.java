package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 批量操作结果（BatchResult）
 *
 * <p>用途：
 * 记录批量操作的成功/失败统计，返回详细的失败信息和结果列表。
 *
 * <p>字段说明：
 * - successCount：成功数量
 * - failCount：失败数量
 * - failedAssetIds：失败的资产ID列表（用于重试）
 * - results：所有执行结果（按 assetId 映射）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SafetyChecklistBatchResult {
    /**
     * 成功数量
     */
    private int successCount;

    /**
     * 失败数量
     */
    private int failCount;

    /**
     * 失败的资产ID列表（可选，用于重试）
     */
    private java.util.List<Long> failedAssetIds;

    /**
     * 所有执行结果（按 assetId 映射，可选）
     * Key: assetId, Value: 执行结果对象
     */
    private Map<Long, com.ams.entity.SafetyChecklistExecution> results;

    /**
     * 获取总数量
     */
    public int getTotalCount() {
        return successCount + failCount;
    }

    /**
     * 是否全部成功
     */
    public boolean isAllSuccess() {
        return failCount == 0;
    }
}