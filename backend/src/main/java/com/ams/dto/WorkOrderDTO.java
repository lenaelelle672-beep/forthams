package com.ams.dto;

import lombok.Data;

@Data
public class WorkOrderDTO {
    private Long id;
    private String status;

    public WorkOrderDTO(Long id, String status) {
        this.id = id;
        this.status = status;
    }
}
package com.ams.dto;

import lombok.Data;

@Data
public class WorkOrderDTO {
    private Long id;
    private String status;
}
