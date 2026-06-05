package com.ams.service.impl;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.InspectionStatisticsDTO;
import com.ams.entity.Asset;
import com.ams.entity.InspectionRecord;
import com.ams.entity.InspectionTemplate;
import com.ams.mapper.InspectionRecordMapper;
import com.ams.service.AssetService;
import com.ams.service.InspectionRecordService;
import com.ams.service.InspectionTemplateService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 检验记录服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InspectionRecordServiceImpl implements InspectionRecordService {

    private final InspectionRecordMapper recordMapper;
    private final AssetService assetService;
    private final InspectionTemplateService templateService;

    @Override
    public Page<InspectionRecord> listRecords(String keyword, Long assetId, String inspectionType,
                                                String status, LocalDate startDate, LocalDate endDate,
                                                Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<InspectionRecord> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<InspectionRecord> wrapper = new LambdaQueryWrapper<InspectionRecord>()
                .eq(InspectionRecord::getTenantId, tenantId);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(InspectionRecord::getRecordNo, keyword)
                    .or().like(InspectionRecord::getInspectorName, keyword));
        }
        if (assetId != null) {
            wrapper.eq(InspectionRecord::getAssetId, assetId);
        }
        if (inspectionType != null && !inspectionType.isEmpty()) {
            wrapper.eq(InspectionRecord::getInspectionType, inspectionType);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(InspectionRecord::getStatus, status);
        }
        if (startDate != null) {
            wrapper.ge(InspectionRecord::getInspectionDate, startDate);
        }
        if (endDate != null) {
            wrapper.le(InspectionRecord::getInspectionDate, endDate);
        }
        wrapper.orderByDesc(InspectionRecord::getInspectionDate);
        return recordMapper.selectPage(page, wrapper);
    }

    @Override
    public InspectionRecord getRecordById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return recordMapper.selectOne(new LambdaQueryWrapper<InspectionRecord>()
                .eq(InspectionRecord::getId, id)
                .eq(InspectionRecord::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InspectionRecord createRecord(InspectionRecord record) {
        String tenantId = TenantContext.requireTenantId();
        record.setTenantId(tenantId);

        // 校验资产存在性
        if (record.getAssetId() != null) {
            Asset asset = assetService.getAssetById(record.getAssetId());
            if (asset == null) {
                throw new BusinessException("资产不存在: assetId=" + record.getAssetId());
            }
        }

        // 设置默认值
        if (record.getStatus() == null) {
            record.setStatus("pending");
        }
        if (record.getResult() == null) {
            record.setResult("PENDING");
        }

        // 生成记录编号
        record.setRecordNo(generateRecordNo());

        recordMapper.insert(record);
        log.info("创建检验记录: recordId={}, recordNo={}", record.getId(), record.getRecordNo());
        return record;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InspectionRecord updateRecord(Long id, InspectionRecord record) {
        String tenantId = TenantContext.requireTenantId();
        InspectionRecord existing = getRecordById(id);
        if (existing == null) {
            throw new BusinessException("检验记录不存在");
        }

        // 校验资产存在性
        if (record.getAssetId() != null && !record.getAssetId().equals(existing.getAssetId())) {
            Asset asset = assetService.getAssetById(record.getAssetId());
            if (asset == null) {
                throw new BusinessException("资产不存在: assetId=" + record.getAssetId());
            }
        }

        record.setId(id);
        record.setTenantId(tenantId);
        recordMapper.updateById(record);
        log.info("更新检验记录: recordId={}", id);
        return getRecordById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteRecord(Long id) {
        InspectionRecord existing = getRecordById(id);
        if (existing == null) {
            throw new BusinessException("检验记录不存在");
        }
        recordMapper.deleteById(id);
        log.info("删除检验记录: recordId={}", id);
    }

    @Override
    public List<InspectionRecord> getRecordsByAssetId(Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        return recordMapper.selectByAssetId(tenantId, assetId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InspectionRecord createRecordFromTemplate(Long assetId, Long templateId) {
        String tenantId = TenantContext.requireTenantId();

        // 获取模板
        InspectionTemplate template = templateService.getTemplateById(templateId);
        if (template == null) {
            throw new BusinessException("检验模板不存在: templateId=" + templateId);
        }

        // 获取资产
        Asset asset = assetService.getAssetById(assetId);
        if (asset == null) {
            throw new BusinessException("资产不存在: assetId=" + assetId);
        }

        // 创建检验记录
        InspectionRecord record = new InspectionRecord();
        record.setTenantId(tenantId);
        record.setAssetId(assetId);
        record.setTemplateId(templateId);
        record.setInspectionType(template.getType());
        record.setInspectionDate(LocalDate.now());
        record.setStatus("pending");
        record.setResult("PENDING");

        // 计算下次检验日期
        if (template.getFrequency() != null && template.getFrequency() > 0) {
            record.setNextInspectionDate(LocalDate.now().plusMonths(template.getFrequency()));
        }

        // 生成记录编号
        record.setRecordNo(generateRecordNo());

        recordMapper.insert(record);
        log.info("根据模板创建检验记录: recordId={}, templateId={}, assetId={}",
                record.getId(), templateId, assetId);
        return record;
    }

    @Override
    public InspectionStatisticsDTO getStatistics(LocalDate startDate, LocalDate endDate) {
        String tenantId = TenantContext.requireTenantId();
        if (startDate == null) {
            startDate = LocalDate.now().withDayOfMonth(1);
        }
        if (endDate == null) {
            endDate = LocalDate.now();
        }

        Map<String, Object> statisticsMap = recordMapper.selectStatisticsByDateRange(tenantId, startDate, endDate);

        InspectionStatisticsDTO dto = new InspectionStatisticsDTO();
        dto.setDateRange(startDate + " 至 " + endDate);
        dto.setTotalCount(getLongValue(statisticsMap, "totalCount"));
        dto.setPassCount(getLongValue(statisticsMap, "completedCount"));
        dto.setFailCount(getLongValue(statisticsMap, "overdueCount"));

        long total = dto.getTotalCount();
        if (total > 0) {
            dto.setPassRate((dto.getPassCount() * 100.0) / total);
        } else {
            dto.setPassRate(0.0);
        }

        return dto;
    }

    @Override
    public List<Map<String, Object>> getChartsDataByType() {
        String tenantId = TenantContext.requireTenantId();
        return recordMapper.selectStatisticsByType(tenantId);
    }

    @Override
    public List<Map<String, Object>> getChartsDataByAssetCategory() {
        String tenantId = TenantContext.requireTenantId();
        return recordMapper.selectStatisticsByAssetCategory(tenantId);
    }

    /**
     * 生成记录编号
     */
    private String generateRecordNo() {
        return "IR-" + System.currentTimeMillis();
    }

    /**
     * 从 Map 中获取 Long 值
     */
    private Long getLongValue(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value == null) {
            return 0L;
        }
        if (value instanceof Long) {
            return (Long) value;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }
}