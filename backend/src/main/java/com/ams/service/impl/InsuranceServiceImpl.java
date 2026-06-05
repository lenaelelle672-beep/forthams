package com.ams.service.impl;

import com.ams.entity.Insurance;
import com.ams.mapper.InsuranceMapper;
import com.ams.service.InsuranceService;
import com.ams.context.TenantContext;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InsuranceServiceImpl implements InsuranceService {
    private final InsuranceMapper insuranceMapper;

    @Override
    public Page<Insurance> listInsurance(String keyword, String insuranceType, String status,
                                         LocalDate startDate, LocalDate endDate, Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<Insurance> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Insurance> wrapper = new LambdaQueryWrapper<Insurance>()
                .eq(Insurance::getTenantId, tenantId);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(Insurance::getPolicyNo, keyword)
                    .or().like(Insurance::getInsuranceName, keyword)
                    .or().like(Insurance::getInsurer, keyword));
        }
        if (insuranceType != null && !insuranceType.isEmpty()) {
            wrapper.eq(Insurance::getInsuranceType, insuranceType);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Insurance::getStatus, status);
        }
        if (startDate != null) {
            wrapper.ge(Insurance::getStartDate, startDate);
        }
        if (endDate != null) {
            wrapper.le(Insurance::getEndDate, endDate);
        }
        wrapper.orderByDesc(Insurance::getCreateTime);
        return insuranceMapper.selectPage(page, wrapper);
    }

    @Override
    public Insurance getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return insuranceMapper.selectOne(new LambdaQueryWrapper<Insurance>()
                .eq(Insurance::getId, id)
                .eq(Insurance::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Insurance create(Insurance insurance) {
        String tenantId = TenantContext.requireTenantId();
        insurance.setTenantId(tenantId);
        insurance.setStatus("ACTIVE");
        insuranceMapper.insert(insurance);
        return insurance;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Insurance update(Long id, Insurance insurance) {
        String tenantId = TenantContext.requireTenantId();
        Insurance existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("Insurance not found");
        }
        insurance.setId(id);
        insurance.setTenantId(tenantId);
        insuranceMapper.updateById(insurance);
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        Insurance existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("Insurance not found");
        }
        insuranceMapper.deleteById(id);
    }

    @Override
    public List<Insurance> getUpcomingExpirations(int days) {
        String tenantId = TenantContext.requireTenantId();
        LocalDate warningDate = LocalDate.now().plusDays(days);
        return insuranceMapper.findExpiringSoon(tenantId, warningDate);
    }

    @Override
    public List<Insurance> getExpiringPolicies(int days) {
        return getUpcomingExpirations(days);
    }

    @Override
    public BigDecimal getTotalPremiumByAssetId(Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        List<Insurance> insurances = insuranceMapper.selectList(new LambdaQueryWrapper<Insurance>()
                .eq(Insurance::getTenantId, tenantId)
                .eq(Insurance::getStatus, "ACTIVE")
                .like(Insurance::getAssetIds, String.valueOf(assetId)));
        return insurances.stream()
                .map(Insurance::getPremium)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}