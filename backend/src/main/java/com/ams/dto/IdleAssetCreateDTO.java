package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class IdleAssetCreateDTO {
    @JsonAlias({"id", "assetId"})
    private Long assetId;
    private Integer idleDays;
    @JsonAlias({"reason"})
    private String reason;
}
