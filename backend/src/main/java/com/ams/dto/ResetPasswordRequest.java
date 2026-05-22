package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 重置密码请求 DTO（过渡方案）
 *
 * <p>TODO: 后续增加 email/phone + verificationCode 字段
 */
@Data
public class ResetPasswordRequest {

    @NotBlank(message = "用户名不能为空")
    private String username;

    @NotBlank(message = "新密码不能为空")
    private String newPassword;

}
