package com.ams.scheduled;

import com.ams.entity.RiskAssessment;
import com.ams.service.RiskAssessmentService;
import com.ams.service.NotificationService;
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
 * 风险评估评审提醒定时任务
 * 每日检查即将到期的风险评估评审，在到期前 30/15/7 天发送提醒
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RiskAssessmentReviewReminderTask {

    private final RiskAssessmentService riskAssessmentService;
    private final NotificationService notificationService;

    /**
     * 每天早上 8 点执行一次
     * Cron 表达式: 0 0 8 * * ?
     */
    @Scheduled(cron = "0 0 8 * * ?")
    public void scanUpcomingReviews() {
        log.info("[RiskAssessmentReviewReminderTask] 开始扫描即将到期的风险评估评审...");

        try {
            // 查询30天内需要评审的风险评估
            LocalDate today = LocalDate.now();
            LocalDate reviewDueDate = today.plusDays(30);

            // 获取所有需要评审的风险评估（状态非 CLOSED 且有评审日期）
            List<RiskAssessment> upcomingReviews = riskAssessmentService.list(
                    null, null, null, 1, 1000
            ).getRecords().stream()
                    .filter(ra -> ra.getReviewDate() != null
                            && !ra.getReviewDate().isBefore(today)
                            && !ra.getReviewDate().isAfter(reviewDueDate)
                            && !"CLOSED".equals(ra.getStatus()))
                    .toList();

            int sentCount = 0;
            for (RiskAssessment assessment : upcomingReviews) {
                try {
                    long daysUntilReview = ChronoUnit.DAYS.between(today, assessment.getReviewDate());
                    // 在 30/15/7 天时发送提醒
                    if (daysUntilReview == 30 || daysUntilReview == 15 || daysUntilReview == 7) {
                        Map<String, Object> variables = new HashMap<>();
                        variables.put("assessmentId", assessment.getId());
                        variables.put("reviewDate", assessment.getReviewDate().toString());
                        variables.put("riskLevel", assessment.getRiskLevel());
                        variables.put("daysRemaining", String.valueOf(daysUntilReview));
                        variables.put("probability", assessment.getProbability());
                        variables.put("severity", assessment.getImpact());

                        notificationService.sendByTemplateToRole(
                                "RISK_REVIEW_DUE",
                                "RISK_MANAGER",
                                variables,
                                assessment.getId(),
                                "risk_assessment"
                        );

                        sentCount++;
                        log.info("[RiskAssessmentReviewReminderTask] 风险评估 (ID={}) 将在 {} 天后需要评审，已发送提醒，风险等级: {}",
                                assessment.getId(), daysUntilReview, assessment.getRiskLevel());
                    }
                } catch (Exception e) {
                    log.error("[RiskAssessmentReviewReminderTask] 处理风险评估 {} 提醒时出错: {}",
                            assessment.getId(), e.getMessage(), e);
                }
            }

            log.info("[RiskAssessmentReviewReminderTask] 扫描完成，共检查 {} 条风险评估，发送 {} 条提醒",
                    upcomingReviews.size(), sentCount);

        } catch (Exception e) {
            log.error("[RiskAssessmentReviewReminderTask] 扫描过程出错: {}", e.getMessage(), e);
        }
    }
}