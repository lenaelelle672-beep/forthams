package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ExecutionStartDTO;
import com.ams.entity.MaintenanceExecution;
import com.ams.entity.MaintenanceExecutionMaterial;
import com.ams.entity.MaintenanceExecutionStep;
import com.ams.enums.ExecutionStatus;
import com.ams.mapper.MaintenanceExecutionMapper;
import com.ams.mapper.MaintenanceExecutionMaterialMapper;
import com.ams.mapper.MaintenanceExecutionStepMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("MaintenanceExecutionService — 状态机生命周期测试")
class MaintenanceExecutionServiceTest {

    @Mock
    private MaintenanceExecutionMapper executionMapper;

    @Mock
    private MaintenanceExecutionStepMapper stepMapper;

    @Mock
    private MaintenanceExecutionMaterialMapper materialMapper;

    @Mock
    private WorkOrderService workOrderService;

    @InjectMocks
    private MaintenanceExecutionService executionService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // =========================================================================
    // start — 开始施工
    // =========================================================================

    @Test
    @DisplayName("开始施工：应创建 RUNNING 状态执行记录并触发工单 EXECUTING")
    void shouldStartExecutionAndTriggerWorkOrder() {
        // 准备
        ExecutionStartDTO dto = new ExecutionStartDTO();
        dto.setMaintenanceRecordId(1L);
        dto.setWorkOrderId(10L);
        dto.setAssigneeId(100L);
        dto.setAssigneeName("张三");

        // 执行
        MaintenanceExecution result = executionService.start(dto);

        // 验证
        assertNotNull(result);
        assertEquals(ExecutionStatus.RUNNING.name(), result.getStatus());
        assertNotNull(result.getStartTime());
        assertEquals("dept:1", result.getTenantId());
        assertEquals(1L, result.getMaintenanceRecordId());
        assertEquals(10L, result.getWorkOrderId());
        assertEquals(100L, result.getAssigneeId());
        assertEquals("张三", result.getAssigneeName());
        // totalLaborHours 和 totalMaterialCost 在 start 时未设置，为 null
        assertNull(result.getTotalLaborHours());
        assertNull(result.getTotalMaterialCost());

        verify(executionMapper).insert(any(MaintenanceExecution.class));
        verify(workOrderService).operateWorkOrder(10L, "start", "开始施工（维保执行）");
    }

    @Test
    @DisplayName("开始施工：工单状态同步失败时应抛出异常")
    void shouldThrowExceptionWhenWorkOrderStartFails() {
        ExecutionStartDTO dto = new ExecutionStartDTO();
        dto.setMaintenanceRecordId(1L);
        dto.setWorkOrderId(10L);

        doThrow(new RuntimeException("工单状态异常")).when(workOrderService).operateWorkOrder(10L, "start", "开始施工（维保执行）");

        assertThrows(BusinessException.class, () -> executionService.start(dto));
    }

    // =========================================================================
    // pause — 暂停施工
    // =========================================================================

    @Test
    @DisplayName("暂停施工：RUNNING→PAUSED，触发工单 ON_HOLD")
    void shouldPauseExecutionAndTriggerWorkOrderHold() {
        MaintenanceExecution execution = createExecution(1L, ExecutionStatus.RUNNING);
        when(executionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(execution);

        MaintenanceExecution result = executionService.pause(1L);

        assertEquals(ExecutionStatus.PAUSED.name(), result.getStatus());
        assertNotNull(result.getPauseTime());
        verify(executionMapper).updateById(execution);
        verify(workOrderService).operateWorkOrder(10L, "hold", "施工暂停");
    }

    @Test
    @DisplayName("暂停施工：非 RUNNING 状态应拒绝")
    void shouldRejectPauseWhenNotRunning() {
        MaintenanceExecution execution = createExecution(1L, ExecutionStatus.IDLE);
        when(executionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(execution);

        assertThrows(BusinessException.class, () -> executionService.pause(1L));
        verify(executionMapper, never()).updateById(any(MaintenanceExecution.class));
    }

    // =========================================================================
    // resume — 恢复施工
    // =========================================================================

    @Test
    @DisplayName("恢复施工：PAUSED→RUNNING，触发工单 EXECUTING")
    void shouldResumeExecutionAndTriggerWorkOrder() {
        MaintenanceExecution execution = createExecution(1L, ExecutionStatus.PAUSED);
        when(executionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(execution);

        MaintenanceExecution result = executionService.resume(1L);

        assertEquals(ExecutionStatus.RUNNING.name(), result.getStatus());
        assertNotNull(result.getResumeTime());
        verify(executionMapper).updateById(execution);
        verify(workOrderService).operateWorkOrder(10L, "resume", "施工恢复");
    }

    @Test
    @DisplayName("恢复施工：非 PAUSED 状态应拒绝")
    void shouldRejectResumeWhenNotPaused() {
        MaintenanceExecution execution = createExecution(1L, ExecutionStatus.COMPLETED);
        when(executionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(execution);

        assertThrows(BusinessException.class, () -> executionService.resume(1L));
        verify(executionMapper, never()).updateById(any(MaintenanceExecution.class));
    }

    // =========================================================================
    // complete — 完成施工
    // =========================================================================

    @Test
    @DisplayName("完成施工：汇总工时和费用，RUNNING→COMPLETED，触发工单 COMPLETED")
    void shouldCompleteExecutionWithSummary() {
        MaintenanceExecution execution = createExecution(1L, ExecutionStatus.RUNNING);
        when(executionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(execution);

        // 模拟步骤数据：5h + 3h = 8h
        MaintenanceExecutionStep step1 = new MaintenanceExecutionStep();
        step1.setLaborHours(new BigDecimal("5"));
        MaintenanceExecutionStep step2 = new MaintenanceExecutionStep();
        step2.setLaborHours(new BigDecimal("3"));
        when(stepMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(step1, step2));

        // 模拟物料数据：100 + 200 = 300
        MaintenanceExecutionMaterial mat1 = new MaintenanceExecutionMaterial();
        mat1.setTotalPrice(new BigDecimal("100"));
        MaintenanceExecutionMaterial mat2 = new MaintenanceExecutionMaterial();
        mat2.setTotalPrice(new BigDecimal("200"));
        when(materialMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(mat1, mat2));

        MaintenanceExecution result = executionService.complete(1L);

        assertEquals(ExecutionStatus.COMPLETED.name(), result.getStatus());
        assertNotNull(result.getEndTime());
        assertEquals(0, new BigDecimal("8").compareTo(result.getTotalLaborHours()));
        assertEquals(0, new BigDecimal("300").compareTo(result.getTotalMaterialCost()));

        verify(stepMapper).selectList(any(LambdaQueryWrapper.class));
        verify(materialMapper).selectList(any(LambdaQueryWrapper.class));
        verify(workOrderService).operateWorkOrder(10L, "complete", "施工完成");
    }

    @Test
    @DisplayName("完成施工：非 RUNNING 状态应拒绝")
    void shouldRejectCompleteWhenNotRunning() {
        MaintenanceExecution execution = createExecution(1L, ExecutionStatus.COMPLETED);
        when(executionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(execution);

        assertThrows(BusinessException.class, () -> executionService.complete(1L));
        verify(executionMapper, never()).updateById(any(MaintenanceExecution.class));
    }

    // =========================================================================
    // 查询方法
    // =========================================================================

    @Test
    @DisplayName("getById：应返回指定执行记录")
    void shouldGetById() {
        MaintenanceExecution execution = createExecution(1L, ExecutionStatus.RUNNING);
        when(executionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(execution);

        MaintenanceExecution result = executionService.getById(1L);
        assertNotNull(result);
        assertEquals(1L, result.getId());
    }

    @Test
    @DisplayName("getById：不存在应抛异常")
    void shouldThrowWhenNotFound() {
        when(executionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        assertThrows(BusinessException.class, () -> executionService.getById(999L));
    }

    // =========================================================================
    // 内部辅助
    // =========================================================================

    private MaintenanceExecution createExecution(Long id, ExecutionStatus status) {
        MaintenanceExecution execution = new MaintenanceExecution();
        execution.setId(id);
        execution.setTenantId("dept:1");
        execution.setMaintenanceRecordId(1L);
        execution.setWorkOrderId(10L);
        execution.setStatus(status.name());
        execution.setStartTime(LocalDateTime.now());
        execution.setTotalLaborHours(BigDecimal.ZERO);
        execution.setTotalMaterialCost(BigDecimal.ZERO);
        return execution;
    }
}
