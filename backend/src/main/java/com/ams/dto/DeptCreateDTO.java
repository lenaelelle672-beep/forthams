package com.ams.dto;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonAlias;
@Data
public class DeptCreateDTO {
    private String name;
    @JsonAlias("deptName")
    private Long parentId;
    private Integer orderNum;
    private String leader;
    private String phone;
    private String status;
}
