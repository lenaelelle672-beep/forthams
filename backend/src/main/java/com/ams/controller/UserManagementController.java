package com.ams.controller;

import com.ams.dto.UserCreateDTO;
import com.ams.dto.UserUpdateDTO;
import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.service.UserManagementService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/user-management", "/users"})
@RequiredArgsConstructor
public class UserManagementController {

    private final UserManagementService userManagementService;
    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;

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

    /** 获取当前登录用户信息（含角色列表），供前端 AuthContext roles 自动修复使用 */
    @GetMapping("/current")
    public Result<Map<String, Object>> currentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, username));
        if (user == null) {
            return Result.error(401, "用户不存在");
        }
        List<String> roles = userRoleMapper.selectRoleCodesByUserId(user.getId());
        Map<String, Object> result = new HashMap<>();
        result.put("userId", user.getId());
        result.put("username", user.getUsername());
        result.put("realName", user.getRealName());
        result.put("roles", roles);
        return Result.success(result);
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
