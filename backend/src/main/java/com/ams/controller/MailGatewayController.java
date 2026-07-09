package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.MailGatewayDTO;
import com.ams.dto.MailGatewayMetaDTO;
import com.ams.dto.MailGatewayPreviewRequestDTO;
import com.ams.dto.MailGatewayPreviewRespDTO;
import com.ams.dto.MailGatewayQueryDTO;
import com.ams.service.MailGatewayService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/system/mail-gateways")
@RequiredArgsConstructor
public class MailGatewayController {

    private final MailGatewayService mailGatewayService;

    @GetMapping
    public Result<MailGatewayDTO.PageResult> list(@ModelAttribute MailGatewayQueryDTO query) {
        return Result.success(mailGatewayService.list(query));
    }

    @GetMapping("/{id}")
    public Result<MailGatewayDTO> detail(@PathVariable Long id) {
        return Result.success(mailGatewayService.detail(id));
    }

    @GetMapping("/meta")
    public Result<MailGatewayMetaDTO> meta() {
        return Result.success(mailGatewayService.meta());
    }

    @PostMapping("/preview")
    public Result<MailGatewayPreviewRespDTO> preview(@RequestBody MailGatewayPreviewRequestDTO request) {
        return Result.success(mailGatewayService.preview(request));
    }
}
