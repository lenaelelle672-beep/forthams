package com.ams.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 系统健康检查控制器，提供服务存活状态与基本信息探测端点。
 * 合并了原 HealthCheckController 的 GET /health 端点。
 */
@RestController
public class SystemHealthController {

    @GetMapping("/health")
    public Map<String, String> rootHealth() {
        return health();
    }

    @GetMapping("/system/health")
    public Map<String, String> health() {
        Map<String, String> result = new LinkedHashMap<>();
        result.put("status", "UP");
        result.put("service", "forthAMS");
        result.put("timestamp", LocalDateTime.now().toString());
        return result;
    }

    @GetMapping("/system/info")
    public Map<String, String> info() {
        Map<String, String> result = new LinkedHashMap<>();
        result.put("app", "forthAMS");
        result.put("version", "1.0.0");
        result.put("javaVersion", System.getProperty("java.version"));
        return result;
    }
}
