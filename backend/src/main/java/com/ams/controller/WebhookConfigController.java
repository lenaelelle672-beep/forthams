package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.WebhookConfigResponse;
import com.ams.entity.WebhookConfig;
import com.ams.service.WebhookConfigService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/webhook-configs")
@RequiredArgsConstructor
public class WebhookConfigController {

    private final WebhookConfigService webhookConfigService;

    @PreAuthorize("@ss.hasPermi('system:config:query')")
    @GetMapping
    public Result<Map<String, Object>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        Page<WebhookConfig> result = webhookConfigService.queryPage(page, pageSize, keyword);
        List<WebhookConfigResponse> records = result.getRecords().stream()
                .map(WebhookConfigResponse::from)
                .toList();
        return Result.success(Map.of("records", records, "total", result.getTotal()));
    }

    @PreAuthorize("@ss.hasPermi('system:config:query')")
    @GetMapping("/{id}")
    public Result<WebhookConfigResponse> detail(@PathVariable Long id) {
        return Result.success(WebhookConfigResponse.from(webhookConfigService.getById(id)));
    }

    @PreAuthorize("@ss.hasPermi('system:config:edit')")
    @PostMapping
    public Result<WebhookConfigResponse> create(@RequestBody WebhookConfig config) {
        return Result.success(WebhookConfigResponse.from(webhookConfigService.create(config)));
    }

    @PreAuthorize("@ss.hasPermi('system:config:edit')")
    @PutMapping("/{id}")
    public Result<WebhookConfigResponse> update(@PathVariable Long id, @RequestBody WebhookConfig config) {
        return Result.success(WebhookConfigResponse.from(webhookConfigService.update(id, config)));
    }

    @PreAuthorize("@ss.hasPermi('system:config:edit')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        webhookConfigService.delete(id);
        return Result.success();
    }
}
