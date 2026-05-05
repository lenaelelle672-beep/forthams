package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AssetCreateDTO;
import com.ams.dto.AssetQueryDTO;
import com.ams.dto.AssetUpdateDTO;
import com.ams.entity.Asset;
import com.ams.enums.AssetStatus;
import com.ams.mapper.AssetMapper;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AssetService {

    private static final Logger log = LoggerFactory.getLogger(AssetService.class);

    private final AssetMapper assetMapper;
    private final AssetLifecycleService assetLifecycleService;

    public Page<Asset> queryAssets(AssetQueryDTO queryDTO) {
        String tenantId = TenantContext.requireTenantId();
        Page<Asset> page = new Page<>(queryDTO.getPage(), queryDTO.getPageSize());

        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId);

        if (queryDTO.getKeyword() != null && !queryDTO.getKeyword().isBlank()) {
            wrapper.and(w -> w.like(Asset::getAssetNo, queryDTO.getKeyword())
                    .or()
                    .like(Asset::getAssetName, queryDTO.getKeyword()));
        }
        
        if (queryDTO.getAssetNo() != null && !queryDTO.getAssetNo().isEmpty()) {
            wrapper.like(Asset::getAssetNo, queryDTO.getAssetNo());
        }
        if (queryDTO.getAssetName() != null && !queryDTO.getAssetName().isEmpty()) {
            wrapper.like(Asset::getAssetName, queryDTO.getAssetName());
        }
        if (queryDTO.getCategoryId() != null) {
            wrapper.eq(Asset::getCategoryId, queryDTO.getCategoryId());
        }
        if (queryDTO.getStatus() != null && !queryDTO.getStatus().isEmpty()) {
            wrapper.eq(Asset::getStatus, parseStatus(queryDTO.getStatus()).name());
        }
        if (queryDTO.getDeptId() != null) {
            wrapper.eq(Asset::getDeptId, queryDTO.getDeptId());
        }
        if (queryDTO.getIsImportant() != null) {
            wrapper.eq(Asset::getIsImportant, queryDTO.getIsImportant());
        }
        wrapper.orderByDesc(Asset::getCreateTime);

        return assetMapper.selectPage(page, wrapper);
    }

    public Asset getAssetById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        Asset asset = assetMapper.selectOne(assetById(id, tenantId));
        if (asset == null) {
            assertSameTenantOrMissing(id, tenantId, "getAssetById");
        }
        return asset;
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset createAsset(AssetCreateDTO createDTO) {
        String tenantId = TenantContext.requireTenantId();
        if (createDTO.getAssetNo() != null && !createDTO.getAssetNo().isEmpty()) {
            Asset existingAsset = assetMapper.selectOne(
                new LambdaQueryWrapper<Asset>()
                        .eq(Asset::getTenantId, tenantId)
                        .eq(Asset::getAssetNo, createDTO.getAssetNo())
            );
            if (existingAsset != null) {
                throw new BusinessException("资产编号已存在");
            }
        }

        Asset asset = new Asset();
        BeanUtil.copyProperties(createDTO, asset);
        asset.setTenantId(tenantId);
        asset.setStatus(normalizeStatusOrDefault(asset.getStatus(), AssetStatus.IDLE));
        if (asset.getAssetNo() == null || asset.getAssetNo().isEmpty()) {
            Long tenantAssetCount = assetMapper.selectCount(new LambdaQueryWrapper<Asset>()
                    .eq(Asset::getTenantId, tenantId));
            asset.setAssetNo("AST-" + java.time.LocalDate.now().getYear() + "-" + String.format("%04d", tenantAssetCount.intValue() + 1));
        }
        assetMapper.insert(asset);
        return asset;
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset updateAsset(Long id, AssetUpdateDTO updateDTO) {
        String tenantId = TenantContext.requireTenantId();
        Asset asset = getAssetById(id);
        String requestedStatus = updateDTO.getStatus();

        BeanUtil.copyProperties(updateDTO, asset, "id", "assetNo", "createBy", "createTime", "status");

        assetMapper.update(asset, assetById(id, tenantId));
        if (requestedStatus != null && !requestedStatus.isBlank()) {
            return assetLifecycleService.transitionLoadedAsset(
                    asset,
                    parseStatus(requestedStatus),
                    AssetLifecycleService.CHANGE_TYPE_STATUS,
                    "资产状态更新",
                    null,
                    null);
        }
        return asset;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteAsset(Long id) {
        String tenantId = TenantContext.requireTenantId();
        int deleted = assetMapper.delete(assetById(id, tenantId));
        if (deleted == 0) {
            assertSameTenantOrMissing(id, tenantId, "deleteAsset");
        }
    }

    private LambdaQueryWrapper<Asset> assetById(Long id, String tenantId) {
        return new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, id)
                .eq(Asset::getTenantId, tenantId);
    }

    private void assertSameTenantOrMissing(Long id, String tenantId, String action) {
        Asset existingAsset = assetMapper.selectById(id);
        if (existingAsset == null) {
            throw new BusinessException("资产不存在");
        }
        TenantSecurityAudit.logCrossTenantAttempt(log, action, id, tenantId, existingAsset.getTenantId());
        throw new AccessDeniedException("Asset belongs to another tenant");
    }

    private String normalizeStatusOrDefault(String status, AssetStatus defaultStatus) {
        try {
            return AssetStatus.fromNameOrDefault(status, defaultStatus).name();
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("资产状态无效: " + status);
        }
    }

    private AssetStatus parseStatus(String status) {
        try {
            return AssetStatus.fromName(status);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("资产状态无效: " + status);
        }
    }

}
