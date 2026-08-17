package com.ams.controller;

import com.ams.dto.AuthResponse;
import com.ams.dto.UserCreateDTO;
import com.ams.dto.UserStatusUpdateDTO;
import com.ams.dto.UserUpdateDTO;
import com.ams.entity.GeneralAuditEntry;
import com.ams.entity.User;
import com.ams.service.AuditService;
import com.ams.service.UserManagementService;
import com.ams.utils.AuditHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import jakarta.validation.constraints.Positive;

@RestController
@RequestMapping({"/user-management", "/users"})
@RequiredArgsConstructor
@Validated
public class UserManagementController {

    private static final String RESOURCE_TYPE = "USER";

    private final UserManagementService userManagementService;
    private final AuditService auditService;
    private final AuditHelper auditHelper;

    @GetMapping("/current")
    public Result<AuthResponse> current() {
        return Result.success(userManagementService.getCurrentUser());
    }

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('user:query')")
    public Result<Page<User>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return Result.success(userManagementService.queryUsers(page, pageSize, keyword, null, null));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('user:query')")
    public Result<User> getById(@PathVariable @Positive Long id) {
        return Result.success(userManagementService.getUserById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('user:create')")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<User> create(@Valid @RequestBody UserCreateDTO dto, HttpServletRequest request) {
        GeneralAuditEntry audit = auditHelper.buildEntry(request, "USER_CREATE", "create_user",
                RESOURCE_TYPE, null, "创建用户: " + dto.getUsername(), "SUCCESS");
        try {
            User created = userManagementService.createUser(dto);
            audit.setResourceId(created.getId() == null ? null : String.valueOf(created.getId()));
            return Result.success(created);
        } catch (RuntimeException ex) {
            audit.setStatus("FAILURE");
            audit.setErrorMessage(truncate(ex.getMessage(), 1024));
            throw ex;
        } finally {
            auditService.save(audit);
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('user:update')")
    public Result<User> update(@PathVariable @Positive Long id, @Valid @RequestBody UserUpdateDTO dto, HttpServletRequest request) {
        GeneralAuditEntry audit = auditHelper.buildEntry(request, "USER_UPDATE", "update_user",
                RESOURCE_TYPE, String.valueOf(id), "更新用户: " + id, "SUCCESS");
        try {
            userManagementService.requireTargetManagementAuthority(id);
            return Result.success(userManagementService.updateUser(id, dto));
        } catch (RuntimeException ex) {
            audit.setStatus("FAILURE");
            audit.setErrorMessage(truncate(ex.getMessage(), 1024));
            throw ex;
        } finally {
            auditService.save(audit);
        }
    }

    @PutMapping("/{id}/reset-password")
    @PreAuthorize("hasAuthority('user:reset-password')")
    public Result<String> resetPassword(@PathVariable @Positive Long id, HttpServletRequest request) {
        GeneralAuditEntry audit = auditHelper.buildEntry(request, "USER_RESET_PASSWORD", "reset_password",
                RESOURCE_TYPE, String.valueOf(id), "重置用户密码: " + id, "SUCCESS");
        try {
            userManagementService.requireTargetManagementAuthority(id);
            return Result.success("临时密码已生成，请安全传达给用户", userManagementService.resetPassword(id));
        } catch (RuntimeException ex) {
            audit.setStatus("FAILURE");
            audit.setErrorMessage(truncate(ex.getMessage(), 1024));
            throw ex;
        } finally {
            auditService.save(audit);
        }
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasAuthority('user:update')")
    public Result<Void> updateStatus(@PathVariable @Positive Long id, @Valid @RequestBody UserStatusUpdateDTO body,
                                      HttpServletRequest request) {
        userManagementService.requireTargetManagementAuthority(id);
        userManagementService.updateStatus(id, body.getStatus());
        return Result.success();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('user:delete')")
    public Result<Void> delete(@PathVariable @Positive Long id, HttpServletRequest request) {
        GeneralAuditEntry audit = auditHelper.buildEntry(request, "USER_DELETE", "delete_user",
                RESOURCE_TYPE, String.valueOf(id), "删除用户: " + id, "SUCCESS");
        try {
            userManagementService.requireTargetManagementAuthority(id);
            userManagementService.deleteUser(id);
            return Result.success();
        } catch (RuntimeException ex) {
            audit.setStatus("FAILURE");
            audit.setErrorMessage(truncate(ex.getMessage(), 1024));
            throw ex;
        } finally {
            auditService.save(audit);
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
