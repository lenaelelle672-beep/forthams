package com.ams.service;

import com.ams.entity.NotificationRecord;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/**
 * 站内信通知渠道
 *
 * <p>将通知记录持久化到数据库，作为用户的站内信。
 * 通过 {@link NotificationService#create(NotificationRecord)} 复用已有持久化逻辑。</p>
 */
@Component
@Lazy
@RequiredArgsConstructor
public class InAppChannel implements NotificationChannel {

    private final NotificationService notificationService;

    @Override
    public void send(NotificationRecord record) {
        notificationService.create(record);
    }
}
