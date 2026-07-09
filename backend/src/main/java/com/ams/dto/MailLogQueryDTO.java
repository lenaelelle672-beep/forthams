package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MailLogQueryDTO {
    @Builder.Default
    private Integer page = 1;

    @Builder.Default
    private Integer pageSize = 20;

    private Integer size;
    private String templateCode;
    private String sendStatus;
    private String bizType;
    private Long bizId;
    private String keyword;
}
