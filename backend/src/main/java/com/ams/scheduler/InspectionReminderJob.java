package com.ams.scheduler;

import com.ams.entity.Asset;
import com.ams.entity.Inspection;
import com.ams.service.AssetService;
import com.ams.service.InspectionService;
import com.ams.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 检验到期自动提醒定时任务（已弃用）
 *
 * @deprecated 此类已弃用，定时任务功能已迁移到 InspectionServiceImpl
 * 保留此文件仅为兼容性，实际功能由 InspectionServiceImpl 的 checkExpiringInspections() 方法提供
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Deprecated
public class InspectionReminderJob {

    private final InspectionService inspectionService;
    private final AssetService assetService;
    private final NotificationService notificationService;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final int DEFAULT_WARNING_DAYS = 30;

    /**
     * 扫描即将到期的检验记录（已弃用）
     *
     * @deprecated 此方法已弃用，功能已迁移到 InspectionServiceImpl.checkExpiringInspections()
     */
    @Deprecated
    // @Scheduled(cron = "0 0 8 * * ?")  // 已注释，功能由 InspectionServiceImpl 接管
    public void scanExpiringInspections() {
        log.warn("[InspectionReminderJob] 此类已弃用，请使用 InspectionServiceImpl.checkExpiringInspections() 代替");
        // 不执行任何操作，实际功能由 InspectionServiceImpl 提供
    }
}