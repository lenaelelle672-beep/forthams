package com.ams.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TenantProvisionRequest {

    @NotBlank
    @Size(max = 64)
    @Pattern(regexp = "^[A-Za-z0-9_-]+$")
    private String tenantId;

    @NotBlank
    @Size(max = 128)
    private String tenantName;

    @Size(max = 32)
    private String plan;

    @Min(1)
    @Max(1_000_000)
    private Integer maxUsers;

    @Min(1)
    @Max(100_000_000)
    private Integer maxAssets;

    @NotBlank
    @Size(min = 3, max = 64)
    private String adminUsername;

    @NotBlank
    @Size(min = 12, max = 128)
    private String adminPassword;

    @NotBlank
    @Size(max = 64)
    private String adminRealName;

    @Email
    @Size(max = 128)
    private String adminEmail;

    @Size(max = 32)
    private String adminPhone;
}
