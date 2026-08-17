package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SysTenantDTO;
import com.ams.dto.TenantProvisionRequest;
import com.ams.service.TenantAuthorityService;
import com.ams.service.TenantProvisioningService;
import com.ams.service.SysTenantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 租户主数据只读 controller。
 *
 * 路径 /tenants 与前端 api/tenant.ts 现有调用对齐：
 * - GET /tenants          租户目录列表（仅显式 platform-admin）
 * - GET /tenants/current  当前租户（任意已认证用户，供 UserProfilePage）
 * - GET /tenants/{id}     租户详情（仅显式 platform-admin）
 * - GET /tenants/meta     只读元数据（仅显式 platform-admin）
 * - POST /tenants/provision 受控开通租户及首位 tenant-admin（仅显式 platform-admin）
 *
 * 除受控开通外不暴露 create/update/suspend/activate。
 */
@RestController
@RequestMapping("/tenants")
@RequiredArgsConstructor
public class SysTenantController {

    private final SysTenantService sysTenantService;
    private final TenantAuthorityService tenantAuthorityService;
    private final TenantProvisioningService tenantProvisioningService;

    @GetMapping
    public Result<SysTenantDTO.PageResult> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        tenantAuthorityService.requirePlatformAdmin();
        return Result.success(sysTenantService.list(keyword, status, page, pageSize));
    }

    @GetMapping("/current")
    public Result<SysTenantDTO> current() {
        tenantAuthorityService.requireCurrentTenantMember();
        return Result.success(sysTenantService.current());
    }

    @GetMapping("/meta")
    public Result<SysTenantDTO.Meta> meta() {
        tenantAuthorityService.requirePlatformAdmin();
        return Result.success(sysTenantService.meta());
    }

    @GetMapping("/{id}")
    public Result<SysTenantDTO> detail(@PathVariable String id) {
        tenantAuthorityService.requirePlatformAdmin();
        return Result.success(sysTenantService.detail(id));
    }

    @PostMapping("/provision")
    public Result<SysTenantDTO> provision(@Valid @RequestBody TenantProvisionRequest request) {
        return Result.success(tenantProvisioningService.provision(request));
    }
}
