package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.NotificationPreference;
import com.ams.mapper.NotificationPreferenceMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 用户通知偏好服务
 *
 * <p>提供用户通知偏好的 CRUD、按用户+分类查询、渠道开关检查、批量保存能力。
 * 每个用户在每个通知分类下有一行配置，分别控制站内信和邮件的开关。</p>
 */
@Service
@RequiredArgsConstructor
public class NotificationPreferenceService {

    private final NotificationPreferenceMapper notificationPreferenceMapper;

    /**
     * 获取用户所有通知偏好
     */
    public List<NotificationPreference> getByUserId(Long userId) {
        validateUserId(userId);
        return notificationPreferenceMapper.selectList(
                new LambdaQueryWrapper<NotificationPreference>()
                        .eq(NotificationPreference::getUserId, userId));
    }

    /**
     * 获取用户在指定分类下的偏好
     */
    public NotificationPreference getByUserAndCategory(Long userId, String category) {
        validateUserId(userId);
        return notificationPreferenceMapper.selectOne(
                new LambdaQueryWrapper<NotificationPreference>()
                        .eq(NotificationPreference::getUserId, userId)
                        .eq(NotificationPreference::getCategory, category));
    }

    /**
     * 检查用户在某分类的某渠道是否启用
     *
     * @param userId   用户ID
     * @param category 通知分类（retirement/maintenance/approval/system）
     * @param channel  通知渠道（IN_APP / EMAIL）
     * @return true=启用（或未配置偏好时默认启用）
     */
    public boolean isEnabled(Long userId, String category, String channel) {
        validateUserId(userId);
        NotificationPreference pref = notificationPreferenceMapper.selectOne(
                new LambdaQueryWrapper<NotificationPreference>()
                        .eq(NotificationPreference::getUserId, userId)
                        .eq(NotificationPreference::getCategory, category));
        if (pref == null) {
            return true; // 未配置时默认启用
        }
        if ("IN_APP".equalsIgnoreCase(channel)) {
            return pref.getInApp() == null || pref.getInApp() == 1;
        } else if ("EMAIL".equalsIgnoreCase(channel)) {
            return pref.getEmail() == null || pref.getEmail() == 1;
        }
        return true;
    }

    /**
     * 批量保存用户偏好（先删后插）
     */
    @Transactional(rollbackFor = Exception.class)
    public void batchSave(Long userId, List<NotificationPreference> preferences) {
        validateUserId(userId);
        notificationPreferenceMapper.delete(
                new LambdaQueryWrapper<NotificationPreference>()
                        .eq(NotificationPreference::getUserId, userId));
        for (NotificationPreference pref : preferences) {
            pref.setUserId(userId);
            if (pref.getInApp() == null) pref.setInApp(1);
            if (pref.getEmail() == null) pref.setEmail(1);
            notificationPreferenceMapper.insert(pref);
        }
    }

    private void validateUserId(Long userId) {
        if (userId == null || userId <= 0) {
            throw new BusinessException("通知偏好用户无效");
        }
    }

    /**
     * 更新单条偏好
     */
    @Transactional(rollbackFor = Exception.class)
    public void updateEnabled(Long id, Integer inApp, Integer email) {
        NotificationPreference pref = notificationPreferenceMapper.selectById(id);
        if (pref != null) {
            if (inApp != null) pref.setInApp(inApp);
            if (email != null) pref.setEmail(email);
            notificationPreferenceMapper.updateById(pref);
        }
    }
}
