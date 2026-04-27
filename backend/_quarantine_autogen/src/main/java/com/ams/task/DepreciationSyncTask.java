package com.ams.task;

import com.ams.entity.Asset;
import com.ams.entity.DepreciationRecord;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DepreciationRecordMapper;
import com.ams.service.impl.DepreciationCalculator;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * 资产折旧同步定时任务
 * 
 * <p>职责说明：
 * <ul>
 *   <li>每月最后一日 23:59 自动执行折旧计算</li>
 *   <li>遍历所有活跃资产，计算当月折旧金额</li>
 *   <li>通过 Redis 分布式锁防止重复执行</li>
 *   <li>支持手动触发和按日期计算</li>
 * </ul>
 * 
 * <p>折旧算法支持：
 * <ul>
 *   <li>直线法 (Straight-Line Method): 年折旧额 = (原值 - 残值) / 预计使用年限</li>
 *   <li>双倍余额递减法 (Double Declining Balance): 年折旧率 = 2 / 预计使用年限 × 100%</li>
 * </ul>
 * 
 * @author AMS Team
 * @version 1.0
 * @since 2025-01
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DepreciationSyncTask {

    /**
     * Redis 分布式锁前缀
     */
    private static final String DEPRECIATION_LOCK_PREFIX = "depreciation:monthly_job:";

    /**
     * 分布式锁超时时间（秒）
     */
    private static final long LOCK_TIMEOUT = 3600L;

    /**
     * 日期格式化器
     */
    private static final DateTimeFormatter PERIOD_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM");

    /**
     * 资产Mapper
     */
    private final AssetMapper assetMapper;

    /**
     * 折旧记录Mapper
     */
    private final DepreciationRecordMapper depreciationRecordMapper;

    /**
     * 折旧计算器
     */
    private final DepreciationCalculator depreciationCalculator;

    /**
     * Redis模板
     */
    private final RedisTemplate<String, Object> redisTemplate;

    /**
     * 定时任务：每月最后一日 23:59 执行折旧计算
     * 
     * <p>CRON表达式说明：
     * <ul>
     *   <li>秒: 0</li>
     *   <li>分: 59</li>
     *   <li>时: 23</li>
     *   <li>日: L (每月最后一天)</li>
     *   <li>月: * (所有月份)</li>
     *   <li>周: ? (忽略星期)</li>
     * </ul>
     * 
     * <p>使用时区: Asia/Shanghai
     */
    @Scheduled(cron = "0 59 23 L * ?", zone = "Asia/Shanghai")
    public void executeMonthlyDepreciation() {
        LocalDate today = LocalDate.now();
        log.info("开始执行月度折旧计算任务，当前日期: {}", today);
        
        executeDepreciation(today);
    }

    /**
     * 执行折旧计算的核心方法
     * 
     * <p>处理流程：
     * <ol>
     *   <li>获取当月年月标识</li>
     *   <li>尝试获取分布式锁</li>
     *   <li>查询所有需要计算折旧的活跃资产</li>
     *   <li>逐个计算并保存折旧记录</li>
     *   <li>释放分布式锁</li>
     * </ol>
     * 
     * @param calculateDate 计算日期
     */
    @Transactional(rollbackFor = Exception.class)
    public void executeDepreciation(LocalDate calculateDate) {
        YearMonth yearMonth = YearMonth.from(calculateDate);
        String period = yearMonth.format(PERIOD_FORMATTER);
        String lockKey = DEPRECIATION_LOCK_PREFIX + period;

        // 尝试获取分布式锁
        Boolean lockAcquired = redisTemplate.opsForValue()
                .setIfAbsent(lockKey, "LOCKED", LOCK_TIMEOUT, TimeUnit.SECONDS);

        if (Boolean.FALSE.equals(lockAcquired)) {
            log.warn("折旧计算任务正在执行中或已完成，跳过本次执行，周期: {}", period);
            return;
        }

        try {
            log.info("成功获取分布式锁，开始处理折旧计算，周期: {}", period);

            // 查询所有活跃且已启用的资产
            List<Asset> activeAssets = assetMapper.selectList(
                    new LambdaQueryWrapper<Asset>()
                            .eq(Asset::getStatus, "ACTIVE")
                            .isNotNull(Asset::getOriginalValue)
                            .isNotNull(Asset::getUsefulLifeYears)
            );

            log.info("查询到活跃资产数量: {}", activeAssets.size());

            int successCount = 0;
            int failCount = 0;
            BigDecimal totalDepreciation = BigDecimal.ZERO;

            for (Asset asset : activeAssets) {
                try {
                    DepreciationRecord record = calculateAndSaveDepreciation(asset, yearMonth);
                    if (record != null) {
                        totalDepreciation = totalDepreciation.add(record.getMonthlyDepreciation());
                        successCount++;
                    }
                } catch (Exception e) {
                    log.error("资产[{}]折旧计算失败: {}", asset.getId(), e.getMessage(), e);
                    failCount++;
                }
            }

            log.info("折旧计算任务完成，成功: {}，失败: {}，总折旧额: {}", 
                    successCount, failCount, totalDepreciation);

        } catch (Exception e) {
            log.error("折旧计算任务执行异常: {}", e.getMessage(), e);
            throw e;
        } finally {
            // 释放分布式锁
            redisTemplate.delete(lockKey);
            log.info("释放分布式锁，周期: {}", period);
        }
    }

    /**
     * 计算并保存单个资产的折旧记录
     * 
     * <p>计算逻辑：
     * <ul>
     *   <li>根据资产的折旧方法配置选择计算策略</li>
     *   <li>计算当月折旧金额</li>
     *   <li>更新累计折旧和账面净值</li>
     *   <li>保存折旧记录到数据库</li>
     * </ul>
     * 
     * @param asset 资产对象
     * @param yearMonth 计算年月
     * @return 折旧记录对象
     */
    private DepreciationRecord calculateAndSaveDepreciation(Asset asset, YearMonth yearMonth) {
        String period = yearMonth.format(PERIOD_FORMATTER);
        
        // 检查是否已存在该周期的折旧记录
        DepreciationRecord existingRecord = depreciationRecordMapper.selectOne(
                new LambdaQueryWrapper<DepreciationRecord>()
                        .eq(DepreciationRecord::getAssetId, asset.getId())
                        .eq(DepreciationRecord::getPeriod, period)
        );

        if (existingRecord != null) {
            log.debug("资产[{}]在周期[{}]已存在折旧记录，跳过", asset.getId(), period);
            return existingRecord;
        }

        // 调用折旧计算器计算
        DepreciationRecord newRecord = depreciationCalculator.calculate(
                asset, 
                yearMonth.atEndOfMonth()
        );

        // 保存折旧记录
        depreciationRecordMapper.insert(newRecord);
        
        log.debug("资产[{}]折旧记录已保存，周期: {}，月折旧额: {}", 
                asset.getId(), period, newRecord.getMonthlyDepreciation());

        return newRecord;
    }

    /**
     * 手动触发折旧计算任务
     * 
     * <p>用途说明：
     * <ul>
     *   <li>用于管理员手动重算</li>
     *   <li>用于补算历史月份的折旧</li>
     *   <li>用于测试验证</li>
     * </ul>
     * 
     * @param calculateDate 计算日期（可选，默认当天）
     * @return 任务执行结果描述
     */
    public String manualTrigger(LocalDate calculateDate) {
        if (calculateDate == null) {
            calculateDate = LocalDate.now();
        }
        
        log.info("手动触发折旧计算任务，计算日期: {}", calculateDate);
        
        try {
            executeDepreciation(calculateDate);
            return "折旧计算任务执行成功";
        } catch (Exception e) {
            log.error("手动触发折旧计算失败: {}", e.getMessage(), e);
            return "折旧计算任务执行失败: " + e.getMessage();
        }
    }

    /**
     * 获取任务执行状态
     * 
     * <p>返回信息：
     * <ul>
     *   <li>任务是否正在执行</li>
     *   <li>最近一次执行时间</li>
     *   <li>最近一次执行结果</li>
     * </ul>
     * 
     * @return 任务状态信息
     */
    public TaskStatus getTaskStatus() {
        LocalDate today = LocalDate.now();
        YearMonth yearMonth = YearMonth.from(today);
        String period = yearMonth.format(PERIOD_FORMATTER);
        String lockKey = DEPRECIATION_LOCK_PREFIX + period;

        Boolean isRunning = redisTemplate.hasKey(lockKey);
        
        return TaskStatus.builder()
                .period(period)
                .isRunning(Boolean.TRUE.equals(isRunning))
                .lastExecutedTime(getLastExecutedTime(period))
                .build();
    }

    /**
     * 获取最近执行时间
     * 
     * @param period 计算周期
     * @return 最近执行时间字符串
     */
    private String getLastExecutedTime(String period) {
        // 实际实现应查询数据库或日志获取最近执行时间
        // 此处简化处理
        return LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
    }

    /**
     * 任务状态内部类
     */
    @lombok.Data
    @lombok.Builder
    public static class TaskStatus {
        /**
         * 计算周期
         */
        private String period;
        
        /**
         * 是否正在执行
         */
        private Boolean isRunning;
        
        /**
         * 最近执行时间
         */
        private String lastExecutedTime;
    }
}