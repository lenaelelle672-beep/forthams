package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.AssetChangeLog;
import com.ams.enums.AssetStatus;
import com.ams.mapper.AssetChangeLogMapper;
import com.ams.mapper.AssetMapper;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.function.Consumer;

@Service
@RequiredArgsConstructor
public class AssetLifecycleService {

    public static final String CHANGE_TYPE_STATUS = "STATUS_CHANGE";
    private static final Pattern SNAPSHOT_STATUS_PATTERN = Pattern.compile("(?:^|,)status=([^,]*)");
    private static final Logger log = LoggerFactory.getLogger(AssetLifecycleService.class);

    private final AssetMapper assetMapper;
    private final AssetChangeLogMapper assetChangeLogMapper;

    @Transactional(rollbackFor = Exception.class)
    public Asset transitionStatus(Long assetId, AssetStatus targetStatus, String changeType, String reason, Long operatorId) {
        Asset asset = loadAssetForCurrentTenant(assetId, "transitionStatus");
        return transitionLoadedAsset(asset, targetStatus, changeType, reason, operatorId, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset transitionAsset(Long assetId, AssetStatus targetStatus, String changeType, String reason,
                                 Long operatorId, Consumer<Asset> mutator) {
        Asset asset = loadAssetForCurrentTenant(assetId, "transitionAsset");
        return transitionLoadedAsset(asset, targetStatus, changeType, reason, operatorId, mutator);
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset rollbackRetirementStatus(Long assetId, String changeType, String reason, Long operatorId) {
        Asset asset = loadAssetForCurrentTenant(assetId, "rollbackRetirementStatus");

        AssetStatus targetStatus = findLatestRetirementOriginalStatus(assetId);
        return transitionLoadedAsset(asset, targetStatus, changeType, reason, operatorId, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset transitionLoadedAsset(Asset asset, AssetStatus targetStatus, String changeType, String reason,
                                       Long operatorId, Consumer<Asset> mutator) {
        String tenantId = verifyAssetTenant(asset, "transitionLoadedAsset");
        if (targetStatus == null) {
            throw new BusinessException("目标资产状态不能为空");
        }

        AssetStatus currentStatus = parseCurrentStatus(asset.getStatus());
        if (!currentStatus.canTransitionTo(targetStatus)) {
            throw new BusinessException("资产状态不允许从" + currentStatus.name() + "变更为" + targetStatus.name());
        }

        String oldValue = buildAssetSnapshot(asset);
        if (mutator != null) {
            mutator.accept(asset);
        }
        asset.setStatus(targetStatus.name());
        String newValue = buildAssetSnapshot(asset);

        if (!oldValue.equals(newValue)) {
            int updated = assetMapper.update(asset, assetById(asset.getId(), tenantId));
            if (updated == 0) {
                throw new AccessDeniedException("Asset belongs to another tenant");
            }
            createChangeLog(asset.getId(), normalizeChangeType(changeType), oldValue, newValue, reason, operatorId);
        }
        return asset;
    }

    private Asset loadAssetForCurrentTenant(Long assetId, String operation) {
        String tenantId = TenantContext.requireTenantId();
        Asset asset = assetMapper.selectOne(assetById(assetId, tenantId));
        if (asset != null) {
            return asset;
        }
        Asset existingAsset = assetMapper.selectById(assetId);
        if (existingAsset == null) {
            throw new BusinessException("资产不存在");
        }
        TenantSecurityAudit.logCrossTenantAttempt(log, operation, assetId, tenantId, existingAsset.getTenantId());
        throw new AccessDeniedException("Asset belongs to another tenant");
    }

    private String verifyAssetTenant(Asset asset, String operation) {
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }
        String tenantId = TenantContext.requireTenantId();
        if (!tenantId.equals(asset.getTenantId())) {
            TenantSecurityAudit.logCrossTenantAttempt(log, operation, asset.getId(), tenantId, asset.getTenantId());
            throw new AccessDeniedException("Asset belongs to another tenant");
        }
        return tenantId;
    }

    private LambdaQueryWrapper<Asset> assetById(Long assetId, String tenantId) {
        return new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, assetId)
                .eq(Asset::getTenantId, tenantId);
    }

    private AssetStatus parseCurrentStatus(String status) {
        try {
            return AssetStatus.fromNameOrDefault(status, AssetStatus.IDLE);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("资产状态无效: " + status);
        }
    }

    private void createChangeLog(Long assetId, String changeType, String oldValue, String newValue, String reason,
                                 Long operatorId) {
        AssetChangeLog changeLog = new AssetChangeLog();
        changeLog.setAssetId(assetId);
        changeLog.setChangeType(changeType);
        changeLog.setOldValue(oldValue);
        changeLog.setNewValue(newValue);
        changeLog.setReason(reason);
        changeLog.setOperatorId(operatorId);
        assetChangeLogMapper.insert(changeLog);
    }

    private String normalizeChangeType(String changeType) {
        if (changeType == null || changeType.isBlank()) {
            return CHANGE_TYPE_STATUS;
        }
        return changeType;
    }

    private String buildAssetSnapshot(Asset asset) {
        return String.format("deptId=%s,userId=%s,location=%s,status=%s",
                asset.getDeptId(), asset.getUserId(), asset.getLocation(), asset.getStatus());
    }

    private AssetStatus findLatestRetirementOriginalStatus(Long assetId) {
        AssetChangeLog changeLog = assetChangeLogMapper.selectOne(
                new LambdaQueryWrapper<AssetChangeLog>()
                        .eq(AssetChangeLog::getAssetId, assetId)
                        .eq(AssetChangeLog::getChangeType, "RETIREMENT_SUBMIT")
                        .orderByDesc(AssetChangeLog::getCreateTime)
                        .last("limit 1"));
        if (changeLog == null) {
            return AssetStatus.IN_USE;
        }
        String status = extractStatus(changeLog.getOldValue());
        if (status == null || status.isBlank()) {
            return AssetStatus.IN_USE;
        }
        return AssetStatus.fromName(status);
    }

    private String extractStatus(String snapshot) {
        if (snapshot == null || snapshot.isBlank()) {
            return null;
        }
        Matcher matcher = SNAPSHOT_STATUS_PATTERN.matcher(snapshot);
        return matcher.find() ? matcher.group(1) : null;
    }
}
