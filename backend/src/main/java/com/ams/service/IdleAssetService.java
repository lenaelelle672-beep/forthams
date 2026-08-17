package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.IdleAssetCreateDTO;
import com.ams.entity.Asset;
import com.ams.entity.IdleAssetNotice;
import com.ams.entity.User;
import com.ams.enums.IdleAssetStatus;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.IdleAssetNoticeMapper;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class IdleAssetService {

    private static final Logger log = LoggerFactory.getLogger(IdleAssetService.class);
    private static final int MAX_PAGE_SIZE = 100;

    private final IdleAssetNoticeMapper idleAssetNoticeMapper;
    private final AssetMapper assetMapper;
    private final AssetDataPermissionEvaluator assetDataPermissionEvaluator;
    private final TenantAuthorityService tenantAuthorityService;

    public Page<IdleAssetNotice> queryIdleAssets(Integer page, Integer pageSize, String status) {
        requirePermission("idleasset:query");
        String tenantId = TenantContext.requireTenantId();
        Page<IdleAssetNotice> pageParam = new Page<>(normalizePage(page), normalizePageSize(pageSize));
        QueryWrapper<IdleAssetNotice> wrapper = new QueryWrapper<>();
        wrapper.eq("tenant_id", tenantId);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);

        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        wrapper.orderByDesc("create_time");

        return idleAssetNoticeMapper.selectPage(pageParam, wrapper);
    }

    public IdleAssetNotice getById(Long id) {
        requirePermission("idleasset:query");
        return getByIdInternal(id);
    }

    private IdleAssetNotice getByIdInternal(Long id) {
        String tenantId = TenantContext.requireTenantId();
        IdleAssetNotice notice = idleAssetNoticeMapper.selectOne(new QueryWrapper<IdleAssetNotice>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (notice == null) {
            IdleAssetNotice existingNotice = idleAssetNoticeMapper.selectById(id);
            if (existingNotice == null) {
                throw new BusinessException("闲置资产公告不存在");
            }
            TenantSecurityAudit.logCrossTenantAttempt(log, "getIdleNoticeById", id, tenantId,
                    existingNotice.getTenantId());
            throw new AccessDeniedException("闲置资产公告不属于当前租户");
        }
        loadAccessibleAsset(notice.getAssetId(), tenantId, "getIdleNoticeById");
        return notice;
    }

    @Transactional(rollbackFor = Exception.class)
    public IdleAssetNotice publishNotice(IdleAssetCreateDTO dto) {
        requirePermission("idleasset:create");
        String tenantId = TenantContext.requireTenantId();
        validateCreateDTO(dto);
        Asset linkedAsset = loadAccessibleAsset(dto == null ? null : dto.getAssetId(), tenantId, "publishNotice");
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        IdleAssetNotice notice = new IdleAssetNotice();
        BeanUtil.copyProperties(dto, notice);
        notice.setTenantId(tenantId);
        BeanUtil.setProperty(notice, "status", IdleAssetStatus.PUBLISHED.name());
        BeanUtil.setProperty(notice, "noticeDate", LocalDate.now());
        notice.setAssetId(linkedAsset.getId());
        notice.setCreateBy(currentUser.getId());
        notice.setVersion(0);
        if (idleAssetNoticeMapper.insert(notice) != 1) {
            throw new BusinessException("闲置资产公告创建失败");
        }
        return notice;
    }

    @Transactional(rollbackFor = Exception.class)
    public IdleAssetNotice claimAsset(Long id, Long claimantId) {
        requirePermission("idleasset:claim");
        IdleAssetNotice notice = getByIdInternal(id);
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        if (claimantId == null || !claimantId.equals(currentUser.getId())) {
            throw new AccessDeniedException("认领人必须是当前租户已认证成员");
        }
        if (parseStatus(notice.getStatus()) != IdleAssetStatus.PUBLISHED) {
            throw new BusinessException("仅已发布状态可认领");
        }
        IdleAssetNotice update = new IdleAssetNotice();
        update.setClaimantId(claimantId);
        update.setStatus("CLAIMED");
        update.setClaimDate(LocalDate.now());
        LambdaUpdateWrapper<IdleAssetNotice> wrapper = new LambdaUpdateWrapper<IdleAssetNotice>()
                .eq(IdleAssetNotice::getId, id)
                .eq(IdleAssetNotice::getTenantId, TenantContext.requireTenantId())
                .eq(IdleAssetNotice::getAssetId, notice.getAssetId())
                .eq(IdleAssetNotice::getStatus, IdleAssetStatus.PUBLISHED.name())
                .eq(IdleAssetNotice::getVersion, versionOf(notice.getVersion()))
                .set(IdleAssetNotice::getVersion, versionOf(notice.getVersion()) + 1);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        int updated = idleAssetNoticeMapper.update(update, wrapper);
        if (updated != 1) {
            throw new BusinessException("闲置资产公告状态已变更，请刷新后重试");
        }
        return getByIdInternal(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public IdleAssetNotice cancelNotice(Long id) {
        requirePermission("idleasset:update");
        IdleAssetNotice notice = getByIdInternal(id);
        IdleAssetStatus currentStatus = parseStatus(notice.getStatus());
        if (currentStatus != IdleAssetStatus.PUBLISHED && currentStatus != IdleAssetStatus.CLAIMED) {
            throw new BusinessException("当前闲置资产公告不可取消");
        }
        int version = versionOf(notice.getVersion());
        notice.setStatus(IdleAssetStatus.CANCELLED.name());
        notice.setVersion(version + 1);
        LambdaUpdateWrapper<IdleAssetNotice> wrapper = new LambdaUpdateWrapper<IdleAssetNotice>()
                .eq(IdleAssetNotice::getId, id)
                .eq(IdleAssetNotice::getTenantId, TenantContext.requireTenantId())
                .eq(IdleAssetNotice::getAssetId, notice.getAssetId())
                .eq(IdleAssetNotice::getStatus, currentStatus.name())
                .eq(IdleAssetNotice::getVersion, version);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        int updated = idleAssetNoticeMapper.update(notice, wrapper);
        if (updated != 1) {
            throw new BusinessException("闲置资产公告已变更，请刷新后重试");
        }
        return notice;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteNotice(Long id) {
        requirePermission("idleasset:delete");
        IdleAssetNotice notice = getByIdInternal(id);
        if (parseStatus(notice.getStatus()) != IdleAssetStatus.CANCELLED) {
            throw new BusinessException("仅已取消的闲置资产公告可以删除");
        }
        LambdaQueryWrapper<IdleAssetNotice> wrapper = new LambdaQueryWrapper<IdleAssetNotice>()
                .eq(IdleAssetNotice::getId, id)
                .eq(IdleAssetNotice::getTenantId, TenantContext.requireTenantId())
                .eq(IdleAssetNotice::getAssetId, notice.getAssetId())
                .eq(IdleAssetNotice::getStatus, IdleAssetStatus.CANCELLED.name())
                .eq(IdleAssetNotice::getVersion, versionOf(notice.getVersion()));
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        int deleted = idleAssetNoticeMapper.delete(wrapper);
        if (deleted != 1) {
            throw new BusinessException("闲置资产公告已变更，请刷新后重试");
        }
    }

    private Asset loadAccessibleAsset(Long assetId, String tenantId, String operation) {
        if (assetId == null || assetId <= 0) {
            throw new BusinessException("闲置资产公告必须关联有效资产");
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

    private IdleAssetStatus parseStatus(String status) {
        try {
            return IdleAssetStatus.valueOf(status);
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new BusinessException("闲置资产公告状态无效");
        }
    }

    private void validateCreateDTO(IdleAssetCreateDTO dto) {
        if (dto == null || dto.getAssetId() == null) {
            throw new BusinessException("闲置资产公告必须关联有效资产");
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
        org.springframework.security.core.Authentication authentication =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = authentication != null
                && !(authentication instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream().anyMatch(authority -> permission.equals(authority.getAuthority()));
        if (!permitted) {
            throw new AccessDeniedException("缺少闲置资产权限: " + permission);
        }
    }
}
