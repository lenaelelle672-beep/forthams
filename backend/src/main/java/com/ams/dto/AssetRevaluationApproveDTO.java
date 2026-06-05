package com.ams.dto;

public record AssetRevaluationApproveDTO(
        Long id,
        String status,
        Long approvedBy
) {
}
