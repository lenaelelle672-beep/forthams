package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.NotificationPreferenceDTO;
import com.ams.dto.NotificationPreferenceMetaDTO;
import com.ams.dto.NotificationPreferencePreviewRequestDTO;
import com.ams.dto.NotificationPreferencePreviewRespDTO;
import com.ams.service.NotificationPreferenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/notification-preferences")
@RequiredArgsConstructor
public class NotificationPreferenceController {

    private final NotificationPreferenceService notificationPreferenceService;

    @GetMapping
    public Result<List<NotificationPreferenceDTO>> list() {
        return Result.success(notificationPreferenceService.list());
    }

    @GetMapping("/meta")
    public Result<NotificationPreferenceMetaDTO> meta() {
        return Result.success(notificationPreferenceService.meta());
    }

    @PostMapping("/preview")
    public Result<NotificationPreferencePreviewRespDTO> preview(@RequestBody NotificationPreferencePreviewRequestDTO request) {
        return Result.success(notificationPreferenceService.preview(request));
    }

    @GetMapping("/{category}")
    public Result<NotificationPreferenceDTO> getByCategory(@PathVariable String category) {
        return Result.success(notificationPreferenceService.getByCategory(category));
    }
}
