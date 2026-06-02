package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.MaintenancePlanCreateDTO;
import com.ams.dto.MaintenancePlanQueryDTO;
import com.ams.dto.MaintenancePlanUpdateDTO;
import com.ams.entity.MaintenancePlan;
import com.ams.entity.MaintenanceRecord;
import com.ams.mapper.MaintenancePlanMapper;
import com.ams.mapper.MaintenanceRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.YearMonth;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MaintenancePlanService {

    private final MaintenancePlanMapper maintenancePlanMapper;
    private final MaintenanceRecordMapper maintenanceRecordMapper;
    private final NotificationService notificationService;

    // ==================== CRUD（租户隔离） ====================

    /**
     * 分页查询维保计划
     */
    public Page<MaintenancePlan> queryPlans(MaintenancePlanQueryDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        Page<MaintenancePlan> pageParam = new Page<>(
                dto.getPage() == null ? 1 : dto.getPage(),
                dto.getPageSize() == null ? 10 : dto.getPageSize());

        LambdaQueryWrapper<MaintenancePlan> wrapper = new LambdaQueryWrapper<MaintenancePlan>()
                .eq(MaintenancePlan::getTenantId, tenantId);

        if (dto.getAssetId() != null) {
            wrapper.eq(MaintenancePlan::getAssetId, dto.getAssetId());
        }
        if (dto.getTriggerType() != null && !dto.getTriggerType().isEmpty()) {
            wrapper.eq(MaintenancePlan::getTriggerType, dto.getTriggerType());
        }
        if (dto.getStatus() != null && !dto.getStatus().isEmpty()) {
            wrapper.eq(MaintenancePlan::getStatus, dto.getStatus());
        }
        wrapper.orderByDesc(MaintenancePlan::getCreateTime);

        return maintenancePlanMapper.selectPage(pageParam, wrapper);
    }

    /**
     * 获取单个维保计划
     */
    public MaintenancePlan getPlanById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        MaintenancePlan plan = maintenancePlanMapper.selectOne(new LambdaQueryWrapper<MaintenancePlan>()
                .eq(MaintenancePlan::getId, id)
                .eq(MaintenancePlan::getTenantId, tenantId));
        if (plan == null) {
            throw new BusinessException("维保计划不存在");
        }
        return plan;
    }

    /**
     * 创建维保计划
     */
    @Transactional(rollbackFor = Exception.class)
    public MaintenancePlan createPlan(MaintenancePlanCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        MaintenancePlan plan = new MaintenancePlan();
        BeanUtil.copyProperties(dto, plan);
        plan.setTenantId(tenantId);

        // 默认值
        if (plan.getPriority() == null) plan.setPriority("NORMAL");
        if (plan.getStatus() == null) plan.setStatus("ACTIVE");

        // 计算首次到期日
        plan.setNextDueDate(calculateNextDueDate(plan));

        maintenancePlanMapper.insert(plan);
        return plan;
    }

    /**
     * 更新维保计划
     */
    @Transactional(rollbackFor = Exception.class)
    public MaintenancePlan updatePlan(Long id, MaintenancePlanUpdateDTO dto) {
        MaintenancePlan plan = getPlanById(id);
        BeanUtil.copyProperties(dto, plan, "id", "tenantId", "createBy", "createTime");

        // 重新计算到期日（如果触发类型或间隔变更）
        plan.setNextDueDate(calculateNextDueDate(plan));

        maintenancePlanMapper.updateById(plan);
        return plan;
    }

    /**
     * 删除维保计划（逻辑删除）
     */
    @Transactional(rollbackFor = Exception.class)
    public void deletePlan(Long id) {
        getPlanById(id);
        maintenancePlanMapper.deleteById(id);
    }

    // ==================== 周期计算核心 ====================

    /**
     * 根据维保计划的触发类型计算下一次到期日
     */
    public LocalDate calculateNextDueDate(MaintenancePlan plan) {
        if (plan == null) return null;

        // 如果计划已暂停/完成/取消，不计算
        String status = plan.getStatus();
        if ("PAUSED".equals(status) || "COMPLETED".equals(status) || "CANCELED".equals(status)) {
            return null;
        }

        // 使用 lastGeneratedDate 作为基准（如果有），否则用 startDate
        LocalDate baseDate = plan.getLastGeneratedDate() != null ? plan.getLastGeneratedDate() : plan.getStartDate();
        if (baseDate == null) return null;

        LocalDate today = LocalDate.now();
        String triggerType = plan.getTriggerType() != null ? plan.getTriggerType() : "manual";

        // 如果基准日期在未来，以基准日期为准（尚未开始）
        LocalDate result;

        switch (triggerType) {
            case "daily":
                // daily: 基准 + 1 天
                result = baseDate.plusDays(1);
                break;

            case "weekly":
                // weekly: 下一个指定星期几
                result = calculateNextWeekday(baseDate, plan.getDayOfWeek());
                break;

            case "monthly":
                // monthly: 下一个指定日期
                result = calculateNextMonthDay(baseDate, plan.getDayOfMonth());
                break;

            case "yearly":
                // yearly: 下一个指定月日
                result = calculateNextYearDay(baseDate, plan.getMonthOfYear(), plan.getDayOfMonth());
                break;

            default: // manual
                if (plan.getIntervalDays() != null && plan.getIntervalDays() > 0) {
                    result = baseDate.plusDays(plan.getIntervalDays());
                } else {
                    // manual 无间隔，只生成一次
                    return null;
                }
                break;
        }

        // 如果计算结果早于今天，从今天开始重新计算
        if (result.isBefore(today)) {
            switch (triggerType) {
                case "daily":
                    result = today.plusDays(1);
                    break;
                case "weekly":
                    result = calculateNextWeekday(today, plan.getDayOfWeek());
                    break;
                case "monthly":
                    result = calculateNextMonthDay(today, plan.getDayOfMonth());
                    break;
                case "yearly":
                    result = calculateNextYearDay(today, plan.getMonthOfYear(), plan.getDayOfMonth());
                    break;
                default:
                    if (plan.getIntervalDays() != null && plan.getIntervalDays() > 0) {
                        result = today.plusDays(plan.getIntervalDays());
                    } else {
                        return null;
                    }
                    break;
            }
        }

        // 检查是否超过 endDate
        if (plan.getEndDate() != null && result.isAfter(plan.getEndDate())) {
            return null;
        }

        return result;
    }

    /**
     * 计算下一个指定星期几
     * @param baseDate 基准日期
     * @param dayOfWeek 1=周一, 7=周日
     */
    private LocalDate calculateNextWeekday(LocalDate baseDate, Integer dayOfWeek) {
        if (dayOfWeek == null || dayOfWeek < 1 || dayOfWeek > 7) {
            // 默认：从基准日期 + 7 天
            return baseDate.plusDays(7);
        }

        // DayOfWeek: MONDAY=1, SUNDAY=7
        DayOfWeek targetDay = DayOfWeek.of(dayOfWeek == 7 ? 7 : dayOfWeek);
        // TemporalAdjusters: DayOfWeek 是 enum，需要匹配 DayOfWeek 的序数
        // DayOfWeek.MONDAY.getValue() = 1, SUNDAY = 7
        DayOfWeek target = DayOfWeek.of(dayOfWeek);

        LocalDate next = baseDate.with(TemporalAdjusters.next(target));
        // 如果 next 和 baseDate 是同一天（baseDate 恰好是目标日），取下一周
        if (!next.isAfter(baseDate)) {
            next = baseDate.with(TemporalAdjusters.next(target));
        }
        return next;
    }

    /**
     * 计算下一个指定月份日期
     * @param baseDate 基准日期
     * @param dayOfMonth 1-31
     */
    private LocalDate calculateNextMonthDay(LocalDate baseDate, Integer dayOfMonth) {
        if (dayOfMonth == null || dayOfMonth < 1) {
            return baseDate.plusMonths(1);
        }

        int targetDay = Math.min(dayOfMonth, 28); // 避免超过当月最大天数

        // 先尝试当月
        try {
            LocalDate candidate = baseDate.withDayOfMonth(targetDay);
            if (candidate.isAfter(baseDate)) {
                return candidate;
            }
        } catch (Exception e) {
            // 当月没有该日期（如 31 日在 2 月），忽略
        }

        // 下个月
        LocalDate nextMonth = baseDate.plusMonths(1);
        int maxDay = nextMonth.lengthOfMonth();
        return nextMonth.withDayOfMonth(Math.min(targetDay, maxDay));
    }

    /**
     * 计算下一个指定年日期
     * @param baseDate 基准日期
     * @param monthOfYear 1-12
     * @param dayOfMonth 1-31
     */
    private LocalDate calculateNextYearDay(LocalDate baseDate, Integer monthOfYear, Integer dayOfMonth) {
        if (monthOfYear == null || monthOfYear < 1 || monthOfYear > 12) {
            return baseDate.plusYears(1);
        }

        int targetMonth = monthOfYear;
        int targetDay = (dayOfMonth != null && dayOfMonth >= 1) ? Math.min(dayOfMonth, 28) : 1;

        try {
            LocalDate candidateThisYear = LocalDate.of(baseDate.getYear(), targetMonth, Math.min(targetDay,
                    YearMonth.of(baseDate.getYear(), targetMonth).lengthOfMonth()));
            if (candidateThisYear.isAfter(baseDate)) {
                return candidateThisYear;
            }
        } catch (Exception e) {
            // 日期非法，忽略
        }

        // 下一年
        try {
            LocalDate nextYear = baseDate.plusYears(1);
            int maxDay = YearMonth.of(nextYear.getYear(), targetMonth).lengthOfMonth();
            return LocalDate.of(nextYear.getYear(), targetMonth, Math.min(targetDay, maxDay));
        } catch (Exception e) {
            return baseDate.plusYears(1);
        }
    }

    // ==================== 生成维保记录 ====================

    /**
     * 为指定计划生成维保记录（手动触发或定时任务调用）
     */
    @Transactional(rollbackFor = Exception.class)
    public void generateRecordsForPlan(Long planId) {
        // 直接查询，不经过 TenantContext（支持定时任务调用）
        MaintenancePlan plan = maintenancePlanMapper.selectById(planId);
        if (plan == null) {
            log.warn("维保计划不存在: id={}", planId);
            return;
        }

        // 只处理 ACTIVE 的计划
        if (!"ACTIVE".equals(plan.getStatus())) {
            log.warn("维保计划未激活: id={}, status={}", planId, plan.getStatus());
            return;
        }

        LocalDate today = LocalDate.now();
        LocalDate nextDue = plan.getNextDueDate();

        // 检查是否到期（nextDueDate <= today）
        if (nextDue == null || nextDue.isAfter(today)) {
            log.debug("维保计划未到期: id={}, nextDueDate={}", planId, nextDue);
            return;
        }

        // 检查是否超过 endDate
        if (plan.getEndDate() != null && today.isAfter(plan.getEndDate())) {
            log.info("维保计划已过期: id={}, endDate={}", planId, plan.getEndDate());
            return;
        }

        // 乐观锁：检查 lastGeneratedDate 是否已变更（防止重复生成）
        LocalDate currentLastGenerated = plan.getLastGeneratedDate();

        // 创建维保记录
        MaintenanceRecord record = new MaintenanceRecord();
        record.setTenantId(plan.getTenantId());
        record.setAssetId(plan.getAssetId());
        record.setMaintenanceDate(today);
        record.setMaintenanceType(plan.getTriggerType());
        record.setExecutor(plan.getDefaultExecutor());
        record.setContent(plan.getDefaultContent() != null ? plan.getDefaultContent() : "");
        record.setNextMaintenanceDate(plan.getNextDueDate());
        if (plan.getEstimatedCost() != null) {
            record.setCost(plan.getEstimatedCost());
        }
        maintenanceRecordMapper.insert(record);

        // 计算新的下次到期日
        LocalDate oldNextDue = plan.getNextDueDate();
        plan.setLastGeneratedDate(today);

        LocalDate newNextDue = calculateNextDueDate(plan);
        plan.setNextDueDate(newNextDue);

        // 乐观锁更新：WHERE last_generated_date = oldValue
        int updated = maintenancePlanMapper.update(plan, new LambdaQueryWrapper<MaintenancePlan>()
                .eq(MaintenancePlan::getId, planId)
                .eq(MaintenancePlan::getLastGeneratedDate, currentLastGenerated));

        if (updated == 0) {
            // 乐观锁冲突，回滚事务
            throw new BusinessException("维保计划并发生成冲突，请重试");
        }

        log.info("维保记录已生成: planId={}, recordId={}, nextDueDate={}", planId, record.getId(), newNextDue);
    }

    // ==================== 定时任务 ====================

    /**
     * 每天凌晨 2:00 自动生成到期维保记录
     * 查所有 ACTIVE 且 nextDueDate <= today 的计划
     */
    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void scheduledGenerateRecords() {
        log.info("开始定时生成维保记录...");
        LocalDate today = LocalDate.now();

        List<MaintenancePlan> duePlans = maintenancePlanMapper.selectDuePlansForScheduler(
                "ACTIVE", today.toString());

        int successCount = 0;
        int failCount = 0;
        for (MaintenancePlan plan : duePlans) {
            try {
                generateRecordsForPlan(plan.getId());
                successCount++;
            } catch (Exception e) {
                log.error("维保记录生成失败: planId={}", plan.getId(), e);
                failCount++;
            }
        }
        log.info("定时生成维保记录完成: 成功={}, 失败={}", successCount, failCount);
    }

    /**
     * 每天早上 9:00 发送到期预警通知
     * 查 3 天内到期的计划
     */
    @Scheduled(cron = "0 0 9 * * ?")
    public void scheduledDueReminder() {
        log.info("开始发送维保到期预警...");
        LocalDate today = LocalDate.now();
        LocalDate threeDaysLater = today.plusDays(3);

        List<MaintenancePlan> upcomingPlans = maintenancePlanMapper.selectUpcomingPlansForScheduler(
                "ACTIVE", today.toString(), threeDaysLater.toString());

        int sentCount = 0;
        for (MaintenancePlan plan : upcomingPlans) {
            try {
                Map<String, Object> variables = new HashMap<>();
                variables.put("planName", plan.getPlanName());
                variables.put("assetId", String.valueOf(plan.getAssetId()));
                variables.put("dueDate", plan.getNextDueDate() != null ? plan.getNextDueDate().toString() : "");
                variables.put("triggerType", plan.getTriggerType());
                long daysLeft = ChronoUnit.DAYS.between(today, plan.getNextDueDate());
                variables.put("daysLeft", String.valueOf(daysLeft));

                Long userId = plan.getCreateBy() != null ? plan.getCreateBy() : 0L;
                notificationService.sendByTemplate("maintenance_due", variables, userId, plan.getId(), "maintenance_plan");
                sentCount++;
            } catch (Exception e) {
                log.error("维保到期预警发送失败: planId={}", plan.getId(), e);
            }
        }
        log.info("维保到期预警发送完成: 已处理={}", sentCount);
    }

    /**
     * 手动触发指定计划的维保记录生成（对外 API）
     */
    @Transactional(rollbackFor = Exception.class)
    public void triggerGenerate(Long planId) {
        // 先验证计划存在（带租户检查）
        getPlanById(planId);
        generateRecordsForPlan(planId);
    }
}
