package com.ams.dto;
import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;
@Data
public class DeptUpdateDTO {
    @JsonAlias("deptName")
    private String name;
    @JsonAlias({"code", "deptCode"})
    private String deptCode;
    private Long parentId;
    @JsonAlias({"orderNum", "sortOrder"})
    private Integer sortOrder;
    private String leader;
    private String phone;
    private String email;
    private Integer status;
    private Long leaderId;
    private Long secretaryId;
    private String deptType;
    private String description;
}
