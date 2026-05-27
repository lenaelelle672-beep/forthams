package com.ams.controller;

import com.ams.common.Result;
import com.ams.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.Map;

/**
 * 系统配置控制器
 *
 * <p>提供系统配置（SYSTEM）和安全配置（SECURITY）的读写 API。
 * 前端 SettingsPage 的 SystemConfigTab 和 SecurityTab 通过此控制器
 * 实现配置持久化，替代原有的 localStorage 方案。
 */
@RestController
@RequestMapping("/system-config")
@RequiredArgsConstructor
public class SystemConfigController {

    private final SystemConfigService systemConfigService;

    /**
     * 获取系统配置（SYSTEM 分组）
     */
    @PreAuthorize("@ss.hasPermi('system:config:query')")
    @GetMapping("/system")
    public Result<Map<String, String>> getSystemConfig() {
        return Result.success(systemConfigService.getConfigMap(SystemConfigService.GROUP_SYSTEM));
    }

    /**
     * 保存系统配置（SYSTEM 分组）
     */
    @PreAuthorize("@ss.hasPermi('system:config:edit')")
    @PutMapping("/system")
    public Result<Void> saveSystemConfig(@RequestBody Map<String, String> configMap) {
        systemConfigService.saveConfigMap(SystemConfigService.GROUP_SYSTEM, configMap);
        return Result.success();
    }

    /**
     * 获取安全配置（SECURITY 分组）
     */
    @PreAuthorize("@ss.hasPermi('system:config:query')")
    @GetMapping("/security")
    public Result<Map<String, String>> getSecurityConfig() {
        return Result.success(systemConfigService.getConfigMap(SystemConfigService.GROUP_SECURITY));
    }

    /**
     * 保存安全配置（SECURITY 分组）
     */
    @PreAuthorize("@ss.hasPermi('system:config:edit')")
    @PutMapping("/security")
    public Result<Void> saveSecurityConfig(@RequestBody Map<String, String> configMap) {
        systemConfigService.saveConfigMap(SystemConfigService.GROUP_SECURITY, configMap);
        return Result.success();
    }
}
