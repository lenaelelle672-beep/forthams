package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.ChannelConfigResponse;
import com.ams.entity.ChannelConfig;
import com.ams.service.ChannelConfigService;
import com.ams.service.DingTalkChannel;
import com.ams.service.WeChatChannel;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/system/channel-configs")
@RequiredArgsConstructor
public class ChannelConfigController {

    private final ChannelConfigService channelConfigService;
    private final DingTalkChannel dingTalkChannel;
    private final WeChatChannel weChatChannel;

    @PreAuthorize("@ss.hasPermi('channel:config:list')")
    @GetMapping
    public Result<Page<ChannelConfigResponse>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String channelType,
            @RequestParam(required = false) String keyword) {
        Page<ChannelConfig> result = channelConfigService.queryPage(page, pageSize, channelType, keyword);
        Page<ChannelConfigResponse> response = new Page<>(result.getCurrent(), result.getSize(), result.getTotal());
        List<ChannelConfigResponse> records = result.getRecords().stream()
                .map(ChannelConfigResponse::from)
                .toList();
        response.setRecords(records);
        return Result.success(response);
    }

    @PreAuthorize("@ss.hasPermi('channel:config:list')")
    @GetMapping("/{id}")
    public Result<ChannelConfigResponse> getById(@PathVariable Long id) {
        return Result.success(ChannelConfigResponse.from(channelConfigService.getById(id)));
    }

    @PreAuthorize("@ss.hasPermi('channel:config:add')")
    @PostMapping
    public Result<ChannelConfigResponse> create(@Valid @RequestBody ChannelConfig config) {
        return Result.success(ChannelConfigResponse.from(channelConfigService.create(config)));
    }

    @PreAuthorize("@ss.hasPermi('channel:config:edit')")
    @PutMapping("/{id}")
    public Result<ChannelConfigResponse> update(@PathVariable Long id, @Valid @RequestBody ChannelConfig config) {
        return Result.success(ChannelConfigResponse.from(channelConfigService.update(id, config)));
    }

    @PreAuthorize("@ss.hasPermi('channel:config:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        channelConfigService.delete(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('channel:config:edit')")
    @PostMapping("/{channelType}/test")
    public Result<String> test(@PathVariable String channelType) {
        String channelTypeUpper = channelType.toUpperCase();
        java.util.List<ChannelConfig> configs = channelConfigService.getByType(channelTypeUpper);
        if (configs.isEmpty()) {
            return Result.error("没有已启用的 " + channelTypeUpper + " 渠道配置");
        }
        int success = 0;
        int fail = 0;
        for (ChannelConfig config : configs) {
            try {
                switch (channelTypeUpper) {
                    case "DINGTALK" -> dingTalkChannel.sendTest(config);
                    case "WECHAT" -> weChatChannel.sendTest(config);
                    default -> throw new IllegalArgumentException("不支持的渠道类型: " + channelTypeUpper);
                }
                success++;
            } catch (Exception e) {
                fail++;
            }
        }
        String msg = "测试完成，成功: " + success + "，失败: " + fail;
        return fail == 0 ? Result.success(msg) : Result.error(msg);
    }
}
