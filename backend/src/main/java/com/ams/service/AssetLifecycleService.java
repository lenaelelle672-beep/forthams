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
    private final AssetDataPermissionEvaluator assetDataPermissionEvaluator;

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
        assetDataPermissionEvaluator.assertCanWrite(asset);
        if (targetStatus == null) {
            throw new BusinessException("目标资产状态不能为空");
        }

        AssetStatus currentStatus = parseCurrentStatus(asset.getStatus());
        validateTransitionSource(currentStatus, targetStatus, changeType);
        if (!currentStatus.canTransitionTo(targetStatus)) {
            throw new BusinessException("资产状态不允许从" + currentStatus.name() + "变更为" + targetStatus.name());
        }

        String expectedStoredStatus = asset.getStatus();
        int expectedVersion = versionOf(asset.getVersion());
        String oldValue = buildAssetSnapshot(asset);
        if (mutator != null) {
            mutator.accept(asset);
        }
        asset.setStatus(targetStatus.name());
        assetDataPermissionEvaluator.assertCanWrite(asset);
        String newValue = buildAssetSnapshot(asset);

        if (!oldValue.equals(newValue)) {
            asset.setVersion(expectedVersion + 1);
            LambdaQueryWrapper<Asset> updateWrapper = assetById(asset.getId(), tenantId);
            updateWrapper.eq(Asset::getStatus, expectedStoredStatus)
                    .eq(Asset::getVersion, expectedVersion);
            assetDataPermissionEvaluator.applyTo(updateWrapper);
            int updated = assetMapper.update(asset, updateWrapper);
            if (updated == 0) {
                throw new BusinessException("资产已变更、版本过期或不在当前数据范围内");
            }
            createChangeLog(asset.getId(), normalizeChangeType(changeType), oldValue, newValue, reason, operatorId);
        }
        return asset;
    }

    private Asset loadAssetForCurrentTenant(Long assetId, String operation) {
        String tenantId = TenantContext.requireTenantId();
        Asset asset = assetMapper.selectOne(assetById(assetId, tenantId));
        if (asset != null) {
            assetDataPermissionEvaluator.assertCanAccess(asset);
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

    private void validateTransitionSource(AssetStatus currentStatus, AssetStatus targetStatus, String changeType) {
        String normalizedChangeType = normalizeChangeType(changeType);
        boolean targetIsRetirementTerminal = targetStatus == AssetStatus.RETIRED || targetStatus == AssetStatus.SCRAPPED;
        switch (normalizedChangeType) {
            case CHANGE_TYPE_STATUS -> {
                if (currentStatus.requiresDedicatedWorkflow() || targetStatus.requiresDedicatedWorkflow()) {
                    throw new BusinessException("退役、报废和清退状态只能通过对应业务流程变更");
                }
            }
            case "RETIREMENT_SUBMIT" -> {
                requireTargetStatus(targetStatus, AssetStatus.PENDING_RETIREMENT, normalizedChangeType);
                if (currentStatus.requiresDedicatedWorkflow()) {
                    throw new BusinessException("退役申请只能从普通资产状态提交");
                }
            }
            case "RETIREMENT_APPROVED", "RETIREMENT_COMPLETED" -> {
                if (currentStatus != AssetStatus.PENDING_RETIREMENT || !targetIsRetirementTerminal) {
                    throw new BusinessException("退役审批只能将待退役资产迁移至退役或报废状态");
                }
            }
            case "RETIREMENT_CANCELLED", "RETIREMENT_REJECTED", "RETIREMENT_REQUIRES_RESUBMISSION" -> {
                if (currentStatus != AssetStatus.PENDING_RETIREMENT || targetStatus.requiresDedicatedWorkflow()) {
                    throw new BusinessException("退役撤回只能将待退役资产恢复至普通资产状态");
                }
            }
            case "TRANSFER" -> requireTargetStatus(targetStatus, AssetStatus.IN_USE, normalizedChangeType);
            case "SCRAP" -> requireTargetStatus(targetStatus, AssetStatus.SCRAPPED, normalizedChangeType);
            case "CLEARANCE" -> requireTargetStatus(targetStatus, AssetStatus.CLEARED, normalizedChangeType);
            default -> throw new BusinessException("未授权的资产状态迁移类型");
        }
    }

    private void requireTargetStatus(AssetStatus targetStatus, AssetStatus expectedStatus, String changeType) {
        if (targetStatus != expectedStatus) {
            throw new BusinessException(changeType + "不允许迁移至" + targetStatus.name());
        }
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
            // 找不到退役提交日志时默认 IDLE（而非 IN_USE）
            // IN_USE 意味着有人在使用，IDLE 是更安全的中性状态
            return AssetStatus.IDLE;
        }
        String status = extractStatus(changeLog.getOldValue());
        if (status == null || status.isBlank()) {
            return AssetStatus.IDLE;
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

    private int versionOf(Integer version) {
        return version == null ? 0 : version;
    }
}
