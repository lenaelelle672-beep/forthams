package com.ams.service;

import com.ams.entity.User;
import com.ams.entity.WorkOrder;
import com.ams.entity.NotificationRecord;
import com.ams.repository.UserMapper;
import com.ams.common.Result;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * NotificationService - 工单审批流程通知服务
 * 
 * <p>职责：基于状态机事件触发通知，根据事件类型确定通知对象并发送邮件通知。</p>
 * 
 * <p>通知规则：
 * <ul>
 *   <li>SUBMIT 事件 → 通知审批人（工单提交，等待审批）</li>
 *   <li>APPROVE 事件 → 通知申请人（审批通过）</li>
 *   <li>REJECT 事件 → 通知申请人（审批驳回）</li>
 *   <li>CLOSE 事件 → 通知申请人（工单已关闭）</li>
 * </ul>
 * </p>
 * 
 * @since SWARM-001 Iteration 1
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final UserMapper userMapper;
    private final EmailService emailService;

    /** 审批人角色标识 */
    private static final String APPROVER_ROLE = "APPROVER";

    /**
     * 通知事件类型枚举
     */
    public enum NotificationEvent {
        SUBMIT("工单已提交", "您有一项新的工单待审批，请及时处理。"),
        APPROVE("工单已通过", "您提交的工单已审批通过。"),
        REJECT("工单已驳回", "您提交的工单已被驳回，请查看驳回原因。"),
        CLOSE("工单已关闭", "您参与的工单已关闭。");

        private final String subject;
        private final String defaultContent;

        NotificationEvent(String subject, String defaultContent) {
            this.subject = subject;
            this.defaultContent = defaultContent;
        }

        public String getSubject() {
            return subject;
        }

        public String getDefaultContent() {
            return defaultContent;
        }
    }

    /**
     * 通知载荷数据结构
     */
    public static class NotificationPayload {
        private final WorkOrder workOrder;
        private final NotificationEvent event;
        private final String recipientEmail;
        private final String recipientName;
        private final Map<String, String> variables;

        public NotificationPayload(WorkOrder workOrder, NotificationEvent event,
                                   String recipientEmail, String recipientName) {
            this.workOrder = workOrder;
            this.event = event;
            this.recipientEmail = recipientEmail;
            this.recipientName = recipientName;
            this.variables = new HashMap<>();
            buildVariables();
        }

        private void buildVariables() {
            variables.put("work_order_no", workOrder.getWorkOrderNo());
            variables.put("applicant_name", Optional.ofNullable(workOrder.getApplicantName()).orElse("未知申请人"));
            variables.put("title", Optional.ofNullable(workOrder.getTitle()).orElse("无标题"));
            variables.put("description", Optional.ofNullable(workOrder.getDescription()).orElse("无描述"));
            variables.put("current_state", workOrder.getCurrentState());
            variables.put("new_state", event.name());
            variables.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        }

        public String getSubject() {
            return interpolate(event.getSubject() + " - " + workOrder.getWorkOrderNo());
        }

        public String getContent() {
            String content = event.getDefaultContent();
            content += "\n\n工单编号: " + variables.get("work_order_no");
            content += "\n申请人: " + variables.get("applicant_name");
            content += "\n标题: " + variables.get("title");
            content += "\n当前状态: " + variables.get("current_state");
            content += "\n时间: " + variables.get("timestamp");
            return interpolate(content);
        }

        /**
         * 变量插值处理
         * 将模板中的 {variable_name} 替换为实际值
         *
         * @param template 原始模板字符串
         * @return 插值后的字符串
         */
        private String interpolate(String template) {
            String result = template;
            for (Map.Entry<String, String> entry : variables.entrySet()) {
                result = result.replace("{" + entry.getKey() + "}", entry.getValue());
            }
            return result;
        }

        public WorkOrder getWorkOrder() {
            return workOrder;
        }

        public NotificationEvent getEvent() {
            return event;
        }

        public String getRecipientEmail() {
            return recipientEmail;
        }

        public String getRecipientName() {
            return recipientName;
        }

        public Map<String, String> getVariables() {
            return new HashMap<>(variables);
        }
    }

    /**
     * 触发状态变更通知
     * 
     * <p>根据事件类型确定通知对象，构建通知载荷并异步发送。</p>
     *
     * @param workOrder 工单实体
     * @param event     触发的事件类型
     * @param operatorId 操作人ID（用于记录）
     */
    public void triggerNotification(WorkOrder workOrder, NotificationEvent event, Long operatorId) {
        log.info("[NotificationService] 触发通知 - 工单: {}, 事件: {}, 操作人: {}",
                workOrder.getWorkOrderNo(), event.name(), operatorId);

        try {
            // 根据事件类型确定通知目标
            NotificationPayload payload = buildPayload(workOrder, event);

            if (payload == null) {
                log.warn("[NotificationService] 无法构建通知载荷，跳过通知发送");
                return;
            }

            // 记录通知事件
            recordNotificationEvent(workOrder, event, payload, operatorId);

            // 异步发送邮件通知
            sendEmailNotificationAsync(payload);

            log.info("[NotificationService] 通知触发成功 - 收件人: {}", payload.getRecipientEmail());

        } catch (Exception e) {
            log.error("[NotificationService] 通知触发失败 - 工单: {}, 错误: {}",
                    workOrder.getWorkOrderNo(), e.getMessage(), e);
        }
    }

    /**
     * 构建通知载荷
     * 
     * <p>根据事件类型确定通知对象（审批人 或 申请人）。</p>
     *
     * <ul>
     *   <li>SUBMIT → 通知审批人</li>
     *   <li>APPROVE / REJECT / CLOSE → 通知申请人</li>
     * </ul>
     *
     * @param workOrder 工单实体
     * @param event     事件类型
     * @return 通知载荷，若无法确定收件人则返回 null
     */
    private NotificationPayload buildPayload(WorkOrder workOrder, NotificationEvent event) {
        String recipientEmail;
        String recipientName;

        switch (event) {
            case SUBMIT:
                // SUBMIT 事件 → 通知审批人
                Optional<User> approver = findApprover();
                if (approver.isEmpty()) {
                    log.warn("[NotificationService] 未找到审批人，无法发送 SUBMIT 通知");
                    return null;
                }
                recipientEmail = approver.get().getEmail();
                recipientName = approver.get().getUsername();
                break;

            case APPROVE:
            case REJECT:
            case CLOSE:
                // APPROVE/REJECT/CLOSE → 通知申请人
                if (workOrder.getApplicantId() == null) {
                    log.warn("[NotificationService] 工单无申请人信息，无法发送通知");
                    return null;
                }
                Optional<User> applicant = findUserById(workOrder.getApplicantId());
                if (applicant.isEmpty()) {
                    log.warn("[NotificationService] 未找到申请人，无法发送 {} 通知", event.name());
                    return null;
                }
                recipientEmail = applicant.get().getEmail();
                recipientName = applicant.get().getUsername();
                break;

            default:
                log.warn("[NotificationService] 未知事件类型: {}", event.name());
                return null;
        }

        return new NotificationPayload(workOrder, event, recipientEmail, recipientName);
    }

    /**
     * 查找审批人
     *
     * @return 审批人用户实体
     */
    private Optional<User> findApprover() {
        // 查找具有 APPROVER 角色的第一个用户
        return Optional.ofNullable(userMapper.findApproverByRole(APPROVER_ROLE));
    }

    /**
     * 根据用户ID查找用户
     *
     * @param userId 用户ID
     * @return 用户实体
     */
    private Optional<User> findUserById(Long userId) {
        return Optional.ofNullable(userMapper.selectById(userId));
    }

    /**
     * 记录通知事件到数据库
     *
     * @param workOrder 工单实体
     * @param event     事件类型
     * @param payload   通知载荷
     * @param operatorId 操作人ID
     */
    private void recordNotificationEvent(WorkOrder workOrder, NotificationEvent event,
                                        NotificationPayload payload, Long operatorId) {
        // 构建 JSON 载荷
        String payloadJson = buildPayloadJson(payload);

        NotificationRecord record = NotificationRecord.builder()
                .workOrderId(workOrder.getId())
                .workOrderNo(workOrder.getWorkOrderNo())
                .eventType(event.name())
                .recipientEmail(payload.getRecipientEmail())
                .recipientName(payload.getRecipientName())
                .payload(payloadJson)
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .operatorId(operatorId)
                .build();

        // 持久化通知记录
        saveNotificationRecord(record);
        log.debug("[NotificationService] 通知记录已保存 - 工单: {}, 事件: {}",
                workOrder.getWorkOrderNo(), event.name());
    }

    /**
     * 构建通知载荷 JSON
     *
     * @param payload 通知载荷对象
     * @return JSON 字符串
     */
    private String buildPayloadJson(NotificationPayload payload) {
        StringBuilder json = new StringBuilder("{");
        json.append("\"subject\":\"").append(escapeJson(payload.getSubject())).append("\",");
        json.append("\"content\":\"").append(escapeJson(payload.getContent())).append("\",");
        json.append("\"variables\":{");
        Map<String, String> vars = payload.getVariables();
        int count = 0;
        for (Map.Entry<String, String> entry : vars.entrySet()) {
            if (count > 0) json.append(",");
            json.append("\"").append(entry.getKey()).append("\":\"").append(escapeJson(entry.getValue())).append("\"");
            count++;
        }
        json.append("}}");
        return json.toString();
    }

    /**
     * JSON 字符串转义
     *
     * @param value 原始字符串
     * @return 转义后的字符串
     */
    private String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\")
                   .replace("\"", "\\\"")
                   .replace("\n", "\\n")
                   .replace("\r", "\\r")
                   .replace("\t", "\\t");
    }

    /**
     * 保存通知记录（持久化层调用）
     *
     * @param record 通知记录实体
     */
    private void saveNotificationRecord(NotificationRecord record) {
        // TODO: 注入 NotificationRecordRepository 并保存
        // notificationRecordRepository.save(record);
        log.debug("[NotificationService] 保存通知记录 - 收件人: {}, 状态: {}",
                record.getRecipientEmail(), record.getStatus());
    }

    /**
     * 异步发送邮件通知
     * 
     * <p>邮件发送为异步执行，避免阻塞主流程。</p>
     *
     * @param payload 通知载荷
     */
    @Async
    public void sendEmailNotificationAsync(NotificationPayload payload) {
        try {
            emailService.sendEmail(
                    payload.getRecipientEmail(),
                    payload.getRecipientName(),
                    payload.getSubject(),
                    payload.getContent()
            );

            // 更新通知记录状态为已发送
            updateNotificationStatus(payload, "SENT", LocalDateTime.now());
            log.info("[NotificationService] 邮件发送成功 - 收件人: {}", payload.getRecipientEmail());

        } catch (Exception e) {
            log.error("[NotificationService] 邮件发送失败 - 收件人: {}, 错误: {}",
                    payload.getRecipientEmail(), e.getMessage(), e);

            // 更新通知记录状态为发送失败
            updateNotificationStatus(payload, "FAILED", null);
        }
    }

    /**
     * 更新通知记录状态
     *
     * @param payload   通知载荷
     * @param status     新状态（SENT / FAILED）
     * @param sentAt     发送时间（失败时为 null）
     */
    private void updateNotificationStatus(NotificationPayload payload, String status, LocalDateTime sentAt) {
        // TODO: 根据 workOrderNo 和 event 查询并更新通知记录
        log.debug("[NotificationService] 更新通知状态 - 工单: {}, 事件: {}, 新状态: {}",
                payload.getWorkOrder().getWorkOrderNo(), payload.getEvent().name(), status);
    }

    /**
     * 发送测试邮件（用于验证邮件配置）
     *
     * @param toAddress 收件地址
     * @param subject   邮件主题
     * @param content   邮件内容
     * @return 操作结果
     */
    public Result<String> sendTestEmail(String toAddress, String subject, String content) {
        try {
            emailService.sendEmail(toAddress, null, subject, content);
            return Result.success("测试邮件发送成功");
        } catch (Exception e) {
            log.error("[NotificationService] 测试邮件发送失败: {}", e.getMessage(), e);
            return Result.error("测试邮件发送失败: " + e.getMessage());
        }
    }

    /**
     * 获取通知模板变量列表
     * 
     * <p>返回支持的模板变量，用于前端展示或文档说明。</p>
     *
     * @return 模板变量映射（变量名 -> 说明）
     */
    public Map<String, String> getAvailableTemplateVariables() {
        Map<String, String> variables = new HashMap<>();
        variables.put("work_order_no", "工单编号");
        variables.put("applicant_name", "申请人姓名");
        variables.put("title", "工单标题");
        variables.put("description", "工单描述");
        variables.put("current_state", "当前状态");
        variables.put("new_state", "变更后的状态");
        variables.put("timestamp", "操作时间 (yyyy-MM-dd HH:mm:ss)");
        return variables;
    }

    /**
     * 邮件服务接口
     * 
     * <p>定义邮件发送的抽象接口，具体实现由注入的 EmailService 提供。</p>
     */
    public interface EmailService {
        /**
         * 发送邮件
         *
         * @param toAddress 收件人地址
         * @param toName   收件人姓名（可为 null）
         * @param subject  邮件主题
         * @param content  邮件正文
         */
        void sendEmail(String toAddress, String toName, String subject, String content);
    }
}