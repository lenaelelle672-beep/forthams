package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.RoleCreateDTO;
import com.ams.dto.RoleUpdateDTO;
import com.ams.entity.Role;
import com.ams.service.RoleService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/roles")
public class RoleController {

    private final RoleService roleService;

    public RoleController(RoleService roleService) {
        this.roleService = roleService;
    }

    @Auditable
    @GetMapping("/list")
    public Result<Page<Role>> list(
        @RequestParam(defaultValue = "1") Integer page,
        @RequestParam(defaultValue = "10") Integer pageSize,
        @RequestParam(required = false) String keyword
    ) {
        return Result.success(roleService.queryRoles(page, pageSize, keyword));
    }

    @Auditable
    @GetMapping("/all")
    public Result<List<Role>> all() {
        return Result.success(roleService.listAllRoles());
    }

    @Auditable
    @Auditable
    @GetMapping("/{id}")
    public Result<Role> getById(@PathVariable Long id) {
        return Result.success(roleService.getRoleById(id));
    }

    @Auditable
    @Auditable
    @PostMapping
    public Result<Role> create(@Valid @RequestBody RoleCreateDTO dto) {
        return Result.success("创建成功", roleService.createRole(dto));
    }

    @Auditable
    @Auditable
    @PutMapping("/{id}")
    public Result<Role> update(@PathVariable Long id, @Valid @RequestBody RoleUpdateDTO dto) {
        return Result.success("更新成功", roleService.updateRole(id, dto));
    }

    @Auditable
    @Auditable
    @DeleteMapping("/{id}")
    public Result<String> delete(@PathVariable Long id) {
        roleService.deleteRole(id);
        return Result.success("删除成功");
    }
}
