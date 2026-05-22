package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("vendor")
public class Vendor {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String vendorCode;
    @TableField("contact_person")
    private String contactPerson;
    @TableField("contact_phone")
    private String contactPhone;
    @TableField("contact_email")
    private String contactEmail;
    private String address;
    private Integer status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private Integer deleted;
}
