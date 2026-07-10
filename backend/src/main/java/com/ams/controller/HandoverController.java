package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.HandoverDTO;
import com.ams.service.HandoverService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 交接任务记录只读 controller。
 *
 * GET /system/handover       交接任务列表（带租户隔离）
 * GET /system/handover/{id}  交接任务详情
 * GET /system/handover/meta  只读元数据
 *
 * 全部只读，不提供发起/推进/取消交接的写操作（V3 只读边界）。
 */
@RestController
@RequestMapping("/system/handover")
@RequiredArgsConstructor
public class HandoverController {

    private final HandoverService handoverService;

    @GetMapping
    public Result<HandoverDTO.PageResult> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return Result.success(handoverService.list(status, keyword, page, pageSize));
    }

    @GetMapping("/{id}")
    public Result<HandoverDTO> detail(@PathVariable Long id) {
        return Result.success(handoverService.detail(id));
    }

    @GetMapping("/meta")
    public Result<HandoverDTO.Meta> meta() {
        return Result.success(handoverService.meta());
    }
}
