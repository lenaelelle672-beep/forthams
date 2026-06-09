package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.common.exception.ConflictException;
import com.ams.context.TenantContext;
import com.ams.dto.ApprovalCreateDTO;
import com.ams.dto.AssetClearanceDTO;
import com.ams.dto.AssetScrapDTO;
import com.ams.dto.AssetTransferDTO;
import com.ams.dto.CompensationCreateDTO;
import com.ams.entity.AssetCompensation;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.ApprovalRecord;
import com.ams.entity.NotificationRecord;
import com.ams.entity.Role;
import com.ams.entity.WorkflowDefinition;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.ApprovalRecordMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.RoleMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ThreadLocalRandom;
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
import com.ams.annotation.DataScope;
import com.ams.event.ApprovalProcessEvent;
@Service
@RequiredArgsConstructor
public class ApprovalService {

    private static final Logger log = LoggerFactory.getLogger(ApprovalService.class);
    private static final int FINAL_STEP = 3;
    private final Cache<String, String> roleNameCache = Caffeine.newBuilder()
            .expireAfterWrite(10, TimeUnit.MINUTES)
            .maximumSize(100)
            .recordStats()
            .build();
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
    private final RoleMapper roleMapper;    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * 分页查询审批流程列表。
     *
     * @param page        页码（从 1 开始）
     * @param pageSize    每页条数
     * @param status      流程状态过滤（PENDING/APPROVED/REJECTED），为空则不过滤
     * @param processType 流程类型过滤（RETIREMENT/WORK_ORDER/ASSET_TRANSFER 等），为空则不过滤
     * @return 分页审批流程结果
     */
    @DataScope(userColumn = "applicant_id")
    public Page<ApprovalProcess> queryProcesses(Integer page, Integer pageSize, String status, String processType, Long applicantId, String keyword) {
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
        if (applicantId != null) {
            wrapper.eq("applicant_id", applicantId);
        }
        if (keyword != null && !keyword.isBlank()) {
            String trimmedKeyword = keyword.trim();
            wrapper.and(w -> w.like("process_no", trimmedKeyword)
                    .or().like("process_type", trimmedKeyword)
                    .or().like("business_data", trimmedKeyword));
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
        WorkflowDefinitionService.WorkflowRuntimePlan workflowPlan = safeResolveWorkflowRuntimePlan(process);
        result.put("workflowRuntimePath", workflowPlan == null ? List.of() : toWorkflowRuntimePath(workflowPlan));
        result.put("workflowResultAction", workflowPlan == null ? "" : workflowPlan.resultAction());
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
        BeanUtil.setProperty(process, "status", "PENDING");
        BeanUtil.setProperty(process, "currentStep", 1);
        BeanUtil.setProperty(process, "applyTime", LocalDateTime.now());

        int retries = 3;
        while (retries > 0) {
            try {
                BeanUtil.setProperty(process, "processNo", generateProcessNo());
                approvalProcessMapper.insert(process);
                break;
            } catch (DataIntegrityViolationException e) {
                retries--;
                if (retries == 0) throw e;
                log.warn("approval_process_no_conflict_retrying: remaining={}", retries);
            }
        }
        // 审批创建成功后，发布 CC 提交通知（仅工作流管理的流程类型）
        publishCcSubmittedEvent(process);
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
        String processStatus = safeGetStringProperty(process, "status", "");
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
        List<ApprovalRecord> currentStepRecords = selectCurrentStepRecords(processId, tenantId, currentStep);
        ensureWorkflowApproverAllowed(currentWorkflowNode, approverId, currentStepRecords);
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

        int rows = approvalProcessMapper.updateById(process);
        if (rows == 0) {
            log.warn("乐观锁冲突: processId={}, version={}", process.getId(), process.getVersion());
            throw new ConflictException("审批数据已被其他操作修改，请刷新后重试");
        }
        // 发布审批事件供 NotificationEventListener 异步处理
        try {
            ApprovalProcessEvent approvalEvent = new ApprovalProcessEvent(
                process.getId(),
                process.getProcessNo(),
                process.getProcessType(),
                currentStep,
                finalStep,
                result,
                approverId,
                null,
                process.getApplicantId(),
                process.getBusinessData(),
                tenantId,
                LocalDateTime.now());
            eventPublisher.publishEvent(approvalEvent);
        } catch (Exception e) {
            log.error("发布审批事件异常，不阻塞主流程: processId={}", process.getId(), e);
        }
        handleBusinessOutcome(process, approverId, result, opinion);
        sendApprovalNotification(process, approverId, result);
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
        return getMyPendingApprovals(approverId, new Page<>(1, 100));
    }

    /**
     * 获取指定审批人待审批的流程列表（分页版本）。
     *
     * <p>使用 NOT EXISTS 子查询排除该审批人已经处理过的流程，
     * 避免全量查询+内存过滤导致 OOM。
     *
     * @param approverId 审批人 ID
     * @param page       分页参数
     * @return 未被该审批人处理过的待审批流程列表
     */
    public List<ApprovalProcess> getMyPendingApprovals(Long approverId, Page<ApprovalProcess> page) {
        String tenantId = TenantContext.requireTenantId();

        if (approverId == null) {
            Page<ApprovalProcess> result = approvalProcessMapper.selectPage(page,
                new QueryWrapper<ApprovalProcess>()
                    .eq("tenant_id", tenantId)
                    .eq("status", "PENDING")
                    .orderByDesc("create_time")
            );
            return result.getRecords();
        }

        // 使用 NOT EXISTS 子查询排除已审批过的流程
        List<ApprovalProcess> pendingList = approvalProcessMapper.selectPendingNotProcessed(tenantId, approverId, page);
        if (pendingList.isEmpty()) {
            return pendingList;
        }

        // workflow 节点权限过滤仍需在内存中进行
        return pendingList.stream()
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

    /** 按流程类型分组统计（总数/通过数/驳回数/审批中数/取消数） */
    public List<Map<String, Object>> getProcessTypeStats() {
        String tenantId = TenantContext.requireTenantId();
        // 使用 SQL GROUP BY 替代全量 selectList + 内存 HashMap 分组，避免 OOM
        QueryWrapper<ApprovalProcess> qw = new QueryWrapper<>();
        qw.eq("tenant_id", tenantId)
                .select("process_type, status, COUNT(*) as cnt")
                .groupBy("process_type", "status");
        List<Map<String, Object>> rows = approvalProcessMapper.selectMaps(qw);

        Map<String, Map<String, Object>> grouped = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            if (row.get("process_type") == null) continue;
            String type = row.get("process_type").toString();
            String status = row.get("status") != null ? row.get("status").toString() : "UNKNOWN";
            long cnt = row.get("cnt") != null ? ((Number) row.get("cnt")).longValue() : 0L;

            grouped.putIfAbsent(type, new HashMap<>(Map.of(
                    "processType", type,
                    "total", 0L, "approved", 0L, "rejected", 0L, "pending", 0L, "cancelled", 0L)));
            Map<String, Object> stat = grouped.get(type);
            stat.put("total", ((Number) stat.get("total")).longValue() + cnt);
            switch (status) {
                case "APPROVED" -> stat.put("approved", ((Number) stat.get("approved")).longValue() + cnt);
                case "REJECTED" -> stat.put("rejected", ((Number) stat.get("rejected")).longValue() + cnt);
                case "CANCELLED" -> stat.put("cancelled", ((Number) stat.get("cancelled")).longValue() + cnt);
                default -> stat.put("pending", ((Number) stat.get("pending")).longValue() + cnt);
            }
        }
        return new ArrayList<>(grouped.values());
    }

    /**
     * Cancel a PENDING approval process.
     *
     * <p>Only processes in PENDING status can be cancelled. Cancellation
     * updates the process status to CANCELLED and triggers the
     * appropriate business cancellation callbacks so downstream state
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
        String processStatus = safeGetStringProperty(process, "status", "");
        if (!"PENDING".equals(processStatus)) {
            throw new BusinessException("仅PENDING状态的流程可取消");
        }

        // 检查是否已有审批记录（防止已操作的流程被随意取消）
        if (hasAnyApprovalRecords(processId)) {
            throw new BusinessException("审批流程已有处理记录，无法取消，请联系管理员");
        }

        BeanUtil.setProperty(process, "status", "CANCELLED");
        int rows = approvalProcessMapper.updateById(process);
        if (rows == 0) {
            log.warn("乐观锁冲突: cancelProcess processId={}, version={}", process.getId(), process.getVersion());
            throw new ConflictException("审批数据已被其他操作修改，请重试");
        }

        handleCancellation(process, operatorId, "流程已取消");

        return process;
    }

    private String generateProcessNo() {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "APR-" + dateStr + "-";
        return prefix + String.format("%05d", ThreadLocalRandom.current().nextInt(1, 99999)) + '-' + System.currentTimeMillis() % 10000;
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

    /**
     * 安全获取 BeanUtil.getProperty 返回的 String 值。
     * <p>BeanUtil.getProperty 返回 Object，直接赋值 String 有 ClassCastException 风险。
     * 此方法统一处理 null → defaultValue、String → 自身、其他 → toString。</p>
     */
    private String safeGetStringProperty(Object bean, String propertyName, String defaultValue) {
        Object value = BeanUtil.getProperty(bean, propertyName);
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof String s) {
            return s;
        }
        return String.valueOf(value);
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

    private WorkflowDefinitionService.WorkflowRuntimePlan safeResolveWorkflowRuntimePlan(ApprovalProcess process) {
        try {
            return resolveWorkflowRuntimePlan(process);
        } catch (BusinessException ex) {
            return null;
        }
    }

    private List<Map<String, Object>> toWorkflowRuntimePath(WorkflowDefinitionService.WorkflowRuntimePlan workflowPlan) {
        List<WorkflowDefinitionService.WorkflowApprovalNode> nodes = workflowPlan.approvalNodes();
        Map<String, String> roleNameMap = batchResolveRoleNames(nodes);
        return nodes.stream()
                .map(node -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("stepNo", node.stepNo());
                    item.put("nodeId", node.nodeId());
                    item.put("nodeCode", node.nodeCode());
                    item.put("label", node.label());
                    item.put("approverRole", node.approverRole());
                    item.put("approverRoleName", resolveRoleName(node.approverRole(), roleNameMap));
                    item.put("approvalMode", node.approvalMode());
                    item.put("approverType", node.approverType());
                    item.put("approverId", node.approverId());
                    return item;
                })
                .toList();
    }

    private Map<String, String> batchResolveRoleNames(List<WorkflowDefinitionService.WorkflowApprovalNode> nodes) {
        Set<String> uniqueCodes = nodes.stream()
                .map(WorkflowDefinitionService.WorkflowApprovalNode::approverRole)
                .filter(code -> code != null && !code.isEmpty())
                .collect(Collectors.toSet());
        if (uniqueCodes.isEmpty()) {
            return Collections.emptyMap();
        }
        Set<String> uncached = uniqueCodes.stream()
                .filter(code -> roleNameCache.getIfPresent(code) == null)
                .collect(Collectors.toSet());
        if (!uncached.isEmpty()) {
            try {
                List<Role> roles = roleMapper.selectList(
                        new QueryWrapper<Role>().in("role_code", uncached));
                for (Role role : roles == null ? Collections.<Role>emptyList() : roles) {
                    if (role != null && role.getRoleCode() != null && role.getRoleName() != null) {
                        roleNameCache.put(role.getRoleCode(), role.getRoleName());
                    }
                }
            } catch (Exception e) {
                log.warn("批量查询角色中文名失败", e);
            }
        }
        Map<String, String> result = new HashMap<>();
        for (String code : uniqueCodes) {
            String name = roleNameCache.getIfPresent(code);
            if (name != null) {
                result.put(code, name);
            }
        }
        return result;
    }

    private String resolveRoleName(String roleCode, Map<String, String> roleNameMap) {
        if (roleCode == null || roleCode.isEmpty()) {
            return null;
        }
        return roleNameMap.get(roleCode);
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
        if ("user".equals(node.approverType())) {
            Long configuredApproverId = parseLong(node.approverId(), null);
            return configuredApproverId != null && configuredApproverId.equals(approverId);
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
        if (node == null) {
            return true;
        }
        if ("sequence".equals(node.approvalMode())) {
            // sequence 模式：当前审批人通过即步骤完成（逐人推进）
            // 顺序控制由 ensureWorkflowApproverAllowed 中的 sequence 校验负责
            List<Long> roleApproverIds = resolveRoleApproverIds(node.approverRole());
            if (roleApproverIds.isEmpty()) {
                return true;
            }
            return roleApproverIds.contains(approverId);
        }
        if ("count".equals(node.approvalMode())) {
            // count 模式：达到指定审批人数即步骤完成
            int threshold = node.countThreshold();
            if (threshold <= 0) {
                throw new BusinessException("count 模式 countThreshold(" + threshold + ")必须大于 0");
            }
            // 运行时校验：countThreshold 不能超过当前审批人数
            List<Long> roleApproverIds = resolveRoleApproverIds(node.approverRole());
            if (!roleApproverIds.isEmpty() && threshold > roleApproverIds.size()) {
                log.error("count 模式 countThreshold({}) 超过当前审批人数({}), 节点: {}",
                        threshold, roleApproverIds.size(), node.nodeCode());
                throw new BusinessException("countThreshold(" + threshold + ")不能超过当前审批人数(" + roleApproverIds.size() + ")");
            }
            Set<Long> approvedIds = currentStepRecords.stream()
                    .filter(r -> "APPROVED".equals(safeGetStringProperty(r, "approveResult", "")))
                    .map(r -> parseLong(BeanUtil.getProperty(r, "approverId"), null))
                    .filter(id -> id != null)
                    .collect(Collectors.toSet());
            if (approverId != null) {
                approvedIds.add(approverId);
            }
            boolean complete = approvedIds.size() >= threshold;
            log.debug("count 模式审批: 已通过 {} 人, 阈值 {}, 步骤完成: {}",
                    approvedIds.size(), threshold, complete);
            return complete;
        }
        if (!"all".equals(node.approvalMode())) {
            return true;
        }
        if ("user".equals(node.approverType())) {
            Long configuredApproverId = parseLong(node.approverId(), null);
            return configuredApproverId != null && configuredApproverId.equals(approverId);
        }

        List<Long> requiredApproverIds = resolveRoleApproverIds(node.approverRole());
        if (requiredApproverIds.isEmpty()) {
            throw new BusinessException("审批角色未配置审批人");
        }

        Set<Long> approvedApproverIds = currentStepRecords.stream()
                .filter(record -> "APPROVED".equals(safeGetStringProperty(record, "approveResult", "")))
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

    private void ensureWorkflowApproverAllowed(WorkflowDefinitionService.WorkflowApprovalNode node,
                                               Long approverId,
                                               List<ApprovalRecord> currentStepRecords) {
        if (node == null || approverId == null) {
            return;
        }
        if ("user".equals(node.approverType())) {
            Long configuredApproverId = parseLong(node.approverId(), null);
            if (configuredApproverId == null) {
                throw new BusinessException("节点指定审批人无效");
            }
            if (!configuredApproverId.equals(approverId)) {
                throw new BusinessException("当前用户不是节点指定审批人");
            }
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
        // sequence 模式顺序校验：当前审批人必须是按 approverId 自然排序后第一个未审批的人
        if ("sequence".equals(node.approvalMode()) && "role".equals(node.approverType())) {
            List<Long> sortedRoleApproverIds = roleApproverIds.stream().sorted().toList();
            Set<Long> approvedIds = currentStepRecords.stream()
                    .filter(r -> "APPROVED".equals(safeGetStringProperty(r, "approveResult", "")))
                    .map(r -> parseLong(BeanUtil.getProperty(r, "approverId"), null))
                    .filter(id -> id != null)
                    .collect(Collectors.toSet());
            for (Long expectedApproverId : sortedRoleApproverIds) {
                if (!approvedIds.contains(expectedApproverId)) {
                    if (!expectedApproverId.equals(approverId)) {
                        throw new BusinessException("sequence 模式下必须按顺序审批，当前不是您的审批轮次");
                    }
                    return;
                }
            }
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
            case "ASSET_TRANSFER":
            case "ASSET_CLEARANCE":
            case "ASSET_SCRAP":
                // 资产处置类驳回：资产尚未变更状态，仅记录日志
                log.info("审批驳回: processType={}, businessId={}", process.getProcessType(), process.getBusinessId());
                break;
            case "ASSET_COMPENSATION":
                // 赔偿驳回：仅在赔偿记录已创建（businessId 对应有效的 AssetCompensation）时更新状态
                if (process.getBusinessId() != null) {
                    try {
                        compensationService.updateStatus(process.getBusinessId(), "REJECTED");
                    } catch (BusinessException ignored) {
                        log.warn("赔偿驳回：赔偿记录不存在或已处理, businessId={}", process.getBusinessId());
                    }
                }
                break;
            default:
                break;
        }
    }

    private void handleCancellation(ApprovalProcess process, Long operatorId, String opinion) {
        switch (process.getProcessType()) {
            case "RETIREMENT":
                retirementApplicationService.cancelApplication(process.getBusinessId(), operatorId);
                break;
            case "WORK_ORDER":
                workOrderService.applyApprovalOutcome(process.getBusinessId(), "CANCELLED", opinion);
                break;
            case "ASSET_TRANSFER":
            case "ASSET_CLEARANCE":
            case "ASSET_SCRAP":
                log.info("审批取消: processType={}, businessId={}", process.getProcessType(), process.getBusinessId());
                break;
            case "ASSET_COMPENSATION":
                if (process.getBusinessId() != null) {
                    try {
                        compensationService.updateStatus(process.getBusinessId(), "CANCELLED");
                    } catch (BusinessException ignored) {
                        log.warn("赔偿取消：赔偿记录不存在或已处理, businessId={}", process.getBusinessId());
                    }
                }
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

    /**
     * 审批完成后发送通知给申请人
     */
    /**
     * 检查审批流程是否已有审批记录。
     *
     * <p>用于 cancelProcess 前置校验，防止已有人处理过的审批流程被随意取消。
     *
     * @param processId 审批流程 ID
     * @return 如果存在至少一条审批记录返回 true，否则返回 false
     */
    private boolean hasAnyApprovalRecords(Long processId) {
        if (processId == null) {
            return false;
        }
        try {
            Long count = approvalRecordMapper.selectCount(
                new QueryWrapper<ApprovalRecord>()
                    .eq("process_id", processId)
            );
            return count != null && count > 0;
        } catch (Exception e) {
            log.warn("failed_to_check_approval_records_for_process: {}, error: {}", processId, e.getMessage());
            // fail-safe: 无法验证时默认有记录，避免误取消
            return true;
        }
    }

    private void sendApprovalNotification(ApprovalProcess process, Long approverId, String result) {
        try {
            // 双重通知防护：退休流程由 NotificationService 的退休通知域方法处理，此处跳过
            if ("RETIREMENT".equals(process.getProcessType())) {
                return;
            }

            Long applicantId = process.getApplicantId();
            if (applicantId == null || applicantId.equals(approverId)) {
                return;
            }
            String action = "APPROVED".equals(result) ? "通过" : "驳回";
            String processLabel = switch (process.getProcessType()) {
                case "RETIREMENT" -> "退役申请";
                case "WORK_ORDER" -> "工单审批";
                case "ASSET_TRANSFER" -> "资产转移";
                case "ASSET_CLEARANCE" -> "资产清退";
                case "ASSET_SCRAP" -> "资产报废";
                case "ASSET_COMPENSATION" -> "资产赔偿";
                default -> "审批流程";
            };
            NotificationRecord notification = new NotificationRecord();
            notification.setUserId(applicantId);
            notification.setTitle("审批结果通知");
            notification.setContent("您的" + processLabel + "（编号：" + process.getProcessNo() + "）已被" + action);
            notification.setType("APPROVAL");
            notification.setCategory("WORKFLOW");
            notification.setRefId(process.getId());
            notification.setRefType("APPROVAL_PROCESS");
            notificationService.create(notification);
        } catch (Exception e) {
            // 通知发送失败不影响主业务流程
            log.error("发送审批通知失败: processId={}", process.getId(), e);
        }
    }

    /**
     * 发布 CC 提交通知事件。
     * <p>审批流程创建成功后，获取工作流运行时计划第一个节点的 CC 配置，
     * 发布 SUBMITTED 事件，由 NotificationEventListener 异步发送 CC 通知。</p>
     */
    private void publishCcSubmittedEvent(ApprovalProcess process) {
        if (!isWorkflowManaged(process)) {
            return;
        }
        try {
            WorkflowDefinitionService.WorkflowRuntimePlan plan = resolveWorkflowRuntimePlan(process);
            String ccRoleCodes = null;
            String ccUserIds = null;
            if (plan != null && !plan.approvalNodes().isEmpty()) {
                WorkflowDefinitionService.WorkflowApprovalNode firstNode = plan.nodeAtStep(1);
                if (firstNode != null) {
                    ccRoleCodes = firstNode.ccRoleCodes();
                    ccUserIds = firstNode.ccUserIds();
                }
            }
            if ((ccRoleCodes == null || ccRoleCodes.isBlank())
                    && (ccUserIds == null || ccUserIds.isBlank())) {
                return; // 无 CC 配置，不发布事件
            }
            String tenantId = TenantContext.requireTenantId();
            ApprovalProcessEvent event = new ApprovalProcessEvent(
                    process.getId(),
                    process.getProcessNo(),
                    process.getProcessType(),
                    null, null,
                    "SUBMITTED",
                    null, null,
                    process.getApplicantId(),
                    process.getBusinessData(),
                    tenantId,
                    LocalDateTime.now(),
                    ccRoleCodes,
                    ccUserIds);
            eventPublisher.publishEvent(event);
            log.info("CC 提交通知事件已发布: processId={}, ccRoleCodes={}, ccUserIds={}",
                    process.getId(), ccRoleCodes, ccUserIds);
        } catch (Exception e) {
            // CC 事件发布异常不阻塞流程创建
            log.warn("发布 CC 提交通知事件异常: processId={}", process.getId(), e);
        }
    }
}
