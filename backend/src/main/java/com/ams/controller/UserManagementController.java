package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.User;
import com.ams.service.UserManagementService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/user-management")
@RequiredArgsConstructor
public class UserManagementController {

    private final UserManagementService userManagementService;

    @GetMapping("/list")
    public Result<Page<User>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long deptId,
            @RequestParam(required = false) Integer status) {
        return Result.success(userManagementService.queryUsers(page, pageSize, keyword, deptId, status));
    }

    @GetMapping("/{id}")
    public Result<User> getById(@PathVariable Long id) {
        return Result.success(userManagementService.getUserById(id));
    }

    @PostMapping
    public Result<User> create(@RequestBody Object dto) {
        return Result.success(userManagementService.createUser(null));
    }

    @PutMapping("/{id}")
    public Result<User> update(@PathVariable Long id, @RequestBody Object dto) {
        return Result.success(userManagementService.updateUser(id, null));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        return Result.success();
    }

    @PutMapping("/{id}/reset-password")
    public Result<Void> resetPassword(@PathVariable Long id) {
        userManagementService.resetPassword(id);
        return Result.success();
    }
}
