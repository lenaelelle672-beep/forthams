package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

/**
 * 更新用户请求 DTO。
 * roleIds 传入时先删除旧 sys_user_role 再写入新关系；传 null 则不更新角色。
 */
@Data
public class UserUpdateDTO {
    @JsonAlias({"name", "realName"})
    private String realName;
    private String email;
    private String phone;
    @JsonAlias({"department", "deptId"})
    private Long deptId;
    /** 角色ID列表，更新时先删旧 sys_user_role 再写入新关系 */
    private java.util.List<Long> roleIds;
}
