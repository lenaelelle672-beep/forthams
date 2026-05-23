package com.ams.dto;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class MaintenanceCreateDTO {
    @JsonAlias({"equipmentId", "assetId"})
    @NotNull
    private Long assetId;
    @JsonAlias({"type", "maintenanceType"})
    @NotBlank
    private String maintenanceType;
    @NotNull
    private LocalDate maintenanceDate;
    @JsonAlias({"technician", "executor"})
    private String executor;
    @JsonAlias({"duration"})
    private Integer duration;
    @JsonAlias({"content", "description"})
    @NotBlank
    private String content;
    @JsonAlias({"cost"})
    private BigDecimal cost;
    private LocalDate nextMaintenanceDate;
    @JsonAlias({"result"})
    private String result;
    @JsonAlias({"remark"})
    private String remark;
}
