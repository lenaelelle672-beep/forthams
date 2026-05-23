package com.ams.dto;
import jakarta.validation.constraints.Min;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class IdleAssetCreateDTO {
    @JsonAlias({"id", "assetId"})
    @NotNull
    private Long assetId;
    @Min(1)
    private Integer idleDays;
    @JsonAlias({"reason"})
    @NotBlank
    private String reason;
}
