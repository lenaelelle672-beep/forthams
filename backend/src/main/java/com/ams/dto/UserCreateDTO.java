package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class UserCreateDTO {
    private String username;
    private String password;
    @JsonAlias({"name", "realName"})
    private String realName;
    private String email;
    private String phone;
    @JsonAlias({"department", "deptId"})
    private Long deptId;
}
