package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.MaintenanceCreateDTO;
import com.ams.dto.MaintenanceUpdateDTO;
import com.ams.entity.Asset;
import com.ams.entity.MaintenanceRecord;
import com.ams.entity.User;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.MaintenanceRecordMapper;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MaintenanceService {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceService.class);
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_UPCOMING_RESULTS = 100;

    private final MaintenanceRecordMapper maintenanceRecordMapper;
    private final AssetMapper assetMapper;
    private final AssetDataPermissionEvaluator assetDataPermissionEvaluator;
    private final TenantAuthorityService tenantAuthorityService;

    public Page<MaintenanceRecord> queryRecords(Integer page, Integer pageSize, Long assetId, String maintenanceType) {
        requirePermission("maintenance:query");
        String tenantId = TenantContext.requireTenantId();
        Page<MaintenanceRecord> pageParam = new Page<>(normalizePage(page), normalizePageSize(pageSize));

        LambdaQueryWrapper<MaintenanceRecord> wrapper = new LambdaQueryWrapper<MaintenanceRecord>()
                .eq(MaintenanceRecord::getTenantId, tenantId);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        if (assetId != null) {
            loadAccessibleAsset(assetId, tenantId, "queryRecords");
            wrapper.eq(MaintenanceRecord::getAssetId, assetId);
        }
        if (maintenanceType != null && !maintenanceType.isEmpty()) {
            wrapper.eq(MaintenanceRecord::getMaintenanceType, maintenanceType);
        }
        wrapper.orderByDesc(MaintenanceRecord::getMaintenanceDate).orderByDesc(MaintenanceRecord::getCreateTime);

        return maintenanceRecordMapper.selectPage(pageParam, wrapper);
    }

    public MaintenanceRecord getRecordById(Long id) {
        requirePermission("maintenance:query");
        return getRecordByIdInternal(id);
    }

    private MaintenanceRecord getRecordByIdInternal(Long id) {
        String tenantId = TenantContext.requireTenantId();
        MaintenanceRecord record = maintenanceRecordMapper.selectOne(new LambdaQueryWrapper<MaintenanceRecord>()
                .eq(MaintenanceRecord::getId, id)
                .eq(MaintenanceRecord::getTenantId, tenantId));
        if (record == null) {
            MaintenanceRecord existingRecord = maintenanceRecordMapper.selectById(id);
            if (existingRecord == null) {
                throw new BusinessException("维护记录不存在");
            }
            TenantSecurityAudit.logCrossTenantAttempt(log, "getRecordById", id, tenantId, existingRecord.getTenantId());
            throw new AccessDeniedException("维护记录不属于当前租户");
        }
        loadAccessibleAsset(record.getAssetId(), tenantId, "getRecordById");
        return record;
    }

    @Transactional(rollbackFor = Exception.class)
    public MaintenanceRecord createRecord(MaintenanceCreateDTO createDTO) {
        requirePermission("maintenance:create");
        String tenantId = TenantContext.requireTenantId();
        validateCreateDTO(createDTO);
        Asset linkedAsset = loadAccessibleAsset(createDTO == null ? null : createDTO.getAssetId(), tenantId,
                "createRecord");
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        MaintenanceRecord record = new MaintenanceRecord();
        BeanUtil.copyProperties(createDTO, record);
        record.setTenantId(tenantId);
        record.setAssetId(linkedAsset.getId());
        record.setCreateBy(currentUser.getId());
        record.setVersion(0);
        if (record.getContent() == null) record.setContent("");
        if (record.getMaintenanceDate() == null) record.setMaintenanceDate(java.time.LocalDate.now());
        if (maintenanceRecordMapper.insert(record) != 1) {
            throw new BusinessException("维护记录创建失败");
        }
        return record;
    }

    @Transactional(rollbackFor = Exception.class)
    public MaintenanceRecord updateRecord(Long id, MaintenanceUpdateDTO updateDTO) {
        requirePermission("maintenance:update");
        if (updateDTO == null) {
            throw new BusinessException("维护记录更新参数不能为空");
        }
        MaintenanceRecord record = getRecordByIdInternal(id);
        Long sourceAssetId = record.getAssetId();
        Long targetAssetId = updateDTO != null && updateDTO.getAssetId() != null
                ? updateDTO.getAssetId() : record.getAssetId();
        Asset linkedAsset = loadAccessibleAsset(targetAssetId, TenantContext.requireTenantId(), "updateRecord");
        BeanUtil.copyProperties(updateDTO, record, "id", "assetId", "createBy", "createTime");
        record.setAssetId(linkedAsset.getId());
        int version = versionOf(record.getVersion());
        record.setVersion(version + 1);
        LambdaUpdateWrapper<MaintenanceRecord> wrapper = new LambdaUpdateWrapper<MaintenanceRecord>()
                .eq(MaintenanceRecord::getId, id)
                .eq(MaintenanceRecord::getTenantId, TenantContext.requireTenantId())
                .eq(MaintenanceRecord::getAssetId, sourceAssetId)
                .eq(MaintenanceRecord::getVersion, version);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        int updated = maintenanceRecordMapper.update(record, wrapper);
        if (updated != 1) {
            throw new BusinessException("维护记录已变更，请刷新后重试");
        }
        return record;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteRecord(Long id) {
        requirePermission("maintenance:delete");
        MaintenanceRecord record = getRecordByIdInternal(id);
        LambdaQueryWrapper<MaintenanceRecord> wrapper = new LambdaQueryWrapper<MaintenanceRecord>()
                .eq(MaintenanceRecord::getId, id)
                .eq(MaintenanceRecord::getTenantId, TenantContext.requireTenantId())
                .eq(MaintenanceRecord::getAssetId, record.getAssetId())
                .eq(MaintenanceRecord::getVersion, versionOf(record.getVersion()));
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        int deleted = maintenanceRecordMapper.delete(wrapper);
        if (deleted != 1) {
            throw new BusinessException("维护记录已变更，请刷新后重试");
        }
    }

    public List<MaintenanceRecord> getUpcomingMaintenance(Integer days) {
        requirePermission("maintenance:query");
        int range = days == null || days < 0 ? 30 : days;
        LocalDate start = LocalDate.now();
        LocalDate end = start.plusDays(range);

        String tenantId = TenantContext.requireTenantId();
        LambdaQueryWrapper<MaintenanceRecord> wrapper = new LambdaQueryWrapper<MaintenanceRecord>()
            .eq(MaintenanceRecord::getTenantId, tenantId);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        wrapper.between(MaintenanceRecord::getNextMaintenanceDate, start, end)
            .orderByAsc(MaintenanceRecord::getNextMaintenanceDate)
            .last("limit " + MAX_UPCOMING_RESULTS);

        return maintenanceRecordMapper.selectList(wrapper);
    }

    private Asset loadAccessibleAsset(Long assetId, String tenantId, String operation) {
        if (assetId == null || assetId <= 0) {
            throw new BusinessException("维护记录必须关联有效资产");
        }
        Asset asset = assetMapper.selectOne(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, assetId)
                .eq(Asset::getTenantId, tenantId));
        if (asset == null) {
            Asset existingAsset = assetMapper.selectById(assetId);
            if (existingAsset == null) {
                throw new BusinessException("关联资产不存在");
            }
            TenantSecurityAudit.logCrossTenantAttempt(log, operation, assetId, tenantId, existingAsset.getTenantId());
            throw new AccessDeniedException("关联资产不属于当前租户");
        }
        assetDataPermissionEvaluator.assertCanAccess(asset);
        return asset;
    }

    private void validateCreateDTO(MaintenanceCreateDTO dto) {
        if (dto == null || dto.getAssetId() == null || dto.getMaintenanceType() == null
                || dto.getMaintenanceType().isBlank()) {
            throw new BusinessException("维护记录参数不完整");
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

    private void requirePermission(String permission) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = authentication != null
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream().anyMatch(authority -> permission.equals(authority.getAuthority()));
        if (!permitted) {
            throw new AccessDeniedException("缺少维护权限: " + permission);
        }
    }
}
