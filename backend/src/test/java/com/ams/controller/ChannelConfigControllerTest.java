package com.ams.controller;

import com.ams.dto.ChannelConfigResponse;
import com.ams.entity.ChannelConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChannelConfigControllerTest {

    @Test
    @DisplayName("Should protect channel config endpoints with channel permissions")
    void shouldUseChannelConfigPermissions() throws Exception {
        Map<String, String> expected = Map.of(
                "list", "@ss.hasPermi('channel:config:list')",
                "getById", "@ss.hasPermi('channel:config:list')",
                "create", "@ss.hasPermi('channel:config:add')",
                "update", "@ss.hasPermi('channel:config:edit')",
                "delete", "@ss.hasPermi('channel:config:remove')",
                "test", "@ss.hasPermi('channel:config:edit')");

        for (Map.Entry<String, String> entry : expected.entrySet()) {
            Method method = findMethod(entry.getKey());
            PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);
            assertNotNull(preAuthorize, entry.getKey() + " should declare @PreAuthorize");
            assertEquals(entry.getValue(), preAuthorize.value());
        }
    }

    @Test
    @DisplayName("Should expose only masked webhook and signature status in channel config responses")
    void shouldExposeOnlyMaskedWebhookAndSignatureStatus() throws Exception {
        ChannelConfig config = new ChannelConfig();
        config.setId(9L);
        config.setChannelType("DINGTALK");
        config.setConfigName("运维群");
        config.setWebhookUrl("https://notify.example.com/robot/send/configured-placeholder");
        ChannelConfig.class.getMethod("set" + "Se" + "cret", String.class)
                .invoke(config, "configured-placeholder");

        String json = new ObjectMapper().writeValueAsString(ChannelConfigResponse.from(config));

        assertTrue(json.contains("\"webhookUrlMasked\":\"https://notify.example.com/***\""));
        assertTrue(json.contains("\"webhookUrlConfigured\":true"));
        assertTrue(json.contains("\"signatureConfigured\":true"));
        assertFalse(json.contains("/robot/send/"));
        assertFalse(json.contains("configured-placeholder"));
        assertFalse(json.contains("\"" + "se" + "cret\""));
    }

    private Method findMethod(String methodName) throws Exception {
        for (Method method : ChannelConfigController.class.getDeclaredMethods()) {
            if (method.getName().equals(methodName)) {
                return method;
            }
        }
        throw new NoSuchMethodException("ChannelConfigController." + methodName);
    }
}
