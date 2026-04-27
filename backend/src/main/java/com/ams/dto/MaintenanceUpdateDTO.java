package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class MaintenanceUpdateDTO {
    @JsonAlias({"equipmentId", "assetId"})
    private Long assetId;
    @JsonAlias({"type", "maintenanceType"})
    private String maintenanceType;
    private LocalDate maintenanceDate;
    @JsonAlias({"technician", "executor"})
    private String executor;
    @JsonAlias({"duration"})
    private Integer duration;
    @JsonAlias({"content", "description"})
    private String content;
    @JsonAlias({"cost"})
    private BigDecimal cost;
    private LocalDate nextMaintenanceDate;
    @JsonAlias({"result"})
    private String result;
    @JsonAlias({"remark"})
    private String remark;
}
