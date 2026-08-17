package com.ams.dto;

import lombok.Data;

@Data
public class FlowDesignerOperationDTO {
    private Long operatorId;
    private String reason;
    private String publishNote;
    private String impactScope;
    private String rollbackPlan;
    private Boolean confirmed;
    /** 发布或回滚前审阅到的草稿 revision；0 仅可匹配历史 revision=0 草稿。 */
    private Integer expectedDraftRevision;
    /** 无草稿时，回滚方必须显式确认其审阅基线没有草稿。 */
    private Boolean expectedDraftAbsent;
    /** 回滚前审阅到的当前已发布版本，防止陈旧回滚覆盖新发布版本。 */
    private Integer expectedPublishedVersion;
}
