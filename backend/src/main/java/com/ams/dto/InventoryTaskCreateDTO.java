package com.ams.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.time.LocalDate;

@Data
public class InventoryTaskCreateDTO {
    @JsonAlias({"name", "taskName"})
    @NotBlank
    private String taskName;
    @JsonAlias({"method", "taskType", "type", "inventoryType"})
    @NotBlank
    private String inventoryType;
    @JsonAlias({"department", "deptIds"})
    private String deptIds;
    @JsonAlias({"location"})
    private String location;
    @JsonAlias({"responsible", "executorId"})
    @NotNull
    private Long executorId;
    @JsonAlias({"scope"})
    private String scope;
    @JsonAlias({"description"})
    private String description;
    private LocalDate startDate;
    @Future
    private LocalDate endDate;
    private Integer totalCount;
}
