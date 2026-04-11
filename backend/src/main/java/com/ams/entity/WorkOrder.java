package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("work_order")
public class WorkOrder {
    @TableId(type = IdType.AUTO)
    private Long id; // Auto-Gen

    private String status; // DRAFT, PENDING, APPROVED, EXECUTING, CLOSED

    public enum Status {
        DRAFT,
        PENDING,
        APPROVED,
        EXECUTING,
        CLOSED
    }

    // Additional fields can be added here if necessary

    // Ensure the status is set to DRAFT by default
    public WorkOrder() {
        this.status = Status.DRAFT.name();
    }
}
