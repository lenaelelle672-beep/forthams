package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AssetRevaluationApproveDTO;
import com.ams.dto.AssetRevaluationCreateDTO;
import com.ams.dto.AssetRevaluationUpdateDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetRevaluation;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.AssetRevaluationMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AssetRevaluationService {

    private static final Set<String> TERMINAL_STATUSES = Set.of(
            "RETIRED", "SCRAPPED", "DISPOSED", "WRITTEN_OFF"
    );

    private final AssetRevaluationMapper revaluationMapper;
    private final AssetMapper assetMapper;

    // ── CRUD ─────────────────────────────────────────────────────────────

    public Page<AssetRevaluation> getPage(int page, int size, String status, Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        QueryWrapper<AssetRevaluation> wrapper = new QueryWrapper<AssetRevaluation>()
                .eq("ar.tenant_id", tenantId)
                .orderByDesc("ar.id");
        if (status != null && !status.isBlank()) {
            wrapper.eq("ar.status", status);
        }
        if (assetId != null) {
            wrapper.eq("ar.asset_id", assetId);
        }
        // 使用自定义查询关联资产名称
        return revaluationMapper.selectPage(new Page<>(page, size), wrapper);
    }

    public AssetRevaluation getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        AssetRevaluation revaluation = revaluationMapper.selectOne(
                new QueryWrapper<AssetRevaluation>()
                        .eq("tenant_id", tenantId)
                        .eq("id", id));
        if (revaluation == null) {
            throw new BusinessException("减值/重估记录不存在");
        }
        // 填充资产信息
        Asset asset = assetMapper.selectById(revaluation.getAssetId());
        if (asset != null) {
            revaluation.setAssetName(asset.getAssetName());
            revaluation.setAssetNo(asset.getAssetNo());
        }
        return revaluation;
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetRevaluation create(AssetRevaluationCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();

        // 校验资产存在且非终态
        Asset asset = assetMapper.selectOne(new QueryWrapper<Asset>()
                .eq("tenant_id", tenantId)
                .eq("id", dto.assetId()));
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }
        if (isTerminal(asset.getStatus())) {
            throw new BusinessException("终态资产不可进行减值/重估");
        }
        if (dto.newValue().compareTo(java.math.BigDecimal.ZERO) < 0) {
            throw new BusinessException("新值不能为负数");
        }

        AssetRevaluation revaluation = new AssetRevaluation();
        revaluation.setTenantId(tenantId);
        revaluation.setAssetId(dto.assetId());
        revaluation.setRevaluationType(dto.revaluationType());
        revaluation.setPreviousValue(asset.getCurrentValue() != null
                ? asset.getCurrentValue() : asset.getOriginalValue());
        revaluation.setNewValue(dto.newValue());
        revaluation.setReason(dto.reason());
        revaluation.setEvidence(dto.evidence());
        revaluation.setStatus("PENDING");

        revaluationMapper.insert(revaluation);

        revaluation.setAssetName(asset.getAssetName());
        revaluation.setAssetNo(asset.getAssetNo());
        return revaluation;
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetRevaluation update(Long id, AssetRevaluationUpdateDTO dto) {
        AssetRevaluation existing = getById(id);
        if (!"PENDING".equals(existing.getStatus())) {
            throw new BusinessException("只能编辑待审批的记录");
        }

        existing.setRevaluationType(dto.revaluationType());
        existing.setNewValue(dto.newValue());
        existing.setReason(dto.reason());
        existing.setEvidence(dto.evidence());
        revaluationMapper.updateById(existing);
        return existing;
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        AssetRevaluation existing = getById(id);
        if (!"PENDING".equals(existing.getStatus())) {
            throw new BusinessException("只能删除待审批的记录");
        }
        revaluationMapper.deleteById(id);
    }

    // ── 审批 ─────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public AssetRevaluation approve(Long id, String status, Long approvedBy) {
        AssetRevaluation revaluation = getById(id);
        if (!"PENDING".equals(revaluation.getStatus())) {
            throw new BusinessException("该记录已被审批");
        }

        revaluation.setStatus(status);
        revaluation.setApprovedBy(approvedBy);
        revaluation.setApprovedAt(LocalDateTime.now());
        revaluationMapper.updateById(revaluation);

        // 审批通过后自动更新 Asset.currentValue
        if ("APPROVED".equals(status)) {
            Asset asset = assetMapper.selectById(revaluation.getAssetId());
            if (asset == null) {
                throw new BusinessException("关联资产不存在");
            }
            asset.setCurrentValue(revaluation.getNewValue());
            assetMapper.updateById(asset);
        }

        return revaluation;
    }

    // ── 辅助 ─────────────────────────────────────────────────────────────

    private boolean isTerminal(String status) {
        return status != null && TERMINAL_STATUSES.contains(status.toUpperCase());
    }
}
