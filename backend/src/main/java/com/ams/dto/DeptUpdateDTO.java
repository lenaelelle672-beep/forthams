package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DeptUpdateDTO {

    @NotBlank(message = "部门名称不能为空")
    private String deptName;

    private String deptCode;
    private Long parentId;
    private Integer sortOrder;
    private String leader;
    private String phone;
}
