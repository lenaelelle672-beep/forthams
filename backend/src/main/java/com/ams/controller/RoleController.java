package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Role;
import com.ams.service.RoleService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/roles")
@RequiredArgsConstructor
public class RoleController {
    private final RoleService roleService;

    @GetMapping("/list")
    public Result<Page<Role>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return Result.success(roleService.queryRoles(page, pageSize, keyword));
    }

    @GetMapping("/all")
    public Result<?> all() {
        return list(1, 9999, null);
    }

    @GetMapping("/{id}")
    public Result<?> getById(@PathVariable Long id) {
        return Result.success();
    }
}
