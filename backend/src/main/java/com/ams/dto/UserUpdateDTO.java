package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class UserUpdateDTO {
    @JsonAlias({"name", "realName"})
    @NotBlank
    private String realName;
    @Email
    private String email;
    private String phone;
    @JsonAlias({"department", "deptId"})
    private Long deptId;
}
