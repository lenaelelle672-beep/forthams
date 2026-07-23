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
    private Long parentId;
    @JsonAlias({"orderNum", "sortOrder"})
    private Integer sortOrder;
    private String leader;
    private String phone;
    private String status;
}
