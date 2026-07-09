package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationTemplateQueryDTO {
    @Builder.Default
    private Integer page = 1;

    @Builder.Default
    private Integer pageSize = 20;

    private Integer size;
    private String category;
    private String channelType;
    private Integer status;
    private String keyword;
}
