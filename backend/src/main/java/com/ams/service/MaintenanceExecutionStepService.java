package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.annotation.DataScope;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ExecutionStepCreateDTO;
import com.ams.dto.ExecutionStepUpdateDTO;
import com.ams.entity.MaintenanceExecutionStep;
import com.ams.mapper.MaintenanceExecutionStepMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 施工步骤管理服务。
 *
 * <p>提供维保施工步骤的 CRUD 和排序管理。
 * 步骤记录施工过程中的具体操作，支持按执行记录查询和批量排序。
 */
@Service
@RequiredArgsConstructor
public class MaintenanceExecutionStepService {

    private final MaintenanceExecutionStepMapper stepMapper;

    /**
     * 获取指定执行的步骤列表（按 step_order 排序）。
     */
    @DataScope(userColumn = "create_by")
    public List<MaintenanceExecutionStep> getSteps(Long executionId) {
        String tenantId = TenantContext.requireTenantId();
        return stepMapper.selectList(
                new LambdaQueryWrapper<MaintenanceExecutionStep>()
                        .eq(MaintenanceExecutionStep::getTenantId, tenantId)
                        .eq(MaintenanceExecutionStep::getExecutionId, executionId)
                        .orderByAsc(MaintenanceExecutionStep::getStepOrder)
                        .orderByAsc(MaintenanceExecutionStep::getId));
    }

    /**
     * 创建施工步骤。
     */
    @Transactional(rollbackFor = Exception.class)
    public MaintenanceExecutionStep createStep(ExecutionStepCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        MaintenanceExecutionStep step = new MaintenanceExecutionStep();
        BeanUtil.copyProperties(dto, step);
        step.setTenantId(tenantId);
        if (step.getStepOrder() == null) {
            // 自动计算排序号：当前最大排序号 + 1
            List<MaintenanceExecutionStep> existing = stepMapper.selectList(
                    new LambdaQueryWrapper<MaintenanceExecutionStep>()
                            .eq(MaintenanceExecutionStep::getExecutionId, dto.getExecutionId())
                            .eq(MaintenanceExecutionStep::getDeleted, 0)
                            .orderByDesc(MaintenanceExecutionStep::getStepOrder)
                            .last("LIMIT 1"));
            int maxOrder = existing.isEmpty() ? 0 : (existing.get(0).getStepOrder() != null ? existing.get(0).getStepOrder() : 0);
            step.setStepOrder(maxOrder + 1);
        }
        stepMapper.insert(step);
        return step;
    }

    /**
     * 更新施工步骤信息。
     */
    @Transactional(rollbackFor = Exception.class)
    public MaintenanceExecutionStep updateStep(Long stepId, ExecutionStepUpdateDTO dto) {
        MaintenanceExecutionStep step = getStepById(stepId);
        BeanUtil.copyProperties(dto, step, "id", "executionId", "tenantId", "createTime");
        stepMapper.updateById(step);
        return step;
    }

    /**
     * 删除施工步骤（逻辑删除）。
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteStep(Long stepId) {
        getStepById(stepId);
        stepMapper.deleteById(stepId);
    }

    /**
     * 批量重排步骤顺序。
     *
     * @param executionId 执行记录ID
     * @param stepIds 按新顺序排列的步骤ID列表
     */
    @Transactional(rollbackFor = Exception.class)
    public void reorderSteps(Long executionId, List<Long> stepIds) {
        String tenantId = TenantContext.requireTenantId();
        int order = 1;
        for (Long stepId : stepIds) {
            MaintenanceExecutionStep step = stepMapper.selectOne(
                    new LambdaQueryWrapper<MaintenanceExecutionStep>()
                            .eq(MaintenanceExecutionStep::getId, stepId)
                            .eq(MaintenanceExecutionStep::getExecutionId, executionId)
                            .eq(MaintenanceExecutionStep::getTenantId, tenantId));
            if (step != null) {
                step.setStepOrder(order++);
                stepMapper.updateById(step);
            }
        }
    }

    private MaintenanceExecutionStep getStepById(Long stepId) {
        String tenantId = TenantContext.requireTenantId();
        MaintenanceExecutionStep step = stepMapper.selectOne(
                new LambdaQueryWrapper<MaintenanceExecutionStep>()
                        .eq(MaintenanceExecutionStep::getId, stepId)
                        .eq(MaintenanceExecutionStep::getTenantId, tenantId));
        if (step == null) {
            throw new BusinessException("施工步骤不存在");
        }
        return step;
    }
}
