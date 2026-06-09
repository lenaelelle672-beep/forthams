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

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class InsuranceExpiryReminder {
    private final InsuranceService insuranceService;
    private final NotificationService notificationService;
    private final TenantService tenantService;

    @Scheduled(cron = "0 0 8 * * ?")
    public void checkExpiringInsurances() {
        log.info("开始检查即将到期的保险...");
        for (String tenantId : tenantService.getActiveTenantIds()) {
            try {
                TenantContext.setTenantId(tenantId);
                sendExpiryReminders(30);
                sendExpiryReminders(15);
                sendExpiryReminders(7);
            } catch (Exception e) {
                log.error("租户 {} 保险到期检查失败: {}", tenantId, e.getMessage(), e);
            } finally {
                TenantContext.clear();
            }
        }
        log.info("保险到期检查完成");
    }

    private void sendExpiryReminders(int days) {
        List<Insurance> expiringInsurances = insuranceService.getUpcomingExpirations(days);
        if (!expiringInsurances.isEmpty()) {
            log.info("发现 {} 份保险将在 {} 天后到期", expiringInsurances.size(), days);
            for (Insurance insurance : expiringInsurances) {
                Map<String, Object> variables = new HashMap<>();
                variables.put("policyNo", insurance.getPolicyNo());
                variables.put("insuranceName", insurance.getInsuranceName());
                variables.put("insurer", insurance.getInsurer());
                variables.put("endDate", insurance.getEndDate().toString());
                variables.put("daysRemaining", String.valueOf(days));

                notificationService.sendByTemplateToRole(
                        "INSURANCE_EXPIRING",
                        "ASSET_MANAGER",
                        variables,
                        insurance.getId(),
                        "insurance"
                );
                log.info("已发送保险到期提醒: 保单号={}, 名称={}, 剩余天数={}",
                        insurance.getPolicyNo(), insurance.getInsuranceName(), days);
            }
        }
    }
}
