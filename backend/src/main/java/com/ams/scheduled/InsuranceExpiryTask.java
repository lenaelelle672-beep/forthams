package com.ams.scheduled;

import com.ams.context.TenantContext;
import com.ams.entity.Insurance;
import com.ams.service.InsuranceService;
import com.ams.service.NotificationService;
import com.ams.service.TenantService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 保险到期提醒定时任务
 * 每日检查即将到期的保单，在到期前 30/15/7 天发送提醒
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InsuranceExpiryTask {

    private final InsuranceService insuranceService;
    private final NotificationService notificationService;
    private final TenantService tenantService;

    /**
     * 每天早上 8 点执行一次
     */
    @Scheduled(cron = "0 0 8 * * ?")
    public void scanExpiringPolicies() {
        log.info("[InsuranceExpiryTask] 开始扫描即将到期保单...");
        int totalChecked = 0;
        for (String tenantId : tenantService.getActiveTenantIds()) {
            try {
                TenantContext.setTenantId(tenantId);
                totalChecked += scanExpiringPoliciesForCurrentTenant();
            } catch (Exception e) {
                log.error("[InsuranceExpiryTask] 租户 {} 保单到期扫描失败: {}", tenantId, e.getMessage(), e);
            } finally {
                TenantContext.clear();
            }
        }
        log.info("[InsuranceExpiryTask] 扫描完成，共检查 {} 条保单", totalChecked);
    }

    private int scanExpiringPoliciesForCurrentTenant() {
        List<Insurance> expiringPolicies = insuranceService.getExpiringPolicies(30);
        LocalDate today = LocalDate.now();

        for (Insurance policy : expiringPolicies) {
            try {
                long daysUntilExpiry = ChronoUnit.DAYS.between(today, policy.getEndDate());
                if (daysUntilExpiry == 30 || daysUntilExpiry == 15 || daysUntilExpiry == 7) {
                    Map<String, Object> variables = new HashMap<>();
                    variables.put("policyNo", policy.getPolicyNo());
                    variables.put("insuranceName", policy.getInsuranceName());
                    variables.put("insurer", policy.getInsurer());
                    variables.put("endDate", policy.getEndDate().toString());
                    variables.put("daysRemaining", String.valueOf(daysUntilExpiry));

                    notificationService.sendByTemplateToRole(
                            "INSURANCE_EXPIRING",
                            "ASSET_MANAGER",
                            variables,
                            policy.getId(),
                            "insurance"
                    );
                    log.info("[InsuranceExpiryTask] 保单 {} (ID={}) 将在 {} 天后到期，已发送提醒",
                            policy.getPolicyNo(), policy.getId(), daysUntilExpiry);
                }
            } catch (Exception e) {
                log.error("[InsuranceExpiryTask] 处理保单 {} 提醒时出错: {}", policy.getPolicyNo(), e.getMessage(), e);
            }
        }
        return expiringPolicies.size();
    }
}
