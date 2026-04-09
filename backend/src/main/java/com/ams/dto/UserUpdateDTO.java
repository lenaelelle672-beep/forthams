package com.ams.dto;

import lombok.Data;

@Data
public class UserUpdateDTO {

    private String realName;
    private String email;
    private String phone;
    private Long deptId;
}
