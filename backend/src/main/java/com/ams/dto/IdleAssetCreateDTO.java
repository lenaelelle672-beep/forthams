package com.ams.dto;

import jakarta.validation.constraints.Min;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class IdleAssetCreateDTO {
    @JsonAlias({"id", "assetId"})
    @NotNull
    private Long assetId;
    @Min(1)
    private Integer idleDays;
    private String title;
    @JsonAlias({"reason"})
    @NotBlank
    private String reason;
    @JsonAlias({"deadline", "claimDeadline"})
    private LocalDate claimDeadline;
}
