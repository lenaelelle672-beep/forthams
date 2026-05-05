package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.CompensationCreateDTO;
import com.ams.dto.CompensationUpdateDTO;
import com.ams.dto.CompensationValuationDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetCompensation;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.AssetCompensationMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class CompensationService {

    private final AssetCompensationMapper assetCompensationMapper;
    private final AssetMapper assetMapper;
    private final WorkflowDefinitionService workflowDefinitionService;

    public Page<AssetCompensation> queryCompensations(Integer page, Integer pageSize, String status, Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        Page<AssetCompensation> pageParam = new Page<>(page, pageSize);
        QueryWrapper<AssetCompensation> wrapper = new QueryWrapper<>();
        wrapper.eq("tenant_id", tenantId);

        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        if (assetId != null) {
            wrapper.eq("asset_id", assetId);
        }
        wrapper.orderByDesc("create_time");

        return assetCompensationMapper.selectPage(pageParam, wrapper);
    }

    public AssetCompensation getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        AssetCompensation compensation = assetCompensationMapper.selectOne(new QueryWrapper<AssetCompensation>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (compensation == null) {
            throw new BusinessException("赔偿记录不存在");
        }
        return compensation;
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetCompensation createCompensation(CompensationCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        AssetCompensation compensation = new AssetCompensation();
        BeanUtil.copyProperties(dto, compensation);
        compensation.setTenantId(tenantId);
        if (compensation.getResponsibleUserId() == null) {
            throw new BusinessException("赔偿责任人不能为空");
        }
        if (compensation.getAssetId() == null) {
            throw new BusinessException("资产不能为空");
        }
        workflowDefinitionService.requirePublishedDefinition("ASSET_COMPENSATION");
        if (compensation.getCompensationAmount() == null) {
            compensation.setCompensationAmount(estimateCompensation(dto).getEstimatedAmount());
        }

        BeanUtil.setProperty(compensation, "compensationNo", generateCompensationNo());
        BeanUtil.setProperty(compensation, "status", "PENDING");
        assetCompensationMapper.insert(compensation);
        return compensation;
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetCompensation updateCompensation(Long id, CompensationUpdateDTO dto) {
        AssetCompensation compensation = getById(id);
        BeanUtil.copyProperties(dto, compensation, "id", "compensationNo", "status", "createBy", "createTime");
        assetCompensationMapper.updateById(compensation);
        return compensation;
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetCompensation updateStatus(Long id, String status) {
        AssetCompensation compensation = getById(id);
        BeanUtil.setProperty(compensation, "status", status);
        assetCompensationMapper.updateById(compensation);
        return compensation;
    }

    public CompensationValuationDTO estimateCompensation(CompensationCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        if (dto.getAssetId() == null) {
            throw new BusinessException("资产不能为空");
        }
        Asset asset = assetMapper.selectOne(new QueryWrapper<Asset>()
                .eq("id", dto.getAssetId())
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }

        BigDecimal baseAmount = firstPositive(asset.getCurrentValue(), asset.getOriginalValue());
        if (baseAmount == null) {
            throw new BusinessException("资产缺少估值基础金额");
        }

        CompensationValuationDTO valuation = new CompensationValuationDTO();
        valuation.setAssetId(asset.getId());
        valuation.setCompensationType(dto.getCompensationType());
        valuation.setBaseAmount(baseAmount);
        valuation.setEstimatedAmount(baseAmount);
        valuation.setValuationBasis("按资产当前价值估算；当前价值缺失时使用资产原值。损坏比例、残值和人工覆盖规则需按审批意见确认。");
        return valuation;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteCompensation(Long id) {
        getById(id);
        assetCompensationMapper.deleteById(id);
    }

    private String generateCompensationNo() {
        String tenantId = TenantContext.requireTenantId();
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "CMP-" + dateStr + "-";

        Long count = assetCompensationMapper.selectCount(
            new QueryWrapper<AssetCompensation>()
                .eq("tenant_id", tenantId)
                .likeRight("compensation_no", prefix)
        );
        long sequence = (count == null ? 0 : count) + 1;
        return prefix + String.format("%03d", sequence);
    }

    private BigDecimal firstPositive(BigDecimal primary, BigDecimal fallback) {
        if (primary != null && primary.compareTo(BigDecimal.ZERO) > 0) {
            return primary;
        }
        if (fallback != null && fallback.compareTo(BigDecimal.ZERO) > 0) {
            return fallback;
        }
        return null;
    }
}
