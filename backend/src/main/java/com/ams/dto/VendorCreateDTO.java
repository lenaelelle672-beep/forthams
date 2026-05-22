package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class VendorCreateDTO {
    @NotBlank(message = "供应商名称不能为空")
    @Size(max = 100, message = "供应商名称长度不能超过100")
    private String name;

    @Size(max = 50, message = "供应商编码长度不能超过50")
    private String vendorCode;

    @Size(max = 50, message = "联系人长度不能超过50")
    private String contactPerson;

    @Size(max = 20, message = "联系电话长度不能超过20")
    private String contactPhone;

    @Size(max = 100, message = "联系邮箱长度不能超过100")
    private String contactEmail;

    @Size(max = 200, message = "地址长度不能超过200")
    private String address;
}
