package com.ams.service.impl;

import com.ams.entity.Asset;
import com.ams.entity.DepreciationRecord;
import com.ams.entity.GeneralAuditEntry;
import com.ams.repository.DepreciationRecordRepository;
import com.ams.service.AuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 审计服务实现类 - 资产折旧计算模块 (SWARM-003)
 * 
 * 本服务提供资产折旧相关的审计功能，包括：
 * - 直线法折旧计算
 * - 双倍余额递减法折旧计算
 * - 月度折旧计划表生成
 * - 年度折旧汇总报表
 * - 折旧数据持久化
 * 
 * @since SWARM-003 Phase 2
 */
@Service
public class AuditServiceImpl implements AuditService {

    private final DepreciationRecordRepository depreciationRecordRepository;

    public AuditServiceImpl(DepreciationRecordRepository depreciationRecordRepository) {
        this.depreciationRecordRepository = depreciationRecordRepository;
    }

    /**
     * 计算资产直线法折旧
     * 
     * 公式: 年折旧额 = (原值 - 残值) / 预计使用年限
     * 
     * @param originalValue 资产原值
     * @param salvageValue  资产残值
     * @param usefulLifeYears 预计使用年限
     * @return 年折旧额（保留2位小数，四舍五入）
     * @throws IllegalArgumentException 如果参数无效
     */
    @Override
    public BigDecimal calculateStraightLineDepreciation(BigDecimal originalValue, 
                                                        BigDecimal salvageValue, 
                                                        int usefulLifeYears) {
        validateDepreciationParams(originalValue, salvageValue, usefulLifeYears);
        
        BigDecimal depreciableAmount = originalValue.subtract(salvageValue);
        BigDecimal annualDepreciation = depreciableAmount.divide(
            BigDecimal.valueOf(usefulLifeYears), 
            2, 
            RoundingMode.HALF_UP
        );
        
        return annualDepreciation;
    }

    /**
     * 计算资产双倍余额递减法折旧
     * 
     * 规则:
     * 1. 年折旧率 = 2 / 预计使用年限
     * 2. 每年折旧 = 年初净值 × 年折旧率
     * 3. 当直线法折旧额 >= 双倍余额递减法折旧额时，自动转为直线法
     * 
     * @param originalValue 资产原值
     * @param salvageValue  资产残值
     * @param usefulLifeYears 预计使用年限
     * @return 折旧计划列表，包含每年的折旧信息和余额
     */
    @Override
    public List<Map<String, Object>> calculateDoubleDecliningBalanceDepreciation(
            BigDecimal originalValue, 
            BigDecimal salvageValue, 
            int usefulLifeYears) {
        validateDepreciationParams(originalValue, salvageValue, usefulLifeYears);
        
        List<Map<String, Object>> schedule = new ArrayList<>();
        BigDecimal bookValue = originalValue;
        BigDecimal ddbRate = BigDecimal.valueOf(2).divide(
            BigDecimal.valueOf(usefulLifeYears), 
            4, 
            RoundingMode.HALF_UP
        );
        
        int remainingYears = usefulLifeYears;
        
        for (int year = 1; year <= usefulLifeYears; year++) {
            if (bookValue.compareTo(salvageValue) <= 0) {
                break;
            }
            
            BigDecimal straightLineAmount = bookValue.subtract(salvageValue)
                .divide(BigDecimal.valueOf(remainingYears), 2, RoundingMode.HALF_UP);
            BigDecimal ddbAmount = bookValue.multiply(ddbRate).setScale(2, RoundingMode.HALF_UP);
            
            Map<String, Object> period = new HashMap<>();
            period.put("year", year);
            period.put("beginBookValue", bookValue.setScale(2, RoundingMode.HALF_UP));
            
            // 判断是否切换为直线法
            if (straightLineAmount.compareTo(ddbAmount) >= 0 && year < usefulLifeYears) {
                period.put("depreciation", straightLineAmount);
                period.put("method", "straight_line");
                bookValue = bookValue.subtract(straightLineAmount);
            } else {
                period.put("depreciation", ddbAmount);
                period.put("method", "double_declining_balance");
                bookValue = bookValue.subtract(ddbAmount);
            }
            
            period.put("endBookValue", bookValue.setScale(2, RoundingMode.HALF_UP));
            schedule.add(period);
            
            remainingYears--;
        }
        
        return schedule;
    }

    /**
     * 生成月度折旧计划表
     * 
     * @param annualDepreciation 年折旧额
     * @param startMonth 开始月份
     * @param usefulLifeMonths 预计使用月数
     * @return 月度折旧计划列表（12期/年）
     */
    @Override
    public List<Map<String, Object>> generateMonthlySchedule(BigDecimal annualDepreciation, 
                                                               int startMonth, 
                                                               int usefulLifeMonths) {
        if (annualDepreciation == null || annualDepreciation.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("年折旧额必须大于等于0");
        }
        if (usefulLifeMonths <= 0 || usefulLifeMonths > 600) {
            throw new IllegalArgumentException("预计使用月数必须在1-600之间");
        }
        
        List<Map<String, Object>> monthlySchedule = new ArrayList<>();
        BigDecimal monthlyAmount = annualDepreciation.divide(
            BigDecimal.valueOf(12), 
            2, 
            RoundingMode.HALF_UP
        );
        
        int totalMonths = Math.min(usefulLifeMonths, 12 * 50); // 最多50年
        LocalDate currentDate = LocalDate.now();
        int currentYear = currentDate.getYear();
        int currentMonth = currentDate.getMonthValue();
        
        BigDecimal accumulatedDepreciation = BigDecimal.ZERO;
        
        for (int monthIndex = 0; monthIndex < totalMonths; monthIndex++) {
            int month = (startMonth + monthIndex - 1) % 12 + 1;
            int year = currentYear + (startMonth + monthIndex - 1) / 12;
            
            Map<String, Object> monthlyRecord = new HashMap<>();
            monthlyRecord.put("period", String.format("%d-%02d", year, month));
            monthlyRecord.put("month", month);
            monthlyRecord.put("year", year);
            monthlyRecord.put("depreciationAmount", monthlyAmount);
            monthlyRecord.put("accumulatedDepreciation", accumulatedDepreciation.add(monthlyAmount));
            
            monthlySchedule.add(monthlyRecord);
            accumulatedDepreciation = accumulatedDepreciation.add(monthlyAmount);
        }
        
        return monthlySchedule;
    }

    /**
     * 生成年度折旧汇总报表
     * 
     * 按资产类别聚合折旧金额，包含：
     * - 资产数量
     * - 原值总额
     * - 本期折旧
     * - 累计折旧
     * - 账面净值
     * 
     * @param assetCategory 资产类别（可选，为null则汇总所有）
     * @param year 统计年度
     * @return 年度折旧汇总数据
     */
    @Override
    public Map<String, Object> generateAnnualReport(String assetCategory, int year) {
        Map<String, Object> report = new HashMap<>();
        
        // 查询该年度的折旧记录
        List<DepreciationRecord> records = depreciationRecordRepository
            .findByYear(year, assetCategory);
        
        // 按资产类别聚合
        Map<String, Map<String, Object>> categoryAggregation = new HashMap<>();
        BigDecimal totalDepreciation = BigDecimal.ZERO;
        BigDecimal totalOriginalValue = BigDecimal.ZERO;
        
        for (DepreciationRecord record : records) {
            String category = record.getAssetCategory();
            if (!categoryAggregation.containsKey(category)) {
                Map<String, Object> categoryData = new HashMap<>();
                categoryData.put("category", category);
                categoryData.put("assetCount", 0);
                categoryData.put("originalValue", BigDecimal.ZERO);
                categoryData.put("currentDepreciation", BigDecimal.ZERO);
                categoryData.put("accumulatedDepreciation", BigDecimal.ZERO);
                categoryAggregation.put(category, categoryData);
            }
            
            Map<String, Object> categoryData = categoryAggregation.get(category);
            int count = (int) categoryData.get("assetCount");
            categoryData.put("assetCount", count + 1);
            
            BigDecimal originalValue = (BigDecimal) categoryData.get("originalValue");
            BigDecimal currentDep = (BigDecimal) categoryData.get("currentDepreciation");
            BigDecimal accumDep = (BigDecimal) categoryData.get("accumulatedDepreciation");
            
            categoryData.put("originalValue", originalValue.add(record.getOriginalValue()));
            categoryData.put("currentDepreciation", currentDep.add(record.getDepreciationAmount()));
            categoryData.put("accumulatedDepreciation", accumDep.add(record.getAccumulatedDepreciation()));
            
            totalDepreciation = totalDepreciation.add(record.getDepreciationAmount());
        }
        
        // 计算账面净值
        for (Map<String, Object> categoryData : categoryAggregation.values()) {
            BigDecimal originalValue = (BigDecimal) categoryData.get("originalValue");
            BigDecimal accumDep = (BigDecimal) categoryData.get("accumulatedDepreciation");
            categoryData.put("bookValue", originalValue.subtract(accumDep));
        }
        
        report.put("year", year);
        report.put("categories", new ArrayList<>(categoryAggregation.values()));
        report.put("grandTotal", totalDepreciation);
        report.put("generatedAt", LocalDate.now().format(DateTimeFormatter.ISO_DATE));
        
        return report;
    }

    /**
     * 持久化折旧记录
     * 
     * 将折旧计算结果写入 depreciation_records 表
     * 支持批量写入，失败时回滚事务
     * 
     * @param assetId 资产ID
     * @param records 折旧记录列表
     * @return 写入记录数
     */
    @Override
    @Transactional
    public int persistDepreciationRecords(Long assetId, List<Map<String, Object>> records) {
        if (assetId == null) {
            throw new IllegalArgumentException("资产ID不能为空");
        }
        if (records == null || records.isEmpty()) {
            throw new IllegalArgumentException("折旧记录列表不能为空");
        }
        
        List<DepreciationRecord> entities = new ArrayList<>();
        
        for (Map<String, Object> record : records) {
            DepreciationRecord entity = new DepreciationRecord();
            entity.setAssetId(assetId);
            entity.setPeriod((String) record.get("period"));
            entity.setDepreciationAmount((BigDecimal) record.get("depreciationAmount"));
            entity.setBookValue((BigDecimal) record.get("bookValue"));
            entity.setAccumulatedDepreciation((BigDecimal) record.get("accumulatedDepreciation"));
            entity.setMethod((String) record.get("method"));
            entity.setCreatedAt(LocalDate.now());
            
            entities.add(entity);
        }
        
        return depreciationRecordRepository.saveAll(entities).size();
    }

    /**
     * 创建审计日志条目
     * 
     * @param action 操作类型
     * @param assetId 资产ID
     * @param details 操作详情
     * @return 审计日志ID
     */
    @Override
    @Transactional
    public Long createAuditEntry(String action, Long assetId, String details) {
        GeneralAuditEntry entry = new GeneralAuditEntry();
        entry.setAction(action);
        entry.setEntityType("DepreciationRecord");
        entry.setEntityId(assetId);
        entry.setDetails(details);
        entry.setTimestamp(LocalDate.now());
        
        return depreciationRecordRepository.saveAuditEntry(entry);
    }

    /**
     * 验证折旧计算参数
     * 
     * 边界约束:
     * - 原值 > 残值
     * - 残值 >= 0
     * - 使用年限: 1-50年
     * 
     * @param originalValue 原值
     * @param salvageValue 残值
     * @param usefulLifeYears 使用年限
     * @throws IllegalArgumentException 当参数不满足约束时
     */
    private void validateDepreciationParams(BigDecimal originalValue, 
                                            BigDecimal salvageValue, 
                                            int usefulLifeYears) {
        if (originalValue == null || originalValue.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("原值必须大于0");
        }
        if (salvageValue == null || salvageValue.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("残值必须大于等于0");
        }
        if (originalValue.compareTo(salvageValue) <= 0) {
            throw new IllegalArgumentException("原值必须大于残值");
        }
        if (usefulLifeYears < 1 || usefulLifeYears > 50) {
            throw new IllegalArgumentException("预计使用年限必须在1-50年之间");
        }
    }

    /**
     * 计算资产月度折旧额
     * 
     * @param annualDepreciation 年折旧额
     * @return 月折旧额（保留2位小数）
     */
    public BigDecimal calculateMonthlyDepreciation(BigDecimal annualDepreciation) {
        if (annualDepreciation == null) {
            return BigDecimal.ZERO;
        }
        return annualDepreciation.divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP);
    }

    /**
     * 校验折旧记录的完整性
     * 
     * @param assetId 资产ID
     * @param period 期间
     * @return 是否存在重复记录
     */
    public boolean checkDuplicateRecord(Long assetId, String period) {
        return depreciationRecordRepository.existsByAssetIdAndPeriod(assetId, period);
    }

    /**
     * 获取资产累计折旧
     * 
     * @param assetId 资产ID
     * @return 累计折旧金额
     */
    public BigDecimal getAccumulatedDepreciation(Long assetId) {
        return depreciationRecordRepository.getAccumulatedDepreciation(assetId);
    }

    /**
     * 边界场景处理：当原值等于残值时不产生折旧
     * 
     * @param originalValue 原值
     * @param salvageValue 残值
     * @return 无折旧计划
     */
    public List<Map<String, Object>> handleZeroDepreciationScenario(
            BigDecimal originalValue, BigDecimal salvageValue) {
        if (originalValue.compareTo(salvageValue) == 0) {
            List<Map<String, Object>> emptySchedule = new ArrayList<>();
            Map<String, Object> record = new HashMap<>();
            record.put("depreciation", BigDecimal.ZERO);
            record.put("note", "原值等于残值，无折旧");
            emptySchedule.add(record);
            return emptySchedule;
        }
        return null;
    }
}