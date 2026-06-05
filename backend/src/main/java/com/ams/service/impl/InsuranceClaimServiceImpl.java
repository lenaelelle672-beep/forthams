package com.ams.service.impl;

import com.ams.entity.InsuranceClaim;
import com.ams.entity.Insurance;
import com.ams.mapper.InsuranceClaimMapper;
import com.ams.mapper.InsuranceMapper;
import com.ams.service.InsuranceClaimService;
import com.ams.context.TenantContext;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InsuranceClaimServiceImpl implements InsuranceClaimService {
    private final InsuranceClaimMapper claimMapper;
    private final InsuranceMapper insuranceMapper;

    @Override
    public Page<InsuranceClaim> listClaims(Long insuranceId, String status, Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<InsuranceClaim> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<InsuranceClaim> wrapper = new LambdaQueryWrapper<InsuranceClaim>()
                .eq(InsuranceClaim::getTenantId, tenantId);
        if (insuranceId != null) {
            wrapper.eq(InsuranceClaim::getInsuranceId, insuranceId);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(InsuranceClaim::getStatus, status);
        }
        wrapper.orderByDesc(InsuranceClaim::getCreateTime);
        Page<InsuranceClaim> result = claimMapper.selectPage(page, wrapper);

        result.getRecords().forEach(claim -> {
            Insurance insurance = insuranceMapper.selectById(claim.getInsuranceId());
            if (insurance != null) {
                claim.setPolicyNo(insurance.getPolicyNo());
                claim.setInsuranceName(insurance.getInsuranceName());
            }
        });

        return result;
    }

    @Override
    public InsuranceClaim getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return claimMapper.selectOne(new LambdaQueryWrapper<InsuranceClaim>()
                .eq(InsuranceClaim::getId, id)
                .eq(InsuranceClaim::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InsuranceClaim create(InsuranceClaim claim) {
        String tenantId = TenantContext.requireTenantId();
        claim.setTenantId(tenantId);
        claim.setStatus("PENDING");
        claimMapper.insert(claim);
        return claim;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InsuranceClaim update(Long id, InsuranceClaim claim) {
        String tenantId = TenantContext.requireTenantId();
        InsuranceClaim existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("Insurance claim not found");
        }
        claim.setId(id);
        claim.setTenantId(tenantId);
        claimMapper.updateById(claim);
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        InsuranceClaim existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("Insurance claim not found");
        }
        claimMapper.deleteById(id);
    }
}