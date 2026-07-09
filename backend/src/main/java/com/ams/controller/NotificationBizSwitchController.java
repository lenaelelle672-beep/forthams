package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.NotificationBizSwitchDTO;
import com.ams.dto.NotificationBizSwitchMetaDTO;
import com.ams.dto.NotificationBizSwitchPreviewRequestDTO;
import com.ams.dto.NotificationBizSwitchPreviewRespDTO;
import com.ams.service.NotificationBizSwitchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/notification-switches")
@RequiredArgsConstructor
public class NotificationBizSwitchController {

    private final NotificationBizSwitchService notificationBizSwitchService;

    @GetMapping("/list")
    public Result<List<NotificationBizSwitchDTO>> list() {
        return Result.success(notificationBizSwitchService.list());
    }

    @GetMapping("/biz-type/{bizType}")
    public Result<List<NotificationBizSwitchDTO>> getByBizType(@PathVariable String bizType) {
        return Result.success(notificationBizSwitchService.getByBizType(bizType));
    }

    @GetMapping("/meta")
    public Result<NotificationBizSwitchMetaDTO> meta() {
        return Result.success(notificationBizSwitchService.meta());
    }

    @PostMapping("/preview")
    public Result<NotificationBizSwitchPreviewRespDTO> preview(@RequestBody NotificationBizSwitchPreviewRequestDTO request) {
        return Result.success(notificationBizSwitchService.preview(request));
    }
}
