package com.ams.controller;

import com.ams.annotation.OperBusinessType;
import com.ams.annotation.OperLog;
import com.ams.common.Result;
import com.ams.dto.AuthResponse;
import com.ams.dto.LoginRequest;
import com.ams.dto.RegisterRequest;
import com.ams.dto.ResetPasswordRequest;
import com.ams.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    @OperLog(title = "用户登录", businessType = OperBusinessType.LOGIN, saveRequestData = false)
    public Result<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return Result.success("登录成功", response);
    }

    @PostMapping("/register")
    @OperLog(title = "用户注册", businessType = OperBusinessType.INSERT, saveRequestData = false)
    public Result<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return Result.success("注册成功", response);
    }

    @PostMapping("/logout")
    @OperLog(title = "用户登出", businessType = OperBusinessType.LOGOUT)
    public Result<String> logout() {
        authService.logout();
        return Result.success("登出成功");
    }

    /**
     * 重置密码。
     *
     * <p>必须提供旧密码作为安全凭据；未验证请求会被服务端拒绝。
     *
     * @param request 包含 username、oldPassword 和 newPassword
     * @return 操作结果
     */
    @PostMapping("/reset-password")
    @OperLog(title = "认证重置密码", businessType = OperBusinessType.UPDATE, saveRequestData = false)
    public Result<String> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return Result.success("密码重置成功");
    }

}
