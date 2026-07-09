package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.NotificationTemplateDTO;
import com.ams.dto.NotificationTemplateMetaDTO;
import com.ams.dto.NotificationTemplatePreviewRequestDTO;
import com.ams.dto.NotificationTemplatePreviewRespDTO;
import com.ams.dto.NotificationTemplateQueryDTO;
import com.ams.service.NotificationTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/notification-templates")
@RequiredArgsConstructor
public class NotificationTemplateController {

    private final NotificationTemplateService notificationTemplateService;

    @GetMapping("/list")
    public Result<NotificationTemplateDTO.PageResult> list(@ModelAttribute NotificationTemplateQueryDTO query) {
        return Result.success(notificationTemplateService.list(query));
    }

    @GetMapping("/{id}")
    public Result<NotificationTemplateDTO> detail(@PathVariable Long id) {
        return Result.success(notificationTemplateService.detail(id));
    }

    @GetMapping("/code/{code}")
    public Result<NotificationTemplateDTO> getByCode(@PathVariable String code) {
        return Result.success(notificationTemplateService.getByCode(code));
    }

    @GetMapping("/meta")
    public Result<NotificationTemplateMetaDTO> meta() {
        return Result.success(notificationTemplateService.meta());
    }

    @PostMapping("/preview")
    public Result<NotificationTemplatePreviewRespDTO> preview(@RequestBody NotificationTemplatePreviewRequestDTO request) {
        return Result.success(notificationTemplateService.preview(request));
    }
}
