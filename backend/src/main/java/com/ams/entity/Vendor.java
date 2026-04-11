package com.ams.entity;

import cn.hutool.core.bean.BeanUtil;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("vendor")
public class Vendor {
    @TableId
    private Long id;
    private String name;
    private String contactInfo;
    private Long vendor_id; // Added for multi-key association

    public boolean equals(Vendor other) {
        return this.name.equals(other.getName()) && this.contactInfo.equals(other.getContactInfo());
    }
}
