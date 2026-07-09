package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.MailLogDTO;
import com.ams.dto.MailLogDetailDTO;
import com.ams.dto.MailLogMetaDTO;
import com.ams.dto.MailLogQueryDTO;
import com.ams.service.MailLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/mail-logs")
@RequiredArgsConstructor
public class MailLogController {

    private final MailLogService mailLogService;

    @GetMapping("/list")
    public Result<MailLogDTO.PageResult> list(@ModelAttribute MailLogQueryDTO query) {
        return Result.success(mailLogService.list(query));
    }

    @GetMapping("/biz")
    public Result<List<MailLogDTO>> getByBiz(@RequestParam String bizType, @RequestParam Long bizId) {
        return Result.success(mailLogService.getByBiz(bizType, bizId));
    }

    @GetMapping("/meta")
    public Result<MailLogMetaDTO> meta() {
        return Result.success(mailLogService.meta());
    }

    @GetMapping("/{id}")
    public Result<MailLogDetailDTO> detail(@PathVariable Long id) {
        return Result.success(mailLogService.detail(id));
    }
}
