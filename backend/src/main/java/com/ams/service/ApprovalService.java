package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ApprovalCreateDTO;
import com.ams.dto.AssetClearanceDTO;
import com.ams.dto.AssetScrapDTO;
import com.ams.dto.AssetTransferDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.ApprovalRecord;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.ApprovalRecordMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * 审批流程核心服务
 *
 * <p>管理各类审批流程的生命周期，包括创建、审批状态流转、业务结果回调。
 * 支持的流程类型：RETIREMENT（报废退役）、WORK_ORDER（工单审批）、
 * ASSET_TRANSFER（资产转移）、ASSET_CLEARANCE（资产清退）、ASSET_SCRAP（资产报废）。
 *
 * <p>当最终审批通过时，同步触发对应的资产处置回调和状态更新，
 * 确保审批结果与资产状态在同一事务内保持一致。
 *
 * @see DisposalService
 * @see RetirementApplicationService
 * @see WorkOrderService
 */
@Service
@RequiredArgsConstructor
public class ApprovalService {

    private static final int FINAL_STEP = 3;

    private final ApprovalProcessMapper approvalProcessMapper;
    private final ApprovalRecordMapper approvalRecordMapper;
    private final RetirementApplicationService retirementApplicationService;
    private final WorkOrderService workOrderService;
    private final DisposalService disposalService;
    private final ObjectMapper objectMapper;

    /**
     * 分页查询审批流程列表。
     *
     * @param page        页码（从 1 开始）
     * @param pageSize    每页条数
     * @param status      流程状态过滤（PENDING/APPROVED/REJECTED），为空则不过滤
     * @param processType 流程类型过滤（RETIREMENT/WORK_ORDER/ASSET_TRANSFER 等），为空则不过滤
     * @return 分页审批流程结果
     */
    public Page<ApprovalProcess> queryProcesses(Integer page, Integer pageSize, String status, String processType) {
        String tenantId = TenantContext.requireTenantId();
        Page<ApprovalProcess> pageParam = new Page<>(page, pageSize);
        QueryWrapper<ApprovalProcess> wrapper = new QueryWrapper<>();
        wrapper.eq("tenant_id", tenantId);

        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        if (processType != null && !processType.isEmpty()) {
            wrapper.eq("process_type", processType);
        }
        wrapper.orderByDesc("create_time");

        return approvalProcessMapper.selectPage(pageParam, wrapper);
    }

    /**
     * 根据 ID 获取审批流程详情，包含该流程的所有审批记录。
     *
     * @param id 审批流程 ID
     * @return 包含 "process"（流程实体）和 "records"（审批记录列表）的 Map
     * @throws BusinessException 流程不存在时抛出
     */
    public Map<String, Object> getProcessById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        ApprovalProcess process = approvalProcessMapper.selectOne(new QueryWrapper<ApprovalProcess>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (process == null) {
            throw new BusinessException("审批流程不存在");
        }

        List<ApprovalRecord> records = approvalRecordMapper.selectList(
            new QueryWrapper<ApprovalRecord>()
                .eq("process_id", id)
                .eq("tenant_id", tenantId)
                .orderByAsc("step_no")
                .orderByAsc("create_time")
        );

        Map<String, Object> result = new HashMap<>();
        result.put("process", process);
        result.put("records", records);
        return result;
    }

    /**
     * 创建审批流程。
     *
     * <p>根据 DTO 信息创建新的审批流程，初始状态为 PENDING，当前步骤为 1。
     * 自动生成唯一的流程编号。
     *
     * @param dto 审批流程创建参数
     * @return 创建成功的审批流程实体
     */
    @Transactional(rollbackFor = Exception.class)
    public ApprovalProcess createProcess(ApprovalCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        ApprovalProcess process = new ApprovalProcess();
        BeanUtil.copyProperties(dto, process);
        BeanUtil.setProperty(process, "tenantId", tenantId);
        BeanUtil.setProperty(process, "processNo", generateProcessNo());
        BeanUtil.setProperty(process, "status", "PENDING");
        BeanUtil.setProperty(process, "currentStep", 1);
        BeanUtil.setProperty(process, "applyTime", LocalDateTime.now());

        approvalProcessMapper.insert(process);
        return process;
    }

    /**
     * 执行审批操作（通过或驳回）。
     *
     * <p>处理审批流程的单步审批，根据审批结果更新流程状态：
     * <ul>
     *   <li>APPROVED 且为最终步骤 → 流程状态变为 APPROVED，同步触发业务结果回调</li>
     *   <li>APPROVED 但非最终步骤 → 当前步骤递增，流程继续</li>
     *   <li>REJECTED → 流程状态变为 REJECTED，触发驳回处理</li>
     * </ul>
     *
     * <p>对于报废/处置流程（ASSET_TRANSFER/ASSET_CLEARANCE/ASSET_SCRAP），
     * 最终审批通过时同步调用 {@link DisposalService} 执行资产处置回调和状态更新，
     * 确保审批结果与资产状态在同一事务内一致。
     *
     * @param processId  审批流程 ID
     * @param approverId 审批人 ID
     * @param result     审批结果（APPROVED / REJECTED）
     * @param opinion    审批意见
     * @return 更新后的审批流程实体
     * @throws BusinessException 流程不存在、状态不可审批或审批结果无效时抛出
     */
    @Transactional(rollbackFor = Exception.class)
    public ApprovalProcess approve(Long processId, Long approverId, String result, String opinion) {
        String tenantId = TenantContext.requireTenantId();
        ApprovalProcess process = approvalProcessMapper.selectOne(new QueryWrapper<ApprovalProcess>()
                .eq("id", processId)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (process == null) {
            throw new BusinessException("审批流程不存在");
        }
        if (!"PENDING".equals(BeanUtil.getProperty(process, "status"))) {
            throw new BusinessException("当前流程不可审批");
        }

        ApprovalRecord record = new ApprovalRecord();
        BeanUtil.setProperty(record, "processId", processId);
        BeanUtil.setProperty(record, "tenantId", tenantId);
        Integer currentStep = parseInteger(BeanUtil.getProperty(process, "currentStep"), 1);
        int finalStep = resolveFinalStep(process);
        BeanUtil.setProperty(record, "stepNo", currentStep);
        BeanUtil.setProperty(record, "approverId", approverId);
        BeanUtil.setProperty(record, "approveResult", result);
        BeanUtil.setProperty(record, "approveOpinion", opinion);
        BeanUtil.setProperty(record, "approveTime", LocalDateTime.now());
        approvalRecordMapper.insert(record);

        if ("REJECTED".equals(result)) {
            BeanUtil.setProperty(process, "status", "REJECTED");
        } else if ("APPROVED".equals(result)) {
            if (currentStep >= finalStep) {
                BeanUtil.setProperty(process, "status", "APPROVED");
            } else {
                BeanUtil.setProperty(process, "currentStep", currentStep + 1);
            }
        } else {
            throw new BusinessException("审批结果无效");
        }

        approvalProcessMapper.updateById(process);
        handleBusinessOutcome(process, approverId, result, opinion);
        return process;
    }

    /**
     * 获取指定审批人待审批的流程列表。
     *
     * <p>排除该审批人已经处理过的流程（通过审批记录过滤）。
     *
     * @param approverId 审批人 ID
     * @return 未被该审批人处理过的待审批流程列表
     */
    public List<ApprovalProcess> getMyPendingApprovals(Long approverId) {
        String tenantId = TenantContext.requireTenantId();
        List<ApprovalProcess> pendingList = approvalProcessMapper.selectList(
            new QueryWrapper<ApprovalProcess>()
                .eq("tenant_id", tenantId)
                .eq("status", "PENDING")
                .orderByDesc("create_time")
        );

        if (approverId == null || pendingList.isEmpty()) {
            return pendingList;
        }

        List<ApprovalRecord> myRecords = approvalRecordMapper.selectList(
            new QueryWrapper<ApprovalRecord>()
                .eq("tenant_id", tenantId)
                .eq("approver_id", approverId)
        );

        if (myRecords.isEmpty()) {
            return pendingList;
        }

        Set<Long> processedIds = myRecords.stream()
            .map(item -> parseLong(BeanUtil.getProperty(item, "processId"), null))
            .filter(id -> id != null)
            .collect(Collectors.toSet());
        return pendingList.stream()
            .filter(item -> {
                Long id = parseLong(BeanUtil.getProperty(item, "id"), null);
                return id == null || !processedIds.contains(id);
            })
            .collect(Collectors.toList());
    }

    /**
     * 获取当前租户下待审批流程的数量。
     *
     * @return 待审批流程总数
     */
    public Long getPendingCount() {
        String tenantId = TenantContext.requireTenantId();
        return approvalProcessMapper.selectCount(
            new QueryWrapper<ApprovalProcess>()
                    .eq("tenant_id", tenantId)
                    .eq("status", "PENDING")
        );
    }

    private String generateProcessNo() {
        String tenantId = TenantContext.requireTenantId();
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "APR-" + dateStr + "-";

        Long count = approvalProcessMapper.selectCount(
            new QueryWrapper<ApprovalProcess>()
                .eq("tenant_id", tenantId)
                .likeRight("process_no", prefix)
        );
        long sequence = (count == null ? 0 : count) + 1;
        return prefix + String.format("%03d", sequence);
    }

    private Integer parseInteger(Object value, Integer defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Integer) {
            return (Integer) value;
        }
        String str = value.toString();
        if (str.isEmpty()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(str);
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private Long parseLong(Object value, Long defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }

        String text = String.valueOf(value);
        if (text.isEmpty()) {
            return defaultValue;
        }
        try {
            return Long.parseLong(text);
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private int resolveFinalStep(ApprovalProcess process) {
        if ("RETIREMENT".equals(process.getProcessType()) && process.getBusinessId() != null) {
            return retirementApplicationService.getApprovalStepCount(process.getBusinessId());
        }
        if ("WORK_ORDER".equals(process.getProcessType())) {
            return 1;
        }
        return FINAL_STEP;
    }

    private void handleBusinessOutcome(ApprovalProcess process, Long approverId, String result, String opinion) {
        if (process.getBusinessId() == null) {
            return;
        }
        if ("REJECTED".equals(result)) {
            handleRejection(process, approverId, opinion);
            return;
        }
        if (!"APPROVED".equals(process.getStatus())) {
            return;
        }
        switch (process.getProcessType()) {
            case "RETIREMENT":
                retirementApplicationService.approveApplication(process.getBusinessId(), approverId);
                break;
            case "WORK_ORDER":
                workOrderService.applyApprovalOutcome(process.getBusinessId(), "APPROVED", opinion);
                break;
            case "ASSET_TRANSFER":
                handleDisposalOutcome(process, AssetTransferDTO.class, dto -> disposalService.transferAsset((AssetTransferDTO) dto));
                break;
            case "ASSET_CLEARANCE":
                handleDisposalOutcome(process, AssetClearanceDTO.class, dto -> disposalService.clearAsset((AssetClearanceDTO) dto));
                break;
            case "ASSET_SCRAP":
                handleDisposalOutcome(process, AssetScrapDTO.class, dto -> disposalService.scrapAsset((AssetScrapDTO) dto));
                break;
            default:
                break;
        }
    }

    private void handleRejection(ApprovalProcess process, Long approverId, String opinion) {
        switch (process.getProcessType()) {
            case "RETIREMENT":
                retirementApplicationService.rejectApplication(process.getBusinessId(), approverId, opinion);
                break;
            case "WORK_ORDER":
                workOrderService.applyApprovalOutcome(process.getBusinessId(), "REJECTED", opinion);
                break;
            default:
                break;
        }
    }

    private <T> void handleDisposalOutcome(ApprovalProcess process, Class<T> dtoClass, Consumer<T> action) {
        String businessData = process.getBusinessData();
        if (businessData == null || businessData.isBlank()) {
            throw new BusinessException("处置业务数据为空，无法执行处置操作");
        }
        try {
            T dto = objectMapper.readValue(businessData, dtoClass);
            action.accept(dto);
        } catch (JsonProcessingException e) {
            throw new BusinessException("处置业务数据解析失败: " + e.getMessage());
        }
    }
}
