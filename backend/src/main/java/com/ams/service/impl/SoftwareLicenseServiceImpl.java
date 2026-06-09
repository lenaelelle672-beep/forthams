package com.ams.service.impl;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.LicenseAssignment;
import com.ams.entity.SoftwareLicense;
import com.ams.mapper.LicenseAssignmentMapper;
import com.ams.mapper.SoftwareLicenseMapper;
import com.ams.service.SoftwareLicenseService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 软件许可证服务实现（桩实现，用于编译通过）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SoftwareLicenseServiceImpl implements SoftwareLicenseService {

    private final SoftwareLicenseMapper softwareLicenseMapper;
    private final LicenseAssignmentMapper licenseAssignmentMapper;

    @Override
    public Page<SoftwareLicense> getPage(Integer page, Integer pageSize, String keyword, String status) {
        String tenantId = TenantContext.requireTenantId();
        Page<SoftwareLicense> p = new Page<>(page, pageSize);
        LambdaQueryWrapper<SoftwareLicense> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SoftwareLicense::getTenantId, tenantId);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(SoftwareLicense::getLicenseName, keyword);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(SoftwareLicense::getStatus, status);
        }
        wrapper.orderByDesc(SoftwareLicense::getCreatedAt);
        return softwareLicenseMapper.selectPage(p, wrapper);
    }

    @Override
    public List<SoftwareLicense> getExpiring(Integer days) {
        String tenantId = TenantContext.requireTenantId();
        LocalDate today = LocalDate.now();
        LocalDate future = today.plusDays(days);
        return softwareLicenseMapper.findExpiring(tenantId, today, future);
    }

    @Override
    public Map<String, Object> getSummary() {
        String tenantId = TenantContext.requireTenantId();
        Map<String, Object> summary = new HashMap<>();
        long total = softwareLicenseMapper.selectCount(new LambdaQueryWrapper<SoftwareLicense>()
                .eq(SoftwareLicense::getTenantId, tenantId));
        summary.put("total", total);
        return summary;
    }

    @Override
    public SoftwareLicense getById(Long id) {
        SoftwareLicense license = softwareLicenseMapper.selectOne(new LambdaQueryWrapper<SoftwareLicense>()
                .eq(SoftwareLicense::getId, id)
                .eq(SoftwareLicense::getTenantId, TenantContext.requireTenantId()));
        if (license == null) {
            throw new BusinessException("许可证不存在");
        }
        return license;
    }

    @Override
    public int getUsedSeats(Long licenseId) {
        return licenseAssignmentMapper.countActiveByLicense(TenantContext.requireTenantId(), licenseId);
    }

    @Override
    public List<LicenseAssignment> getActiveAssignments(Long licenseId) {
        return licenseAssignmentMapper.findActiveByLicense(TenantContext.requireTenantId(), licenseId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SoftwareLicense create(SoftwareLicense license) {
        license.setTenantId(TenantContext.requireTenantId());
        softwareLicenseMapper.insert(license);
        return license;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SoftwareLicense update(Long id, SoftwareLicense license) {
        SoftwareLicense existing = getById(id);
        license.setId(id);
        license.setTenantId(existing.getTenantId());
        softwareLicenseMapper.updateById(license);
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        getById(id);
        softwareLicenseMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LicenseAssignment assign(Long licenseId, Long assetId, Long userId, String notes) {
        SoftwareLicense license = getById(licenseId);
        LicenseAssignment assignment = new LicenseAssignment();
        assignment.setTenantId(license.getTenantId());
        assignment.setLicenseId(license.getId());
        assignment.setAssetId(assetId);
        assignment.setUserId(userId);
        assignment.setAssignedDate(LocalDate.now());
        assignment.setNotes(notes);
        licenseAssignmentMapper.insert(assignment);
        return assignment;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void returnLicense(Long assignmentId, String notes) {
        LicenseAssignment assignment = licenseAssignmentMapper.selectOne(new LambdaQueryWrapper<LicenseAssignment>()
                .eq(LicenseAssignment::getId, assignmentId)
                .eq(LicenseAssignment::getTenantId, TenantContext.requireTenantId()));
        if (assignment != null) {
            assignment.setReturnedDate(LocalDate.now());
            if (notes != null) {
                assignment.setNotes(notes);
            }
            licenseAssignmentMapper.updateById(assignment);
        }
    }
}
