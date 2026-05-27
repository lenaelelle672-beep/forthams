package com.ams.dto;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Email;

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
    @Email
    private String email;
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;
    @JsonAlias({"department", "deptId"})
    private Long deptId;
    private Integer status;
    private String remark;
    /** 角色ID列表，更新时先删旧 sys_user_role 再写入新关系 */
    private java.util.List<Long> roleIds;
}
