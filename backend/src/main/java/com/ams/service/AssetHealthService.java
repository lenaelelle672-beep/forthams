package com.ams.service;

import com.ams.dto.AssetHealthVO;

import java.util.List;

public interface AssetHealthService {
    /**
     * 计算单资产健康评分
     */
    AssetHealthVO calculateHealth(Long assetId);

    /**
     * 批量计算资产健康评分
     */
    List<AssetHealthVO> batchCalculateHealth(List<Long> assetIds);

    /**
     * 获取不健康资产Top N
     */
    List<AssetHealthVO> getUnhealthyAssets(int topN, int minScore);
}
