package com.ams.scheduled;

import com.ams.entity.Inspection;
import com.ams.service.InspectionService;
import com.ams.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 检验到期提醒定时任务（已弃用）
 *
 * @deprecated 此类已弃用，定时任务功能已迁移到 InspectionServiceImpl
 * 保留此文件仅为兼容性，实际功能由 InspectionServiceImpl 的 inspectionReminder() 方法提供
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Deprecated
public class InspectionExpiryTask {

    private final InspectionService inspectionService;
    private final NotificationService notificationService;

    /**
     * 扫描即将到期的检验记录（已弃用）
     *
     * @deprecated 此方法已弃用，功能已迁移到 InspectionServiceImpl.inspectionReminder()
     */
    @Deprecated
    public void scanExpiringInspections() {
        log.warn("[InspectionExpiryTask] 此类已弃用，请使用 InspectionServiceImpl.inspectionReminder() 代替");
        // 不执行任何操作，实际功能由 InspectionServiceImpl 提供
    }
}