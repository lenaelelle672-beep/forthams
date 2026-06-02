package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("manufacturer")
public class Manufacturer {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String code;
    private String contact;
    private String phone;
    private String email;
    private String website;
    private String country;
    private String address;
    private Integer status;
    private String remark;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
    @TableLogic
    private Integer deleted;
}
