package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.SystemConfig;
import com.ams.service.SystemConfigService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/system/configs")
@RequiredArgsConstructor
public class SysConfigController {

    private final SystemConfigService systemConfigService;

    @PreAuthorize("@ss.hasPermi('system:config:query')")
    @GetMapping
    public Result<Page<SystemConfig>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String configName,
            @RequestParam(required = false) String configKey) {
        return Result.success(systemConfigService.getPage(page, pageSize, configName, configKey));
    }

    @PreAuthorize("@ss.hasPermi('system:config:query')")
    @GetMapping("/{id}")
    public Result<SystemConfig> getById(@PathVariable Long id) {
        return Result.success(systemConfigService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('system:config:query')")
    @GetMapping("/by-key/{key}")
    public Result<SystemConfig> getByKey(@PathVariable String key) {
        return Result.success(systemConfigService.getByKey(key));
    }

    @PreAuthorize("@ss.hasPermi('system:config:add')")
    @PostMapping
    public Result<SystemConfig> create(@RequestBody SystemConfig config) {
        return Result.success(systemConfigService.create(config));
    }

    @PreAuthorize("@ss.hasPermi('system:config:edit')")
    @PutMapping("/{id}")
    public Result<SystemConfig> update(@PathVariable Long id, @RequestBody SystemConfig config) {
        return Result.success(systemConfigService.update(id, config));
    }

    @PreAuthorize("@ss.hasPermi('system:config:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        systemConfigService.delete(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('system:config:edit')")
    @PostMapping("/refresh-cache")
    public Result<Void> refreshCache() {
        systemConfigService.refreshCache();
        return Result.success();
    }
}
