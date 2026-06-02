package com.ams.scheduler;

import com.ams.entity.Contract;
import com.ams.service.ContractService;
import com.ams.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 合同到期自动提醒定时任务
 * 每天早上 8:00 扫描即将到期（30天内）的合同并发送通知
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ContractReminderJob {

    private final ContractService contractService;
    private final NotificationService notificationService;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /**
     * 每天早上 8:00 执行合同到期扫描
     */
    @Scheduled(cron = "0 0 8 * * ?")
    public void scanExpiringContracts() {
        log.info("contract_reminder_start");
        try {
            List<Contract> expiring = contractService.getExpiring(30);
            if (expiring == null || expiring.isEmpty()) {
                log.info("contract_reminder_no_expiring");
                return;
            }
            
            int notified = 0;
            for (Contract contract : expiring) {
                try {
                    long daysLeft = ChronoUnit.DAYS.between(LocalDate.now(), contract.getEndDate());
                    Map<String, Object> variables = new HashMap<>();
                    variables.put("contractName", contract.getContractName());
                    variables.put("contractNo", contract.getContractNo());
                    variables.put("endDate", contract.getEndDate().format(FORMATTER));
                    variables.put("daysLeft", daysLeft);
                    
                    // 通知 ASSET_MANAGER 角色的用户
                    notificationService.sendByTemplateToRole(
                            "CONTRACT_EXPIRING", "ASSET_MANAGER",
                            variables, contract.getId(), "contract");
                    notified++;
                } catch (Exception e) {
                    log.warn("contract_reminder_single_failed id={} error={}", 
                            contract.getId(), e.getMessage());
                }
            }
            log.info("contract_reminder_done total={} notified={}", expiring.size(), notified);
        } catch (Exception e) {
            log.error("contract_reminder_fatal error={}", e.getMessage(), e);
        }
    }
}
