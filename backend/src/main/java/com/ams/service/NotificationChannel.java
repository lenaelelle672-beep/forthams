package com.ams.service;

import com.ams.entity.NotificationRecord;

/**
 * 通知渠道接口
 *
 * <p>定义通知发送的统一契约。每个实现代表一种通知投递方式
 * （站内信、邮件、短信等），由 {@link NotificationService} 统一编排调用。</p>
 */
@FunctionalInterface
public interface NotificationChannel {

    /**
     * 发送通知记录
     *
     * @param record 通知记录
     */
    void send(NotificationRecord record);
}
