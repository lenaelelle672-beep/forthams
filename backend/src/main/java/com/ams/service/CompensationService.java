package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.CompensationCreateDTO;
import com.ams.dto.CompensationUpdateDTO;
import com.ams.dto.CompensationValuationDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetCompensation;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Dept;
import com.ams.entity.DisposalApplication;
import com.ams.entity.User;
import com.ams.enums.AssetStatus;
import com.ams.enums.CompensationStatus;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.AssetCompensationMapper;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.DisposalApplicationMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CompensationService {

    private static final String PROCESS_TYPE = "COMPENSATION";
    private static final int MAX_PAGE_SIZE = 100;

    private final AssetCompensationMapper assetCompensationMapper;
    private final ApprovalProcessMapper approvalProcessMapper;
    private final AssetMapper assetMapper;
    private final WorkflowDefinitionService workflowDefinitionService;
    private final AssetDataPermissionEvaluator assetDataPermissionEvaluator;
    private final DisposalApplicationMapper disposalApplicationMapper;
    private final UserMapper userMapper;
    private final DeptMapper deptMapper;
    private final UserTenantMembershipMapper userTenantMembershipMapper;
    private final TenantAuthorityService tenantAuthorityService;
    private final ApprovalAssignmentService approvalAssignmentService;

    public Page<AssetCompensation> queryCompensations(Integer page, Integer pageSize, String status, Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        Page<AssetCompensation> pageParam = new Page<>(normalizePage(page), normalizePageSize(pageSize));
        QueryWrapper<AssetCompensation> wrapper = new QueryWrapper<>();
        wrapper.eq("tenant_id", tenantId);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);

        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        if (assetId != null) {
            loadAccessibleAsset(assetId, tenantId);
            wrapper.eq("asset_id", assetId);
        }
        wrapper.orderByDesc("create_time");

        return assetCompensationMapper.selectPage(pageParam, wrapper);
    }

    public AssetCompensation getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        AssetCompensation compensation = assetCompensationMapper.selectOne(new QueryWrapper<AssetCompensation>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (compensation == null) {
            throw new BusinessException("赔偿记录不存在");
        }
        loadAccessibleAsset(compensation.getAssetId(), tenantId);
        return compensation;
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetCompensation createCompensation(CompensationCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        validateCreateDTO(dto);
        User applicant = tenantAuthorityService.requireCurrentTenantMember();
        if (applicant.getId() == null) {
            throw new AccessDeniedException("当前租户成员无效");
        }
        AssetCompensation compensation = new AssetCompensation();
        BeanUtil.copyProperties(dto, compensation);
        compensation.setTenantId(tenantId);
        validateResponsibleAssociations(compensation.getResponsibleUserId(), compensation.getResponsibleDeptId(), tenantId);
        workflowDefinitionService.requirePublishedDefinition("ASSET_COMPENSATION");
        Asset targetAsset = lockEligibleAsset(compensation.getAssetId(), tenantId);
        ensureNoActiveCompensation(targetAsset.getId());
        ensureNoActiveDisposal(targetAsset.getId());
        if (compensation.getCompensationAmount() == null) {
            compensation.setCompensationAmount(estimatedAmount(targetAsset));
        }
        validateAmount(compensation.getCompensationAmount());

        BeanUtil.setProperty(compensation, "compensationNo", generateCompensationNo());
        BeanUtil.setProperty(compensation, "status", CompensationStatus.PENDING.name());
        compensation.setCreateBy(applicant.getId());
        compensation.setVersion(0);
        if (assetCompensationMapper.insert(compensation) != 1 || compensation.getId() == null) {
            throw new BusinessException("赔偿申请创建失败");
        }
        createApprovalProcess(compensation, applicant.getId());
        return compensation;
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetCompensation updateCompensation(Long id, CompensationUpdateDTO dto) {
        AssetCompensation compensation = getById(id);
        requireApplicant(compensation);
        throw new BusinessException("赔偿申请一旦提交进入审批即不可修改");
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetCompensation updateStatus(Long id, CompensationStatus targetStatus) {
        throw new AccessDeniedException("赔偿终态必须通过受控审批流程处理");
    }

    /** 只由 ApprovalService 在审批记录和流程终态均已写入后调用。 */
    @Transactional(rollbackFor = Exception.class)
    public AssetCompensation applyApprovalOutcome(Long id, String result, Long approverId, String opinion) {
        requirePermission("compensation:approve");
        AssetCompensation compensation = getById(id);
        if (compensation.getCreateBy() == null || compensation.getCreateBy().equals(approverId)) {
            throw new AccessDeniedException("申请人不能审批自己的赔偿申请");
        }
        CompensationStatus targetStatus = parseApprovalResult(result);
        CompensationStatus currentStatus = parseStatus(compensation.getStatus());
        if (!currentStatus.canTransitionTo(targetStatus)) {
            throw new BusinessException("当前赔偿申请不可处理");
        }
        requireApprovedProcess(compensation, targetStatus);
        if (targetStatus == CompensationStatus.APPROVED) {
            lockEligibleAsset(compensation.getAssetId(), TenantContext.requireTenantId());
            ensureNoActiveDisposal(compensation.getAssetId());
        }
        int version = versionOf(compensation.getVersion());
        compensation.setStatus(targetStatus.name());
        compensation.setVersion(version + 1);
        LambdaUpdateWrapper<AssetCompensation> wrapper = new LambdaUpdateWrapper<AssetCompensation>()
                .eq(AssetCompensation::getId, id)
                .eq(AssetCompensation::getTenantId, TenantContext.requireTenantId())
                .eq(AssetCompensation::getAssetId, compensation.getAssetId())
                .eq(AssetCompensation::getStatus, currentStatus.name())
                .eq(AssetCompensation::getVersion, version);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        int updated = assetCompensationMapper.update(compensation, wrapper);
        if (updated != 1) {
            throw new BusinessException("赔偿申请已变更，请刷新后重试");
        }
        return compensation;
    }

    public CompensationValuationDTO estimateCompensation(CompensationCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        if (dto.getAssetId() == null) {
            throw new BusinessException("资产不能为空");
        }
        Asset asset = loadAccessibleAsset(dto.getAssetId(), tenantId);

        BigDecimal baseAmount = estimatedAmount(asset);

        CompensationValuationDTO valuation = new CompensationValuationDTO();
        valuation.setAssetId(asset.getId());
        valuation.setCompensationType(dto.getCompensationType());
        valuation.setBaseAmount(baseAmount);
        valuation.setEstimatedAmount(baseAmount);
        valuation.setValuationBasis("按资产当前价值估算；当前价值缺失时使用资产原值。损坏比例、残值和人工覆盖规则需按审批意见确认。");
        return valuation;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteCompensation(Long id) {
        AssetCompensation compensation = getById(id);
        requireApplicant(compensation);
        CompensationStatus status = parseStatus(compensation.getStatus());
        if (status != CompensationStatus.PENDING) {
            throw new BusinessException("仅待审批赔偿申请可以删除");
        }
        requireNoPendingApprovalProcess(compensation);
        LambdaQueryWrapper<AssetCompensation> wrapper = new LambdaQueryWrapper<AssetCompensation>()
                .eq(AssetCompensation::getId, id)
                .eq(AssetCompensation::getTenantId, TenantContext.requireTenantId())
                .eq(AssetCompensation::getAssetId, compensation.getAssetId())
                .eq(AssetCompensation::getStatus, status.name())
                .eq(AssetCompensation::getVersion, versionOf(compensation.getVersion()));
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        int deleted = assetCompensationMapper.delete(wrapper);
        if (deleted != 1) {
            throw new BusinessException("赔偿申请已变更，请刷新后重试");
        }
    }

    private String generateCompensationNo() {
        String tenantId = TenantContext.requireTenantId();
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "CMP-" + dateStr + "-";

        Long count = assetCompensationMapper.selectCount(
            new QueryWrapper<AssetCompensation>()
                .eq("tenant_id", tenantId)
                .likeRight("compensation_no", prefix)
        );
        long sequence = (count == null ? 0 : count) + 1;
        // 加随机后缀防止并发 createCompensation 产生相同编号（count+1 在并发下不安全）
        String randomSuffix = String.format("%04d", java.util.concurrent.ThreadLocalRandom.current().nextInt(10000));
        return prefix + String.format("%03d", sequence) + randomSuffix;
    }

    private BigDecimal firstPositive(BigDecimal primary, BigDecimal fallback) {
        if (primary != null && primary.compareTo(BigDecimal.ZERO) > 0) {
            return primary;
        }
        if (fallback != null && fallback.compareTo(BigDecimal.ZERO) > 0) {
            return fallback;
        }
        return null;
    }

    private Asset loadAccessibleAsset(Long assetId, String tenantId) {
        Asset asset = assetMapper.selectOne(new QueryWrapper<Asset>()
                .eq("id", assetId)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }
        assetDataPermissionEvaluator.assertCanAccess(asset);
        return asset;
    }

    private Asset lockEligibleAsset(Long assetId, String tenantId) {
        Asset asset = assetMapper.selectOne(new QueryWrapper<Asset>()
                .eq("id", assetId)
                .eq("tenant_id", tenantId)
                .last("FOR UPDATE"));
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }
        assetDataPermissionEvaluator.assertCanAccess(asset);
        try {
            if (AssetStatus.fromNameOrDefault(asset.getStatus(), AssetStatus.IDLE).requiresDedicatedWorkflow()) {
                throw new BusinessException("待退役或终态资产不能关联赔偿申请");
            }
        } catch (IllegalArgumentException exception) {
            throw new BusinessException("资产状态无效");
        }
        return asset;
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

    private void ensureNoActiveDisposal(Long assetId) {
        Long count = disposalApplicationMapper.selectCount(new LambdaQueryWrapper<DisposalApplication>()
                .eq(DisposalApplication::getTenantId, TenantContext.requireTenantId())
                .eq(DisposalApplication::getAssetId, assetId)
                .eq(DisposalApplication::getStatus, "PENDING"));
        if (count != null && count > 0) {
            throw new BusinessException("该资产已有进行中的处置申请");
        }
    }

    private BigDecimal estimatedAmount(Asset asset) {
        BigDecimal baseAmount = firstPositive(asset.getCurrentValue(), asset.getOriginalValue());
        if (baseAmount == null) {
            throw new BusinessException("资产缺少估值基础金额");
        }
        return baseAmount;
    }

    private void validateCreateDTO(CompensationCreateDTO dto) {
        if (dto == null) {
            throw new BusinessException("赔偿申请不能为空");
        }
        if (dto.getResponsibleUserId() == null) {
            throw new BusinessException("赔偿责任人不能为空");
        }
        if (dto.getAssetId() == null) {
            throw new BusinessException("资产不能为空");
        }
        if (dto.getCompensationType() == null || dto.getCompensationType().isBlank()
                || dto.getCompensationType().length() > 32) {
            throw new BusinessException("赔偿类型不合法");
        }
        validateAmount(dto.getCompensationAmount());
        validateDescription(dto.getDescription());
    }

    private void validateAmount(BigDecimal amount) {
        if (amount == null) {
            return;
        }
        int integerDigits = Math.max(amount.precision() - amount.scale(), 0);
        if (amount.compareTo(BigDecimal.ZERO) <= 0 || amount.scale() > 2 || integerDigits > 8) {
            throw new BusinessException("赔偿金额不合法");
        }
    }

    private void validateDescription(String description) {
        if (description != null && description.length() > 500) {
            throw new BusinessException("赔偿说明长度不能超过500个字符");
        }
    }

    private void validateResponsibleAssociations(Long responsibleUserId, Long responsibleDeptId, String tenantId) {
        User responsibleUser = null;
        if (responsibleUserId != null) {
            responsibleUser = userMapper.selectOne(new LambdaQueryWrapper<User>()
                    .eq(User::getId, responsibleUserId)
                    .eq(User::getTenantId, tenantId)
                    .eq(User::getStatus, 1)
                    .eq(User::getDeleted, 0)
                    .last("limit 1"));
            if (responsibleUser == null || responsibleUser.getId() == null
                    || userTenantMembershipMapper.countActiveMembership(responsibleUser.getId(), tenantId) != 1) {
                throw new AccessDeniedException("责任用户不存在或不属于当前租户");
            }
        }
        if (responsibleDeptId != null) {
            Dept dept = deptMapper.selectOne(new QueryWrapper<Dept>()
                    .eq("id", responsibleDeptId)
                    .eq("tenant_id", tenantId)
                    .eq("deleted", 0)
                    .last("limit 1"));
            if (dept == null || !isEnabled(dept)) {
                throw new AccessDeniedException("责任部门不存在或不属于当前租户");
            }
            if (responsibleUser != null && !responsibleDeptId.equals(responsibleUser.getDeptId())) {
                throw new AccessDeniedException("责任用户不属于责任部门");
            }
        }
    }

    private void createApprovalProcess(AssetCompensation compensation, Long applicantId) {
        ApprovalProcess process = new ApprovalProcess();
        process.setProcessNo("CMPAPR-" + UUID.randomUUID());
        process.setProcessType(PROCESS_TYPE);
        process.setBusinessId(compensation.getId());
        process.setTenantId(compensation.getTenantId());
        process.setStatus("PENDING");
        process.setCurrentStep(1);
        process.setApplicantId(applicantId);
        process.setVersion(0);
        if (approvalProcessMapper.insert(process) != 1 || process.getId() == null) {
            throw new BusinessException("赔偿审批流程创建失败");
        }
        approvalAssignmentService.initializeForProcess(process, "ASSET_COMPENSATION");
    }

    private void requireNoPendingApprovalProcess(AssetCompensation compensation) {
        ApprovalProcess process = approvalProcessMapper.selectOne(new LambdaQueryWrapper<ApprovalProcess>()
                .eq(ApprovalProcess::getTenantId, compensation.getTenantId())
                .eq(ApprovalProcess::getProcessType, PROCESS_TYPE)
                .eq(ApprovalProcess::getBusinessId, compensation.getId())
                .eq(ApprovalProcess::getStatus, "PENDING")
                .orderByDesc(ApprovalProcess::getCreateTime)
                .orderByDesc(ApprovalProcess::getId)
                .last("limit 1"));
        if (process != null) {
            throw new BusinessException("存在进行中的赔偿审批流程，不能删除申请");
        }
    }

    private void requireApprovedProcess(AssetCompensation compensation, CompensationStatus targetStatus) {
        ApprovalProcess process = approvalProcessMapper.selectOne(new LambdaQueryWrapper<ApprovalProcess>()
                .eq(ApprovalProcess::getTenantId, compensation.getTenantId())
                .eq(ApprovalProcess::getProcessType, PROCESS_TYPE)
                .eq(ApprovalProcess::getBusinessId, compensation.getId())
                .eq(ApprovalProcess::getStatus, targetStatus.name())
                .orderByDesc(ApprovalProcess::getCreateTime)
                .orderByDesc(ApprovalProcess::getId)
                .last("limit 1"));
        if (process == null || !compensation.getCreateBy().equals(process.getApplicantId())) {
            throw new AccessDeniedException("赔偿终态必须由已完成的受控审批流程驱动");
        }
    }

    private CompensationStatus parseApprovalResult(String result) {
        if ("APPROVED".equals(result)) {
            return CompensationStatus.APPROVED;
        }
        if ("REJECTED".equals(result)) {
            return CompensationStatus.REJECTED;
        }
        throw new BusinessException("赔偿审批结果无效");
    }

    private void requireApplicant(AssetCompensation compensation) {
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        if (compensation.getCreateBy() == null || currentUser.getId() == null
                || !compensation.getCreateBy().equals(currentUser.getId())) {
            throw new AccessDeniedException("仅申请人可以修改赔偿申请");
        }
    }

    private void requirePermission(String permission) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = authentication != null
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream().anyMatch(authority -> permission.equals(authority.getAuthority()));
        if (!permitted) {
            throw new AccessDeniedException("缺少赔偿权限: " + permission);
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

    private CompensationStatus parseStatus(String status) {
        try {
            return CompensationStatus.fromStoredValue(status);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("赔偿状态无效");
        }
    }

    private boolean isEnabled(Dept dept) {
        return "1".equals(dept.getStatus()) || "ACTIVE".equalsIgnoreCase(dept.getStatus());
    }
}
