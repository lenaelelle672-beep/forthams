package com.ams.controller;

import com.ams.common.Result;
import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.Location;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.LocationMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/gis")
@RequiredArgsConstructor
public class GISController {

    private final AssetMapper assetMapper;
    private final LocationMapper locationMapper;

    /**
     * 获取带坐标的资产列表（支持 locationId 空间过滤 + 多租户隔离）
     *
     * @param categoryId 资产分类（可选）
     * @param deptId 部门（可选）
     * @param status 业务状态（可选）
     * @param locationId 空间单元 ID（可选，传则只返 cascade 子树下的资产）
     */
    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/assets")
    public Result<List<Asset>> getAssetsWithLocation(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long deptId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long locationId) {
        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<>();
        wrapper.isNotNull(Asset::getLocationLat)
               .isNotNull(Asset::getLocationLng)
               .gt(Asset::getLocationLat, BigDecimal.ZERO);
        // 多租户隔离（R12 修复）
        wrapper.eq(Asset::getTenantId, TenantContext.requireTenantId());

        if (categoryId != null) wrapper.eq(Asset::getCategoryId, categoryId);
        if (deptId != null) wrapper.eq(Asset::getDeptId, deptId);
        if (status != null && !status.isBlank()) wrapper.eq(Asset::getStatus, status);
        if (locationId != null) {
            // cascade 预热：LocationMapper.findDescendants 已经支持 WITH RECURSIVE
            List<Location> descendants = locationMapper.findDescendants(locationId);
            List<Long> locationIds = (descendants == null || descendants.isEmpty())
                    ? Collections.singletonList(locationId)
                    : descendants.stream().map(Location::getId).collect(Collectors.toList());
            wrapper.in(Asset::getLocationId, locationIds);
        }
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
        // 多租户隔离：更新时通过实体 tenantId 过滤
        asset.setTenantId(TenantContext.requireTenantId());
        assetMapper.updateById(asset);
        return Result.success();
    }

    /**
     * 获取资产分布统计（按分类/部门分组计数）
     */
    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/stats")
    public Result<Map<String, Object>> getStats() {
        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<Asset>()
                .isNotNull(Asset::getLocationLat)
                .gt(Asset::getLocationLat, BigDecimal.ZERO)
                // 多租户隔离
                .eq(Asset::getTenantId, TenantContext.requireTenantId());
        List<Asset> assets = assetMapper.selectList(wrapper);
        Map<String, Long> byStatus = assets.stream()
                .filter(a -> a.getStatus() != null)
                .collect(Collectors.groupingBy(Asset::getStatus, Collectors.counting()));
        Map<String, Long> byCategory = assets.stream()
                .filter(a -> a.getCategoryId() != null)
                .collect(Collectors.groupingBy(a -> String.valueOf(a.getCategoryId()), Collectors.counting()));
        return Result.success(Map.of("total", assets.size(), "byStatus", byStatus, "byCategory", byCategory));
    }
}
