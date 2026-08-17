package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class UserUpdateDTO {
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
