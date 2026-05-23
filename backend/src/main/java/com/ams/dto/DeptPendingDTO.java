package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 部门待处理工单统计 DTO。
 *
 * <p>用于封装各部门待处理（PENDING）工单的计数结果。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeptPendingDTO {

    /** 部门名称 */
    @JsonProperty("name")
    private String name;

    /** 该部门待处理工单数量 */
    @JsonProperty("value")
    private long value;
}
