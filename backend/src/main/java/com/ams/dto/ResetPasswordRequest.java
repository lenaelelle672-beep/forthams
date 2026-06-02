package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 重置密码请求 DTO。
 *
 * <p>当前安全凭据为旧密码；未提供旧密码的请求不会通过基础校验。</p>
 */
@Data
public class ResetPasswordRequest {

    @NotBlank(message = "用户名不能为空")
    private String username;

    @NotBlank(message = "新密码不能为空")
    private String newPassword;

    @NotBlank(message = "旧密码不能为空")
    private String oldPassword;

}
