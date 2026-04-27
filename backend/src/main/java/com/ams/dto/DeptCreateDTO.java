package com.ams.dto;

import lombok.Data;

@Data
public class DeptCreateDTO {
    private String name;
    private Long parentId;
    private Integer orderNum;
    private String leader;
    private String phone;
    private String email;
    private String status;
}
