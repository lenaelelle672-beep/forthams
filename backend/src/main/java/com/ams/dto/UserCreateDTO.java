package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class UserCreateDTO {
    @NotBlank
    @Size(min = 3, max = 64)
    private String username;
    private String password;
    @JsonAlias({"name", "realName"})
    @NotBlank
    @Size(max = 64)
    private String realName;
    @Email
    private String email;
    private String phone;
    @JsonAlias({"department", "deptId"})
    private Long deptId;
}
