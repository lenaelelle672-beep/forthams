package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class LoginRequest {

    @NotBlank(message = "用户名不能为空")
    @Size(max = 64, message = "用户名不能超过64个字符")
    @Pattern(regexp = "\\S+", message = "用户名格式不合法")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(max = 256, message = "密码不能超过256个字符")
    private String password;

}
