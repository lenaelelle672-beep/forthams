package com.ams.dto;

import lombok.Data;

@Data
public class VendorPortalLoginRequest {
    private String vendorCode;
    private String password;
}
