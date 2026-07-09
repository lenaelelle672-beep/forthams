package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.ChannelConfigDTO;
import com.ams.dto.ChannelConfigMetaDTO;
import com.ams.dto.ChannelConfigPreviewRequestDTO;
import com.ams.dto.ChannelConfigPreviewRespDTO;
import com.ams.dto.ChannelConfigQueryDTO;
import com.ams.service.ChannelConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/system/channel-configs")
@RequiredArgsConstructor
public class ChannelConfigController {

    private final ChannelConfigService channelConfigService;

    @GetMapping
    public Result<ChannelConfigDTO.PageResult> list(@ModelAttribute ChannelConfigQueryDTO query) {
        return Result.success(channelConfigService.list(query));
    }

    @GetMapping("/{id}")
    public Result<ChannelConfigDTO> detail(@PathVariable Long id) {
        return Result.success(channelConfigService.detail(id));
    }

    @GetMapping("/meta")
    public Result<ChannelConfigMetaDTO> meta() {
        return Result.success(channelConfigService.meta());
    }

    @PostMapping("/preview")
    public Result<ChannelConfigPreviewRespDTO> preview(@RequestBody ChannelConfigPreviewRequestDTO request) {
        return Result.success(channelConfigService.preview(request));
    }
}
