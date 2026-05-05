package com.ams.dto;

import lombok.*;

/**
 * 操作人排行统计视图对象。
 * 用于展示操作频率最高的前10名用户的排名信息，
 * 对应 ATB-007 操作人排行榜接口的单条排行记录。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OperatorRankingVO {

    /**
     * 排名序号（从 1 开始，按操作次数降序排列）
     */
    private Integer rank;

    /**
     * 操作人ID
     */
    private String operatorId;

    /**
     * 操作人姓名
     */
    private String operatorName;

    /**
     * 该操作人的累计操作次数
     */
    private Long count;

}