package com.ams.workflow;

import com.ams.entity.ApprovalStep;
import com.ams.entity.RetirementRequest;
import com.ams.entity.Role;
import com.ams.repository.RetirementRequestRepository;
import com.ams.repository.RoleMapper;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * ApprovalChainResolver - 审批链解析器
 * 
 * <p>负责解析和验证资产报废申请的审批链配置。
 * 支持多级串行审批流程，根据申请类型和金额自动匹配审批规则。</p>
 * 
 * <p>主要功能：</p>
 * <ul>
 *   <li>根据资产价值和类型确定所需审批级别</li>
 *   <li>验证审批人权限是否满足当前审批节点要求</li>
 *   <li>获取下一级审批节点信息</li>
 *   <li>判断审批链是否完成</li>
 * </ul>
 * 
 * <p>审批链配置规则（默认）：</p>
 * <ul>
 *   <li>Level 1: DIRECTOR (总监) - 必须</li>
 *   <li>Level 2: CFO (财务总监) - 必须</li>
 * </ul>
 * 
 * @since SWARM-002 Iteration 7
 * @see RetirementApprovalWorkflow
 * @see RetirementRequest
 */
@Component
public class ApprovalChainResolver {

    private final RetirementRequestRepository retirementRequestRepository;
    private final RoleMapper roleMapper;

    /**
     * 审批链级别对应的角色代码
     */
    private static final Map<Integer, String> APPROVAL_LEVEL_ROLES = Map.of(
        1, "DIRECTOR",
        2, "CFO"
    );

    /**
     * 每级审批所需的最小资产价值阈值（元）
     */
    private static final Map<Integer, Long> VALUE_THRESHOLDS = Map.of(
        1, 0L,      // Level 1: 任何价值都需要
        2, 10000L   // Level 2: 价值 >= 10000 需要
    );

    /**
     * 构造方法
     * 
     * @param retirementRequestRepository 报废申请仓储
     * @param roleMapper 角色Mapper
     */
    @Autowired
    public ApprovalChainResolver(
            RetirementRequestRepository retirementRequestRepository,
            RoleMapper roleMapper) {
        this.retirementRequestRepository = retirementRequestRepository;
        this.roleMapper = roleMapper;
    }

    /**
     * 根据报废申请解析审批链
     * 
     * <p>根据申请的资产价值和类型，返回完整的审批步骤列表。
     * 审批链按照级别从低到高排列。</p>
     * 
     * @param request 报废申请
     * @return 审批步骤列表，按级别排序
     * @throws IllegalArgumentException if request is null
     */
    public List<ApprovalStep> resolveApprovalChain(RetirementRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("报废申请不能为空");
        }

        List<ApprovalStep> steps = new ArrayList<>();
        
        // 根据资产价值确定需要的审批级别
        int requiredLevel = calculateRequiredLevel(request.getAssetValue());
        
        for (int level = 1; level <= requiredLevel; level++) {
            ApprovalStep step = createApprovalStep(request, level);
            steps.add(step);
        }
        
        return steps;
    }

    /**
     * 计算所需的审批级别
     * 
     * <p>根据资产价值确定需要几级审批。</p>
     * 
     * <ul>
     *   <li>价值 < 10000: 仅需 Level 1 (DIRECTOR)</li>
     *   <li>价值 >= 10000: 需要 Level 1 + Level 2 (DIRECTOR + CFO)</li>
     * </ul>
     * 
     * @param assetValue 资产价值（元）
     * @return 所需的最高级别
     */
    public int calculateRequiredLevel(Long assetValue) {
        if (assetValue == null) {
            return 1; // 默认最低级别
        }
        
        if (assetValue >= VALUE_THRESHOLDS.getOrDefault(2, 10000L)) {
            return 2;
        }
        return 1;
    }

    /**
     * 创建指定级别的审批步骤
     * 
     * @param request 报废申请
     * @param level 审批级别
     * @return 审批步骤实例
     */
    private ApprovalStep createApprovalStep(RetirementRequest request, int level) {
        ApprovalStep step = new ApprovalStep();
        step.setRequestId(request.getId());
        step.setLevel(level);
        step.setApproverRole(APPROVAL_LEVEL_ROLES.getOrDefault(level, "UNKNOWN"));
        step.setStatus("PENDING");
        return step;
    }

    /**
     * 验证审批人是否有权执行指定级别的审批
     * 
     * <p>检查审批人的角色是否匹配当前审批级别要求的角色。</p>
     * 
     * @param approverId 审批人ID
     * @param level 审批级别
     * @return true if approver has permission, false otherwise
     * @throws IllegalArgumentException if approverId is null or level is invalid
     */
    public boolean validateApproverPermission(String approverId, int level) {
        if (approverId == null || approverId.isEmpty()) {
            throw new IllegalArgumentException("审批人ID不能为空");
        }
        
        if (level < 1 || level > 2) {
            throw new IllegalArgumentException("无效的审批级别: " + level);
        }
        
        String requiredRole = APPROVAL_LEVEL_ROLES.get(level);
        if (requiredRole == null) {
            return false;
        }
        
        // 查询审批人的角色
        Role role = roleMapper.findByUserId(approverId);
        if (role == null) {
            return false;
        }
        
        return requiredRole.equals(role.getCode());
    }

    /**
     * 获取指定申请当前需要审批的级别
     * 
     * <p>根据已完成的审批步骤，返回下一个需要审批的级别。
     * 如果所有审批都已完成，返回 -1。</p>
     * 
     * @param requestId 申请ID
     * @return 下一审批级别，或 -1 表示已完成
     */
    public int getCurrentPendingLevel(Long requestId) {
        if (requestId == null) {
            throw new IllegalArgumentException("申请ID不能为空");
        }
        
        List<ApprovalStep> completedSteps = retirementRequestRepository
            .findCompletedApprovalSteps(requestId);
        
        int requiredLevel = getRequiredLevelForRequest(requestId);
        
        for (int level = 1; level <= requiredLevel; level++) {
            boolean isCompleted = completedSteps.stream()
                .anyMatch(step -> step.getLevel() == level);
            
            if (!isCompleted) {
                return level;
            }
        }
        
        return -1; // 所有审批已完成
    }

    /**
     * 获取指定申请所需的审批级别
     * 
     * @param requestId 申请ID
     * @return 所需的最高级别
     */
    private int getRequiredLevelForRequest(Long requestId) {
        RetirementRequest request = retirementRequestRepository.findById(requestId)
            .orElseThrow(() -> new IllegalArgumentException("申请不存在: " + requestId));
        
        return calculateRequiredLevel(request.getAssetValue());
    }

    /**
     * 判断审批链是否完成
     * 
     * <p>检查指定申请的所有必需审批步骤是否都已完成。</p>
     * 
     * @param requestId 申请ID
     * @return true if approval chain is complete, false otherwise
     */
    public boolean isApprovalChainComplete(Long requestId) {
        return getCurrentPendingLevel(requestId) == -1;
    }

    /**
     * 获取审批链的下一个审批人信息
     * 
     * <p>根据当前待审批级别，返回该级别可用的审批人列表。
     * 目前返回角色信息，实际系统中应查询具体用户。</p>
     * 
     * @param requestId 申请ID
     * @return 下一级审批角色代码，如果已完成则返回 null
     */
    public String getNextApproverRole(Long requestId) {
        int pendingLevel = getCurrentPendingLevel(requestId);
        
        if (pendingLevel == -1) {
            return null; // 审批已完成
        }
        
        return APPROVAL_LEVEL_ROLES.get(pendingLevel);
    }

    /**
     * 获取指定级别的审批角色代码
     * 
     * @param level 审批级别
     * @return 角色代码，如果级别无效则返回 null
     */
    public String getRoleByLevel(int level) {
        return APPROVAL_LEVEL_ROLES.get(level);
    }

    /**
     * 获取所有审批级别的角色映射
     * 
     * @return 不可修改的角色映射
     */
    public Map<Integer, String> getApprovalLevelRoles() {
        return Map.copyOf(APPROVAL_LEVEL_ROLES);
    }
}