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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class WeChatChannel implements NotificationChannel {

    private static final Logger log = LoggerFactory.getLogger(WeChatChannel.class);
    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");

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
        List<ChannelConfig> configs = channelConfigService.getByType("WECHAT");
        if (configs.isEmpty()) {
            log.debug("WeChatChannel skipped: no enabled configs");
            return;
        }

        String content = record.getContent() != null ? record.getContent() : "";
        if (record.getTitle() != null) {
            content = record.getTitle() + "\n\n" + content;
        }

        for (ChannelConfig config : configs) {
            try {
                Map<String, Object> body = new HashMap<>();
                body.put("msgtype", "text");

                Map<String, String> text = new HashMap<>();
                text.put("content", content);
                body.put("text", text);

                String json = objectMapper.writeValueAsString(body);
                Request httpRequest = new Request.Builder()
                        .url(config.getWebhookUrl())
                        .post(RequestBody.create(json, JSON))
                        .build();

                try (var response = httpClient.newCall(httpRequest).execute()) {
                    if (response.isSuccessful()) {
                        log.info("WeChat message sent to config={}", config.getConfigName());
                    } else {
                        log.warn("WeChat send failed to config={}, status={}, body={}",
                                config.getConfigName(), response.code(), response.body() != null ? response.body().string() : "");
                    }
                }
            } catch (Exception e) {
                log.warn("WeChatChannel failed to send to config={}: {}", config.getConfigName(), e.getMessage());
            }
        }
    }

    public void sendTest(ChannelConfig config) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("msgtype", "text");

            Map<String, String> text = new HashMap<>();
            text.put("content", "【测试消息】企业微信通知渠道配置 \"" + config.getConfigName() + "\" 测试成功");
            body.put("text", text);

            String json = objectMapper.writeValueAsString(body);
            Request httpRequest = new Request.Builder()
                    .url(config.getWebhookUrl())
                    .post(RequestBody.create(json, JSON))
                    .build();

            try (var response = httpClient.newCall(httpRequest).execute()) {
                if (!response.isSuccessful()) {
                    String respBody = response.body() != null ? response.body().string() : "";
                    throw new RuntimeException("HTTP " + response.code() + ": " + respBody);
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("企业微信测试消息发送失败: " + e.getMessage(), e);
        }
    }
}
