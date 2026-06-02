package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.ChannelConfig;
import com.ams.service.ChannelConfigService;
import com.ams.service.DingTalkChannel;
import com.ams.service.WeChatChannel;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/system/channel-configs")
@RequiredArgsConstructor
public class ChannelConfigController {

    private final ChannelConfigService channelConfigService;
    private final DingTalkChannel dingTalkChannel;
    private final WeChatChannel weChatChannel;

    @PreAuthorize("@ss.hasPermi('channel:config:list')")
    @GetMapping
    public Result<Page<ChannelConfig>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String channelType,
            @RequestParam(required = false) String keyword) {
        return Result.success(channelConfigService.queryPage(page, pageSize, channelType, keyword));
    }

    @PreAuthorize("@ss.hasPermi('channel:config:list')")
    @GetMapping("/{id}")
    public Result<ChannelConfig> getById(@PathVariable Long id) {
        return Result.success(channelConfigService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('channel:config:add')")
    @PostMapping
    public Result<ChannelConfig> create(@Valid @RequestBody ChannelConfig config) {
        return Result.success(channelConfigService.create(config));
    }

    @PreAuthorize("@ss.hasPermi('channel:config:edit')")
    @PutMapping("/{id}")
    public Result<ChannelConfig> update(@PathVariable Long id, @Valid @RequestBody ChannelConfig config) {
        return Result.success(channelConfigService.update(id, config));
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
