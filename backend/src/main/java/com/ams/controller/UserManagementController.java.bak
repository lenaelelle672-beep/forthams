package com.ams.controller;

import com.ams.dto.UserCreateDTO;
import com.ams.dto.UserUpdateDTO;
import com.ams.entity.User;
import com.ams.service.UserManagementService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/user-management", "/users"})
@RequiredArgsConstructor
public class UserManagementController {

    private final UserManagementService userManagementService;

    /** 分页查询用户列表（管理后台使用） */
    @GetMapping("/list")
    public Result<Page<User>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long deptId,
            @RequestParam(required = false) Integer status) {
        return Result.success(userManagementService.queryUsers(page, pageSize, keyword, deptId, status));
    }

    /** 关键词搜索用户（流程设计器审批人选择器使用） */
    @GetMapping("/search")
    public Result<List<User>> search(@RequestParam(required = false) String keyword) {
        return Result.success(userManagementService.searchUsers(keyword));
    }

    @GetMapping("/{id}")
    public Result<User> getById(@PathVariable Long id) {
        return Result.success(userManagementService.getUserById(id));
    }

    /** 获取用户详情（含角色信息，流程设计器/排障使用） */
    @GetMapping("/{id}/detail")
    public Result<Map<String, Object>> getDetail(@PathVariable Long id) {
        return Result.success(userManagementService.getUserDetailWithRoles(id));
    }

    /** 获取用户的角色ID列表 */
    @GetMapping("/{id}/roles")
    public Result<List<Long>> getUserRoles(@PathVariable Long id) {
        return Result.success(userManagementService.getUserRoleIds(id));
    }

    @PostMapping
    public Result<User> create(@Valid @RequestBody UserCreateDTO dto) {
        return Result.success(userManagementService.createUser(dto));
    }

    @PutMapping("/{id}")
    public Result<User> update(@PathVariable Long id, @Valid @RequestBody UserUpdateDTO dto) {
        return Result.success(userManagementService.updateUser(id, dto));
    }

    @PutMapping("/{id}/reset-password")
    public Result<Void> resetPassword(@PathVariable Long id) {
        userManagementService.resetPassword(id);
        return Result.success();
    }

    @PutMapping("/{id}/status")
    public Result<Void> updateStatus(@PathVariable Long id, @RequestBody Map<String, Integer> body) {
        userManagementService.updateStatus(id, body.get("status"));
        return Result.success();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        userManagementService.deleteUser(id);
        return Result.success();
    }
}
