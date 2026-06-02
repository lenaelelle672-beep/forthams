package com.ams.service;

import com.ams.entity.NotificationRecord;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebhookChannel implements NotificationChannel {

    private final WebhookService webhookService;

    @Override
    public void send(NotificationRecord record) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("notificationId", record.getId());
            payload.put("userId", record.getUserId());
            payload.put("title", record.getTitle());
            payload.put("content", record.getContent());
            payload.put("type", record.getType());
            payload.put("category", record.getCategory());
            webhookService.fireEvent("NOTIFICATION", payload);
        } catch (Exception e) {
            log.warn("webhook_channel_send_failed recordId={} error={}", record.getId(), e.getMessage());
        }
    }
}
