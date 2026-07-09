package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.MailTemplateDTO;
import com.ams.dto.MailTemplateMetaDTO;
import com.ams.dto.MailTemplatePreviewRequestDTO;
import com.ams.dto.MailTemplatePreviewRespDTO;
import com.ams.dto.MailTemplateQueryDTO;
import com.ams.service.MailTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/mail-templates")
@RequiredArgsConstructor
public class MailTemplateController {

    private final MailTemplateService mailTemplateService;

    @GetMapping("/list")
    public Result<MailTemplateDTO.PageResult> list(@ModelAttribute MailTemplateQueryDTO query) {
        return Result.success(mailTemplateService.list(query));
    }

    @GetMapping("/{id}")
    public Result<MailTemplateDTO> detail(@PathVariable Long id) {
        return Result.success(mailTemplateService.detail(id));
    }

    @GetMapping("/code/{code}")
    public Result<MailTemplateDTO> getByCode(@PathVariable String code) {
        return Result.success(mailTemplateService.getByCode(code));
    }

    @GetMapping("/meta")
    public Result<MailTemplateMetaDTO> meta() {
        return Result.success(mailTemplateService.meta());
    }

    @PostMapping("/preview")
    public Result<MailTemplatePreviewRespDTO> preview(@RequestBody MailTemplatePreviewRequestDTO request) {
        return Result.success(mailTemplateService.preview(request));
    }
}
