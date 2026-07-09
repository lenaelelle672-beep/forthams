package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SystemPostQueryDTO {
    @Builder.Default
    private Integer page = 1;

    @Builder.Default
    private Integer pageSize = 20;

    private Integer size;
    private String keyword;
    private String status;
}
