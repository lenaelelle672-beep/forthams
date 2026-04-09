package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.UserCreateDTO;
import com.ams.dto.UserUpdateDTO;
import com.ams.entity.User;
import com.ams.service.UserManagementService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
public class UserManagementController {

    private final UserManagementService userManagementService;

    public UserManagementController(UserManagementService userManagementService) {
        this.userManagementService = userManagementService;
    }

    @GetMapping("/list")
    public Result<Page<User>> list(
        @RequestParam(defaultValue = "1") Integer page,
        @RequestParam(defaultValue = "10") Integer pageSize,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) Long deptId,
        @RequestParam(required = false) Integer status
    ) {
        return Result.success(userManagementService.queryUsers(page, pageSize, keyword, deptId, status));
    }

    @GetMapping("/{id}")
    public Result<User> getById(@PathVariable Long id) {
        return Result.success(userManagementService.getUserById(id));
    }

    @PostMapping
    public Result<User> create(@Valid @RequestBody UserCreateDTO dto) {
        return Result.success("创建成功", userManagementService.createUser(dto));
    }

    @PutMapping("/{id}")
    public Result<User> update(@PathVariable Long id, @Valid @RequestBody UserUpdateDTO dto) {
        return Result.success("更新成功", userManagementService.updateUser(id, dto));
    }

    @PutMapping("/{id}/reset-password")
    public Result<String> resetPassword(@PathVariable Long id) {
        userManagementService.resetPassword(id);
        return Result.success("重置密码成功");
    }

    @PutMapping("/{id}/status")
    public Result<String> updateStatus(@PathVariable Long id, @RequestParam Integer status) {
        userManagementService.updateStatus(id, status);
        return Result.success("状态更新成功");
    }

    @DeleteMapping("/{id}")
    public Result<String> delete(@PathVariable Long id) {
        userManagementService.deleteUser(id);
        return Result.success("删除成功");
    }
}
