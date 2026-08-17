package com.ams.dto;
import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.*;
import lombok.Data;
@Data
public class DeptCreateDTO {
    @JsonAlias("deptName")
    @NotBlank
    @Size(max = 128)
    private String name;
    @JsonAlias({"code", "deptCode"})
    @NotBlank
    @Size(max = 64)
    private String deptCode;
    @PositiveOrZero(message = "上级部门ID不能为负数")
    private Long parentId;
    @JsonAlias({"orderNum", "sortOrder"})
    @Min(value = 0, message = "排序号不能为负数")
    private Integer sortOrder;
    @Size(max = 64)
    private String leader;
    @Size(max = 32)
    private String phone;
}
