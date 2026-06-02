package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.IdleAssetCreateDTO;
import com.ams.entity.Asset;
import com.ams.entity.IdleAssetNotice;
import com.ams.enums.AssetStatus;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.IdleAssetNoticeMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.ams.annotation.DataScope;
@Service
@RequiredArgsConstructor
public class IdleAssetService {

    private static final String STATUS_PUBLISHED = "PUBLISHED";
    private static final String STATUS_CLAIM_PENDING = "CLAIM_PENDING";
    private static final String STATUS_CLAIMED = "CLAIMED";
    private static final String STATUS_CANCELLED = "CANCELLED";
    private static final String CLAIM_STATUS_PENDING = "PENDING";
    private static final String CLAIM_STATUS_APPROVED = "APPROVED";
    private static final String CLAIM_STATUS_REJECTED = "REJECTED";

    private final IdleAssetNoticeMapper idleAssetNoticeMapper;
    private final AssetMapper assetMapper;
    private final AssetLifecycleService assetLifecycleService;

    @DataScope(userColumn = "create_by")
    public Page<IdleAssetNotice> queryIdleAssets(Integer page, Integer pageSize, String status) {
        String tenantId = TenantContext.requireTenantId();
        Page<IdleAssetNotice> pageParam = new Page<>(page, pageSize);
        QueryWrapper<IdleAssetNotice> wrapper = new QueryWrapper<>();
        wrapper.eq("tenant_id", tenantId);

        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        wrapper.orderByDesc("create_time");

        return idleAssetNoticeMapper.selectPage(pageParam, wrapper);
    }

    public IdleAssetNotice getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        IdleAssetNotice notice = idleAssetNoticeMapper.selectOne(new QueryWrapper<IdleAssetNotice>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (notice == null) {
            throw new BusinessException("闲置资产公告不存在");
        }
        return notice;
    }

    @Transactional(rollbackFor = Exception.class)
    public IdleAssetNotice publishNotice(IdleAssetCreateDTO dto, Long userId) {
        String tenantId = TenantContext.requireTenantId();
        Asset asset = requireIdleAsset(dto.getAssetId(), tenantId);
        ensureNoActiveNotice(dto.getAssetId(), tenantId);

        IdleAssetNotice notice = new IdleAssetNotice();
        notice.setTenantId(tenantId);
        notice.setAssetId(asset.getId());
        notice.setIdleDays(dto.getIdleDays() == null ? 0 : dto.getIdleDays());
        notice.setTitle(resolveTitle(dto, asset));
        notice.setReason(dto.getReason().trim());
        notice.setClaimDeadline(dto.getClaimDeadline());
        notice.setStatus(STATUS_PUBLISHED);
        notice.setNoticeDate(LocalDate.now());
        notice.setCreateBy(userId);
        idleAssetNoticeMapper.insert(notice);
        return notice;
    }

    @Transactional(rollbackFor = Exception.class)
    public IdleAssetNotice claimAsset(Long id, Long claimantId) {
        IdleAssetNotice notice = getById(id);
        if (claimantId == null) {
            throw new BusinessException("认领人不能为空");
        }
        if (!STATUS_PUBLISHED.equals(notice.getStatus())) {
            throw new BusinessException("仅已发布状态可认领");
        }
        if (notice.getClaimDeadline() != null && notice.getClaimDeadline().isBefore(LocalDate.now())) {
            throw new BusinessException("闲置资产认领已截止");
        }
        notice.setClaimantId(claimantId);
        notice.setClaimDate(LocalDate.now());
        notice.setClaimStatus(CLAIM_STATUS_PENDING);
        notice.setStatus(STATUS_CLAIM_PENDING);
        idleAssetNoticeMapper.updateById(notice);
        return notice;
    }

    @Transactional(rollbackFor = Exception.class)
    public IdleAssetNotice approveClaim(Long id, Long approverId, String opinion) {
        IdleAssetNotice notice = requireClaimPending(id);
        if (notice.getClaimantId() == null) {
            throw new BusinessException("认领人不能为空");
        }

        String approvalOpinion = normalizeOpinion(opinion, "同意认领");
        assetLifecycleService.transitionAsset(
                notice.getAssetId(),
                AssetStatus.IN_USE,
                "IDLE_CLAIM_APPROVED",
                "闲置认领审批通过: " + approvalOpinion,
                approverId,
                asset -> asset.setUserId(notice.getClaimantId())
        );

        notice.setStatus(STATUS_CLAIMED);
        notice.setClaimStatus(CLAIM_STATUS_APPROVED);
        notice.setClaimApprovedBy(approverId);
        notice.setClaimApprovedTime(LocalDateTime.now());
        notice.setApprovalOpinion(approvalOpinion);
        idleAssetNoticeMapper.updateById(notice);
        return notice;
    }

    @Transactional(rollbackFor = Exception.class)
    public IdleAssetNotice rejectClaim(Long id, Long approverId, String opinion) {
        IdleAssetNotice notice = requireClaimPending(id);
        notice.setStatus(STATUS_PUBLISHED);
        notice.setClaimStatus(CLAIM_STATUS_REJECTED);
        notice.setClaimantId(null);
        notice.setClaimDate(null);
        notice.setClaimApprovedBy(approverId);
        notice.setClaimApprovedTime(LocalDateTime.now());
        notice.setApprovalOpinion(normalizeOpinion(opinion, "不同意认领"));
        idleAssetNoticeMapper.updateById(notice);
        return notice;
    }

    @Transactional(rollbackFor = Exception.class)
    public IdleAssetNotice cancelNotice(Long id) {
        IdleAssetNotice notice = getById(id);
        if (STATUS_CLAIMED.equals(notice.getStatus())) {
            throw new BusinessException("已认领公告不可取消");
        }
        notice.setStatus(STATUS_CANCELLED);
        idleAssetNoticeMapper.updateById(notice);
        return notice;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteNotice(Long id) {
        String tenantId = TenantContext.requireTenantId();
        getById(id);
        idleAssetNoticeMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<IdleAssetNotice>()
                .eq(IdleAssetNotice::getId, id)
                .eq(IdleAssetNotice::getTenantId, tenantId));
    }

    private Asset requireIdleAsset(Long assetId, String tenantId) {
        Asset asset = assetMapper.selectOne(new QueryWrapper<Asset>()
                .eq("id", assetId)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (asset == null) {
            throw new BusinessException(400, "资产不存在或不属于当前租户");
        }
        if (!AssetStatus.IDLE.matches(asset.getStatus())) {
            throw new BusinessException("仅闲置资产可发布认领公告");
        }
        return asset;
    }

    private void ensureNoActiveNotice(Long assetId, String tenantId) {
        Long activeCount = idleAssetNoticeMapper.selectCount(new QueryWrapper<IdleAssetNotice>()
                .eq("tenant_id", tenantId)
                .eq("asset_id", assetId)
                .in("status", List.of(STATUS_PUBLISHED, STATUS_CLAIM_PENDING, STATUS_CLAIMED)));
        if (activeCount != null && activeCount > 0) {
            throw new BusinessException("该资产已有有效闲置公告");
        }
    }

    private IdleAssetNotice requireClaimPending(Long id) {
        IdleAssetNotice notice = getById(id);
        if (!STATUS_CLAIM_PENDING.equals(notice.getStatus()) || !CLAIM_STATUS_PENDING.equals(notice.getClaimStatus())) {
            throw new BusinessException("仅待审批认领申请可审核");
        }
        return notice;
    }

    private String resolveTitle(IdleAssetCreateDTO dto, Asset asset) {
        if (dto.getTitle() != null && !dto.getTitle().isBlank()) {
            return dto.getTitle().trim();
        }
        return asset.getAssetName() + " 闲置认领公告";
    }

    private String normalizeOpinion(String opinion, String fallback) {
        return opinion == null || opinion.isBlank() ? fallback : opinion.trim();
    }
}
