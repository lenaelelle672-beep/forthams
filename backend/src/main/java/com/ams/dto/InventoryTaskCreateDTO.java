package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;
import java.time.LocalDate;

@Data
public class InventoryTaskCreateDTO {
    @JsonAlias({"name", "taskName"})
    private String taskName;
    @JsonAlias({"method", "taskType", "type", "inventoryType"})
    private String inventoryType;
    @JsonAlias({"department", "deptIds"})
    private String deptIds;
    @JsonAlias({"location"})
    private String location;
    @JsonAlias({"responsible", "executorId"})
    private Long executorId;
    @JsonAlias({"scope"})
    private String scope;
    @JsonAlias({"description"})
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer totalCount;
}
