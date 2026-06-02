package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.NotificationTemplateCreateDTO;
import com.ams.dto.NotificationTemplateUpdateDTO;
import com.ams.entity.NotificationTemplate;
import com.ams.service.NotificationTemplateService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * 通知模板管理控制器
 *
 * <p>提供通知模板的 RESTful CRUD 端点。</p>
 */
@RestController
@RequestMapping("/notification-templates")
@RequiredArgsConstructor
public class NotificationTemplateController {

    private final NotificationTemplateService notificationTemplateService;

    @PreAuthorize("@ss.hasPermi('notification:template:list')")
    @GetMapping("/list")
    public Result<Page<NotificationTemplate>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword) {
        return Result.success(notificationTemplateService.queryPage(page, pageSize, category, keyword));
    }

    @PreAuthorize("@ss.hasPermi('notification:template:list')")
    @GetMapping("/{id}")
    public Result<NotificationTemplate> getById(@PathVariable Long id) {
        return Result.success(notificationTemplateService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('notification:template:list')")
    @GetMapping("/code/{templateCode}")
    public Result<NotificationTemplate> getByCode(@PathVariable String templateCode) {
        return Result.success(notificationTemplateService.getByCode(templateCode));
    }

    @PreAuthorize("@ss.hasPermi('notification:template:add')")
    @PostMapping
    public Result<NotificationTemplate> create(@Valid @RequestBody NotificationTemplateCreateDTO dto) {
        return Result.success(notificationTemplateService.create(dto));
    }

    @PreAuthorize("@ss.hasPermi('notification:template:edit')")
    @PutMapping("/{id}")
    public Result<NotificationTemplate> update(@PathVariable Long id,
                                                @Valid @RequestBody NotificationTemplateUpdateDTO dto) {
        return Result.success(notificationTemplateService.update(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('notification:template:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        notificationTemplateService.delete(id);
        return Result.success();
    }
}
