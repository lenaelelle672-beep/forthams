package com.ams.service;

import com.ams.entity.LicenseAssignment;
import com.ams.entity.SamComplianceDetail;
import com.ams.entity.SamComplianceScan;
import com.ams.entity.SoftwareLicense;
import com.ams.mapper.LicenseAssignmentMapper;
import com.ams.mapper.SamComplianceDetailMapper;
import com.ams.mapper.SamComplianceScanMapper;
import com.ams.mapper.SoftwareLicenseMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class SamComplianceService {

    private final SoftwareLicenseMapper licenseMapper;
    private final LicenseAssignmentMapper assignmentMapper;
    private final SamComplianceScanMapper scanMapper;
    private final SamComplianceDetailMapper detailMapper;

    /**
     * 执行一次完整的 SAM 合规扫描。
     * 遍历所有活跃许可证，计算已分配席位，判定合规状态，汇总结果。
     */
    @Transactional
    public SamComplianceScan runScan() {
        // 创建扫描记录
        SamComplianceScan scan = new SamComplianceScan();
        scan.setScanDate(LocalDateTime.now());
        scan.setStatus("RUNNING");
        scanMapper.insert(scan);
        Long scanId = scan.getId();

        // 获取所有活跃许可证
        List<SoftwareLicense> licenses = licenseMapper.selectList(
                new LambdaQueryWrapper<SoftwareLicense>()
                        .eq(SoftwareLicense::getDeleted, 0)
        );

        int total = licenses.size();
        int compliant = 0;
        int overused = 0;
        int underused = 0;
        int expired = 0;

        List<SamComplianceDetail> details = new ArrayList<>();

        for (SoftwareLicense lic : licenses) {
            String complianceStatus;
            String riskLevel;
            String recommendation;
            int usedSeats = 0;

            // 检查是否过期
            boolean isExpired = lic.getExpiryDate() != null
                    && lic.getExpiryDate().isBefore(LocalDate.now());

            if (isExpired) {
                complianceStatus = "EXPIRED";
                riskLevel = "MEDIUM";
                recommendation = "许可证已过期，请续期或重新购买";
                expired++;
            } else if (lic.getTotalSeats() == null || lic.getTotalSeats() <= 0) {
                // 无限／未限制席位的许可证视为合规
                complianceStatus = "COMPLIANT";
                riskLevel = "LOW";
                recommendation = "无限席位许可，无需调整";
                compliant++;
            } else {
                usedSeats = assignmentMapper.countActiveByLicense(lic.getId());

                if (usedSeats > lic.getTotalSeats()) {
                    complianceStatus = "OVERUSED";
                    riskLevel = "HIGH";
                    recommendation = "超出许可席位 " + (usedSeats - lic.getTotalSeats())
                            + " 个，请立即回收或增购";
                    overused++;
                } else if (usedSeats == 0) {
                    complianceStatus = "UNDERUSED";
                    riskLevel = "LOW";
                    recommendation = "许可未使用，建议重新分配或回收";
                    underused++;
                } else {
                    complianceStatus = "COMPLIANT";
                    riskLevel = "LOW";
                    recommendation = "合规";
                    compliant++;
                }
            }

            SamComplianceDetail detail = new SamComplianceDetail();
            detail.setScanId(scanId);
            detail.setLicenseId(lic.getId());
            detail.setSoftwareName(lic.getLicenseName());
            detail.setLicenseType(lic.getLicenseType());
            detail.setTotalSeats(lic.getTotalSeats());
            detail.setUsedSeats(usedSeats);
            detail.setComplianceStatus(complianceStatus);
            detail.setRiskLevel(riskLevel);
            detail.setRecommendation(recommendation);
            details.add(detail);
        }

        // 批量插入详情
        if (!details.isEmpty()) {
            for (SamComplianceDetail d : details) {
                detailMapper.insert(d);
            }
        }

        // 计算合规率
        BigDecimal rate;
        if (total > 0) {
            int compliantCount = compliant;
            rate = BigDecimal.valueOf(compliantCount)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
        } else {
            rate = BigDecimal.valueOf(100);
        }

        // 更新扫描汇总
        scan.setTotalLicenses(total);
        scan.setCompliantCount(compliant);
        scan.setOverusedCount(overused);
        scan.setUnderusedCount(underused);
        scan.setExpiredCount(expired);
        scan.setComplianceRate(rate);
        scan.setStatus("COMPLETED");
        scanMapper.updateById(scan);

        log.info("SAM扫描完成: 总数={}, 合规={}, 超用={}, 闲置={}, 过期={}, 合规率={}%",
                total, compliant, overused, underused, expired, rate);

        return scan;
    }

    /**
     * 获取最新一次扫描结果
     */
    public Map<String, Object> getLatestScan() {
        LambdaQueryWrapper<SamComplianceScan> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(SamComplianceScan::getId);
        wrapper.last("LIMIT 1");
        SamComplianceScan scan = scanMapper.selectOne(wrapper);

        if (scan == null) {
            return Map.of("scan", null, "details", Collections.emptyList(), "highRiskCount", 0);
        }

        List<SamComplianceDetail> details = detailMapper.findByScanId(scan.getId());
        long highRiskCount = details.stream().filter(d -> "HIGH".equals(d.getRiskLevel())).count();

        // 按合规状态分组统计
        Map<String, Long> statusCount = new HashMap<>();
        for (SamComplianceDetail d : details) {
            statusCount.merge(d.getComplianceStatus(), 1L, Long::sum);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scan", scan);
        result.put("details", details);
        result.put("highRiskCount", highRiskCount);
        result.put("statusCount", statusCount);
        return result;
    }

    /**
     * 获取扫描历史（分页）
     */
    public Page<SamComplianceScan> getScanHistory(Integer page, Integer pageSize) {
        LambdaQueryWrapper<SamComplianceScan> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(SamComplianceScan::getId);
        return scanMapper.selectPage(new Page<>(page, pageSize), wrapper);
    }

    /**
     * 获取指定扫描的详情
     */
    public Map<String, Object> getScanDetails(Long scanId) {
        SamComplianceScan scan = scanMapper.selectById(scanId);
        if (scan == null) {
            return Map.of("scan", null, "details", Collections.emptyList());
        }
        List<SamComplianceDetail> details = detailMapper.findByScanId(scanId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scan", scan);
        result.put("details", details);
        return result;
    }

    /**
     * 获取合规仪表盘汇总数据
     */
    public Map<String, Object> getDashboardData() {
        // 最新扫描
        LambdaQueryWrapper<SamComplianceScan> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByDesc(SamComplianceScan::getId);
        wrapper.last("LIMIT 1");
        SamComplianceScan latestScan = scanMapper.selectOne(wrapper);

        Map<String, Object> data = new LinkedHashMap<>();

        if (latestScan == null) {
            data.put("hasData", false);
            data.put("complianceRate", 0);
            data.put("totalLicenses", 0);
            data.put("compliantCount", 0);
            data.put("overusedCount", 0);
            data.put("underusedCount", 0);
            data.put("expiredCount", 0);
            data.put("highRiskItems", Collections.emptyList());
            data.put("byLicenseType", Collections.emptyMap());
            return data;
        }

        List<SamComplianceDetail> details = detailMapper.findByScanId(latestScan.getId());

        // 高风险项
        List<SamComplianceDetail> highRiskItems = details.stream()
                .filter(d -> "HIGH".equals(d.getRiskLevel()))
                .toList();

        // 按许可类型分组统计
        Map<String, Long> byLicenseType = new HashMap<>();
        for (SamComplianceDetail d : details) {
            String type = d.getLicenseType() != null ? d.getLicenseType() : "未知";
            byLicenseType.merge(type, 1L, Long::sum);
        }

        data.put("hasData", true);
        data.put("complianceRate", latestScan.getComplianceRate());
        data.put("totalLicenses", latestScan.getTotalLicenses());
        data.put("compliantCount", latestScan.getCompliantCount());
        data.put("overusedCount", latestScan.getOverusedCount());
        data.put("underusedCount", latestScan.getUnderusedCount());
        data.put("expiredCount", latestScan.getExpiredCount());
        data.put("highRiskItems", highRiskItems);
        data.put("byLicenseType", byLicenseType);
        data.put("scanId", latestScan.getId());
        data.put("scanDate", latestScan.getScanDate());

        return data;
    }
}
