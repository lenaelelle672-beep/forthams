package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.MailTemplateCreateDTO;
import com.ams.dto.MailTemplateUpdateDTO;
import com.ams.entity.MailTemplate;
import com.ams.service.MailTemplateService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * 邮件模板管理控制器
 */
@RestController
@RequestMapping("/mail-templates")
@RequiredArgsConstructor
public class MailTemplateController {

    private final MailTemplateService mailTemplateService;

    @PreAuthorize("@ss.hasPermi('mail:template:list')")
    @GetMapping("/list")
    public Result<Page<MailTemplate>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword) {
        return Result.success(mailTemplateService.queryPage(page, pageSize, category, keyword));
    }

    @PreAuthorize("@ss.hasPermi('mail:template:list')")
    @GetMapping("/{id}")
    public Result<MailTemplate> getById(@PathVariable Long id) {
        return Result.success(mailTemplateService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('mail:template:list')")
    @GetMapping("/code/{templateCode}")
    public Result<MailTemplate> getByCode(@PathVariable String templateCode) {
        return Result.success(mailTemplateService.getByCode(templateCode));
    }

    @PreAuthorize("@ss.hasPermi('mail:template:add')")
    @PostMapping
    public Result<MailTemplate> create(@Valid @RequestBody MailTemplateCreateDTO dto) {
        return Result.success(mailTemplateService.create(dto));
    }

    @PreAuthorize("@ss.hasPermi('mail:template:edit')")
    @PutMapping("/{id}")
    public Result<MailTemplate> update(@PathVariable Long id, @Valid @RequestBody MailTemplateUpdateDTO dto) {
        return Result.success(mailTemplateService.update(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('mail:template:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        mailTemplateService.delete(id);
        return Result.success();
    }
}
