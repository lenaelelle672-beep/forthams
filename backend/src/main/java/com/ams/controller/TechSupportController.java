package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SupportTicketDTO;
import com.ams.service.TechSupportService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 技术支持工单只读 controller。诊断包强制脱敏，全部只读。 */
@RestController
@RequestMapping("/system/tech-support")
@RequiredArgsConstructor
public class TechSupportController {

    private final TechSupportService techSupportService;

    @GetMapping
    public Result<SupportTicketDTO.PageResult> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String keyword) {
        return Result.success(techSupportService.list(status, priority, keyword, page, pageSize));
    }

    @GetMapping("/{id}")
    public Result<SupportTicketDTO> detail(@PathVariable Long id) {
        return Result.success(techSupportService.detail(id));
    }

    @GetMapping("/meta")
    public Result<SupportTicketDTO.Meta> meta() {
        return Result.success(techSupportService.meta());
    }
}
