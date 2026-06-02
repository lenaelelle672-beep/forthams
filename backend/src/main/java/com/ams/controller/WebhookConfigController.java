package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.WebhookConfig;
import com.ams.service.WebhookConfigService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/webhook-configs")
@RequiredArgsConstructor
public class WebhookConfigController {

    private final WebhookConfigService webhookConfigService;

    @PreAuthorize("@ss.hasPermi('system:config')")
    @GetMapping
    public Result<Map<String, Object>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        Page<WebhookConfig> result = webhookConfigService.queryPage(page, pageSize, keyword);
        return Result.success(Map.of("records", result.getRecords(), "total", result.getTotal()));
    }

    @PreAuthorize("@ss.hasPermi('system:config')")
    @GetMapping("/{id}")
    public Result<WebhookConfig> detail(@PathVariable Long id) {
        return Result.success(webhookConfigService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('system:config')")
    @PostMapping
    public Result<WebhookConfig> create(@RequestBody WebhookConfig config) {
        return Result.success(webhookConfigService.create(config));
    }

    @PreAuthorize("@ss.hasPermi('system:config')")
    @PutMapping("/{id}")
    public Result<WebhookConfig> update(@PathVariable Long id, @RequestBody WebhookConfig config) {
        return Result.success(webhookConfigService.update(id, config));
    }

    @PreAuthorize("@ss.hasPermi('system:config')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        webhookConfigService.delete(id);
        return Result.success();
    }
}
