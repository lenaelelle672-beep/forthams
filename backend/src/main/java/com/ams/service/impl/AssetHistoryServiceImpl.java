package com.ams.service.impl;

import com.ams.context.TenantContext;
import com.ams.dto.AssetHistoryEvent;
import com.ams.entity.*;
import com.ams.mapper.*;
import com.ams.service.AssetHistoryService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssetHistoryServiceImpl implements AssetHistoryService {

    private final AssetChangeLogMapper assetChangeLogMapper;
    private final WorkOrderMapper workOrderMapper;
    private final MaintenanceRecordMapper maintenanceRecordMapper;
    private final AssetAssignmentMapper assetAssignmentMapper;
    private final AssetBorrowMapper assetBorrowMapper;
    private final InspectionMapper inspectionMapper;
    private final RetirementApplicationMapper retirementApplicationMapper;
    private final IntakeOrderMapper intakeOrderMapper;

    @Override
    public List<AssetHistoryEvent> getFullHistory(Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        List<AssetHistoryEvent> events = new ArrayList<>();

        events.addAll(getChangeLogEvents(assetId));
        events.addAll(getWorkOrderEvents(assetId));
        events.addAll(getMaintenanceEvents(assetId));
        events.addAll(getAssignmentEvents(assetId));
        events.addAll(getBorrowEvents(assetId));
        events.addAll(getInspectionEvents(assetId));
        events.addAll(getRetirementEvents(assetId));
        events.addAll(getIntakeEvents(assetId));

        events.sort((a, b) -> b.getEventTime().compareTo(a.getEventTime()));
        return events;
    }

    @Override
    public List<AssetHistoryEvent> getHistoryByTypes(Long assetId, List<String> eventTypes) {
        return getFullHistory(assetId).stream()
                .filter(e -> eventTypes.contains(e.getEventType()))
                .collect(Collectors.toList());
    }

    @Override
    public List<AssetHistoryEvent> getHistoryByTimeRange(Long assetId, LocalDateTime startTime, LocalDateTime endTime) {
        List<AssetHistoryEvent> allEvents = getFullHistory(assetId);
        return allEvents.stream()
                .filter(event -> {
                    LocalDateTime eventTime = event.getEventTime();
                    if (eventTime == null) {
                        return false;
                    }
                    boolean afterStart = startTime == null || !eventTime.isBefore(startTime);
                    boolean beforeEnd = endTime == null || !eventTime.isAfter(endTime);
                    return afterStart && beforeEnd;
                })
                .collect(Collectors.toList());
    }

    private List<AssetHistoryEvent> getChangeLogEvents(Long assetId) {
        return assetChangeLogMapper.selectList(
                new LambdaQueryWrapper<AssetChangeLog>()
                        .eq(AssetChangeLog::getAssetId, assetId)
                        .orderByDesc(AssetChangeLog::getCreateTime)
        ).stream().map(log -> AssetHistoryEvent.builder()
                .eventType("CHANGE_LOG")
                .eventTime(log.getCreateTime() != null ? log.getCreateTime() : LocalDateTime.now())
                .title("资产信息变更")
                .description(log.getChangeType() + ": "
                        + (log.getOldValue() != null ? log.getOldValue() + " → " : "")
                        + (log.getNewValue() != null ? log.getNewValue() : "")
                        + (log.getReason() != null ? "（" + log.getReason() + "）" : ""))
                .refId(log.getId())
                .refType("CHANGE_LOG")
                .level("INFO")
                .build()
        ).collect(Collectors.toList());
    }

    private List<AssetHistoryEvent> getWorkOrderEvents(Long assetId) {
        return workOrderMapper.selectList(
                new LambdaQueryWrapper<WorkOrder>()
                        .eq(WorkOrder::getAssetId, assetId)
                        .orderByDesc(WorkOrder::getCreateTime)
        ).stream().map(wo -> {
            String statusLabel = wo.getStatus() != null ? wo.getStatus() : "未知";
            return AssetHistoryEvent.builder()
                    .eventType("WORK_ORDER")
                    .eventTime(wo.getCreateTime() != null ? wo.getCreateTime() : LocalDateTime.now())
                    .title("维修工单：" + (wo.getTitle() != null ? wo.getTitle() : "无标题"))
                    .description("状态：" + statusLabel)
                    .refId(wo.getId())
                    .refType("WORK_ORDER")
                    .linkUrl("/workorders/" + wo.getId())
                    .level("COMPLETED".equals(wo.getStatus()) ? "INFO" :
                           "DRAFT".equals(wo.getStatus()) ? "WARNING" : "INFO")
                    .build();
        }).collect(Collectors.toList());
    }

    private List<AssetHistoryEvent> getMaintenanceEvents(Long assetId) {
        return maintenanceRecordMapper.selectList(
                new LambdaQueryWrapper<MaintenanceRecord>()
                        .eq(MaintenanceRecord::getAssetId, assetId)
                        .orderByDesc(MaintenanceRecord::getCreateTime)
        ).stream().map(mr -> AssetHistoryEvent.builder()
                .eventType("MAINTENANCE")
                .eventTime(mr.getCreateTime() != null ? mr.getCreateTime() : LocalDateTime.now())
                .title("保养记录")
                .description(mr.getMaintenanceType() != null ? "保养类型：" + mr.getMaintenanceType() : "保养执行")
                .operatorName(mr.getExecutor())
                .refId(mr.getId())
                .refType("MAINTENANCE")
                .level("INFO")
                .build()
        ).collect(Collectors.toList());
    }

    private List<AssetHistoryEvent> getAssignmentEvents(Long assetId) {
        return assetAssignmentMapper.selectList(
                new LambdaQueryWrapper<AssetAssignment>()
                        .eq(AssetAssignment::getAssetId, assetId)
                        .orderByDesc(AssetAssignment::getCreateTime)
        ).stream().map(aa -> {
            String status = aa.getStatus() != null ? aa.getStatus() : "";
            return AssetHistoryEvent.builder()
                    .eventType("ASSIGNMENT")
                    .eventTime(aa.getCreateTime() != null ? aa.getCreateTime() : LocalDateTime.now())
                    .title("资产领用")
                    .description("领用人ID：" + (aa.getAssignedToUserId() != null ? aa.getAssignedToUserId().toString() : "未知")
                            + " | 状态：" + status)
                    .refId(aa.getId())
                    .refType("ASSIGNMENT")
                    .linkUrl("/assignments/" + aa.getId())
                    .level("RETURNED".equals(aa.getStatus()) ? "INFO" : "WARNING")
                    .build();
        }).collect(Collectors.toList());
    }

    private List<AssetHistoryEvent> getBorrowEvents(Long assetId) {
        return assetBorrowMapper.selectList(
                new LambdaQueryWrapper<AssetBorrow>()
                        .eq(AssetBorrow::getAssetId, assetId)
                        .orderByDesc(AssetBorrow::getCreateTime)
        ).stream().map(ab -> AssetHistoryEvent.builder()
                .eventType("BORROW")
                .eventTime(ab.getCreateTime() != null ? ab.getCreateTime() : LocalDateTime.now())
                .title("资产借用")
                .description("借用人ID：" + (ab.getBorrowerId() != null ? ab.getBorrowerId().toString() : "未知")
                        + " | 预计归还：" + (ab.getExpectedReturnDate() != null ? ab.getExpectedReturnDate().toString() : "未设置"))
                .refId(ab.getId())
                .refType("BORROW")
                .linkUrl("/borrows/" + ab.getId())
                .level("OVERDUE".equals(ab.getStatus()) ? "ERROR" : "RETURNED".equals(ab.getStatus()) ? "INFO" : "WARNING")
                .build()
        ).collect(Collectors.toList());
    }

    private List<AssetHistoryEvent> getInspectionEvents(Long assetId) {
        return inspectionMapper.selectList(
                new LambdaQueryWrapper<Inspection>()
                        .eq(Inspection::getAssetId, assetId)
                        .orderByDesc(Inspection::getCreateTime)
        ).stream().map(ins -> {
            String resultLabel = ins.getResult() != null ? ins.getResult() : "待定";
            return AssetHistoryEvent.builder()
                    .eventType("INSPECTION")
                    .eventTime(ins.getCreateTime() != null ? ins.getCreateTime() : LocalDateTime.now())
                    .title("检验/年检")
                    .description("类型：" + (ins.getInspectionType() != null ? ins.getInspectionType() : "未知")
                            + " | 结果：" + resultLabel)
                    .operatorName(ins.getInspectorName())
                    .refId(ins.getId())
                    .refType("INSPECTION")
                    .linkUrl("/inspections/" + ins.getId())
                    .level("FAIL".equals(ins.getResult()) ? "ERROR" : "INFO")
                    .build();
        }).collect(Collectors.toList());
    }

    private List<AssetHistoryEvent> getRetirementEvents(Long assetId) {
        return retirementApplicationMapper.selectList(
                new LambdaQueryWrapper<RetirementApplication>()
                        .eq(RetirementApplication::getAssetId, assetId)
                        .orderByDesc(RetirementApplication::getCreateTime)
        ).stream().map(ra -> AssetHistoryEvent.builder()
                .eventType("RETIREMENT")
                .eventTime(ra.getCreateTime() != null ? ra.getCreateTime() : LocalDateTime.now())
                .title("报废申请")
                .description("状态：" + (ra.getStatus() != null ? ra.getStatus() : "未知")
                        + (ra.getReason() != null ? " | 原因：" + ra.getReason() : ""))
                .refId(ra.getId())
                .refType("RETIREMENT")
                .linkUrl("/retirement/" + ra.getId())
                .level("APPROVED".equals(ra.getStatus()) ? "ERROR" :
                       "REJECTED".equals(ra.getStatus()) ? "INFO" : "WARNING")
                .build()
        ).collect(Collectors.toList());
    }

    private List<AssetHistoryEvent> getIntakeEvents(Long assetId) {
        return intakeOrderMapper.selectList(
                new LambdaQueryWrapper<IntakeOrder>()
                        .orderByDesc(IntakeOrder::getCreateTime)
        ).stream().map(io -> AssetHistoryEvent.builder()
                .eventType("INTAKE")
                .eventTime(io.getCreateTime() != null ? io.getCreateTime() : LocalDateTime.now())
                .title("入库验收")
                .description("验收单号：" + (io.getOrderNo() != null ? io.getOrderNo() : "")
                        + " | 状态：" + (io.getStatus() != null ? io.getStatus() : "待定"))
                .refId(io.getId())
                .refType("INTAKE")
                .linkUrl("/intake/" + io.getId())
                .level("ACCEPTED".equals(io.getStatus()) || "COMPLETED".equals(io.getStatus()) ? "INFO" : "WARNING")
                .build()
        ).collect(Collectors.toList());
    }
}
