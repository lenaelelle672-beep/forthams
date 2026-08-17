package com.ams.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class WorkOrderCommentDTO {

    @Size(max = 1000, message = "工单备注长度不能超过1000个字符")
    private String comment;
}
