package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.SlaConfig;
import com.ams.service.SlaService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * SLA 配置管理接口。
 *
 * <p>提供按租户查询和更新 SLA 配置的能力。
 * 仅管理员可修改配置。
 */
@RestController
@RequestMapping("/sla-config")
@RequiredArgsConstructor
public class SlaConfigController {

    private final SlaService slaService;

    @PreAuthorize("@ss.hasPermi('system:config:query')")
    @GetMapping
    public Result<List<SlaConfig>> listConfigs() {
        return Result.success(slaService.listConfigs());
    }

    @PreAuthorize("@ss.hasPermi('system:config:edit')")
    @PutMapping("/{id}")
    public Result<SlaConfig> updateConfig(@PathVariable Long id, @RequestBody SlaConfig config) {
        return Result.success(slaService.updateConfig(id, config));
    }
}
