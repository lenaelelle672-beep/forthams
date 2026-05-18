package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ApprovalCreateDTO;
import com.ams.dto.AssetClearanceDTO;
import com.ams.dto.AssetScrapDTO;
import com.ams.dto.AssetTransferDTO;
import com.ams.dto.CompensationCreateDTO;
import com.ams.entity.AssetCompensation;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.ApprovalRecord;
import com.ams.entity.WorkflowDefinition;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.ApprovalRecordMapper;
import com.ams.mapper.UserRoleMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
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
    private static final String WORKFLOW_PAYLOAD_KEY = "_approvalPayload";
    private static final String WORKFLOW_DEFINITION_KEY = "_workflowDefinition";
    private static final String WORKFLOW_DEFINITION_ID_KEY = "_workflowDefinitionId";
    private static final String WORKFLOW_VERSION_KEY = "_workflowVersion";
    private static final Set<String> WORKFLOW_MANAGED_PROCESS_TYPES = Set.of(
            "ASSET_TRANSFER",
            "ASSET_CLEARANCE",
            "ASSET_SCRAP",
            "ASSET_COMPENSATION"
    );

    private final ApprovalProcessMapper approvalProcessMapper;
    private final ApprovalRecordMapper approvalRecordMapper;
    private final RetirementApplicationService retirementApplicationService;
    private final WorkOrderService workOrderService;
    private final DisposalService disposalService;
    private final CompensationService compensationService;
    private final WorkflowDefinitionService workflowDefinitionService;
    private final UserRoleMapper userRoleMapper;
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
        if (dto.getProcessType() != null && WORKFLOW_MANAGED_PROCESS_TYPES.contains(dto.getProcessType())) {
            if (dto.getBusinessType() != null && !dto.getBusinessType().isBlank()
                    && !dto.getProcessType().equals(dto.getBusinessType())) {
                throw new BusinessException("业务流程类型与审批流程类型不一致");
            }
            WorkflowDefinition definition = workflowDefinitionService.requirePublishedDefinition(dto.getProcessType());
            dto.setBusinessType(dto.getProcessType());
            dto.setBusinessData(bindWorkflowSnapshot(dto.getBusinessData(), definition));
        }

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
        String processStatus = BeanUtil.getProperty(process, "status") instanceof String s ? s : String.valueOf(BeanUtil.getProperty(process, "status"));
        if (!"PENDING".equals(processStatus)) {
            switch (processStatus) {
                case "APPROVED":
                    throw new BusinessException("审批流程已通过，不可重复审批");
                case "REJECTED":
                    throw new BusinessException("审批流程已驳回，不可再次审批");
                case "CANCELLED":
                    throw new BusinessException("审批流程已取消，不可审批");
                default:
                    throw new BusinessException("当前流程状态[" + processStatus + "]不可审批");
            }
        }
        if (!"APPROVED".equals(result) && !"REJECTED".equals(result)) {
            throw new BusinessException("审批结果无效");
        }

        Integer currentStep = parseInteger(BeanUtil.getProperty(process, "currentStep"), 1);
        WorkflowDefinitionService.WorkflowRuntimePlan workflowPlan = resolveWorkflowRuntimePlan(process);
        WorkflowDefinitionService.WorkflowApprovalNode currentWorkflowNode = workflowPlan == null ? null : workflowPlan.nodeAtStep(currentStep);
        ensureWorkflowApproverAllowed(currentWorkflowNode, approverId);
        List<ApprovalRecord> currentStepRecords = selectCurrentStepRecords(processId, tenantId, currentStep);
        if (hasApprovedCurrentStep(currentStepRecords, approverId)) {
            throw new BusinessException("当前步骤已审批");
        }

        ApprovalRecord record = new ApprovalRecord();
        BeanUtil.setProperty(record, "processId", processId);
        BeanUtil.setProperty(record, "tenantId", tenantId);
        int finalStep = resolveFinalStep(process, workflowPlan);
        BeanUtil.setProperty(record, "stepNo", currentStep);
        BeanUtil.setProperty(record, "approverId", approverId);
        BeanUtil.setProperty(record, "approveResult", result);
        BeanUtil.setProperty(record, "approveOpinion", opinion);
        BeanUtil.setProperty(record, "approveTime", LocalDateTime.now());
        approvalRecordMapper.insert(record);

        if ("REJECTED".equals(result)) {
            BeanUtil.setProperty(process, "status", "REJECTED");
        } else if ("APPROVED".equals(result)) {
            if (isApprovalStepComplete(currentWorkflowNode, currentStepRecords, approverId)) {
                if (currentStep >= finalStep) {
                    BeanUtil.setProperty(process, "status", "APPROVED");
                } else {
                    BeanUtil.setProperty(process, "currentStep", currentStep + 1);
                }
            }
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

        Set<String> processedStepKeys = (myRecords == null ? List.<ApprovalRecord>of() : myRecords).stream()
            .map(item -> stepKey(
                    parseLong(BeanUtil.getProperty(item, "processId"), null),
                    parseInteger(BeanUtil.getProperty(item, "stepNo"), null)))
            .filter(key -> key != null)
            .collect(Collectors.toSet());
        return pendingList.stream()
            .filter(item -> {
                Long id = parseLong(BeanUtil.getProperty(item, "id"), null);
                Integer currentStep = parseInteger(BeanUtil.getProperty(item, "currentStep"), 1);
                return id == null || !processedStepKeys.contains(stepKey(id, currentStep));
            })
            .filter(item -> canApproveCurrentWorkflowNode(item, approverId))
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

    /**
     * Cancel a PENDING approval process.
     *
     * <p>Only processes in PENDING status can be cancelled. Cancellation
     * updates the process status to CANCELLED and triggers the
     * appropriate business rejection callbacks so downstream state
     * stays consistent.
     *
     * @param processId  the approval process ID
     * @param operatorId the user performing the cancellation
     * @return the updated process
     * @throws BusinessException if the process does not exist or is not PENDING
     */
    @Transactional(rollbackFor = Exception.class)
    public ApprovalProcess cancelProcess(Long processId, Long operatorId) {
        String tenantId = TenantContext.requireTenantId();
        ApprovalProcess process = approvalProcessMapper.selectOne(new QueryWrapper<ApprovalProcess>()
                .eq("id", processId)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (process == null) {
            throw new BusinessException("审批流程不存在");
        }
        String processStatus = BeanUtil.getProperty(process, "status") instanceof String s ? s : String.valueOf(BeanUtil.getProperty(process, "status"));
        if (!"PENDING".equals(processStatus)) {
            throw new BusinessException("仅PENDING状态的流程可取消");
        }

        BeanUtil.setProperty(process, "status", "CANCELLED");
        approvalProcessMapper.updateById(process);

        // Trigger business-side cancellation via the rejection handler
        handleRejection(process, operatorId, "流程已取消");

        return process;
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

    private String stepKey(Long processId, Integer stepNo) {
        if (processId == null || stepNo == null) {
            return null;
        }
        return processId + ":" + stepNo;
    }

    private boolean isWorkflowManaged(ApprovalProcess process) {
        return process.getProcessType() != null && WORKFLOW_MANAGED_PROCESS_TYPES.contains(process.getProcessType());
    }

    private WorkflowDefinitionService.WorkflowRuntimePlan resolveWorkflowRuntimePlan(ApprovalProcess process) {
        if (!isWorkflowManaged(process)) {
            return null;
        }
        String businessPayload = extractWorkflowPayloadJson(process.getBusinessData());
        String workflowDefinitionJson = extractWorkflowDefinitionJson(process.getBusinessData());
        if (workflowDefinitionJson != null) {
            return workflowDefinitionService.requireRuntimePlan(workflowDefinitionJson, businessPayload);
        }
        return workflowDefinitionService.requirePublishedRuntimePlan(process.getProcessType(), businessPayload);
    }

    private int resolveFinalStep(ApprovalProcess process) {
        return resolveFinalStep(process, resolveWorkflowRuntimePlan(process));
    }

    private int resolveFinalStep(ApprovalProcess process, WorkflowDefinitionService.WorkflowRuntimePlan workflowPlan) {
        if ("RETIREMENT".equals(process.getProcessType()) && process.getBusinessId() != null) {
            return retirementApplicationService.getApprovalStepCount(process.getBusinessId());
        }
        if ("WORK_ORDER".equals(process.getProcessType())) {
            return 1;
        }
        if (isWorkflowManaged(process)) {
            WorkflowDefinitionService.WorkflowRuntimePlan plan = workflowPlan == null ? resolveWorkflowRuntimePlan(process) : workflowPlan;
            return plan == null ? FINAL_STEP : plan.finalStep(FINAL_STEP);
        }
        return FINAL_STEP;
    }

    private List<ApprovalRecord> selectCurrentStepRecords(Long processId, String tenantId, Integer currentStep) {
        List<ApprovalRecord> records = approvalRecordMapper.selectList(
            new QueryWrapper<ApprovalRecord>()
                .eq("process_id", processId)
                .eq("tenant_id", tenantId)
                .eq("step_no", currentStep)
        );
        return records == null ? List.of() : records;
    }

    private boolean hasApprovedCurrentStep(List<ApprovalRecord> currentStepRecords, Long approverId) {
        if (approverId == null) {
            return false;
        }
        return currentStepRecords.stream()
                .anyMatch(record -> approverId.equals(parseLong(BeanUtil.getProperty(record, "approverId"), null)));
    }

    private boolean canApproveCurrentWorkflowNode(ApprovalProcess process, Long approverId) {
        try {
            WorkflowDefinitionService.WorkflowRuntimePlan plan = resolveWorkflowRuntimePlan(process);
            if (plan == null) {
                return true;
            }
            Integer currentStep = parseInteger(BeanUtil.getProperty(process, "currentStep"), 1);
            return isApproverAllowedForNode(plan.nodeAtStep(currentStep), approverId);
        } catch (BusinessException ex) {
            return false;
        }
    }

    private boolean isApproverAllowedForNode(WorkflowDefinitionService.WorkflowApprovalNode node, Long approverId) {
        if (node == null || approverId == null) {
            return true;
        }
        if (node.approverRole() == null || node.approverRole().isBlank()) {
            return true;
        }
        List<Long> roleApproverIds = resolveRoleApproverIds(node.approverRole());
        return !roleApproverIds.isEmpty() && roleApproverIds.contains(approverId);
    }

    private boolean isApprovalStepComplete(WorkflowDefinitionService.WorkflowApprovalNode node,
                                           List<ApprovalRecord> currentStepRecords,
                                           Long approverId) {
        if (node == null || !"all".equals(node.approvalMode())) {
            return true;
        }

        List<Long> requiredApproverIds = resolveRoleApproverIds(node.approverRole());
        if (requiredApproverIds.isEmpty()) {
            throw new BusinessException("审批角色未配置审批人");
        }

        Set<Long> approvedApproverIds = currentStepRecords.stream()
                .filter(record -> "APPROVED".equals(BeanUtil.getProperty(record, "approveResult")))
                .map(record -> parseLong(BeanUtil.getProperty(record, "approverId"), null))
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        if (approverId != null) {
            approvedApproverIds.add(approverId);
        }
        return approvedApproverIds.containsAll(requiredApproverIds);
    }

    private List<Long> resolveRoleApproverIds(String approverRole) {
        if (approverRole == null || approverRole.isBlank() || userRoleMapper == null) {
            return List.of();
        }
        List<Long> approverIds = userRoleMapper.selectActiveUserIdsByRole(approverRole);
        if (approverIds == null || approverIds.isEmpty()) {
            return List.of();
        }
        return approverIds.stream()
                .filter(id -> id != null)
                .distinct()
                .toList();
    }

    private void ensureWorkflowApproverAllowed(WorkflowDefinitionService.WorkflowApprovalNode node, Long approverId) {
        if (node == null || approverId == null) {
            return;
        }
        if (node.approverRole() == null || node.approverRole().isBlank()) {
            return;
        }
        List<Long> roleApproverIds = resolveRoleApproverIds(node.approverRole());
        if (roleApproverIds.isEmpty()) {
            throw new BusinessException("审批角色未配置审批人");
        }
        if (!roleApproverIds.contains(approverId)) {
            throw new BusinessException("当前用户不属于节点审批角色");
        }
    }

    private String bindWorkflowSnapshot(String businessData, WorkflowDefinition definition) {
        Map<String, Object> wrapped = new HashMap<>();
        wrapped.put(WORKFLOW_PAYLOAD_KEY, parseJsonValue(firstJson(businessData), "审批业务数据解析失败"));
        wrapped.put(WORKFLOW_DEFINITION_ID_KEY, definition.getId());
        wrapped.put(WORKFLOW_VERSION_KEY, definition.getVersion());
        wrapped.put(WORKFLOW_DEFINITION_KEY, parseJsonValue(definition.getDefinitionJson(), "流程定义解析失败"));
        return toJson(wrapped, "审批业务数据序列化失败");
    }

    private String extractWorkflowPayloadJson(String businessData) {
        if (businessData == null || businessData.isBlank()) {
            return "{}";
        }
        Object parsed = parseJsonValue(businessData, "审批业务数据解析失败");
        if (parsed instanceof Map<?, ?> data && data.containsKey(WORKFLOW_PAYLOAD_KEY)) {
            return toJson(data.get(WORKFLOW_PAYLOAD_KEY), "审批业务数据序列化失败");
        }
        return businessData;
    }

    private String extractWorkflowDefinitionJson(String businessData) {
        if (businessData == null || businessData.isBlank()) {
            return null;
        }
        Object parsed = parseJsonValue(businessData, "审批业务数据解析失败");
        if (parsed instanceof Map<?, ?> data && data.containsKey(WORKFLOW_DEFINITION_KEY)) {
            return toJson(data.get(WORKFLOW_DEFINITION_KEY), "流程定义序列化失败");
        }
        return null;
    }

    private String firstJson(String json) {
        return json == null || json.isBlank() ? "{}" : json;
    }

    private Object parseJsonValue(String json, String message) {
        try {
            return objectMapper.readValue(json, Object.class);
        } catch (JsonProcessingException e) {
            throw new BusinessException(message + ": " + e.getMessage());
        }
    }

    private String toJson(Object value, String message) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new BusinessException(message + ": " + e.getMessage());
        }
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
            case "ASSET_COMPENSATION":
                handleDisposalOutcome(process, CompensationCreateDTO.class, dto -> {
                    AssetCompensation compensation = compensationService.createCompensation((CompensationCreateDTO) dto);
                    compensationService.updateStatus(compensation.getId(), "APPROVED");
                });
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
            T dto = objectMapper.readerFor(dtoClass)
                    .without(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                    .readValue(extractWorkflowPayloadJson(businessData));
            action.accept(dto);
        } catch (JsonProcessingException e) {
            throw new BusinessException("处置业务数据解析失败: " + e.getMessage());
        }
    }
}
