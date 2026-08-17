package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class UserCreateDTO {
    @NotBlank
    @Size(min = 3, max = 64)
    private String username;
    @Size(min = 12, max = 128, message = "密码长度必须在12到128个字符之间")
    private String password;
    @JsonAlias({"name", "realName"})
    @NotBlank
    @Size(max = 64)
    private String realName;
    @Email
    @Size(max = 128)
    private String email;
    @Size(max = 32)
    private String phone;
    @JsonAlias({"department", "deptId"})
    @Positive
    private Long deptId;
}
