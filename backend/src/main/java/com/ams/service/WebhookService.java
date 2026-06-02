package com.ams.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class WebhookService {

    private final WebhookConfigService webhookConfigService;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    private static final String HMAC_SHA256 = "HmacSHA256";

    /**
     * 触发 Webhook 事件
     */
    public void fireEvent(String eventType, Map<String, Object> payload) {
        List<com.ams.entity.WebhookConfig> configs = webhookConfigService.getEnabledByEvent(eventType);
        if (configs == null || configs.isEmpty()) return;

        for (com.ams.entity.WebhookConfig config : configs) {
            try {
                sendWebhook(config, eventType, payload);
            } catch (Exception e) {
                log.warn("webhook_send_failed id={} url={} error={}",
                        config.getId(), config.getUrl(), e.getMessage());
            }
        }
    }

    /**
     * 发送 Webhook 并签名
     */
    private void sendWebhook(com.ams.entity.WebhookConfig config, String eventType,
                              Map<String, Object> payload) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("event", eventType);
        body.put("timestamp", Instant.now().toString());
        body.put("data", payload);

        String jsonBody = objectMapper.writeValueAsString(body);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Webhook-Event", eventType);
        headers.set("X-Webhook-Timestamp", Instant.now().toString());

        // HMAC-SHA256 签名
        if (config.getSecret() != null && !config.getSecret().isBlank()) {
            String signature = sign(jsonBody, config.getSecret());
            headers.set("X-Webhook-Signature", "sha256=" + signature);
        }

        HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);
        ResponseEntity<String> response = restTemplate.exchange(
                config.getUrl(), HttpMethod.POST, entity, String.class);

        if (!response.getStatusCode().is2xxSuccessful()) {
            log.warn("webhook_response_error id={} status={}", config.getId(), response.getStatusCode());
        }
    }

    private String sign(String data, String secret) throws Exception {
        Mac mac = Mac.getInstance(HMAC_SHA256);
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
        byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hash);
    }
}
