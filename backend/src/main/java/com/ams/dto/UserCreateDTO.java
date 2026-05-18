package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

/**
 * 创建用户请求 DTO。
 * 支持 roleIds 字段在创建用户时同步写入 sys_user_role 关联表。
 */
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
    /** 角色ID列表，创建时同步写入 sys_user_role */
    private java.util.List<Long> roleIds;
}
