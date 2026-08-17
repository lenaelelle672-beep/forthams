package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AssetClearanceDTO;
import com.ams.dto.AssetScrapDTO;
import com.ams.dto.AssetTransferDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Asset;
import com.ams.entity.AssetChangeLog;
import com.ams.entity.AssetCompensation;
import com.ams.entity.Dept;
import com.ams.entity.DisposalApplication;
import com.ams.entity.User;
import com.ams.enums.AssetStatus;
import com.ams.enums.CompensationStatus;
import com.ams.enums.DisposalStatus;
import com.ams.enums.DisposalType;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.AssetChangeLogMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.AssetCompensationMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.DisposalApplicationMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DisposalService {

    private static final String PROCESS_TYPE = "DISPOSAL";
    private static final int MAX_PAGE_SIZE = 100;

    private final AssetLifecycleService assetLifecycleService;
    private final AssetChangeLogMapper assetChangeLogMapper;
    private final WorkflowDefinitionService workflowDefinitionService;
    private final AssetMapper assetMapper;
    private final AssetDataPermissionEvaluator assetDataPermissionEvaluator;
    private final AssetCompensationMapper assetCompensationMapper;
    private final DisposalApplicationMapper disposalApplicationMapper;
    private final ApprovalProcessMapper approvalProcessMapper;
    private final DeptMapper deptMapper;
    private final UserMapper userMapper;
    private final UserTenantMembershipMapper userTenantMembershipMapper;
    private final TenantAuthorityService tenantAuthorityService;
    private final ApprovalAssignmentService approvalAssignmentService;

    @Transactional(rollbackFor = Exception.class)
    public DisposalApplication createTransferApplication(AssetTransferDTO dto) {
        requirePermission("disposal:create");
        validateTransfer(dto);
        workflowDefinitionService.requirePublishedDefinition("ASSET_TRANSFER");
        String tenantId = TenantContext.requireTenantId();
        Asset asset = lockAccessibleAsset(dto.getAssetId(), tenantId);
        validateTransferTargets(dto.getTargetDeptId(), dto.getTargetUserId(), tenantId);
        return createApplication(asset, DisposalType.TRANSFER, dto.getReason(), dto.getTargetDeptId(),
                dto.getTargetUserId(), dto.getTargetLocation());
    }

    @Transactional(rollbackFor = Exception.class)
    public DisposalApplication createClearanceApplication(AssetClearanceDTO dto) {
        requirePermission("disposal:create");
        validateClearance(dto);
        workflowDefinitionService.requirePublishedDefinition("ASSET_CLEARANCE");
        String tenantId = TenantContext.requireTenantId();
        Asset asset = lockAccessibleAsset(dto.getAssetId(), tenantId);
        return createApplication(asset, DisposalType.CLEARANCE, dto.getReason(), null, null, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public DisposalApplication createScrapApplication(AssetScrapDTO dto) {
        requirePermission("disposal:create");
        validateScrap(dto);
        workflowDefinitionService.requirePublishedDefinition("ASSET_SCRAP");
        String tenantId = TenantContext.requireTenantId();
        Asset asset = lockAccessibleAsset(dto.getAssetId(), tenantId);
        return createApplication(asset, DisposalType.SCRAP, dto.getReason(), null, null, null);
    }

    /**
     * 只由 ApprovalService 在已写入审批记录且流程原子迁移到终态后调用。
     */
    @Transactional(rollbackFor = Exception.class)
    public DisposalApplication applyApprovalOutcome(Long applicationId, String result, Long approverId, String opinion) {
        requirePermission("disposal:approve");
        DisposalApplication application = getApplicationById(applicationId);
        if (application.getApplicantId() == null || application.getApplicantId().equals(approverId)) {
            throw new AccessDeniedException("申请人不能审批自己的处置申请");
        }
        DisposalStatus targetStatus = parseResult(result);
        requireApprovedProcess(application, targetStatus);
        DisposalStatus currentStatus = parseStatus(application.getStatus());
        if (!currentStatus.canTransitionTo(targetStatus)) {
            throw new BusinessException("当前处置申请不可处理");
        }
        if (targetStatus == DisposalStatus.APPROVED) {
            lockAccessibleAsset(application.getAssetId(), TenantContext.requireTenantId());
            ensureNoActiveCompensation(application.getAssetId());
        }

        int version = versionOf(application.getVersion());
        application.setStatus(targetStatus.name());
        application.setVersion(version + 1);
        LambdaUpdateWrapper<DisposalApplication> wrapper = new LambdaUpdateWrapper<DisposalApplication>()
                .eq(DisposalApplication::getId, applicationId)
                .eq(DisposalApplication::getTenantId, TenantContext.requireTenantId())
                .eq(DisposalApplication::getAssetId, application.getAssetId())
                .eq(DisposalApplication::getStatus, currentStatus.name())
                .eq(DisposalApplication::getVersion, version);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        int updated = disposalApplicationMapper.update(application, wrapper);
        if (updated != 1) {
            throw new BusinessException("处置申请已变更，请刷新后重试");
        }

        if (targetStatus == DisposalStatus.APPROVED) {
            executeApprovedApplication(application, approverId, opinion);
        }
        return application;
    }

    public Page<AssetChangeLog> getDisposalHistory(Integer page, Integer pageSize, DisposalType changeType) {
        requirePermission("disposal:query");
        Page<AssetChangeLog> pager = new Page<>(normalizePage(page), normalizePageSize(pageSize));
        QueryWrapper<AssetChangeLog> wrapper = new QueryWrapper<>();
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        if (changeType != null) {
            wrapper.eq("change_type", changeType.name());
        } else {
            wrapper.in("change_type", DisposalType.TRANSFER.name(), DisposalType.CLEARANCE.name(), DisposalType.SCRAP.name());
        }
        wrapper.orderByDesc("create_time");
        return assetChangeLogMapper.selectPage(pager, wrapper);
    }

    public Page<DisposalApplication> queryApplications(Integer page, Integer pageSize, DisposalType disposalType,
                                                         DisposalStatus status, String keyword) {
        requirePermission("disposal:query");
        String tenantId = TenantContext.requireTenantId();
        Page<DisposalApplication> pager = new Page<>(normalizePage(page), normalizePageSize(pageSize));
        QueryWrapper<DisposalApplication> wrapper = new QueryWrapper<>();
        wrapper.eq("tenant_id", tenantId);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        if (disposalType != null) {
            wrapper.eq("disposal_type", disposalType.name());
        }
        if (status != null) {
            wrapper.eq("status", status.name());
        }
        if (keyword != null && !keyword.isBlank()) {
            String normalizedKeyword = keyword.trim();
            wrapper.and(query -> query.like("application_no", normalizedKeyword)
                    .or()
                    .like("reason", normalizedKeyword));
        }
        wrapper.orderByDesc("create_time");
        Page<DisposalApplication> result = disposalApplicationMapper.selectPage(pager, wrapper);
        result.getRecords().forEach(application -> populateDisplayFields(application, tenantId));
        return result;
    }

    public DisposalApplication getApplicationDetail(Long id) {
        requirePermission("disposal:query");
        DisposalApplication application = getApplicationById(id);
        populateDisplayFields(application, TenantContext.requireTenantId());
        return application;
    }

    public Map<String, Long> getDisposalStatistics() {
        requirePermission("disposal:query");
        String tenantId = TenantContext.requireTenantId();
        LocalDate firstDayOfCurrentMonth = LocalDate.now().withDayOfMonth(1);
        LocalDateTime currentMonthStart = firstDayOfCurrentMonth.atStartOfDay();
        LocalDateTime nextMonthStart = firstDayOfCurrentMonth.plusMonths(1).atStartOfDay();
        LocalDateTime previousMonthStart = firstDayOfCurrentMonth.minusMonths(1).atStartOfDay();

        Map<String, Long> statistics = new LinkedHashMap<>();
        statistics.put("thisMonthCount", countApplications(tenantId, null, currentMonthStart, nextMonthStart));
        statistics.put("previousMonthCount", countApplications(tenantId, null, previousMonthStart, currentMonthStart));
        statistics.put("pendingCount", countApplications(tenantId, DisposalStatus.PENDING, null, null));
        statistics.put("approvedCount", countApplications(tenantId, DisposalStatus.APPROVED, currentMonthStart, nextMonthStart));
        return statistics;
    }

    public DisposalApplication getApplicationById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        DisposalApplication application = disposalApplicationMapper.selectOne(new LambdaQueryWrapper<DisposalApplication>()
                .eq(DisposalApplication::getId, id)
                .eq(DisposalApplication::getTenantId, tenantId)
                .last("limit 1"));
        if (application == null) {
            throw new BusinessException("处置申请不存在");
        }
        loadAccessibleAsset(application.getAssetId(), tenantId);
        return application;
    }

    private long countApplications(String tenantId, DisposalStatus status, LocalDateTime start, LocalDateTime end) {
        QueryWrapper<DisposalApplication> wrapper = new QueryWrapper<DisposalApplication>()
                .eq("tenant_id", tenantId);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        if (status != null) {
            wrapper.eq("status", status.name());
        }
        if (start != null) {
            wrapper.ge("create_time", start);
        }
        if (end != null) {
            wrapper.lt("create_time", end);
        }
        return disposalApplicationMapper.selectCount(wrapper);
    }

    private void populateDisplayFields(DisposalApplication application, String tenantId) {
        if (application == null) {
            return;
        }
        if (application.getAssetId() != null) {
            Asset asset = assetMapper.selectOne(new LambdaQueryWrapper<Asset>()
                    .eq(Asset::getId, application.getAssetId())
                    .eq(Asset::getTenantId, tenantId)
                    .last("limit 1"));
            if (asset != null) {
                application.setAssetNo(asset.getAssetNo());
                application.setAssetName(asset.getAssetName());
            }
        }
        if (application.getApplicantId() != null) {
            User applicant = userMapper.selectOne(new LambdaQueryWrapper<User>()
                    .eq(User::getId, application.getApplicantId())
                    .eq(User::getTenantId, tenantId)
                    .last("limit 1"));
            if (applicant != null) {
                application.setApplicantName(applicant.getRealName());
            }
        }
    }

    private DisposalApplication createApplication(Asset asset, DisposalType type, String reason, Long targetDeptId,
                                                    Long targetUserId, String targetLocation) {
        if (AssetStatus.PENDING_RETIREMENT.matches(asset.getStatus())) {
            throw new BusinessException("待退役资产不能同时发起处置申请");
        }
        ensureNoActiveDisposal(asset.getId());
        ensureNoActiveCompensation(asset.getId());
        User applicant = tenantAuthorityService.requireCurrentTenantMember();
        if (applicant.getId() == null) {
            throw new AccessDeniedException("当前租户成员无效");
        }
        DisposalApplication application = new DisposalApplication();
        application.setTenantId(asset.getTenantId());
        application.setApplicationNo(generateApplicationNo());
        application.setAssetId(asset.getId());
        application.setDisposalType(type.name());
        application.setTargetDeptId(targetDeptId);
        application.setTargetUserId(targetUserId);
        application.setTargetLocation(targetLocation);
        application.setReason(reason);
        application.setApplicantId(applicant.getId());
        application.setStatus(DisposalStatus.PENDING.name());
        application.setVersion(0);
        if (disposalApplicationMapper.insert(application) != 1 || application.getId() == null) {
            throw new BusinessException("处置申请创建失败");
        }

        ApprovalProcess process = new ApprovalProcess();
        process.setProcessNo("DSPAPR-" + UUID.randomUUID());
        process.setProcessType(PROCESS_TYPE);
        process.setBusinessId(application.getId());
        process.setTenantId(application.getTenantId());
        process.setStatus("PENDING");
        process.setCurrentStep(1);
        process.setApplicantId(applicant.getId());
        process.setVersion(0);
        if (approvalProcessMapper.insert(process) != 1 || process.getId() == null) {
            throw new BusinessException("处置审批流程创建失败");
        }
        approvalAssignmentService.initializeForProcess(process, workflowBusinessType(type));
        return application;
    }

    private void ensureNoActiveDisposal(Long assetId) {
        Long count = disposalApplicationMapper.selectCount(new LambdaQueryWrapper<DisposalApplication>()
                .eq(DisposalApplication::getTenantId, TenantContext.requireTenantId())
                .eq(DisposalApplication::getAssetId, assetId)
                .eq(DisposalApplication::getStatus, DisposalStatus.PENDING.name()));
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

    private void executeApprovedApplication(DisposalApplication application, Long approverId, String opinion) {
        DisposalType type = parseType(application.getDisposalType());
        Asset currentAsset = loadAccessibleAsset(application.getAssetId(), TenantContext.requireTenantId());
        if (AssetStatus.PENDING_RETIREMENT.matches(currentAsset.getStatus())) {
            throw new BusinessException("待退役资产不能执行处置终态");
        }
        switch (type) {
            case TRANSFER -> {
                validateTransferTargets(application.getTargetDeptId(), application.getTargetUserId(),
                        TenantContext.requireTenantId());
                assetLifecycleService.transitionAsset(application.getAssetId(), AssetStatus.IN_USE, type.name(),
                        application.getReason(), approverId, asset -> {
                            asset.setDeptId(application.getTargetDeptId());
                            asset.setUserId(application.getTargetUserId());
                            asset.setLocation(application.getTargetLocation());
                        });
            }
            case CLEARANCE -> assetLifecycleService.transitionStatus(application.getAssetId(), AssetStatus.CLEARED,
                    type.name(), application.getReason(), approverId);
            case SCRAP -> assetLifecycleService.transitionStatus(application.getAssetId(), AssetStatus.SCRAPPED,
                    type.name(), application.getReason(), approverId);
        }
    }

    private void requireApprovedProcess(DisposalApplication application, DisposalStatus targetStatus) {
        ApprovalProcess process = approvalProcessMapper.selectOne(new LambdaQueryWrapper<ApprovalProcess>()
                .eq(ApprovalProcess::getTenantId, application.getTenantId())
                .eq(ApprovalProcess::getProcessType, PROCESS_TYPE)
                .eq(ApprovalProcess::getBusinessId, application.getId())
                .eq(ApprovalProcess::getStatus, targetStatus == DisposalStatus.APPROVED ? "APPROVED" : "REJECTED")
                .orderByDesc(ApprovalProcess::getCreateTime)
                .orderByDesc(ApprovalProcess::getId)
                .last("limit 1"));
        if (process == null || !application.getApplicantId().equals(process.getApplicantId())) {
            throw new AccessDeniedException("处置终态必须由已完成的受控审批流程驱动");
        }
    }

    private Asset loadAccessibleAsset(Long assetId, String tenantId) {
        if (assetId == null || assetId <= 0) {
            throw new BusinessException("处置申请必须关联有效资产");
        }
        Asset asset = assetMapper.selectOne(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, assetId)
                .eq(Asset::getTenantId, tenantId));
        if (asset == null) {
            throw new AccessDeniedException("关联资产不存在或不属于当前租户");
        }
        assetDataPermissionEvaluator.assertCanAccess(asset);
        return asset;
    }

    private Asset lockAccessibleAsset(Long assetId, String tenantId) {
        if (assetId == null || assetId <= 0) {
            throw new BusinessException("处置申请必须关联有效资产");
        }
        Asset asset = assetMapper.selectOne(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, assetId)
                .eq(Asset::getTenantId, tenantId)
                .last("FOR UPDATE"));
        if (asset == null) {
            throw new AccessDeniedException("关联资产不存在或不属于当前租户");
        }
        assetDataPermissionEvaluator.assertCanAccess(asset);
        return asset;
    }

    private void validateTransferTargets(Long targetDeptId, Long targetUserId, String tenantId) {
        if (targetDeptId == null) {
            throw new BusinessException("目标部门不能为空");
        }
        Dept dept = deptMapper.selectOne(new QueryWrapper<Dept>()
                .eq("id", targetDeptId)
                .eq("tenant_id", tenantId)
                .eq("deleted", 0)
                .last("limit 1"));
        if (dept == null || !("1".equals(dept.getStatus()) || "ACTIVE".equalsIgnoreCase(dept.getStatus()))) {
            throw new AccessDeniedException("目标部门不存在、已停用或不属于当前租户");
        }
        if (targetUserId == null) {
            return;
        }
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getId, targetUserId)
                .eq(User::getTenantId, tenantId)
                .eq(User::getStatus, 1)
                .eq(User::getDeleted, 0)
                .last("limit 1"));
        if (user == null || user.getId() == null
                || userTenantMembershipMapper.countActiveMembership(user.getId(), tenantId) != 1
                || !targetDeptId.equals(user.getDeptId())) {
            throw new AccessDeniedException("目标用户未加入目标部门或不属于当前租户");
        }
    }

    private void validateTransfer(AssetTransferDTO dto) {
        if (dto == null || dto.getAssetId() == null || dto.getTargetDeptId() == null
                || dto.getReason() == null || dto.getReason().isBlank()) {
            throw new BusinessException("处置申请参数不完整");
        }
    }

    private void validateClearance(AssetClearanceDTO dto) {
        if (dto == null || dto.getAssetId() == null || dto.getReason() == null || dto.getReason().isBlank()) {
            throw new BusinessException("处置申请参数不完整");
        }
    }

    private void validateScrap(AssetScrapDTO dto) {
        if (dto == null || dto.getAssetId() == null || dto.getReason() == null || dto.getReason().isBlank()) {
            throw new BusinessException("处置申请参数不完整");
        }
    }

    private DisposalStatus parseResult(String result) {
        if ("APPROVED".equals(result)) {
            return DisposalStatus.APPROVED;
        }
        if ("REJECTED".equals(result)) {
            return DisposalStatus.REJECTED;
        }
        throw new BusinessException("处置审批结果无效");
    }

    private DisposalStatus parseStatus(String status) {
        try {
            return DisposalStatus.valueOf(status);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new BusinessException("处置申请状态无效");
        }
    }

    private DisposalType parseType(String type) {
        try {
            return DisposalType.valueOf(type);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new BusinessException("处置类型无效");
        }
    }

    private String generateApplicationNo() {
        return "DSP-" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + "-"
                + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
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

    private String workflowBusinessType(DisposalType type) {
        return switch (type) {
            case TRANSFER -> "ASSET_TRANSFER";
            case CLEARANCE -> "ASSET_CLEARANCE";
            case SCRAP -> "ASSET_SCRAP";
        };
    }

    private void requirePermission(String permission) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = authentication != null
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream().anyMatch(authority -> permission.equals(authority.getAuthority()));
        if (!permitted) {
            throw new AccessDeniedException("缺少处置权限: " + permission);
        }
    }
}
