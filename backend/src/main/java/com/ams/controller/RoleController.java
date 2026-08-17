package com.ams.controller;

import com.ams.dto.RoleCreateDTO;
import com.ams.dto.RoleDataScopeUpdateDTO;
import com.ams.dto.RoleUpdateDTO;
import com.ams.entity.Role;
import com.ams.service.RoleService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/roles")
@RequiredArgsConstructor
@Validated
public class RoleController {

    private final RoleService roleService;

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('role:query')")
    public Result<Page<Role>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(roleService.queryRoles(page, pageSize, null));
    }

    @GetMapping("/all")
    @PreAuthorize("hasAuthority('role:query')")
    public Result<List<Role>> all() {
        return Result.success(roleService.listAllRoles());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('role:query')")
    public Result<Role> getById(@PathVariable Long id) {
        return Result.success(roleService.getRoleById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('role:create')")
    public Result<Role> create(@Valid @RequestBody RoleCreateDTO dto) {
        return Result.success(roleService.createRole(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('role:update')")
    public Result<Role> update(@PathVariable Long id, @Valid @RequestBody RoleUpdateDTO dto) {
        return Result.success(roleService.updateRole(id, dto));
    }

    @PutMapping("/{id}/data-scope")
    @PreAuthorize("hasAuthority('role:update')")
    public Result<Void> updateDataScope(@PathVariable Long id, @Valid @RequestBody RoleDataScopeUpdateDTO dto) {
        roleService.configureDataScope(id, dto);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('role:delete')")
    public Result<Void> delete(@PathVariable Long id) {
        roleService.deleteRole(id);
        return Result.success();
    }
}
