package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Asset;
import com.ams.mapper.AssetMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/gis")
@RequiredArgsConstructor
public class GISController {

    private final AssetMapper assetMapper;

    /**
     * 获取带坐标的资产列表
     */
    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/assets")
    public Result<List<Asset>> getAssetsWithLocation(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long deptId,
            @RequestParam(required = false) String status) {
        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<>();
        wrapper.isNotNull(Asset::getLocationLat)
               .isNotNull(Asset::getLocationLng)
               .gt(Asset::getLocationLat, BigDecimal.ZERO);
        if (categoryId != null) wrapper.eq(Asset::getCategoryId, categoryId);
        if (deptId != null) wrapper.eq(Asset::getDeptId, deptId);
        if (status != null && !status.isBlank()) wrapper.eq(Asset::getStatus, status);
        return Result.success(assetMapper.selectList(wrapper));
    }

    /**
     * 更新资产坐标
     */
    @PreAuthorize("@ss.hasPermi('asset:edit')")
    @PutMapping("/assets/{id}/location")
    public Result<Void> updateLocation(@PathVariable Long id,
                                        @RequestBody Map<String, BigDecimal> location) {
        Asset asset = new Asset();
        asset.setId(id);
        asset.setLocationLat(location.get("lat"));
        asset.setLocationLng(location.get("lng"));
        assetMapper.updateById(asset);
        return Result.success();
    }

    /**
     * 获取资产分布统计（按分类/部门分组计数）
     */
    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/stats")
    public Result<Map<String, Object>> getStats() {
        List<Asset> assets = assetMapper.selectList(new LambdaQueryWrapper<Asset>()
                .isNotNull(Asset::getLocationLat)
                .gt(Asset::getLocationLat, BigDecimal.ZERO));
        Map<String, Long> byStatus = assets.stream()
                .filter(a -> a.getStatus() != null)
                .collect(Collectors.groupingBy(Asset::getStatus, Collectors.counting()));
        Map<String, Long> byCategory = assets.stream()
                .filter(a -> a.getCategoryId() != null)
                .collect(Collectors.groupingBy(a -> String.valueOf(a.getCategoryId()), Collectors.counting()));
        return Result.success(Map.of("total", assets.size(), "byStatus", byStatus, "byCategory", byCategory));
    }
}
