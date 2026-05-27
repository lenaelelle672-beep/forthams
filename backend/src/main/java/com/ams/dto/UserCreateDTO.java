package com.ams.dto;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotBlank;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Email;
import lombok.Data;

/**
 * 创建用户请求 DTO。
 * 支持 roleIds 字段在创建用户时同步写入 sys_user_role 关联表。
 */
@Data
public class UserCreateDTO {
    @NotBlank
    private String username;
    @NotBlank
    private String password;
    @JsonAlias({"name", "realName"})
    private String realName;
    @Email
    private String email;
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;
    @JsonAlias({"department", "deptId"})
    private Long deptId;
    private Integer status;
    private String remark;
    /** 角色ID列表，创建时同步写入 sys_user_role */
    private java.util.List<Long> roleIds;
}
