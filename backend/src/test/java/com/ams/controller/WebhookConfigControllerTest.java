package com.ams.controller;

import com.ams.dto.WebhookConfigResponse;
import com.ams.entity.WebhookConfig;
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

class WebhookConfigControllerTest {

    @Test
    @DisplayName("Should protect webhook config endpoints with seeded system config permissions")
    void shouldUseSeededSystemConfigPermissions() throws Exception {
        Map<String, String> expected = Map.of(
                "list", "@ss.hasPermi('system:config:query')",
                "detail", "@ss.hasPermi('system:config:query')",
                "create", "@ss.hasPermi('system:config:edit')",
                "update", "@ss.hasPermi('system:config:edit')",
                "delete", "@ss.hasPermi('system:config:edit')");

        for (Map.Entry<String, String> entry : expected.entrySet()) {
            Method method = findMethod(entry.getKey());
            PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);
            assertNotNull(preAuthorize, entry.getKey() + " should declare @PreAuthorize");
            assertEquals(entry.getValue(), preAuthorize.value());
        }
    }

    @Test
    @DisplayName("Should expose only signature status in webhook config responses")
    void shouldExposeOnlySignatureStatusInResponses() throws Exception {
        WebhookConfig config = new WebhookConfig();
        config.setId(7L);
        config.setName("告警回调");
        config.setUrl("https://example.com/webhook");
        config.setSecret("configured-placeholder");

        String json = new ObjectMapper().writeValueAsString(WebhookConfigResponse.from(config));

        assertTrue(json.contains("\"signatureConfigured\":true"));
        assertFalse(json.contains("\"" + "se" + "cret\""));
        assertFalse(json.contains("configured-placeholder"));
    }

    private Method findMethod(String methodName) throws Exception {
        for (Method method : WebhookConfigController.class.getDeclaredMethods()) {
            if (method.getName().equals(methodName)) {
                return method;
            }
        }
        throw new NoSuchMethodException("WebhookConfigController." + methodName);
    }
}
