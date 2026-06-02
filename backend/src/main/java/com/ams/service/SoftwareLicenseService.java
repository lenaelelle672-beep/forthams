package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.LicenseAssignment;
import com.ams.entity.SoftwareLicense;
import com.ams.mapper.LicenseAssignmentMapper;
import com.ams.mapper.SoftwareLicenseMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SoftwareLicenseService {

    private final SoftwareLicenseMapper licenseMapper;
    private final LicenseAssignmentMapper assignmentMapper;

    public Page<SoftwareLicense> getPage(Integer page, Integer pageSize, String keyword, String status) {
        LambdaQueryWrapper<SoftwareLicense> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            wrapper.like(SoftwareLicense::getLicenseName, keyword)
                   .or().like(SoftwareLicense::getManufacturer, keyword);
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq(SoftwareLicense::getStatus, status);
        }
        wrapper.orderByDesc(SoftwareLicense::getCreatedAt);
        return licenseMapper.selectPage(new Page<>(page, pageSize), wrapper);
    }

    public SoftwareLicense getById(Long id) {
        SoftwareLicense l = licenseMapper.selectById(id);
        if (l == null) throw new BusinessException("许可证不存在");
        return l;
    }

    public List<SoftwareLicense> getExpiring(Integer days) {
        LocalDate today = LocalDate.now();
        LocalDate future = today.plusDays(days == null ? 30 : days);
        return licenseMapper.findExpiring(today, future);
    }

    public int getUsedSeats(Long licenseId) {
        return assignmentMapper.countActiveByLicense(licenseId);
    }

    public List<LicenseAssignment> getActiveAssignments(Long licenseId) {
        return assignmentMapper.findActiveByLicense(licenseId);
    }

    public SoftwareLicense create(SoftwareLicense l) {
        if (l.getStatus() == null) l.setStatus("ACTIVE");
        licenseMapper.insert(l);
        return l;
    }

    public SoftwareLicense update(Long id, SoftwareLicense l) {
        getById(id);
        l.setId(id);
        licenseMapper.updateById(l);
        return l;
    }

    public void delete(Long id) {
        int used = assignmentMapper.countActiveByLicense(id);
        if (used > 0) throw new BusinessException("该许可证尚有 " + used + " 个分配未归还，无法删除");
        licenseMapper.deleteById(id);
    }

    @Transactional
    public LicenseAssignment assign(Long licenseId, Long assetId, Long userId, String notes) {
        SoftwareLicense l = getById(licenseId);
        int used = assignmentMapper.countActiveByLicense(licenseId);
        if (used >= l.getTotalSeats()) {
            throw new BusinessException("许可证席位已满 (" + used + "/" + l.getTotalSeats() + ")");
        }
        LicenseAssignment a = new LicenseAssignment();
        a.setLicenseId(licenseId);
        a.setAssetId(assetId);
        a.setUserId(userId);
        a.setAssignedDate(LocalDate.now());
        a.setNotes(notes);
        assignmentMapper.insert(a);
        return a;
    }

    @Transactional
    public void returnLicense(Long assignmentId, String notes) {
        LicenseAssignment a = assignmentMapper.selectById(assignmentId);
        if (a == null) throw new BusinessException("分配记录不存在");
        if (a.getReturnedDate() != null) throw new BusinessException("该席位已归还");
        a.setReturnedDate(LocalDate.now());
        if (notes != null) a.setNotes(notes);
        assignmentMapper.updateById(a);
    }

    public Map<String, Object> getSummary() {
        long total = licenseMapper.selectCount(new LambdaQueryWrapper<>());
        long active = licenseMapper.selectCount(new LambdaQueryWrapper<SoftwareLicense>()
                .eq(SoftwareLicense::getStatus, "ACTIVE"));
        List<SoftwareLicense> expiring30 = getExpiring(30);
        return Map.of("total", total, "active", active, "expiringSoon", expiring30.size());
    }
}
