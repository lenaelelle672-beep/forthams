package com.ams.service;

import com.ams.entity.ChannelConfig;
import com.ams.entity.NotificationRecord;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class DingTalkChannel implements NotificationChannel {

    private static final Logger log = LoggerFactory.getLogger(DingTalkChannel.class);
    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");
    private static final String DINGTALK_API = "https://oapi.dingtalk.com/robot/send";

    private final ChannelConfigService channelConfigService;
    private final ObjectMapper objectMapper;

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .build();

    @Override
    @Async("notificationExecutor")
    public void send(NotificationRecord record) {
        List<ChannelConfig> configs = channelConfigService.getByType("DINGTALK");
        if (configs.isEmpty()) {
            log.debug("DingTalkChannel skipped: no enabled configs");
            return;
        }

        String title = record.getTitle() != null ? record.getTitle() : "通知";
        String content = record.getContent() != null ? record.getContent() : "";
        String markdownText = "## " + title + "\n\n" + content;

        for (ChannelConfig config : configs) {
            try {
                String webhookUrl = buildWebhookUrl(config);
                Map<String, Object> body = new HashMap<>();
                body.put("msgtype", "markdown");

                Map<String, String> markdown = new HashMap<>();
                markdown.put("title", title);
                markdown.put("text", markdownText);
                body.put("markdown", markdown);

                String json = objectMapper.writeValueAsString(body);
                Request httpRequest = new Request.Builder()
                        .url(webhookUrl)
                        .post(RequestBody.create(json, JSON))
                        .build();

                try (var response = httpClient.newCall(httpRequest).execute()) {
                    if (response.isSuccessful()) {
                        log.info("DingTalk message sent to config={}", config.getConfigName());
                    } else {
                        log.warn("DingTalk send failed to config={}, status={}, body={}",
                                config.getConfigName(), response.code(), response.body() != null ? response.body().string() : "");
                    }
                }
            } catch (Exception e) {
                log.warn("DingTalkChannel failed to send to config={}: {}", config.getConfigName(), e.getMessage());
            }
        }
    }

    public void sendTest(ChannelConfig config) {
        try {
            String webhookUrl = buildWebhookUrl(config);
            Map<String, Object> body = new HashMap<>();
            body.put("msgtype", "text");

            Map<String, String> text = new HashMap<>();
            text.put("content", "【测试消息】钉钉通知渠道配置 \"" + config.getConfigName() + "\" 测试成功");
            body.put("text", text);

            String json = objectMapper.writeValueAsString(body);
            Request httpRequest = new Request.Builder()
                    .url(webhookUrl)
                    .post(RequestBody.create(json, JSON))
                    .build();

            try (var response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful()) {
                    String respBody = response.body() != null ? response.body().string() : "";
                    throw new RuntimeException("HTTP " + response.code() + ": " + respBody);
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("钉钉测试消息发送失败: " + e.getMessage(), e);
        }
    }

    private String buildWebhookUrl(ChannelConfig config) {
        String url = config.getWebhookUrl();
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("Webhook URL 不能为空");
        }

        if (config.getSecret() != null && !config.getSecret().isBlank()) {
            long timestamp = System.currentTimeMillis();
            String sign = sign(timestamp, config.getSecret());
            String separator = url.contains("?") ? "&" : "?";
            url = url + separator + "timestamp=" + timestamp + "&sign=" + sign;
        }

        return url;
    }

    static String sign(long timestamp, String secret) {
        try {
            String stringToSign = timestamp + "\n" + secret;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signData = mac.doFinal(stringToSign.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(signData);
        } catch (Exception e) {
            throw new RuntimeException("DingTalk sign failed", e);
        }
    }
}
