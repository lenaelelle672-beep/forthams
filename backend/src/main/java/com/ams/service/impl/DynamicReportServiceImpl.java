package com.ams.service.impl;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.ams.entity.SavedReport;
import com.ams.mapper.SavedReportMapper;
import com.ams.service.DynamicReportService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DynamicReportServiceImpl implements DynamicReportService {

    private final SavedReportMapper savedReportMapper;

    @Override
    public Page<SavedReport> list(String reportType, String keyword, Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<SavedReport> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<SavedReport> wrapper = new LambdaQueryWrapper<SavedReport>()
                .eq(SavedReport::getTenantId, tenantId);
        if (reportType != null && !reportType.isEmpty()) {
            wrapper.eq(SavedReport::getReportType, reportType);
        }
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(SavedReport::getReportName, keyword);
        }
        wrapper.orderByDesc(SavedReport::getCreateTime);
        return savedReportMapper.selectPage(page, wrapper);
    }

    @Override
    public SavedReport getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return savedReportMapper.selectOne(new LambdaQueryWrapper<SavedReport>()
                .eq(SavedReport::getId, id)
                .eq(SavedReport::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SavedReport create(SavedReport report) {
        String tenantId = TenantContext.requireTenantId();
        report.setTenantId(tenantId);
        savedReportMapper.insert(report);
        return report;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SavedReport update(Long id, SavedReport report) {
        String tenantId = TenantContext.requireTenantId();
        report.setId(id);
        report.setTenantId(tenantId);
        savedReportMapper.updateById(report);
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        savedReportMapper.delete(new LambdaQueryWrapper<SavedReport>()
                .eq(SavedReport::getId, id)
                .eq(SavedReport::getTenantId, tenantId));
    }

    @Override
    public List<Map<String, Object>> executeReport(Long savedReportId) {
        SavedReport report = getById(savedReportId);
        if (report == null) throw new IllegalArgumentException("SavedReport not found: " + savedReportId);

        // 解析 configJson
        Map<String, Object> config;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = com.fasterxml.jackson.databind.json.JsonMapper.builder()
                    .build()
                    .readValue(report.getConfigJson(), Map.class);
            config = parsed;
        } catch (JsonProcessingException e) {
            throw new BusinessException(500, "INVALID_REPORT_CONFIG", "Invalid configJson: " + e.getMessage(), e);
        }

        // 根据报表类型和配置动态执行查询
        // 简化实现：返回模拟数据
        // 完整实现应使用 MyBatis-Plus 动态 SQL 或 JdbcTemplate
        String reportType = report.getReportType();
        List<Map<String, Object>> result = new ArrayList<>();

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("reportName", report.getReportName());
        row.put("reportType", reportType);
        row.put("generatedAt", new Date().toString());
        row.put("totalCount", 42);
        row.put("fields", config.getOrDefault("fields", Collections.emptyList()));
        result.add(row);

        return result;
    }
}
