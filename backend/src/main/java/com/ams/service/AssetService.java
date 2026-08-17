package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AssetCreateDTO;
import com.ams.dto.AssetQueryDTO;
import com.ams.dto.AssetUpdateDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Asset;
import com.ams.enums.AssetStatus;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.AssetMapper;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
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
    private static final int MAX_PAGE_SIZE = 100;

    private final AssetMapper assetMapper;
    private final ApprovalProcessMapper approvalProcessMapper;
    private final AssetLifecycleService assetLifecycleService;
    private final AssetDataPermissionEvaluator assetDataPermissionEvaluator;

    public Page<Asset> queryAssets(AssetQueryDTO queryDTO) {
        String tenantId = TenantContext.requireTenantId();
        Page<Asset> page = new Page<>(normalizePage(queryDTO.getPage()), normalizePageSize(queryDTO.getPageSize()));

        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId);
        assetDataPermissionEvaluator.applyTo(wrapper);

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
        assetDataPermissionEvaluator.assertCanAccess(asset);
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
        asset.setVersion(0);
        AssetStatus initialStatus = parseInitialStatus(createDTO.getStatus());
        asset.setStatus(initialStatus.name());
        if (asset.getAssetNo() == null || asset.getAssetNo().isEmpty()) {
            Long tenantAssetCount = assetMapper.selectCount(new LambdaQueryWrapper<Asset>()
                    .eq(Asset::getTenantId, tenantId));
            asset.setAssetNo("AST-" + java.time.LocalDate.now().getYear() + "-" + String.format("%04d", tenantAssetCount.intValue() + 1));
        }
        assetDataPermissionEvaluator.assertCanWrite(asset);
        assetMapper.insert(asset);
        return asset;
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset updateAsset(Long id, AssetUpdateDTO updateDTO) {
        String tenantId = TenantContext.requireTenantId();
        Asset asset = getAssetById(id);
        String requestedStatus = updateDTO.getStatus();
        AssetStatus targetStatus = requestedStatus == null || requestedStatus.isBlank()
                ? null
                : parseStatus(requestedStatus);
        if (targetStatus != null) {
            AssetStatus currentStatus = parseStatus(asset.getStatus());
            if (currentStatus.requiresDedicatedWorkflow() || targetStatus.requiresDedicatedWorkflow()) {
                throw new BusinessException("退役、报废和清退状态只能通过对应业务流程变更");
            }
        }

        int version = versionOf(asset.getVersion());
        BeanUtil.copyProperties(updateDTO, asset, "id", "assetNo", "createBy", "createTime", "status",
                "deptId", "userId", "location", "locationId");
        asset.setVersion(version + 1);

        assetDataPermissionEvaluator.assertCanWrite(asset);
        LambdaQueryWrapper<Asset> updateWrapper = assetById(id, tenantId);
        updateWrapper.eq(Asset::getVersion, version);
        assetDataPermissionEvaluator.applyTo(updateWrapper);
        int updated = assetMapper.update(asset, updateWrapper);
        if (updated == 0) {
            throw new AccessDeniedException("资产数据权限拒绝：资产已变更或不在当前数据范围内");
        }
        if (targetStatus != null) {
            return assetLifecycleService.transitionLoadedAsset(
                    asset,
                    targetStatus,
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
        Asset asset = lockAssetForDelete(id, tenantId);
        requireNotPendingRetirement(asset);
        requireNoActiveInventoryReference(asset.getId(), tenantId);
        requireNoResubmissionLifecycle(asset.getId(), tenantId);
        requireNoPendingApprovalForAsset(asset.getId(), tenantId);
        LambdaQueryWrapper<Asset> deleteWrapper = assetById(id, tenantId);
        deleteWrapper.eq(Asset::getVersion, versionOf(asset.getVersion()));
        deleteWrapper.ne(Asset::getStatus, AssetStatus.PENDING_RETIREMENT.name());
        applyLifecycleDeleteGuards(deleteWrapper, asset.getId(), tenantId);
        assetDataPermissionEvaluator.applyTo(deleteWrapper);
        int deleted = assetMapper.delete(deleteWrapper);
        if (deleted == 0) {
            requireNotPendingRetirement(lockAssetForDelete(id, tenantId));
            requireNoActiveInventoryReference(asset.getId(), tenantId);
            requireNoResubmissionLifecycle(asset.getId(), tenantId);
            requireNoPendingApprovalForAsset(asset.getId(), tenantId);
            throw new AccessDeniedException("资产数据权限拒绝：资产已变更或不在当前数据范围内");
        }
    }

    private void applyLifecycleDeleteGuards(LambdaQueryWrapper<Asset> wrapper, Long assetId, String tenantId) {
        wrapper.apply("NOT EXISTS (SELECT 1 FROM inventory_detail detail "
                        + "INNER JOIN inventory_task task ON task.id = detail.task_id "
                        + "AND task.tenant_id = detail.tenant_id "
                        + "WHERE detail.asset_id = {0} "
                        + "AND detail.tenant_id = {1} "
                        + "AND COALESCE(task.deleted, 0) = 0 "
                        + "AND UPPER(TRIM(task.status)) IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED'))",
                assetId, tenantId);
        applyNoBusinessStatusGuard(wrapper, assetId, tenantId, "retirement_application");
        applyNoBusinessStatusGuard(wrapper, assetId, tenantId, "asset_compensation");
        applyNoBusinessStatusGuard(wrapper, assetId, tenantId, "disposal_application");
        applyNoBusinessStatusGuard(wrapper, assetId, tenantId, "work_order");
        applyNoPendingApprovalGuard(wrapper, assetId, tenantId, "RETIREMENT", "retirement_application");
        applyNoPendingApprovalGuard(wrapper, assetId, tenantId, "COMPENSATION", "asset_compensation");
        applyNoPendingApprovalGuard(wrapper, assetId, tenantId, "DISPOSAL", "disposal_application");
        applyNoPendingApprovalGuard(wrapper, assetId, tenantId, "WORK_ORDER", "work_order");
    }

    private void applyNoBusinessStatusGuard(
            LambdaQueryWrapper<Asset> wrapper,
            Long assetId,
            String tenantId,
            String businessTable) {
        wrapper.apply("NOT EXISTS (SELECT 1 FROM " + businessTable + " business "
                        + "WHERE business.asset_id = {0} "
                        + "AND business.tenant_id = {1} "
                        + "AND business.status = {2} "
                        + "AND COALESCE(business.deleted, 0) = 0)",
                assetId, tenantId, "CANCELLED_REQUIRES_RESUBMISSION");
    }

    private void applyNoPendingApprovalGuard(
            LambdaQueryWrapper<Asset> wrapper,
            Long assetId,
            String tenantId,
            String processType,
            String businessTable) {
        wrapper.apply("NOT EXISTS (SELECT 1 FROM approval_process process "
                        + "INNER JOIN " + businessTable + " business ON business.id = process.business_id "
                        + "AND business.tenant_id = process.tenant_id "
                        + "WHERE process.tenant_id = {0} "
                        + "AND process.process_type = {1} "
                        + "AND process.status = {2} "
                        + "AND business.asset_id = {3} "
                        + "AND COALESCE(business.deleted, 0) = 0 "
                        + "AND COALESCE(process.deleted, 0) = 0)",
                tenantId, processType, "PENDING", assetId);
    }

    private LambdaQueryWrapper<Asset> assetById(Long id, String tenantId) {
        return new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, id)
                .eq(Asset::getTenantId, tenantId);
    }

    private Asset lockAssetForDelete(Long id, String tenantId) {
        Asset asset = assetMapper.selectOne(assetById(id, tenantId).last("FOR UPDATE"));
        if (asset == null) {
            assertSameTenantOrMissing(id, tenantId, "deleteAsset");
        }
        assetDataPermissionEvaluator.assertCanAccess(asset);
        return asset;
    }

    private void requireNotPendingRetirement(Asset asset) {
        if (AssetStatus.PENDING_RETIREMENT.matches(asset.getStatus())) {
            throw new BusinessException("资产处于冻结退役状态，不能删除");
        }
    }

    private void requireNoResubmissionLifecycle(Long assetId, String tenantId) {
        if (hasBusinessStatusForAsset(assetId, tenantId, "retirement_application", "CANCELLED_REQUIRES_RESUBMISSION")
                || hasBusinessStatusForAsset(assetId, tenantId, "asset_compensation", "CANCELLED_REQUIRES_RESUBMISSION")
                || hasBusinessStatusForAsset(assetId, tenantId, "disposal_application", "CANCELLED_REQUIRES_RESUBMISSION")
                || hasBusinessStatusForAsset(assetId, tenantId, "work_order", "CANCELLED_REQUIRES_RESUBMISSION")) {
            throw new BusinessException("资产存在需重提的业务流程，不能删除");
        }
    }

    private void requireNoActiveInventoryReference(Long assetId, String tenantId) {
        Long referenced = assetMapper.selectCount(new QueryWrapper<Asset>()
                .eq("id", assetId)
                .eq("tenant_id", tenantId)
                .apply("EXISTS (SELECT 1 FROM inventory_detail detail "
                        + "INNER JOIN inventory_task task ON task.id = detail.task_id "
                        + "AND task.tenant_id = detail.tenant_id "
                        + "WHERE detail.asset_id = {0} "
                        + "AND detail.tenant_id = {1} "
                        + "AND COALESCE(task.deleted, 0) = 0 "
                        + "AND UPPER(TRIM(task.status)) IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED'))",
                        assetId, tenantId));
        if (referenced != null && referenced > 0) {
            throw new BusinessException("资产仍被活跃盘点任务引用，不能删除");
        }
    }

    private boolean hasBusinessStatusForAsset(Long assetId, String tenantId, String businessTable, String status) {
        Long matched = assetMapper.selectCount(new QueryWrapper<Asset>()
                .eq("id", assetId)
                .eq("tenant_id", tenantId)
                .apply("EXISTS (SELECT 1 FROM " + businessTable + " business "
                        + "WHERE business.asset_id = {0} "
                        + "AND business.tenant_id = {1} "
                        + "AND business.status = {2} "
                        + "AND COALESCE(business.deleted, 0) = 0)",
                        assetId, tenantId, status));
        return matched != null && matched > 0;
    }

    private void requireNoPendingApprovalForAsset(Long assetId, String tenantId) {
        if (hasPendingApprovalForAsset(assetId, tenantId, "RETIREMENT", "retirement_application")
                || hasPendingApprovalForAsset(assetId, tenantId, "COMPENSATION", "asset_compensation")
                || hasPendingApprovalForAsset(assetId, tenantId, "DISPOSAL", "disposal_application")
                || hasPendingApprovalForAsset(assetId, tenantId, "WORK_ORDER", "work_order")) {
            throw new BusinessException("资产存在进行中的审批流程，不能删除");
        }
    }

    private boolean hasPendingApprovalForAsset(Long assetId, String tenantId, String processType, String businessTable) {
        ApprovalProcess process = approvalProcessMapper.selectOne(new QueryWrapper<ApprovalProcess>()
                .eq("tenant_id", tenantId)
                .eq("process_type", processType)
                .eq("status", "PENDING")
                .apply("EXISTS (SELECT 1 FROM " + businessTable + " business "
                        + "WHERE business.id = approval_process.business_id "
                        + "AND business.tenant_id = {0} "
                        + "AND business.asset_id = {1} "
                        + "AND COALESCE(business.deleted, 0) = 0)", tenantId, assetId)
                .orderByDesc("create_time")
                .orderByDesc("id")
                .last("limit 1"));
        return process != null;
    }

    private void assertSameTenantOrMissing(Long id, String tenantId, String action) {
        Asset existingAsset = assetMapper.selectById(id);
        if (existingAsset == null) {
            throw new BusinessException("资产不存在");
        }
        TenantSecurityAudit.logCrossTenantAttempt(log, action, id, tenantId, existingAsset.getTenantId());
        throw new AccessDeniedException("Asset belongs to another tenant");
    }

    private AssetStatus parseInitialStatus(String status) {
        try {
            AssetStatus initialStatus = AssetStatus.fromNameOrDefault(status, AssetStatus.IDLE);
            if (initialStatus.requiresDedicatedWorkflow()) {
                throw new BusinessException("退役、报废和清退状态不能通过资产创建设置");
            }
            return initialStatus;
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

    private int normalizePage(Integer page) {
        return page == null || page < 1 ? 1 : page;
    }

    private int normalizePageSize(Integer pageSize) {
        if (pageSize == null || pageSize < 1) {
            return 10;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    private int versionOf(Integer version) {
        return version == null ? 0 : version;
    }

}
