package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.SysTenant;
import com.ams.service.TenantService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/tenants")
@RequiredArgsConstructor
public class TenantController {

    private final TenantService tenantService;

    @PreAuthorize("@ss.hasPermi('system:tenant')")
    @GetMapping
    public Result<Map<String, Object>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        Page<SysTenant> result = tenantService.listTenants(page, pageSize, keyword);
        return Result.success(Map.of("records", result.getRecords(), "total", result.getTotal()));
    }

    @PreAuthorize("@ss.hasPermi('system:tenant')")
    @GetMapping("/{id}")
    public Result<SysTenant> detail(@PathVariable String id) {
        return Result.success(tenantService.getTenant(id));
    }

    @PreAuthorize("@ss.hasPermi('system:tenant')")
    @PostMapping
    public Result<SysTenant> create(@RequestBody SysTenant tenant) {
        return Result.success(tenantService.createTenant(tenant));
    }

    @PreAuthorize("@ss.hasPermi('system:tenant')")
    @PutMapping("/{id}")
    public Result<SysTenant> update(@PathVariable String id, @RequestBody SysTenant tenant) {
        return Result.success(tenantService.updateTenant(id, tenant));
    }

    @PreAuthorize("@ss.hasPermi('system:tenant')")
    @PutMapping("/{id}/suspend")
    public Result<Void> suspend(@PathVariable String id) {
        tenantService.suspendTenant(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('system:tenant')")
    @PutMapping("/{id}/activate")
    public Result<Void> activate(@PathVariable String id) {
        tenantService.activateTenant(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('system:tenant')")
    @GetMapping("/{id}/quota")
    public Result<Map<String, Object>> quota(@PathVariable String id) {
        return Result.success(tenantService.getQuotaUsage(id));
    }
}
