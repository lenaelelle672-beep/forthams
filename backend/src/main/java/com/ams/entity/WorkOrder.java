package com.ams.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("work_order")
public class WorkOrder {
    private Long id; // Auto-Gen
    private String status; // DRAFT, PENDING, APPROVED, EXECUTING, CLOSED
}
