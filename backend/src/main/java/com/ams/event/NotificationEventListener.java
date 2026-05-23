package com.ams.event;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * 通知事件监听器
 *
 * <p>监听审批相关事件，记录日志。后续可扩展为异步发送邮件/站内信等。</p>
 */
@Slf4j
@Component
public class NotificationEventListener {

    /**
     * 处理审批通知事件
     *
     * @param event 审批通知事件
     */
    @EventListener
    public void handleApprovalNotification(ApprovalNotificationEvent event) {
        log.info("收到审批通知事件: {}", event);
    }
}
