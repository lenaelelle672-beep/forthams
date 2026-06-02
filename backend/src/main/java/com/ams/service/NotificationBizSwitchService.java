package com.ams.service;

import com.ams.entity.NotificationBizSwitch;
import com.ams.mapper.NotificationBizSwitchMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 流程通知开关服务
 *
 * <p>控制各业务流程中哪些事件触发通知。管理员可在后台开启/关闭。</p>
 */
@Service
@RequiredArgsConstructor
public class NotificationBizSwitchService {

    private final NotificationBizSwitchMapper bizSwitchMapper;

    /**
     * 获取所有流程通知开关
     */
    public List<NotificationBizSwitch> getAll() {
        return bizSwitchMapper.selectList(new LambdaQueryWrapper<NotificationBizSwitch>()
                .orderByAsc(NotificationBizSwitch::getBizType)
                .orderByAsc(NotificationBizSwitch::getEvent));
    }

    /**
     * 按业务类型获取开关列表
     */
    public List<NotificationBizSwitch> getByBizType(String bizType) {
        return bizSwitchMapper.selectList(new LambdaQueryWrapper<NotificationBizSwitch>()
                .eq(NotificationBizSwitch::getBizType, bizType));
    }

    /**
     * 检查某事件是否启用通知
     */
    public boolean isEnabled(String bizType, String event) {
        NotificationBizSwitch sw = bizSwitchMapper.selectOne(
                new LambdaQueryWrapper<NotificationBizSwitch>()
                        .eq(NotificationBizSwitch::getBizType, bizType)
                        .eq(NotificationBizSwitch::getEvent, event));
        return sw == null || sw.getEnabled() == 1;
    }

    /**
     * 获取事件关联的模板编码
     */
    public String getTemplateCode(String bizType, String event) {
        NotificationBizSwitch sw = bizSwitchMapper.selectOne(
                new LambdaQueryWrapper<NotificationBizSwitch>()
                        .eq(NotificationBizSwitch::getBizType, bizType)
                        .eq(NotificationBizSwitch::getEvent, event));
        return sw != null ? sw.getTemplateCode() : null;
    }

    /**
     * 更新开关状态
     */
    @Transactional(rollbackFor = Exception.class)
    public void updateEnabled(Long id, Integer enabled) {
        NotificationBizSwitch sw = bizSwitchMapper.selectById(id);
        if (sw != null) {
            sw.setEnabled(enabled);
            bizSwitchMapper.updateById(sw);
        }
    }
}
