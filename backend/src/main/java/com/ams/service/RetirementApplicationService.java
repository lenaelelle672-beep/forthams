package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.RetirementApplyDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Asset;
import com.ams.entity.AssetCompensation;
import com.ams.entity.DisposalApplication;
import com.ams.entity.RetirementApplication;
import com.ams.entity.User;
import com.ams.enums.AssetStatus;
import com.ams.enums.CompensationStatus;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.AssetCompensationMapper;
import com.ams.mapper.DisposalApplicationMapper;
import com.ams.mapper.RetirementApplicationMapper;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RetirementApplicationService {

    private static final Logger log = LoggerFactory.getLogger(RetirementApplicationService.class);
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_HISTORY_RESULTS = 100;

    private final RetirementApplicationMapper retirementApplicationMapper;
    private final ApprovalProcessMapper approvalProcessMapper;
    private final AssetMapper assetMapper;
    private final AssetCompensationMapper assetCompensationMapper;
    private final DisposalApplicationMapper disposalApplicationMapper;
    private final AssetLifecycleService assetLifecycleService;
    private final AssetDataPermissionEvaluator assetDataPermissionEvaluator;
    private final TenantAuthorityService tenantAuthorityService;
    private final ApprovalAssignmentService approvalAssignmentService;

    @Transactional(rollbackFor = Exception.class)
    public RetirementApplication submitApplication(RetirementApplyDTO dto, Long applicantId) {
        validateApplyDTO(dto);
        requireApplicantActor(applicantId);
        Asset asset = lockAssetForCurrentTenant(dto.getAssetId(), "submitRetirementApplication");
        requireRetirementEligibleAsset(asset);
        ensureNoActiveRetirement(dto.getAssetId(), null);
        ensureNoActiveDisposal(dto.getAssetId());
        ensureNoActiveCompensation(dto.getAssetId());

        RetirementApplication application = buildApplication(dto, asset);
        application.setApplicantId(applicantId);
        application.setApplicantName(applicantId.toString());
        application.setStatus("PENDING");
        application.setCurrentApprovalStep(1);
        application.setTotalApprovalSteps(1);
        application.setVersion(0);

        application.setApplicationNo(generateApplicationNo());

        if (retirementApplicationMapper.insert(application) != 1 || application.getId() == null) {
            throw new BusinessException("退役申请创建失败");
        }

        ApprovalProcess approvalProcess = new ApprovalProcess();
        approvalProcess.setProcessNo(generateProcessNo());
        approvalProcess.setProcessType("RETIREMENT");
        approvalProcess.setBusinessId(application.getId());
        approvalProcess.setTenantId(application.getTenantId());
        approvalProcess.setStatus("PENDING");
        approvalProcess.setCurrentStep(1);
        approvalProcess.setApplicantId(applicantId);
        approvalProcess.setVersion(0);
        approvalProcess.setApplyTime(LocalDateTime.now());
        if (approvalProcessMapper.insert(approvalProcess) != 1 || approvalProcess.getId() == null) {
            throw new BusinessException("退役审批流程创建失败");
        }
        approvalAssignmentService.initializeForProcess(approvalProcess, "RETIREMENT");
        application.setTotalApprovalSteps(resolveApprovalStepCount(approvalProcess));
        updateApplicationAtomically(application, RetirementApplication.Status.PENDING, application.getAssetId());

        assetLifecycleService.transitionLoadedAsset(
                asset,
                AssetStatus.PENDING_RETIREMENT,
                "RETIREMENT_SUBMIT",
                dto.getReason(),
                applicantId,
                null);

        return application;
    }

    @Transactional(rollbackFor = Exception.class)
    public RetirementApplication createDraftApplication(RetirementApplyDTO dto, Long applicantId) {
        validateApplyDTO(dto);
        requireApplicantActor(applicantId);
        Asset asset = lockAssetForCurrentTenant(dto.getAssetId(), "createDraftRetirementApplication");
        requireRetirementEligibleAsset(asset);

        RetirementApplication application = buildApplication(dto, asset);
        application.setApplicantId(applicantId);
        application.setApplicantName(applicantId.toString());
        application.setStatus("DRAFT");
        application.setCurrentApprovalStep(0);
        application.setTotalApprovalSteps(1);
        application.setVersion(0);
        application.setApplicationNo(generateApplicationNo());
        if (retirementApplicationMapper.insert(application) != 1 || application.getId() == null) {
            throw new BusinessException("退役申请创建失败");
        }
        return application;
    }

    @Transactional(rollbackFor = Exception.class)
    public RetirementApplication submitExistingApplication(Long id, Long operatorId) {
        RetirementApplication application = getApplicationById(id);
        requireApplicantActor(operatorId);
        requireApplicant(application, operatorId);
        RetirementApplication.Status expectedStatus = statusOf(application);
        if (!isSubmittableStatus(expectedStatus)) {
            throw new BusinessException("报废申请仅DRAFT、REJECTED或需重提状态可提交");
        }
        Asset asset = lockAssetForCurrentTenant(application.getAssetId(), "submitExistingRetirementApplication");
        if (expectedStatus == RetirementApplication.Status.CANCELLED_REQUIRES_RESUBMISSION) {
            assetLifecycleService.rollbackRetirementStatus(
                    application.getAssetId(),
                    "RETIREMENT_REQUIRES_RESUBMISSION",
                    application.getReason(),
                    operatorId);
            asset = lockAssetForCurrentTenant(application.getAssetId(), "resubmitCancelledRetirementApplication");
        }
        requireRetirementEligibleAsset(asset);
        ensureNoActiveRetirement(application.getAssetId(), application.getId());
        ensureNoActiveDisposal(application.getAssetId());
        ensureNoActiveCompensation(application.getAssetId());

        application.setAssetName(asset.getAssetName());
        application.setAssetCode(asset.getAssetNo());
        ApprovalProcess approvalProcess = createPendingApprovalProcess(application, operatorId);
        transitionApplicationStatus(application, RetirementApplication.Status.PENDING);
        application.setCurrentApprovalStep(1);
        application.setTotalApprovalSteps(resolveApprovalStepCount(approvalProcess));
        updateApplicationAtomically(application, expectedStatus, application.getAssetId());

        assetLifecycleService.transitionLoadedAsset(
                asset,
                AssetStatus.PENDING_RETIREMENT,
                "RETIREMENT_SUBMIT",
                application.getReason(),
                operatorId,
                null);
        return application;
    }

    public Page<RetirementApplication> getMyApplications(Long applicantId, Integer page, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<RetirementApplication> pageObj = new Page<>(normalizePage(page), normalizePageSize(pageSize));
        LambdaQueryWrapper<RetirementApplication> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(RetirementApplication::getTenantId, tenantId)
                .eq(RetirementApplication::getApplicantId, applicantId);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        wrapper.orderByDesc(RetirementApplication::getCreateTime);
        return retirementApplicationMapper.selectPage(pageObj, wrapper);
    }

    public Page<RetirementApplication> queryApplications(Integer page, Integer pageSize, String status, Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        Page<RetirementApplication> pageObj = new Page<>(normalizePage(page), normalizePageSize(pageSize));
        LambdaQueryWrapper<RetirementApplication> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(RetirementApplication::getTenantId, tenantId);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        if (status != null && !status.isBlank()) {
            wrapper.eq(RetirementApplication::getStatus, parseStatus(status).name());
        }
        if (assetId != null) {
            loadAssetForCurrentTenant(assetId, "queryRetirementApplications");
            wrapper.eq(RetirementApplication::getAssetId, assetId);
        }
        wrapper.orderByDesc(RetirementApplication::getCreateTime);
        return retirementApplicationMapper.selectPage(pageObj, wrapper);
    }

    public RetirementApplication getApplicationById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        RetirementApplication application = retirementApplicationMapper.selectOne(
                new LambdaQueryWrapper<RetirementApplication>()
                        .eq(RetirementApplication::getId, id)
                        .eq(RetirementApplication::getTenantId, tenantId)
                        .last("limit 1"));
        if (application != null) {
            loadAssetForCurrentTenant(application.getAssetId(), "getRetirementApplicationById");
            return application;
        }

        application = retirementApplicationMapper.selectById(id);
        if (application == null) {
            throw new BusinessException("退役申请不存在");
        }
        TenantSecurityAudit.logCrossTenantAttempt(log, "getRetirementApplicationById", id, tenantId, application.getTenantId());
        throw new AccessDeniedException("Retirement application belongs to another tenant");
    }

    @Transactional(rollbackFor = Exception.class)
    public RetirementApplication updateApplication(Long id, RetirementApplyDTO dto) {
        RetirementApplication application = getApplicationById(id);
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        requireApplicant(application, currentUser.getId());
        RetirementApplication.Status expectedStatus = statusOf(application);
        if (!isEditableStatus(expectedStatus)) {
            throw new BusinessException("报废申请仅DRAFT或REJECTED状态可修改");
        }
        validateApplyDTO(dto);
        Long sourceAssetId = application.getAssetId();
        BeanUtil.copyProperties(dto, application, "id", "applicationNo", "status", "createTime", "updateTime");
        Asset asset = lockAssetForCurrentTenant(application.getAssetId(), "updateRetirementApplicationAsset");
        requireRetirementEligibleAsset(asset);
        application.setAssetName(asset.getAssetName());
        application.setAssetCode(asset.getAssetNo());
        updateApplicationAtomically(application, expectedStatus, sourceAssetId);
        return application;
    }

    @Transactional(rollbackFor = Exception.class)
    public void cancelApplication(Long id, Long operatorId) {
        RetirementApplication application = getApplicationById(id);
        requireApplicantActor(operatorId);
        requireApplicant(application, operatorId);
        RetirementApplication.Status currentStatus = statusOf(application);
        if (!isCancellableStatus(currentStatus)) {
            throw new BusinessException("报废申请仅DRAFT、PENDING、REJECTED或需重提状态可撤销");
        }
        boolean rollbackAssetStatus = isReviewingStatus(currentStatus)
                || currentStatus == RetirementApplication.Status.CANCELLED_REQUIRES_RESUBMISSION;
        if (isReviewingStatus(currentStatus)) {
            cancelPendingApprovalProcess(application);
        }
        transitionApplicationStatus(application, RetirementApplication.Status.CANCELLED);
        updateApplicationAtomically(application, currentStatus, application.getAssetId());

        if (rollbackAssetStatus) {
            assetLifecycleService.rollbackRetirementStatus(
                    application.getAssetId(),
                    "RETIREMENT_CANCELLED",
                    application.getReason(),
                    operatorId);
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public RetirementApplication approveApplication(Long id, Long operatorId) {
        throw new AccessDeniedException("退役终态必须通过受控审批流程处理");
    }

    @Transactional(rollbackFor = Exception.class)
    public RetirementApplication completeApplication(Long id, Long operatorId) {
        throw new AccessDeniedException("退役终态必须通过受控审批流程处理");
    }

    @Transactional(rollbackFor = Exception.class)
    public RetirementApplication rejectApplication(Long id, Long operatorId, String reason) {
        throw new AccessDeniedException("退役终态必须通过受控审批流程处理");
    }

    /** 只由 ApprovalService 在审批记录和流程终态均已写入后调用。 */
    @Transactional(rollbackFor = Exception.class)
    public RetirementApplication applyApprovalOutcome(Long id, String result, Long operatorId, String reason) {
        requirePermission("retirement:approve");
        RetirementApplication application = getApplicationById(id);
        requireApplicantNotApprover(application, operatorId);
        RetirementApplication.Status currentStatus = statusOf(application);
        if (!isReviewingStatus(currentStatus)) {
            throw new BusinessException("当前报废申请不可处理");
        }
        if ("APPROVED".equals(result)) {
            ApprovalProcess process = requireTerminalApprovalProcess(application, "APPROVED");
            transitionApplicationStatus(application, RetirementApplication.Status.APPROVED);
            application.setTotalApprovalSteps(resolveApprovalStepCount(process));
            application.setCurrentApprovalStep(application.getTotalApprovalSteps());
            updateApplicationAtomically(application, currentStatus, application.getAssetId());
            assetLifecycleService.transitionStatus(
                    application.getAssetId(),
                    resolveRetirementTargetStatus(application),
                    "RETIREMENT_APPROVED",
                    application.getReason(),
                    operatorId);
            return application;
        }
        if (!"REJECTED".equals(result)) {
            throw new BusinessException("退役审批结果无效");
        }
        ApprovalProcess process = requireTerminalApprovalProcess(application, "REJECTED");
        transitionApplicationStatus(application, RetirementApplication.Status.REJECTED);
        application.setTotalApprovalSteps(resolveApprovalStepCount(process));
        application.setCurrentApprovalStep(currentApprovalStep(process.getCurrentStep(), application.getTotalApprovalSteps()));
        updateApplicationAtomically(application, currentStatus, application.getAssetId());
        assetLifecycleService.rollbackRetirementStatus(
                application.getAssetId(),
                "RETIREMENT_REJECTED",
                reason == null || reason.isBlank() ? application.getReason() : reason,
                operatorId);
        return application;
    }

    public int getApprovalStepCount(Long id) {
        return normalizeApprovalSteps(getApplicationById(id).getTotalApprovalSteps());
    }

    /**
     * Update the retirement application's review status when the approval process
     * advances to an intermediate step (not yet terminal). Mirrors the approval
     * process's currentStep onto the application and marks it APPROVING so that
     * the application's status reflects intermediate approval progress instead of
     * staying in PENDING through all intermediate steps.
     */
    @Transactional(rollbackFor = Exception.class)
    public void updateReviewStatus(Long applicationId, Integer currentStep) {
        RetirementApplication application = getApplicationById(applicationId);
        RetirementApplication.Status expectedStatus = statusOf(application);
        if (!isReviewingStatus(expectedStatus)) {
            return;
        }
        if (expectedStatus == RetirementApplication.Status.PENDING) {
            transitionApplicationStatus(application, RetirementApplication.Status.APPROVING);
        }
        if (currentStep != null && currentStep > 0) {
            application.setCurrentApprovalStep(currentStep);
        }
        updateApplicationAtomically(application, expectedStatus, application.getAssetId());
    }

    public List<RetirementApplication> getAssetRetirementHistory(Long assetId) {
        Asset asset = loadAssetForCurrentTenant(assetId, "getAssetRetirementHistory");
        LambdaQueryWrapper<RetirementApplication> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(RetirementApplication::getTenantId, asset.getTenantId())
                .eq(RetirementApplication::getAssetId, assetId);
        wrapper.orderByDesc(RetirementApplication::getCreateTime).last("limit " + MAX_HISTORY_RESULTS);
        return retirementApplicationMapper.selectList(wrapper);
    }

    public Map<String, Object> getStatistics() {
        String tenantId = TenantContext.requireTenantId();
        Map<String, Object> stats = new HashMap<>();

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime monthStart = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime yearStart = now.withDayOfYear(1).withHour(0).withMinute(0).withSecond(0).withNano(0);

        LambdaQueryWrapper<RetirementApplication> thisMonthWrapper = new LambdaQueryWrapper<>();
        thisMonthWrapper.eq(RetirementApplication::getTenantId, tenantId)
                .ge(RetirementApplication::getCreateTime, monthStart);
        assetDataPermissionEvaluator.applyToRelatedAsset(thisMonthWrapper);
        stats.put("thisMonthCount", retirementApplicationMapper.selectCount(thisMonthWrapper));

        LambdaQueryWrapper<RetirementApplication> thisYearWrapper = new LambdaQueryWrapper<>();
        thisYearWrapper.eq(RetirementApplication::getTenantId, tenantId)
                .ge(RetirementApplication::getCreateTime, yearStart);
        assetDataPermissionEvaluator.applyToRelatedAsset(thisYearWrapper);
        stats.put("thisYearCount", retirementApplicationMapper.selectCount(thisYearWrapper));

        LambdaQueryWrapper<RetirementApplication> pendingWrapper = new LambdaQueryWrapper<>();
        pendingWrapper.eq(RetirementApplication::getTenantId, tenantId)
                .eq(RetirementApplication::getStatus, "PENDING");
        assetDataPermissionEvaluator.applyToRelatedAsset(pendingWrapper);
        stats.put("pendingCount", retirementApplicationMapper.selectCount(pendingWrapper));

        LambdaQueryWrapper<RetirementApplication> approvedWrapper = new LambdaQueryWrapper<>();
        approvedWrapper.eq(RetirementApplication::getTenantId, tenantId)
                .eq(RetirementApplication::getStatus, "APPROVED");
        assetDataPermissionEvaluator.applyToRelatedAsset(approvedWrapper);
        stats.put("approvedCount", retirementApplicationMapper.selectCount(approvedWrapper));

        return stats;
    }

    private String generateApplicationNo() {
        String prefix = "RA-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        return prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private String generateProcessNo() {
        String prefix = "APR-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        return prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private boolean isEditableStatus(RetirementApplication.Status status) {
        return status == RetirementApplication.Status.DRAFT || status == RetirementApplication.Status.REJECTED;
    }

    private boolean isSubmittableStatus(RetirementApplication.Status status) {
        return isEditableStatus(status) || status == RetirementApplication.Status.CANCELLED_REQUIRES_RESUBMISSION;
    }

    private boolean isCancellableStatus(RetirementApplication.Status status) {
        return isEditableStatus(status) || isReviewingStatus(status)
                || status == RetirementApplication.Status.CANCELLED_REQUIRES_RESUBMISSION;
    }

    private boolean isReviewingStatus(RetirementApplication.Status status) {
        return status == RetirementApplication.Status.PENDING || status == RetirementApplication.Status.APPROVING;
    }

    private RetirementApplication buildApplication(RetirementApplyDTO dto, Asset asset) {
        RetirementApplication application = new RetirementApplication();
        application.setTenantId(asset.getTenantId());
        application.setAssetId(dto.getAssetId());
        application.setAssetName(asset.getAssetName());
        application.setAssetCode(asset.getAssetNo());
        application.setReason(dto.getReason());
        application.setEstimatedResidualValue(dto.getEstimatedResidualValue());
        application.setRetirementType(dto.getRetirementType().name());
        application.setAttachments(dto.getAttachments());
        application.setRemark(dto.getRemark());
        return application;
    }

    private void validateApplyDTO(RetirementApplyDTO dto) {
        if (dto == null || dto.getAssetId() == null) {
            throw new BusinessException("资产ID不能为空");
        }
        if (dto.getAssetId() <= 0) {
            throw new BusinessException("资产ID必须为正数");
        }
        if (dto.getReason() == null || dto.getReason().isBlank() || dto.getReason().length() > 500) {
            throw new BusinessException("报废原因不能为空");
        }
        if (dto.getRetirementType() == null) {
            throw new BusinessException("退役类型不能为空");
        }
        validateResidualValue(dto.getEstimatedResidualValue());
        if (dto.getAttachments() != null && dto.getAttachments().length() > 4096) {
            throw new BusinessException("附件信息长度不能超过4096个字符");
        }
        if (dto.getRemark() != null && dto.getRemark().length() > 1000) {
            throw new BusinessException("备注长度不能超过1000个字符");
        }
    }

    private void ensureNoActiveRetirement(Long assetId, Long excludeApplicationId) {
        String tenantId = TenantContext.requireTenantId();
        LambdaQueryWrapper<RetirementApplication> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(RetirementApplication::getTenantId, tenantId)
                .eq(RetirementApplication::getAssetId, assetId)
                .in(RetirementApplication::getStatus, List.of("PENDING", "APPROVING"));
        if (excludeApplicationId != null) {
            wrapper.ne(RetirementApplication::getId, excludeApplicationId);
        }
        Long count = retirementApplicationMapper.selectCount(wrapper);
        if (count != null && count > 0) {
            throw new BusinessException("该资产已有进行中的报废申请");
        }
    }

    private void ensureNoActiveDisposal(Long assetId) {
        Long count = disposalApplicationMapper.selectCount(new LambdaQueryWrapper<DisposalApplication>()
                .eq(DisposalApplication::getTenantId, TenantContext.requireTenantId())
                .eq(DisposalApplication::getAssetId, assetId)
                .eq(DisposalApplication::getStatus, "PENDING"));
        if (count != null && count > 0) {
            throw new BusinessException("该资产已有进行中的处置申请");
        }
    }

    private void ensureNoActiveCompensation(Long assetId) {
        Long count = assetCompensationMapper.selectCount(new LambdaQueryWrapper<AssetCompensation>()
                .eq(AssetCompensation::getTenantId, TenantContext.requireTenantId())
                .eq(AssetCompensation::getAssetId, assetId)
                .eq(AssetCompensation::getStatus, CompensationStatus.PENDING.name()));
        if (count != null && count > 0) {
            throw new BusinessException("该资产已有进行中的赔偿申请");
        }
    }

    private Asset loadAssetForCurrentTenant(Long assetId, String operation) {
        String tenantId = TenantContext.requireTenantId();
        Asset asset = assetMapper.selectOne(assetById(assetId, tenantId));
        if (asset != null) {
            assetDataPermissionEvaluator.assertCanAccess(asset);
            return asset;
        }
        Asset existingAsset = assetMapper.selectById(assetId);
        if (existingAsset == null) {
            throw new BusinessException("资产不存在");
        }
        TenantSecurityAudit.logCrossTenantAttempt(log, operation, assetId, tenantId, existingAsset.getTenantId());
        throw new AccessDeniedException("Asset belongs to another tenant");
    }

    private Asset lockAssetForCurrentTenant(Long assetId, String operation) {
        String tenantId = TenantContext.requireTenantId();
        Asset asset = assetMapper.selectOne(assetById(assetId, tenantId).last("FOR UPDATE"));
        if (asset != null) {
            assetDataPermissionEvaluator.assertCanAccess(asset);
            return asset;
        }
        Asset existingAsset = assetMapper.selectById(assetId);
        if (existingAsset == null) {
            throw new BusinessException("资产不存在");
        }
        TenantSecurityAudit.logCrossTenantAttempt(log, operation, assetId, tenantId, existingAsset.getTenantId());
        throw new AccessDeniedException("Asset belongs to another tenant");
    }

    private void requireRetirementEligibleAsset(Asset asset) {
        try {
            if (AssetStatus.fromNameOrDefault(asset.getStatus(), AssetStatus.IDLE).requiresDedicatedWorkflow()) {
                throw new BusinessException("待退役或终态资产不能创建或修改退役申请");
            }
        } catch (IllegalArgumentException exception) {
            throw new BusinessException("资产状态无效");
        }
    }

    private LambdaQueryWrapper<Asset> assetById(Long assetId, String tenantId) {
        return new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, assetId)
                .eq(Asset::getTenantId, tenantId);
    }

    private AssetStatus resolveRetirementTargetStatus(RetirementApplication application) {
        try {
            return switch (RetirementApplication.RetirementType.fromStoredValue(application.getRetirementType())) {
                case SCRAP -> AssetStatus.SCRAPPED;
                case RETIREMENT -> AssetStatus.RETIRED;
            };
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("退役类型无效");
        }
    }

    private ApprovalProcess createPendingApprovalProcess(RetirementApplication application, Long applicantId) {
        ApprovalProcess process = approvalProcessMapper.selectOne(
                new LambdaQueryWrapper<ApprovalProcess>()
                        .eq(ApprovalProcess::getTenantId, application.getTenantId())
                        .eq(ApprovalProcess::getProcessType, "RETIREMENT")
                        .eq(ApprovalProcess::getBusinessId, application.getId())
                        .eq(ApprovalProcess::getStatus, "PENDING")
                        .orderByDesc(ApprovalProcess::getCreateTime)
                        .orderByDesc(ApprovalProcess::getId)
                        .last("limit 1"));
        if (process != null) {
            throw new BusinessException("退役申请已有进行中的审批流程");
        }

        process = new ApprovalProcess();
        process.setProcessNo(generateProcessNo());
        process.setProcessType("RETIREMENT");
        process.setBusinessId(application.getId());
        process.setTenantId(application.getTenantId());
        process.setStatus("PENDING");
        process.setCurrentStep(1);
        process.setApplicantId(applicantId);
        process.setApplyTime(LocalDateTime.now());
        process.setVersion(0);
        if (approvalProcessMapper.insert(process) != 1 || process.getId() == null) {
            throw new BusinessException("审批流程创建失败");
        }
        approvalAssignmentService.initializeForProcess(process, "RETIREMENT");
        return process;
    }

    private int normalizeApprovalSteps(Integer totalApprovalSteps) {
        return totalApprovalSteps == null || totalApprovalSteps < 1 ? 1 : totalApprovalSteps;
    }

    private int resolveApprovalStepCount(ApprovalProcess process) {
        return normalizeApprovalSteps(approvalAssignmentService.getFinalStep(process));
    }

    private int currentApprovalStep(Integer currentStep, Integer totalApprovalSteps) {
        int total = normalizeApprovalSteps(totalApprovalSteps);
        if (currentStep == null || currentStep < 1) {
            return 1;
        }
        return Math.min(currentStep, total);
    }

    private void cancelPendingApprovalProcess(RetirementApplication application) {
        ApprovalProcess process = approvalProcessMapper.selectOne(
                new LambdaQueryWrapper<ApprovalProcess>()
                        .eq(ApprovalProcess::getTenantId, TenantContext.requireTenantId())
                        .eq(ApprovalProcess::getProcessType, "RETIREMENT")
                        .eq(ApprovalProcess::getBusinessId, application.getId())
                        .eq(ApprovalProcess::getStatus, "PENDING")
                        .orderByDesc(ApprovalProcess::getCreateTime)
                        .orderByDesc(ApprovalProcess::getId)
                        .last("limit 1 FOR UPDATE"));
        if (process == null) {
            throw new BusinessException("进行中的退役审批流程不存在或已变更，请刷新后重试");
        }
        int version = versionOf(process.getVersion());
        ApprovalProcess update = new ApprovalProcess();
        update.setStatus("CANCELLED");
        update.setVersion(version + 1);
        int updated = approvalProcessMapper.update(update, new LambdaUpdateWrapper<ApprovalProcess>()
                .eq(ApprovalProcess::getId, process.getId())
                .eq(ApprovalProcess::getTenantId, TenantContext.requireTenantId())
                .eq(ApprovalProcess::getProcessType, "RETIREMENT")
                .eq(ApprovalProcess::getBusinessId, application.getId())
                .eq(ApprovalProcess::getStatus, "PENDING")
                .eq(ApprovalProcess::getVersion, version));
        if (updated != 1) {
            throw new BusinessException("审批流程已变更，请刷新后重试");
        }
        approvalAssignmentService.freezePendingAssignments(process.getId());
    }

    private void updateApplicationAtomically(RetirementApplication application,
                                              RetirementApplication.Status expectedStatus,
                                              Long sourceAssetId) {
        int version = versionOf(application.getVersion());
        application.setVersion(version + 1);
        LambdaUpdateWrapper<RetirementApplication> wrapper = new LambdaUpdateWrapper<RetirementApplication>()
                .eq(RetirementApplication::getId, application.getId())
                .eq(RetirementApplication::getTenantId, TenantContext.requireTenantId())
                .eq(RetirementApplication::getAssetId, sourceAssetId)
                .eq(RetirementApplication::getStatus, expectedStatus.name())
                .eq(RetirementApplication::getVersion, version);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        int updated = retirementApplicationMapper.update(application, wrapper);
        if (updated != 1) {
            throw new BusinessException("退役申请已变更，请刷新后重试");
        }
    }

    private ApprovalProcess requireTerminalApprovalProcess(RetirementApplication application, String expectedProcessStatus) {
        ApprovalProcess process = approvalProcessMapper.selectOne(new LambdaQueryWrapper<ApprovalProcess>()
                .eq(ApprovalProcess::getTenantId, application.getTenantId())
                .eq(ApprovalProcess::getProcessType, "RETIREMENT")
                .eq(ApprovalProcess::getBusinessId, application.getId())
                .eq(ApprovalProcess::getStatus, expectedProcessStatus)
                .orderByDesc(ApprovalProcess::getCreateTime)
                .orderByDesc(ApprovalProcess::getId)
                .last("limit 1"));
        if (process == null || application.getApplicantId() == null
                || !application.getApplicantId().equals(process.getApplicantId())) {
            throw new AccessDeniedException("退役终态必须由已完成的受控审批流程驱动");
        }
        return process;
    }

    private void requireApplicantActor(Long actorId) {
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        if (actorId == null || currentUser.getId() == null || !actorId.equals(currentUser.getId())) {
            throw new AccessDeniedException("申请人必须是当前租户已认证成员");
        }
    }

    private void requireApplicant(RetirementApplication application, Long actorId) {
        if (application.getApplicantId() == null || actorId == null || !application.getApplicantId().equals(actorId)) {
            throw new AccessDeniedException("仅申请人可以修改退役申请");
        }
    }

    private void requireApplicantNotApprover(RetirementApplication application, Long approverId) {
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        if (approverId == null || currentUser.getId() == null || !approverId.equals(currentUser.getId())) {
            throw new AccessDeniedException("审批人必须是当前租户已认证成员");
        }
        if (application.getApplicantId() == null || application.getApplicantId().equals(approverId)) {
            throw new AccessDeniedException("申请人不能审批自己的退役申请");
        }
    }

    private void requirePermission(String permission) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = authentication != null
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream().anyMatch(authority -> permission.equals(authority.getAuthority()));
        if (!permitted) {
            throw new AccessDeniedException("缺少退役权限: " + permission);
        }
    }

    private int normalizePage(Integer page) {
        return page == null || page < 1 ? 1 : page;
    }

    private int normalizePageSize(Integer pageSize) {
        if (pageSize == null || pageSize < 1) {
            return 10;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    private int versionOf(Integer version) {
        return version == null ? 0 : version;
    }

    private RetirementApplication.Status statusOf(RetirementApplication application) {
        return parseStatus(application.getStatus());
    }

    private RetirementApplication.Status parseStatus(String status) {
        try {
            return RetirementApplication.Status.fromStoredValue(status);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("退役申请状态无效");
        }
    }

    private void transitionApplicationStatus(RetirementApplication application,
                                             RetirementApplication.Status targetStatus) {
        RetirementApplication.Status currentStatus = statusOf(application);
        if (!currentStatus.canTransitionTo(targetStatus)) {
            throw new BusinessException("退役申请状态不允许从" + currentStatus.name() + "变更为" + targetStatus.name());
        }
        application.setStatus(targetStatus.name());
    }

    private void validateResidualValue(java.math.BigDecimal residualValue) {
        if (residualValue == null) {
            return;
        }
        int integerDigits = Math.max(residualValue.precision() - residualValue.scale(), 0);
        if (residualValue.signum() < 0 || residualValue.scale() > 2 || integerDigits > 13) {
            throw new BusinessException("预计残值不合法");
        }
    }
}
