package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.RetirementApplyDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.ApprovalRecord;
import com.ams.entity.Asset;
import com.ams.entity.AssetChangeLog;
import com.ams.entity.RetirementApplication;
import com.ams.enums.AssetStatus;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.ApprovalRecordMapper;
import com.ams.mapper.AssetChangeLogMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.RetirementApplicationMapper;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RetirementApplicationService {

    private static final Logger log = LoggerFactory.getLogger(RetirementApplicationService.class);

    private final RetirementApplicationMapper retirementApplicationMapper;
    private final ApprovalProcessMapper approvalProcessMapper;
    private final ApprovalRecordMapper approvalRecordMapper;
    private final AssetChangeLogMapper assetChangeLogMapper;
    private final AssetMapper assetMapper;
    private final AssetLifecycleService assetLifecycleService;

    @Transactional(rollbackFor = Exception.class)
    public RetirementApplication submitApplication(RetirementApplyDTO dto, Long applicantId) {
        validateApplyDTO(dto);
        Asset asset = loadAssetForCurrentTenant(dto.getAssetId(), "submitRetirementApplication");
        ensureNoActiveRetirement(dto.getAssetId(), null);

        RetirementApplication application = buildApplication(dto, asset);
        application.setApplicantId(applicantId);
        application.setApplicantName(applicantId.toString());
        application.setStatus("PENDING");
        application.setCurrentApprovalStep(1);
        application.setTotalApprovalSteps(1);

        application.setApplicationNo(generateApplicationNo());

        retirementApplicationMapper.insert(application);

        ApprovalProcess approvalProcess = new ApprovalProcess();
        approvalProcess.setProcessNo(generateProcessNo());
        approvalProcess.setProcessType("RETIREMENT");
        approvalProcess.setBusinessId(application.getId());
        approvalProcess.setTenantId(application.getTenantId());
        approvalProcess.setStatus("PENDING");
        approvalProcess.setCurrentStep(1);
        approvalProcess.setApplicantId(applicantId);
        approvalProcess.setApplyTime(LocalDateTime.now());
        approvalProcessMapper.insert(approvalProcess);

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
        Asset asset = loadAssetForCurrentTenant(dto.getAssetId(), "createDraftRetirementApplication");

        RetirementApplication application = buildApplication(dto, asset);
        application.setApplicantId(applicantId);
        application.setApplicantName(applicantId.toString());
        application.setStatus("DRAFT");
        application.setCurrentApprovalStep(0);
        application.setTotalApprovalSteps(1);
        application.setApplicationNo(generateApplicationNo());
        retirementApplicationMapper.insert(application);
        return application;
    }

    @Transactional(rollbackFor = Exception.class)
    public RetirementApplication submitExistingApplication(Long id, Long operatorId) {
        RetirementApplication application = getApplicationById(id);
        if (!isEditableStatus(application.getStatus())) {
            throw new BusinessException("报废申请仅DRAFT或REJECTED状态可提交");
        }
        ensureNoActiveRetirement(application.getAssetId(), application.getId());
        Asset asset = loadAssetForCurrentTenant(application.getAssetId(), "submitExistingRetirementApplication");

        application.setAssetName(asset.getAssetName());
        application.setAssetCode(asset.getAssetNo());
        application.setStatus("PENDING");
        application.setCurrentApprovalStep(1);
        application.setTotalApprovalSteps(normalizeApprovalSteps(application.getTotalApprovalSteps()));
        retirementApplicationMapper.updateById(application);
        upsertPendingApprovalProcess(application, operatorId);

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
        Page<RetirementApplication> pageObj = new Page<>(page, pageSize);
        LambdaQueryWrapper<RetirementApplication> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(RetirementApplication::getTenantId, tenantId)
                .eq(RetirementApplication::getApplicantId, applicantId);
        wrapper.orderByDesc(RetirementApplication::getCreateTime);
        return retirementApplicationMapper.selectPage(pageObj, wrapper);
    }

    public Page<RetirementApplication> queryApplications(Integer page, Integer pageSize, String status, Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        Page<RetirementApplication> pageObj = new Page<>(page, pageSize);
        LambdaQueryWrapper<RetirementApplication> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(RetirementApplication::getTenantId, tenantId);
        if (status != null && !status.isBlank()) {
            wrapper.eq(RetirementApplication::getStatus, status.trim().toUpperCase());
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
        if (!isEditableStatus(application.getStatus())) {
            throw new BusinessException("报废申请仅DRAFT或REJECTED状态可修改");
        }
        validateApplyDTO(dto);
        Asset asset = loadAssetForCurrentTenant(dto.getAssetId(), "updateRetirementApplicationAsset");
        BeanUtil.copyProperties(dto, application, "id", "applicationNo", "status", "createTime", "updateTime");
        application.setAssetName(asset.getAssetName());
        application.setAssetCode(asset.getAssetNo());
        retirementApplicationMapper.updateById(application);
        return application;
    }

    @Transactional(rollbackFor = Exception.class)
    public void cancelApplication(Long id, Long operatorId) {
        RetirementApplication application = getApplicationById(id);
        if (!isCancellableStatus(application.getStatus())) {
            throw new BusinessException("报废申请仅DRAFT、PENDING或REJECTED状态可撤销");
        }
        boolean rollbackAssetStatus = isReviewingStatus(application.getStatus());
        application.setStatus("CANCELLED");
        retirementApplicationMapper.updateById(application);
        updateApprovalProcessStatus(application.getId(), "CANCELLED");

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
        RetirementApplication application = getApplicationById(id);
        if ("APPROVED".equals(application.getStatus())) {
            return application;
        }
        if (!isReviewingStatus(application.getStatus())) {
            throw new BusinessException("当前报废申请不可审批通过");
        }

        application.setStatus("APPROVED");
        application.setCurrentApprovalStep(normalizeApprovalSteps(application.getTotalApprovalSteps()));
        retirementApplicationMapper.updateById(application);
        updateApprovalProcessStatus(application.getId(), "APPROVED");

        assetLifecycleService.transitionStatus(
                application.getAssetId(),
                resolveRetirementTargetStatus(application),
                "RETIREMENT_APPROVED",
                application.getReason(),
                operatorId);
        return application;
    }

    @Transactional(rollbackFor = Exception.class)
    public RetirementApplication completeApplication(Long id, Long operatorId) {
        RetirementApplication application = getApplicationById(id);
        if ("COMPLETED".equals(application.getStatus())) {
            return application;
        }
        if (!"APPROVED".equals(application.getStatus())) {
            throw new BusinessException("仅已审批通过的报废申请可以完成");
        }

        application.setStatus("COMPLETED");
        retirementApplicationMapper.updateById(application);
        updateApprovalProcessStatus(application.getId(), "COMPLETED");

        assetLifecycleService.transitionStatus(
                application.getAssetId(),
                resolveRetirementTargetStatus(application),
                "RETIREMENT_COMPLETED",
                application.getReason(),
                operatorId);
        return application;
    }

    @Transactional(rollbackFor = Exception.class)
    public RetirementApplication rejectApplication(Long id, Long operatorId, String reason) {
        RetirementApplication application = getApplicationById(id);
        if ("REJECTED".equals(application.getStatus())) {
            return application;
        }
        if (!isReviewingStatus(application.getStatus())) {
            throw new BusinessException("当前报废申请不可驳回");
        }

        application.setStatus("REJECTED");
        retirementApplicationMapper.updateById(application);
        updateApprovalProcessStatus(application.getId(), "REJECTED");
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

    public List<RetirementApplication> getAssetRetirementHistory(Long assetId) {
        Asset asset = loadAssetForCurrentTenant(assetId, "getAssetRetirementHistory");
        LambdaQueryWrapper<RetirementApplication> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(RetirementApplication::getTenantId, asset.getTenantId())
                .eq(RetirementApplication::getAssetId, assetId);
        wrapper.orderByDesc(RetirementApplication::getCreateTime);
        return retirementApplicationMapper.selectList(wrapper);
    }

    /**
     * Get approval history for a retirement application.
     * Queries the approval_process and approval_record tables to build
     * a timeline of approval actions for the frontend.
     *
     * @param id - Retirement application ID
     * @return List of approval history records
     */
    public List<Map<String, Object>> getApprovalHistory(Long id) {
        RetirementApplication application = getApplicationById(id);
        String tenantId = TenantContext.requireTenantId();

        // Find the approval process for this application
        ApprovalProcess process = approvalProcessMapper.selectOne(
                new LambdaQueryWrapper<ApprovalProcess>()
                        .eq(ApprovalProcess::getTenantId, tenantId)
                        .eq(ApprovalProcess::getProcessType, "RETIREMENT")
                        .eq(ApprovalProcess::getBusinessId, application.getId())
                        .last("limit 1"));

        List<Map<String, Object>> result = new ArrayList<>();

        if (process != null) {
            // Query approval records for this process
            List<ApprovalRecord> records = approvalRecordMapper.selectList(
                    new LambdaQueryWrapper<ApprovalRecord>()
                            .eq(ApprovalRecord::getProcessId, process.getId())
                            .orderByAsc(ApprovalRecord::getCreateTime));

            for (ApprovalRecord record : records) {
                Map<String, Object> item = new HashMap<>();
                item.put("id", String.valueOf(record.getId()));
                item.put("applicationId", String.valueOf(application.getId()));
                item.put("action", record.getApproveResult() != null ? record.getApproveResult() : "PENDING");
                item.put("comment", record.getApproveOpinion());
                item.put("operator", record.getApproverId() != null ? String.valueOf(record.getApproverId()) : null);
                item.put("createdAt", record.getApproveTime() != null ? record.getApproveTime().toString() : null);
                result.add(item);
            }
        }

        // If no approval records yet, synthesize from application status
        if (result.isEmpty()) {
            Map<String, Object> submitItem = new HashMap<>();
            submitItem.put("id", "submit-" + application.getId());
            submitItem.put("applicationId", String.valueOf(application.getId()));
            submitItem.put("action", "SUBMIT");
            submitItem.put("comment", application.getReason());
            submitItem.put("operator", application.getApplicantName());
            submitItem.put("createdAt", application.getCreateTime() != null ? application.getCreateTime().toString() : null);
            result.add(submitItem);

            // Add status transition if beyond PENDING
            String status = application.getStatus();
            if ("APPROVED".equals(status) || "COMPLETED".equals(status)) {
                Map<String, Object> approveItem = new HashMap<>();
                approveItem.put("id", "approve-" + application.getId());
                approveItem.put("applicationId", String.valueOf(application.getId()));
                approveItem.put("action", "APPROVE");
                approveItem.put("comment", null);
                approveItem.put("operator", null);
                approveItem.put("createdAt", application.getUpdateTime() != null ? application.getUpdateTime().toString() : null);
                result.add(approveItem);
            }
            if ("COMPLETED".equals(status)) {
                Map<String, Object> completeItem = new HashMap<>();
                completeItem.put("id", "complete-" + application.getId());
                completeItem.put("applicationId", String.valueOf(application.getId()));
                completeItem.put("action", "COMPLETE");
                completeItem.put("comment", null);
                completeItem.put("operator", null);
                completeItem.put("createdAt", application.getUpdateTime() != null ? application.getUpdateTime().toString() : null);
                result.add(completeItem);
            }
            if ("REJECTED".equals(status)) {
                Map<String, Object> rejectItem = new HashMap<>();
                rejectItem.put("id", "reject-" + application.getId());
                rejectItem.put("applicationId", String.valueOf(application.getId()));
                rejectItem.put("action", "REJECT");
                rejectItem.put("comment", application.getRemark());
                rejectItem.put("operator", null);
                rejectItem.put("createdAt", application.getUpdateTime() != null ? application.getUpdateTime().toString() : null);
                result.add(rejectItem);
            }
            if ("CANCELLED".equals(status)) {
                Map<String, Object> cancelItem = new HashMap<>();
                cancelItem.put("id", "cancel-" + application.getId());
                cancelItem.put("applicationId", String.valueOf(application.getId()));
                cancelItem.put("action", "CANCEL");
                cancelItem.put("comment", null);
                cancelItem.put("operator", null);
                cancelItem.put("createdAt", application.getUpdateTime() != null ? application.getUpdateTime().toString() : null);
                result.add(cancelItem);
            }
        }

        return result;
    }

    /**
     * Get asset state change history from the asset_change_log table.
     * Extracts status transitions from snapshot strings for the frontend timeline.
     *
     * @param assetId - Asset ID
     * @return Map with assetId and history array
     */
    public Map<String, Object> getAssetStateHistory(Long assetId) {
        loadAssetForCurrentTenant(assetId, "getAssetStateHistory");

        List<AssetChangeLog> changeLogs = assetChangeLogMapper.selectList(
                new LambdaQueryWrapper<AssetChangeLog>()
                        .eq(AssetChangeLog::getAssetId, assetId)
                        .orderByAsc(AssetChangeLog::getCreateTime));

        List<Map<String, String>> history = new ArrayList<>();
        java.util.regex.Pattern statusPattern = java.util.regex.Pattern.compile("status=([^,]*)");

        for (AssetChangeLog logEntry : changeLogs) {
            String oldStatus = extractStatusFromSnapshot(logEntry.getOldValue(), statusPattern);
            String newStatus = extractStatusFromSnapshot(logEntry.getNewValue(), statusPattern);

            Map<String, String> entry = new HashMap<>();
            entry.put("fromStatus", oldStatus != null ? oldStatus : "");
            entry.put("toStatus", newStatus != null ? newStatus : "");
            entry.put("timestamp", logEntry.getCreateTime() != null ? logEntry.getCreateTime().toString() : "");
            entry.put("operator", logEntry.getOperatorId() != null ? String.valueOf(logEntry.getOperatorId()) : "");
            history.add(entry);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("assetId", String.valueOf(assetId));
        result.put("history", history);
        return result;
    }

    private String extractStatusFromSnapshot(String snapshot, java.util.regex.Pattern pattern) {
        if (snapshot == null || snapshot.isBlank()) return null;
        java.util.regex.Matcher matcher = pattern.matcher(snapshot);
        return matcher.find() ? matcher.group(1) : null;
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
        stats.put("thisMonthCount", retirementApplicationMapper.selectCount(thisMonthWrapper));

        LambdaQueryWrapper<RetirementApplication> thisYearWrapper = new LambdaQueryWrapper<>();
        thisYearWrapper.eq(RetirementApplication::getTenantId, tenantId)
                .ge(RetirementApplication::getCreateTime, yearStart);
        stats.put("thisYearCount", retirementApplicationMapper.selectCount(thisYearWrapper));

        LambdaQueryWrapper<RetirementApplication> pendingWrapper = new LambdaQueryWrapper<>();
        pendingWrapper.eq(RetirementApplication::getTenantId, tenantId)
                .eq(RetirementApplication::getStatus, "PENDING");
        stats.put("pendingCount", retirementApplicationMapper.selectCount(pendingWrapper));

        LambdaQueryWrapper<RetirementApplication> approvedWrapper = new LambdaQueryWrapper<>();
        approvedWrapper.eq(RetirementApplication::getTenantId, tenantId)
                .eq(RetirementApplication::getStatus, "APPROVED");
        stats.put("approvedCount", retirementApplicationMapper.selectCount(approvedWrapper));

        return stats;
    }

    private synchronized String generateApplicationNo() {
        String tenantId = TenantContext.requireTenantId();
        String prefix = "RA-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        LambdaQueryWrapper<RetirementApplication> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(RetirementApplication::getTenantId, tenantId)
                .likeRight(RetirementApplication::getApplicationNo, prefix);
        List<RetirementApplication> applications = retirementApplicationMapper.selectList(wrapper);

        int maxSuffix = 0;
        for (RetirementApplication application : applications) {
            String applicationNo = application.getApplicationNo();
            if (applicationNo != null && applicationNo.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Integer.parseInt(applicationNo.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // Ignore malformed historical application numbers.
                }
            }
        }
        return prefix + String.format("%04d", maxSuffix + 1);
    }

    private synchronized String generateProcessNo() {
        String tenantId = TenantContext.requireTenantId();
        String prefix = "APR-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        LambdaQueryWrapper<ApprovalProcess> wrapper = new LambdaQueryWrapper<ApprovalProcess>()
                .eq(ApprovalProcess::getTenantId, tenantId)
                .likeRight(ApprovalProcess::getProcessNo, prefix);
        List<ApprovalProcess> processes = approvalProcessMapper.selectList(wrapper);

        int maxSuffix = 0;
        for (ApprovalProcess process : processes) {
            String processNo = process.getProcessNo();
            if (processNo != null && processNo.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Integer.parseInt(processNo.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // Ignore malformed historical process numbers.
                }
            }
        }
        return prefix + String.format("%03d", maxSuffix + 1);
    }

    private boolean isEditableStatus(String status) {
        return "DRAFT".equals(status) || "REJECTED".equals(status);
    }

    private boolean isCancellableStatus(String status) {
        return isEditableStatus(status) || isReviewingStatus(status);
    }

    private boolean isReviewingStatus(String status) {
        return "PENDING".equals(status) || "APPROVING".equals(status);
    }

    private RetirementApplication buildApplication(RetirementApplyDTO dto, Asset asset) {
        RetirementApplication application = new RetirementApplication();
        application.setTenantId(asset.getTenantId());
        application.setAssetId(dto.getAssetId());
        application.setAssetName(asset.getAssetName());
        application.setAssetCode(asset.getAssetNo());
        application.setReason(dto.getReason());
        application.setEstimatedResidualValue(dto.getEstimatedResidualValue());
        application.setRetirementType(dto.getRetirementType());
        application.setAttachments(dto.getAttachments());
        application.setRemark(dto.getRemark());
        return application;
    }

    private void validateApplyDTO(RetirementApplyDTO dto) {
        if (dto == null || dto.getAssetId() == null) {
            throw new BusinessException("资产ID不能为空");
        }
        if (dto.getReason() == null || dto.getReason().isBlank()) {
            throw new BusinessException("报废原因不能为空");
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

    private Asset loadAssetForCurrentTenant(Long assetId, String operation) {
        String tenantId = TenantContext.requireTenantId();
        Asset asset = assetMapper.selectOne(assetById(assetId, tenantId));
        if (asset != null) {
            return asset;
        }
        Asset existingAsset = assetMapper.selectById(assetId);
        if (existingAsset == null) {
            throw new BusinessException("资产不存在");
        }
        TenantSecurityAudit.logCrossTenantAttempt(log, operation, assetId, tenantId, existingAsset.getTenantId());
        throw new AccessDeniedException("Asset belongs to another tenant");
    }

    private LambdaQueryWrapper<Asset> assetById(Long assetId, String tenantId) {
        return new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, assetId)
                .eq(Asset::getTenantId, tenantId);
    }

    private AssetStatus resolveRetirementTargetStatus(RetirementApplication application) {
        return "SCRAP".equalsIgnoreCase(application.getRetirementType())
                || "SCRAPPED".equalsIgnoreCase(application.getRetirementType())
                ? AssetStatus.SCRAPPED
                : AssetStatus.RETIRED;
    }

    private void upsertPendingApprovalProcess(RetirementApplication application, Long applicantId) {
        ApprovalProcess process = approvalProcessMapper.selectOne(
                new LambdaQueryWrapper<ApprovalProcess>()
                        .eq(ApprovalProcess::getTenantId, application.getTenantId())
                        .eq(ApprovalProcess::getProcessType, "RETIREMENT")
                        .eq(ApprovalProcess::getBusinessId, application.getId())
                        .last("limit 1"));
        if (process != null) {
            process.setStatus("PENDING");
            process.setCurrentStep(1);
            process.setApplicantId(applicantId);
            process.setApplyTime(LocalDateTime.now());
            approvalProcessMapper.updateById(process);
            return;
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
        approvalProcessMapper.insert(process);
    }

    private int normalizeApprovalSteps(Integer totalApprovalSteps) {
        return totalApprovalSteps == null || totalApprovalSteps < 1 ? 1 : totalApprovalSteps;
    }

    private void updateApprovalProcessStatus(Long applicationId, String status) {
        ApprovalProcess process = approvalProcessMapper.selectOne(
                new LambdaQueryWrapper<ApprovalProcess>()
                        .eq(ApprovalProcess::getTenantId, TenantContext.requireTenantId())
                        .eq(ApprovalProcess::getProcessType, "RETIREMENT")
                        .eq(ApprovalProcess::getBusinessId, applicationId)
                        .last("limit 1"));
        if (process == null) {
            return;
        }
        if (!"PENDING".equals(process.getStatus())
                && !("COMPLETED".equals(status) && "APPROVED".equals(process.getStatus()))) {
            return;
        }
        process.setStatus(status);
        approvalProcessMapper.updateById(process);
    }
}
