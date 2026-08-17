package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.GisLocationUpdateRequest;
import com.ams.entity.Asset;
import com.ams.entity.Location;
import com.ams.enums.AssetStatus;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.LocationMapper;
import com.ams.service.AssetDataPermissionEvaluator;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/gis")
@RequiredArgsConstructor
public class GISController {

    private static final Logger log = LoggerFactory.getLogger(GISController.class);
    private static final int MAX_GIS_RESULTS = 500;
    private final AssetMapper assetMapper;
    private final LocationMapper locationMapper;
    private final AssetDataPermissionEvaluator assetDataPermissionEvaluator;

    @GetMapping("/assets")
    public Result<List<Asset>> getAssetsWithLocation(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long deptId,
            @RequestParam(required = false) AssetStatus status,
            @RequestParam(required = false) Long locationId,
            Authentication authentication) {
        requirePermission(authentication, "asset:query");

        LambdaQueryWrapper<Asset> wrapper = geolocatedAssets(TenantContext.requireTenantId());
        assetDataPermissionEvaluator.applyTo(wrapper);
        if (categoryId != null) {
            wrapper.eq(Asset::getCategoryId, categoryId);
        }
        if (deptId != null) {
            wrapper.eq(Asset::getDeptId, deptId);
        }
        if (status != null) {
            wrapper.eq(Asset::getStatus, status.name());
        }
        if (locationId != null) {
            List<Long> locationIds = locationMapper.findDescendants(locationId).stream()
                    .map(Location::getId)
                    .toList();
            if (locationIds.isEmpty()) {
                return Result.success(List.of());
            }
            wrapper.in(Asset::getLocationId, locationIds);
        }

        return Result.success(assetMapper.selectList(wrapper.orderByDesc(Asset::getUpdateTime)
                .last("limit " + MAX_GIS_RESULTS)));
    }

    @GetMapping("/stats")
    public Result<Map<String, Object>> getStats(Authentication authentication) {
        requirePermission(authentication, "asset:query");

        LambdaQueryWrapper<Asset> wrapper = geolocatedAssets(TenantContext.requireTenantId());
        assetDataPermissionEvaluator.applyTo(wrapper);
        List<Asset> assets = assetMapper.selectList(wrapper.last("limit " + MAX_GIS_RESULTS));
        Map<String, Long> byStatus = assets.stream()
                .filter(asset -> asset.getStatus() != null)
                .collect(java.util.stream.Collectors.groupingBy(Asset::getStatus, java.util.stream.Collectors.counting()));
        Map<String, Long> byCategory = assets.stream()
                .filter(asset -> asset.getCategoryId() != null)
                .collect(java.util.stream.Collectors.groupingBy(
                        asset -> String.valueOf(asset.getCategoryId()),
                        java.util.stream.Collectors.counting()));

        return Result.success(Map.of(
                "total", assets.size(),
                "byStatus", byStatus,
                "byCategory", byCategory,
                "capped", true));
    }

    @PutMapping("/assets/{id}/location")
    public Result<Void> updateLocation(
            @PathVariable Long id,
            @Valid @RequestBody GisLocationUpdateRequest request,
            Authentication authentication) {
        requirePermission(authentication, "asset:update");
        String tenantId = TenantContext.requireTenantId();

        Asset current = assetMapper.selectOne(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, id)
                .eq(Asset::getTenantId, tenantId));
        if (current == null) {
            assertSameTenantOrMissing(id, tenantId);
        }
        assetDataPermissionEvaluator.assertCanWrite(current);

        Asset asset = new Asset();
        asset.setLocationLat(request.getLat());
        asset.setLocationLng(request.getLng());
        asset.setVersion(versionOf(current.getVersion()) + 1);
        LambdaQueryWrapper<Asset> updateWrapper = new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, id)
                .eq(Asset::getTenantId, tenantId)
                .eq(Asset::getStatus, current.getStatus())
                .eq(Asset::getVersion, versionOf(current.getVersion()));
        assetDataPermissionEvaluator.applyTo(updateWrapper);
        int updated = assetMapper.update(asset, updateWrapper);
        if (updated == 0) {
            throw new AccessDeniedException("资产数据权限拒绝：资产已变更或不在当前数据范围内");
        }
        return Result.success();
    }

    private LambdaQueryWrapper<Asset> geolocatedAssets(String tenantId) {
        return new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .isNotNull(Asset::getLocationLat)
                .isNotNull(Asset::getLocationLng)
                .ge(Asset::getLocationLat, -90)
                .le(Asset::getLocationLat, 90)
                .ge(Asset::getLocationLng, -180)
                .le(Asset::getLocationLng, 180);
    }

    private void requirePermission(Authentication authentication, String permission) {
        boolean allowed = authentication != null && authentication.getAuthorities().stream()
                .map(grantedAuthority -> grantedAuthority.getAuthority())
                .anyMatch(permission::equals);
        if (!allowed) {
            throw new AccessDeniedException("缺少权限: " + permission);
        }
    }

    private void assertSameTenantOrMissing(Long id, String tenantId) {
        Asset existing = assetMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException(404, "资产不存在");
        }
        TenantSecurityAudit.logCrossTenantAttempt(log, "updateGisLocation", id, tenantId, existing.getTenantId());
        throw new AccessDeniedException("无权修改其他租户资产");
    }

    private int versionOf(Integer version) {
        return version == null ? 0 : version;
    }
}
