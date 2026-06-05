package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ExecutionStartDTO;
import com.ams.entity.MaintenanceExecution;
import com.ams.entity.MaintenanceExecutionStep;
import com.ams.entity.MaintenanceExecutionMaterial;
import com.ams.mapper.MaintenanceExecutionMapper;
import com.ams.mapper.MaintenanceExecutionStepMapper;
import com.ams.mapper.MaintenanceExecutionMaterialMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 维保执行生命周期管理服务。
 *
 * <p>核心职责：管理维保施工执行的状态流转（IDLE→RUNNING→PAUSED→RUNNING→COMPLETED），
 * 在关键操作点同步关联 WorkOrder 的状态机。
 *
 * <p>职责边界：本服务专注于维保粒度的执行生命周期管理，
 * 与 WorkOrderExecutionService（工单粒度的步骤/工时管理）职责不同。
 * 前者用于维保施工过程跟踪，后者用于工单内部检查清单管理，两者共存但不冲突。
 */
@Service
@RequiredArgsConstructor
public class MaintenanceExecutionService {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceExecutionService.class);

    private final MaintenanceExecutionMapper executionMapper;
    private final MaintenanceExecutionStepMapper stepMapper;
    private final MaintenanceExecutionMaterialMapper materialMapper;
    private final WorkOrderService workOrderService;

    // ─────────────────────────────────────────────────────────────────────────
    // 核心生命周期方法（含跨 Service 事务协调）
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 开始施工：创建执行记录 → status=RUNNING → 触发 WorkOrder EXECUTING。
     * 使用 Propagation.REQUIRED 确保跨 Service 调用在同一事务中。
     */
    @Transactional(rollbackFor = Exception.class, propagation = Propagation.REQUIRED)
    public MaintenanceExecution start(ExecutionStartDTO dto) {
        String tenantId = TenantContext.requireTenantId();

        // 校验：该维保记录是否已有进行中的执行
        LambdaQueryWrapper<MaintenanceExecution> activeCheck = new LambdaQueryWrapper<MaintenanceExecution>()
                .eq(MaintenanceExecution::getTenantId, tenantId)
                .eq(MaintenanceExecution::getMaintenanceRecordId, dto.getMaintenanceRecordId())
                .in(MaintenanceExecution::getStatus, "IDLE", "RUNNING", "PAUSED");
        if (executionMapper.selectCount(activeCheck) > 0) {
            throw new BusinessException("该维保记录已有进行中的施工执行，请先完成后重试");
        }

        MaintenanceExecution execution = new MaintenanceExecution();
        BeanUtil.copyProperties(dto, execution);
        execution.setTenantId(tenantId);
        execution.setStatus("RUNNING");
        execution.setStartTime(LocalDateTime.now());
        executionMapper.insert(execution);

        // 同步触发 WorkOrder EXECUTING 状态
        try {
            workOrderService.operateWorkOrder(dto.getWorkOrderId(), "start", "开始施工（维保执行）");
        } catch (Exception e) {
            log.error("触发工单 start 状态失败，事务回滚: workOrderId={}", dto.getWorkOrderId(), e);
            throw new BusinessException("触发工单状态流转失败: " + e.getMessage());
        }

        return execution;
    }

    /**
     * 暂停施工：status=PAUSED → 触发 WorkOrder ON_HOLD。
     */
    @Transactional(rollbackFor = Exception.class, propagation = Propagation.REQUIRED)
    public MaintenanceExecution pause(Long id) {
        MaintenanceExecution execution = getExecutionById(id);
        if (!"RUNNING".equals(execution.getStatus())) {
            throw new BusinessException("只有执行中的施工可以暂停");
        }

        execution.setStatus("PAUSED");
        execution.setPauseTime(LocalDateTime.now());
        executionMapper.updateById(execution);

        // 同步触发 WorkOrder ON_HOLD
        try {
            workOrderService.operateWorkOrder(execution.getWorkOrderId(), "hold", "施工暂停");
        } catch (Exception e) {
            log.error("触发工单 hold 状态失败，事务回滚: executionId={}", id, e);
            throw new BusinessException("触发工单状态流转失败: " + e.getMessage());
        }

        return execution;
    }

    /**
     * 恢复施工：status=RUNNING → 触发 WorkOrder RESUME。
     */
    @Transactional(rollbackFor = Exception.class, propagation = Propagation.REQUIRED)
    public MaintenanceExecution resume(Long id) {
        MaintenanceExecution execution = getExecutionById(id);
        if (!"PAUSED".equals(execution.getStatus())) {
            throw new BusinessException("只有已暂停的施工可以恢复");
        }

        execution.setStatus("RUNNING");
        execution.setResumeTime(LocalDateTime.now());
        executionMapper.updateById(execution);

        // 同步触发 WorkOrder RESUME
        try {
            workOrderService.operateWorkOrder(execution.getWorkOrderId(), "resume", "施工恢复");
        } catch (Exception e) {
            log.error("触发工单 resume 状态失败，事务回滚: executionId={}", id, e);
            throw new BusinessException("触发工单状态流转失败: " + e.getMessage());
        }

        return execution;
    }

    /**
     * 完成施工：汇总工时/费用 → status=COMPLETED → 触发 WorkOrder COMPLETED。
     *
     * <p>totalLaborHours = sum(steps.laborHours)
     * <br>totalMaterialCost = sum(materials.totalPrice)
     */
    @Transactional(rollbackFor = Exception.class, propagation = Propagation.REQUIRED)
    public MaintenanceExecution complete(Long id) {
        MaintenanceExecution execution = getExecutionById(id);
        if (!"RUNNING".equals(execution.getStatus())) {
            throw new BusinessException("只有执行中的施工可以完成");
        }

        // 汇总工时
        List<MaintenanceExecutionStep> steps = stepMapper.selectList(
                new LambdaQueryWrapper<MaintenanceExecutionStep>()
                        .eq(MaintenanceExecutionStep::getExecutionId, id)
                        .eq(MaintenanceExecutionStep::getDeleted, 0));
        BigDecimal totalHours = steps.stream()
                .map(s -> s.getLaborHours() != null ? s.getLaborHours() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 汇总物料费用
        List<MaintenanceExecutionMaterial> materials = materialMapper.selectList(
                new LambdaQueryWrapper<MaintenanceExecutionMaterial>()
                        .eq(MaintenanceExecutionMaterial::getExecutionId, id)
                        .eq(MaintenanceExecutionMaterial::getDeleted, 0));
        BigDecimal totalCost = materials.stream()
                .map(m -> m.getTotalPrice() != null ? m.getTotalPrice() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        execution.setStatus("COMPLETED");
        execution.setEndTime(LocalDateTime.now());
        execution.setTotalLaborHours(totalHours);
        execution.setTotalMaterialCost(totalCost);
        executionMapper.updateById(execution);

        // 同步触发 WorkOrder COMPLETED
        try {
            workOrderService.operateWorkOrder(execution.getWorkOrderId(), "complete", "施工完成");
        } catch (Exception e) {
            log.error("触发工单 complete 状态失败，事务回滚: executionId={}", id, e);
            throw new BusinessException("触发工单状态流转失败: " + e.getMessage());
        }

        return execution;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 查询方法
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 根据 ID 查询执行记录（含租户隔离）。
     */
    public MaintenanceExecution getById(Long id) {
        return getExecutionById(id);
    }

    /**
     * 按维保记录 ID 查询执行记录列表（按创建时间倒序）。
     */
    public List<MaintenanceExecution> getByMaintenanceRecordId(Long maintenanceRecordId) {
        String tenantId = TenantContext.requireTenantId();
        return executionMapper.selectList(
                new LambdaQueryWrapper<MaintenanceExecution>()
                        .eq(MaintenanceExecution::getTenantId, tenantId)
                        .eq(MaintenanceExecution::getMaintenanceRecordId, maintenanceRecordId)
                        .orderByDesc(MaintenanceExecution::getCreateTime));
    }

    /**
     * 按工单 ID 查询执行记录列表（按创建时间倒序）。
     */
    public List<MaintenanceExecution> getByWorkOrderId(Long workOrderId) {
        String tenantId = TenantContext.requireTenantId();
        return executionMapper.selectList(
                new LambdaQueryWrapper<MaintenanceExecution>()
                        .eq(MaintenanceExecution::getTenantId, tenantId)
                        .eq(MaintenanceExecution::getWorkOrderId, workOrderId)
                        .orderByDesc(MaintenanceExecution::getCreateTime));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 内部方法
    // ─────────────────────────────────────────────────────────────────────────

    private MaintenanceExecution getExecutionById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        MaintenanceExecution execution = executionMapper.selectOne(
                new LambdaQueryWrapper<MaintenanceExecution>()
                        .eq(MaintenanceExecution::getId, id)
                        .eq(MaintenanceExecution::getTenantId, tenantId));
        if (execution == null) {
            throw new BusinessException("施工执行记录不存在");
        }
        return execution;
    }
}
