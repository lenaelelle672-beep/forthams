package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.GeneralAuditEntry;
import com.ams.service.AuditService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditService auditService;

    @GetMapping
    public ResponseEntity<Result<Page<GeneralAuditEntry>>> getLogs(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size) {
        Result<Page<GeneralAuditEntry>> result = auditService.queryLogs(page, size);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/count")
    public ResponseEntity<Result<Long>> getCount() {
        long count = auditService.queryLogs(0, 1).getData().getTotal();
        return ResponseEntity.ok(Result.success(count));
    }
}
