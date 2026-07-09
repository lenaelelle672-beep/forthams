package com.ams.dto;

import lombok.Data;

@Data
public class ChannelConfigQueryDTO {
    private Integer page;
    private Integer pageSize;
    private String channelType;
    private String keyword;
}
