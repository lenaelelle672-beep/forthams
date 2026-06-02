package com.ams.controller;

import com.ams.annotation.OperBusinessType;
import com.ams.annotation.OperLog;
import com.ams.dto.UserCreateDTO;
import com.ams.dto.UserUpdateDTO;
import com.ams.entity.User;
import com.ams.mapper.SysMenuMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.service.UserManagementService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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
    private final SysMenuMapper sysMenuMapper;

    /** 分页查询用户列表（管理后台使用） */
    @PreAuthorize("@ss.hasPermi('system:user:query')")
    @GetMapping("/list")
    public Result<Page<User>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long deptId,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) List<Long> roleIds,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createTimeStart,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createTimeEnd) {
        return Result.success(userManagementService.queryUsers(
                page, pageSize, keyword, deptId, status, roleIds, createTimeStart, createTimeEnd));
    }

    /** 关键词搜索用户（流程设计器审批人选择器使用） */
    @PreAuthorize("@ss.hasPermi('system:user:query')")
    @GetMapping("/search")
    public Result<List<User>> search(@RequestParam(required = false) String keyword) {
        return Result.success(userManagementService.searchUsers(keyword));
    }

    /** 获取当前登录用户信息（含角色和权限列表），供前端 AuthContext 自动修复使用 */
    @GetMapping("/current")
    public Result<Map<String, Object>> currentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, username));
        if (user == null) {
            return Result.error(401, "用户不存在");
        }
        List<String> roles = userRoleMapper.selectRoleCodesByUserId(user.getId());
        List<String> permissions = sysMenuMapper.selectPermsByUserId(user.getId());
        Map<String, Object> result = new HashMap<>();
        result.put("userId", user.getId());
        result.put("username", user.getUsername());
        result.put("realName", user.getRealName());
        result.put("roles", roles);
        result.put("permissions", permissions);
        return Result.success(result);
    }

    @PreAuthorize("@ss.hasPermi('system:user:query')")
    @GetMapping("/{id}")
    public Result<User> getById(@PathVariable Long id) {
        return Result.success(userManagementService.getUserById(id));
    }

    /** 获取用户详情（含角色信息，流程设计器/排障使用） */
    @PreAuthorize("@ss.hasPermi('system:user:query')")
    @GetMapping("/{id}/detail")
    public Result<Map<String, Object>> getDetail(@PathVariable Long id) {
        return Result.success(userManagementService.getUserDetailWithRoles(id));
    }

    /** 获取用户的角色ID列表 */
    @PreAuthorize("@ss.hasPermi('system:user:query')")
    @GetMapping("/{id}/roles")
    public Result<List<Long>> getUserRoles(@PathVariable Long id) {
        return Result.success(userManagementService.getUserRoleIds(id));
    }

    /** 为用户分配角色（先删后插批量替换） */
    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @PutMapping("/{id}/roles")
    @OperLog(title = "用户角色授权", businessType = OperBusinessType.GRANT)
    public Result<Void> assignRoles(@PathVariable Long id, @RequestBody Map<String, List<Long>> body) {
        List<Long> roleIds = body.get("roleIds");
        userManagementService.assignUserRoles(id, roleIds);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('system:user:add')")
    @PostMapping
    @OperLog(title = "用户新增", businessType = OperBusinessType.INSERT, saveRequestData = false)
    public Result<User> create(@Valid @RequestBody UserCreateDTO dto) {
        return Result.success(userManagementService.createUser(dto));
    }

    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @PutMapping("/{id}")
    @OperLog(title = "用户修改", businessType = OperBusinessType.UPDATE)
    public Result<User> update(@PathVariable Long id, @Valid @RequestBody UserUpdateDTO dto) {
        return Result.success(userManagementService.updateUser(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @PutMapping("/{id}/reset-password")
    @OperLog(title = "用户重置密码", businessType = OperBusinessType.UPDATE, saveRequestData = false)
    public Result<Void> resetPassword(@PathVariable Long id) {
        userManagementService.resetPassword(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('system:user:edit')")
    @PutMapping("/{id}/status")
    @OperLog(title = "用户状态修改", businessType = OperBusinessType.UPDATE)
    public Result<Void> updateStatus(@PathVariable Long id, @RequestBody Map<String, Integer> body) {
        userManagementService.updateStatus(id, body.get("status"));
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('system:user:delete')")
    @DeleteMapping("/{id}")
    @OperLog(title = "用户删除", businessType = OperBusinessType.DELETE)
    public Result<Void> delete(@PathVariable Long id) {
        userManagementService.deleteUser(id);
        return Result.success();
    }
}
