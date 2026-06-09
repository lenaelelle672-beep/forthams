package com.ams.service.impl;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.ScheduledReport;
import com.ams.mapper.ScheduledReportMapper;
import com.ams.service.EmailService;
import com.ams.service.ScheduledReportService;
import com.ams.service.TenantService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduledReportServiceImpl implements ScheduledReportService {

    private final ScheduledReportMapper scheduledReportMapper;
    private final EmailService emailService;
    private final TenantService tenantService;

    @Override
    public Page<ScheduledReport> list(Integer pageNum, Integer pageSize, String status, String keyword) {
        String tenantId = TenantContext.requireTenantId();
        Page<ScheduledReport> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<ScheduledReport> wrapper = new LambdaQueryWrapper<ScheduledReport>()
                .eq(ScheduledReport::getTenantId, tenantId);
        if (status != null && !status.isEmpty()) {
            wrapper.eq(ScheduledReport::getStatus, status);
        }
        wrapper.orderByDesc(ScheduledReport::getCreateTime);
        return scheduledReportMapper.selectPage(page, wrapper);
    }

    @Override
    public ScheduledReport getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return scheduledReportMapper.selectOne(new LambdaQueryWrapper<ScheduledReport>()
                .eq(ScheduledReport::getId, id)
                .eq(ScheduledReport::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ScheduledReport create(ScheduledReport report) {
        String tenantId = TenantContext.requireTenantId();
        report.setTenantId(tenantId);
        report.setStatus("ACTIVE");
        report.setNextRunAt(calculateNextRun(report.getCronExpr()));
        scheduledReportMapper.insert(report);
        return report;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ScheduledReport update(Long id, ScheduledReport report) {
        String tenantId = TenantContext.requireTenantId();
        report.setId(id);
        report.setTenantId(tenantId);
        report.setNextRunAt(calculateNextRun(report.getCronExpr()));
        scheduledReportMapper.updateById(report);
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        scheduledReportMapper.delete(new LambdaQueryWrapper<ScheduledReport>()
                .eq(ScheduledReport::getId, id)
                .eq(ScheduledReport::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ScheduledReport toggleStatus(Long id) {
        ScheduledReport report = getById(id);
        if (report == null) throw new BusinessException("定时报表不存在: id=" + id);
        if ("ACTIVE".equals(report.getStatus())) {
            report.setStatus("PAUSED");
        } else {
            report.setStatus("ACTIVE");
            report.setNextRunAt(calculateNextRun(report.getCronExpr()));
        }
        scheduledReportMapper.updateById(report);
        return report;
    }

    /**
     * 每 5 分钟扫描一次，检查是否有到期的定时报表需要执行
     */
    @Scheduled(fixedRate = 300_000)
    @Transactional(rollbackFor = Exception.class)
    public void scanAndExecute() {
        LocalDateTime now = LocalDateTime.now();
        for (String tenantId : tenantService.getActiveTenantIds()) {
            try {
                TenantContext.setTenantId(tenantId);
                List<ScheduledReport> dueReports = scheduledReportMapper.selectList(
                        new LambdaQueryWrapper<ScheduledReport>()
                                .eq(ScheduledReport::getTenantId, tenantId)
                                .eq(ScheduledReport::getStatus, "ACTIVE")
                                .le(ScheduledReport::getNextRunAt, now)
                                .isNotNull(ScheduledReport::getRecipientEmails)
                );

                for (ScheduledReport report : dueReports) {
                    try {
                        log.info("Executing scheduled report: tenantId={}, id={}, cron={}",
                                tenantId, report.getId(), report.getCronExpr());

                        // 发送邮件（此处为简化实现，实际可调用 PdfExportService 生成 PDF 附件）
                        String[] recipients = report.getRecipientEmails()
                                .replaceAll("[\\[\\]\"]", "").split(",");
                        for (String email : recipients) {
                            String trimmed = email.trim();
                            if (!trimmed.isEmpty()) {
                                emailService.sendEmail(trimmed,
                                        report.getSubject() != null ? report.getSubject() : "定时报表",
                                        "请在系统中查看定时报表（报表ID: " + report.getSavedReportId() + "）");
                            }
                        }

                        report.setLastRunAt(now);
                        report.setNextRunAt(calculateNextRun(report.getCronExpr()));
                        scheduledReportMapper.updateById(report);
                        log.info("Scheduled report executed successfully: tenantId={}, id={}", tenantId, report.getId());
                    } catch (RuntimeException e) {
                        log.error("Failed to execute scheduled report: tenantId={}, id={}", tenantId, report.getId(), e);
                    }
                }
            } catch (RuntimeException e) {
                log.error("Scheduled report scan failed: tenantId={}", tenantId, e);
            } finally {
                TenantContext.clear();
            }
        }
    }

    /**
     * 根据 cron 表达式计算下一次执行时间。
     * <p>
     * 支持的格式：5 字段标准 cron（分 时 日 月 周），每个字段支持 * 或数字，
     * 周字段支持 MON/TUE/WED/THU/FRI/SAT/SUN 缩写。
     * </p>
     *
     * @param cronExpr cron 表达式，如 "0 0 8 * * MON"（每周一 8:00）
     * @return 下一次执行时间
     */
    private LocalDateTime calculateNextRun(String cronExpr) {
        if (cronExpr == null || cronExpr.isBlank()) {
            log.warn("cronExpr 为空，默认 1 小时后");
            return LocalDateTime.now().plusHours(1);
        }

        String[] parts = cronExpr.trim().split("\\s+");
        if (parts.length != 5) {
            log.warn("cronExpr 格式不正确（需要 5 段，得到 {}），默认 1 小时后: {}", parts.length, cronExpr);
            return LocalDateTime.now().plusHours(1);
        }

        try {
            // 解析各字段
            Set<Integer> minutes = parseCronField(parts[0], 0, 59);
            Set<Integer> hours = parseCronField(parts[1], 0, 23);
            Set<Integer> daysOfMonth = parseCronField(parts[2], 1, 31);
            Set<Integer> months = parseCronField(parts[3], 1, 12);
            Set<Integer> daysOfWeek = parseDayOfWeekField(parts[4]);

            // 从当前时间 +1 分钟开始扫描
            LocalDateTime candidate = LocalDateTime.now().truncatedTo(ChronoUnit.MINUTES).plusMinutes(1);

            // 最多扫描 2 年（约 100 万分钟，实际通常会很快找到）
            int maxIterations = 1_051_200; // 365 * 2 * 24 * 60
            int iter = 0;

            while (iter < maxIterations) {
                int m = candidate.getMinute();
                int h = candidate.getHour();
                int d = candidate.getDayOfMonth();
                int mo = candidate.getMonthValue();
                int dw = candidate.getDayOfWeek().getValue(); // 1=Mon ... 7=Sun

                // 将 DayOfWeek 转换为 cron 风格：0=Sun, 1=Mon ... 6=Sat
                int cronDow = dw % 7; // Monday=1 → 1, Sunday=7 → 0

                if (minutes.contains(m) && hours.contains(h) && months.contains(mo)
                        && daysOfMonth.contains(d) && daysOfWeek.contains(cronDow)) {
                    return candidate;
                }

                candidate = candidate.plusMinutes(1);
                iter++;
            }

            log.warn("在 2 年内未找到匹配 cron 的时间，默认 1 小时后: {}", cronExpr);
            return LocalDateTime.now().plusHours(1);
        } catch (RuntimeException e) {
            log.error("cron 表达式解析失败，默认 1 小时后: {}", cronExpr, e);
            return LocalDateTime.now().plusHours(1);
        }
    }

    /**
     * 解析 cron 数字字段（分/时/日/月），支持 * 和数字。
     */
    private Set<Integer> parseCronField(String field, int min, int max) {
        Set<Integer> result = new HashSet<>();
        String trimmed = field.trim();
        if ("*".equals(trimmed)) {
            for (int i = min; i <= max; i++) {
                result.add(i);
            }
        } else {
            int val = Integer.parseInt(trimmed);
            if (val < min || val > max) {
                throw new IllegalArgumentException("字段值 " + val + " 超出范围 [" + min + "," + max + "]");
            }
            result.add(val);
        }
        return result;
    }

    /**
     * 解析周字段，支持 0-7（0/7=周日）、MON-SUN 缩写、*（每天）。
     */
    private Set<Integer> parseDayOfWeekField(String field) {
        Set<Integer> result = new HashSet<>();
        String trimmed = field.trim().toUpperCase();
        if ("*".equals(trimmed)) {
            for (int i = 0; i <= 6; i++) {
                result.add(i);
            }
            return result;
        }
        // 尝试解析为缩写
        Map<String, Integer> dowMap = new HashMap<>();
        dowMap.put("SUN", 0);
        dowMap.put("MON", 1);
        dowMap.put("TUE", 2);
        dowMap.put("WED", 3);
        dowMap.put("THU", 4);
        dowMap.put("FRI", 5);
        dowMap.put("SAT", 6);

        if (dowMap.containsKey(trimmed)) {
            result.add(dowMap.get(trimmed));
        } else {
            int val = Integer.parseInt(trimmed);
            if (val == 7) val = 0; // 7 也代表周日
            if (val < 0 || val > 6) {
                throw new IllegalArgumentException("周字段值 " + val + " 超出范围 [0,6]");
            }
            result.add(val);
        }
        return result;
    }
}
