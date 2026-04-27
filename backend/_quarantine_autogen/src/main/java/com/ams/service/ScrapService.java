package com.ams.service;

import com.ams.entity.*;
import com.ams.dto.*;
import com.ams.mapper.*;
import com.ams.common.exception.BusinessException;
import com.ams.common.Result;
import com.ams.state.RetirementState;
import com.ams.state.StateTransitionException;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 资产报废服务类
 * 
 * 负责处理资产报废申请的全生命周期管理，包括：
 * - 报废申请发起
 * - 审批链流程控制
 * - 状态流转管理
 * - 报废历史记录
 * 
 * @author AMS Team
 * @version 1.0
 * @since 2024-01-01
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScrapService {

    private final ScrapRequestMapper scrapRequestMapper;
    private final RetirementApplicationMapper retirementApplicationMapper;
    private final RetirementHistoryMapper retirementHistoryMapper;
    private final AssetMapper assetMapper;
    private final ApprovalService approvalService;
    private final ApprovalChainService approvalChainService;
    private final NotificationService notificationService;
    private final LifecycleRecorder lifecycleRecorder;

    /** 报废原因枚举 */
    public enum ScrapReason {
        DAMAGE("物理损坏"),
        OBSOLETE("技术淘汰"),
        EXPIRED("折旧到期"),
        LOSS("丢失被盗"),
        REGULATORY("政策性淘汰"),
        OTHER("其他原因");

        private final String description;

        ScrapReason(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }

    /** 报废申请状态枚举 */
    public enum ScrapStatus {
        PENDING("待审批"),
        APPROVED("已通过"),
        REJECTED("已驳回"),
        SCRAPPED("已报废"),
        WITHDRAWN("已撤回");

        private final String description;

        ScrapStatus(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }

    /**
     * 创建资产报废申请
     * 
     * @param assetId 资产ID
     * @param userId 申请人ID
     * @param dto 报废申请数据
     * @return 报废申请结果
     * @throws BusinessException 当资产不可报废时抛出
     */
    @Transactional(rollbackFor = Exception.class)
    public Result<ScrapRequestDTO> createScrapRequest(Long assetId, Long userId, ScrapRequestDTO dto) {
        // 1. 校验资产存在性
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new BusinessException("ASSET_NOT_FOUND", "资产不存在");
        }

        // 2. 校验资产状态是否可以报废
        validateAssetForScrap(asset);

        // 3. 校验是否存在重复申请
        checkDuplicateScrapRequest(assetId);

        // 4. 生成申请单号
        String applicationNo = generateApplicationNo();

        // 5. 创建报废申请记录
        ScrapRequest scrapRequest = ScrapRequest.builder()
                .applicationNo(applicationNo)
                .assetId(assetId)
                .reason(dto.getReason())
                .description(dto.getDescription())
                .status(ScrapStatus.PENDING.name())
                .currentNode(1)
                .totalNodes(getApprovalNodeCount())
                .applicantId(userId)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        scrapRequestMapper.insert(scrapRequest);

        // 6. 记录生命周期历史
        lifecycleRecorder.recordScrapCreated(scrapRequest);

        // 7. 发送审批通知
        notificationService.sendScrapApplicationCreatedNotification(scrapRequest);

        log.info("资产报废申请创建成功: applicationNo={}, assetId={}, userId={}", 
                applicationNo, assetId, userId);

        // 8. 构建返回结果
        ScrapRequestDTO result = ScrapRequestDTO.builder()
                .id(scrapRequest.getId())
                .applicationNo(applicationNo)
                .assetId(assetId)
                .reason(scrapRequest.getReason())
                .description(scrapRequest.getDescription())
                .status(scrapRequest.getStatus())
                .currentNode(scrapRequest.getCurrentNode())
                .totalNodes(scrapRequest.getTotalNodes())
                .createdAt(scrapRequest.getCreatedAt())
                .build();

        return Result.success(result);
    }

    /**
     * 审批报废申请（通过）
     * 
     * @param applicationId 申请ID
     * @param userId 审批人ID
     * @param node 当前审批节点
     * @param comment 审批意见
     * @return 审批结果
     * @throws BusinessException 审批条件不满足时抛出
     */
    @Transactional(rollbackFor = Exception.class)
    public Result<ScrapRequestDTO> approveScrapRequest(Long applicationId, Long userId, 
                                                        Integer node, String comment) {
        // 1. 获取报废申请
        ScrapRequest scrapRequest = scrapRequestMapper.selectById(applicationId);
        if (scrapRequest == null) {
            throw new BusinessException("APPLICATION_NOT_FOUND", "报废申请不存在");
        }

        // 2. 校验申请状态
        if (!ScrapStatus.PENDING.name().equals(scrapRequest.getStatus())) {
            throw new BusinessException("INVALID_APPLICATION_STATUS", 
                    "申请状态无效，当前状态：" + scrapRequest.getStatus());
        }

        // 3. 校验审批节点顺序
        validateApprovalSequence(scrapRequest, node);

        // 4. 校验审批人权限
        validateApproverPermission(userId, scrapRequest);

        // 5. 记录审批操作
        RetirementHistory history = RetirementHistory.builder()
                .applicationId(applicationId)
                .assetId(scrapRequest.getAssetId())
                .action("APPROVED")
                .operatorId(userId)
                .node(node)
                .comment(comment)
                .createdAt(LocalDateTime.now())
                .build();
        retirementHistoryMapper.insert(history);

        // 6. 判断是否为最终审批节点
        boolean isFinalNode = node >= scrapRequest.getTotalNodes();

        if (isFinalNode) {
            // 最终审批通过，执行报废操作
            scrapRequest.setStatus(ScrapStatus.SCRAPPED.name());
            scrapRequest.setUpdatedAt(LocalDateTime.now());
            scrapRequestMapper.updateById(scrapRequest);

            // 更新资产状态
            Asset asset = assetMapper.selectById(scrapRequest.getAssetId());
            asset.setStatus("SCRAPPED");
            asset.setUpdatedAt(LocalDateTime.now());
            assetMapper.updateById(asset);

            // 记录最终报废历史
            lifecycleRecorder.recordAssetScrapped(asset, scrapRequest);

            // 发送报废完成通知
            notificationService.sendAssetScrappedNotification(asset, scrapRequest);

            log.info("资产报废完成: applicationNo={}, assetId={}", 
                    scrapRequest.getApplicationNo(), scrapRequest.getAssetId());
        } else {
            // 中间节点审批通过，推进到下一节点
            scrapRequest.setStatus(ScrapStatus.PENDING.name());
            scrapRequest.setCurrentNode(node + 1);
            scrapRequest.setUpdatedAt(LocalDateTime.now());
            scrapRequestMapper.updateById(scrapRequest);

            // 发送节点推进通知
            notificationService.sendApprovalNodeAdvancedNotification(scrapRequest, node + 1);

            log.info("报废申请审批节点推进: applicationNo={}, fromNode={}, toNode={}", 
                    scrapRequest.getApplicationNo(), node, node + 1);
        }

        // 7. 返回更新后的申请信息
        ScrapRequestDTO result = ScrapRequestDTO.builder()
                .id(scrapRequest.getId())
                .applicationNo(scrapRequest.getApplicationNo())
                .assetId(scrapRequest.getAssetId())
                .reason(scrapRequest.getReason())
                .description(scrapRequest.getDescription())
                .status(scrapRequest.getStatus())
                .currentNode(scrapRequest.getCurrentNode())
                .totalNodes(scrapRequest.getTotalNodes())
                .createdAt(scrapRequest.getCreatedAt())
                .updatedAt(scrapRequest.getUpdatedAt())
                .build();

        return Result.success(result);
    }

    /**
     * 驳回报废申请
     * 
     * @param applicationId 申请ID
     * @param userId 审批人ID
     * @param comment 驳回原因
     * @return 驳回结果
     * @throws BusinessException 驳回条件不满足时抛出
     */
    @Transactional(rollbackFor = Exception.class)
    public Result<ScrapRequestDTO> rejectScrapRequest(Long applicationId, Long userId, String comment) {
        // 1. 获取报废申请
        ScrapRequest scrapRequest = scrapRequestMapper.selectById(applicationId);
        if (scrapRequest == null) {
            throw new BusinessException("APPLICATION_NOT_FOUND", "报废申请不存在");
        }

        // 2. 校验申请状态
        if (!ScrapStatus.PENDING.name().equals(scrapRequest.getStatus())) {
            throw new BusinessException("INVALID_APPLICATION_STATUS", 
                    "申请状态无效，当前状态：" + scrapRequest.getStatus());
        }

        // 3. 校验审批人权限
        validateApproverPermission(userId, scrapRequest);

        // 4. 更新申请状态
        scrapRequest.setStatus(ScrapStatus.REJECTED.name());
        scrapRequest.setUpdatedAt(LocalDateTime.now());
        scrapRequestMapper.updateById(scrapRequest);

        // 5. 记录驳回历史
        RetirementHistory history = RetirementHistory.builder()
                .applicationId(applicationId)
                .assetId(scrapRequest.getAssetId())
                .action("REJECTED")
                .operatorId(userId)
                .node(scrapRequest.getCurrentNode())
                .comment(comment)
                .createdAt(LocalDateTime.now())
                .build();
        retirementHistoryMapper.insert(history);

        // 6. 发送驳回通知
        notificationService.sendScrapRejectedNotification(scrapRequest, comment);

        log.info("报废申请被驳回: applicationNo={}, rejector={}, reason={}", 
                scrapRequest.getApplicationNo(), userId, comment);

        // 7. 返回结果
        ScrapRequestDTO result = ScrapRequestDTO.builder()
                .id(scrapRequest.getId())
                .applicationNo(scrapRequest.getApplicationNo())
                .assetId(scrapRequest.getAssetId())
                .status(scrapRequest.getStatus())
                .updatedAt(scrapRequest.getUpdatedAt())
                .build();

        return Result.success(result);
    }

    /**
     * 撤回报废申请
     * 
     * 仅在 PENDING 状态下可撤回，已进入审批流后不可撤回
     * 
     * @param applicationId 申请ID
     * @param userId 申请人ID
     * @return 撤回结果
     * @throws BusinessException 撤回条件不满足时抛出
     */
    @Transactional(rollbackFor = Exception.class)
    public Result<ScrapRequestDTO> withdrawScrapRequest(Long applicationId, Long userId) {
        // 1. 获取报废申请
        ScrapRequest scrapRequest = scrapRequestMapper.selectById(applicationId);
        if (scrapRequest == null) {
            throw new BusinessException("APPLICATION_NOT_FOUND", "报废申请不存在");
        }

        // 2. 校验是否为申请人
        if (!scrapRequest.getApplicantId().equals(userId)) {
            throw new BusinessException("NOT_APPLICATION_OWNER", "只有申请人可以撤回申请");
        }

        // 3. 校验申请状态
        if (!ScrapStatus.PENDING.name().equals(scrapRequest.getStatus())) {
            throw new BusinessException("CANNOT_WITHDRAW", 
                    "当前状态不允许撤回，仅待审批状态可撤回");
        }

        // 4. 更新申请状态
        scrapRequest.setStatus(ScrapStatus.WITHDRAWN.name());
        scrapRequest.setUpdatedAt(LocalDateTime.now());
        scrapRequestMapper.updateById(scrapRequest);

        // 5. 记录撤回历史
        RetirementHistory history = RetirementHistory.builder()
                .applicationId(applicationId)
                .assetId(scrapRequest.getAssetId())
                .action("WITHDRAWN")
                .operatorId(userId)
                .node(scrapRequest.getCurrentNode())
                .comment("申请人主动撤回")
                .createdAt(LocalDateTime.now())
                .build();
        retirementHistoryMapper.insert(history);

        log.info("报废申请已撤回: applicationNo={}, userId={}", 
                scrapRequest.getApplicationNo(), userId);

        // 6. 返回结果
        ScrapRequestDTO result = ScrapRequestDTO.builder()
                .id(scrapRequest.getId())
                .applicationNo(scrapRequest.getApplicationNo())
                .assetId(scrapRequest.getAssetId())
                .status(scrapRequest.getStatus())
                .updatedAt(scrapRequest.getUpdatedAt())
                .build();

        return Result.success(result);
    }

    /**
     * 查询报废申请详情
     * 
     * @param applicationId 申请ID
     * @return 申请详情
     * @throws BusinessException 申请不存在时抛出
     */
    public Result<ScrapRequestDTO> getScrapRequest(Long applicationId) {
        ScrapRequest scrapRequest = scrapRequestMapper.selectById(applicationId);
        if (scrapRequest == null) {
            throw new BusinessException("APPLICATION_NOT_FOUND", "报废申请不存在");
        }

        ScrapRequestDTO result = ScrapRequestDTO.builder()
                .id(scrapRequest.getId())
                .applicationNo(scrapRequest.getApplicationNo())
                .assetId(scrapRequest.getAssetId())
                .reason(scrapRequest.getReason())
                .description(scrapRequest.getDescription())
                .status(scrapRequest.getStatus())
                .currentNode(scrapRequest.getCurrentNode())
                .totalNodes(scrapRequest.getTotalNodes())
                .applicantId(scrapRequest.getApplicantId())
                .createdAt(scrapRequest.getCreatedAt())
                .updatedAt(scrapRequest.getUpdatedAt())
                .build();

        return Result.success(result);
    }

    /**
     * 分页查询报废申请列表
     * 
     * @param pageNum 页码
     * @param pageSize 每页数量
     * @param status 状态筛选（可选）
     * @param assetId 资产ID筛选（可选）
     * @return 分页结果
     */
    public Result<Page<ScrapRequestDTO>> listScrapRequests(Integer pageNum, Integer pageSize,
                                                            String status, Long assetId) {
        Page<ScrapRequest> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<ScrapRequest> wrapper = new LambdaQueryWrapper<>();

        if (status != null && !status.isEmpty()) {
            wrapper.eq(ScrapRequest::getStatus, status);
        }
        if (assetId != null) {
            wrapper.eq(ScrapRequest::getAssetId, assetId);
        }

        wrapper.orderByDesc(ScrapRequest::getCreatedAt);

        IPage<ScrapRequest> resultPage = scrapRequestMapper.selectPage(page, wrapper);

        // 转换结果
        Page<ScrapRequestDTO> dtoPage = new Page<>(resultPage.getCurrent(), 
                resultPage.getSize(), resultPage.getTotal());
        dtoPage.setRecords(resultPage.getRecords().stream().map(sr -> 
                ScrapRequestDTO.builder()
                        .id(sr.getId())
                        .applicationNo(sr.getApplicationNo())
                        .assetId(sr.getAssetId())
                        .reason(sr.getReason())
                        .description(sr.getDescription())
                        .status(sr.getStatus())
                        .currentNode(sr.getCurrentNode())
                        .totalNodes(sr.getTotalNodes())
                        .applicantId(sr.getApplicantId())
                        .createdAt(sr.getCreatedAt())
                        .updatedAt(sr.getUpdatedAt())
                        .build()
        ).toList());

        return Result.success(dtoPage);
    }

    /**
     * 查询资产报废历史记录
     * 
     * @param assetId 资产ID
     * @return 报废历史列表
     */
    public Result<List<RetirementHistoryDTO>> getScrapHistory(Long assetId) {
        LambdaQueryWrapper<RetirementHistory> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(RetirementHistory::getAssetId, assetId)
               .orderByAsc(RetirementHistory::getCreatedAt);

        List<RetirementHistory> histories = retirementHistoryMapper.selectList(wrapper);

        List<RetirementHistoryDTO> result = histories.stream().map(h -> 
                RetirementHistoryDTO.builder()
                        .id(h.getId())
                        .applicationId(h.getApplicationId())
                        .assetId(h.getAssetId())
                        .action(h.getAction())
                        .operatorId(h.getOperatorId())
                        .node(h.getNode())
                        .comment(h.getComment())
                        .createdAt(h.getCreatedAt())
                        .build()
        ).toList();

        return Result.success(result);
    }

    /**
     * 按申请单号查询报废申请
     * 
     * @param applicationNo 申请单号
     * @return 申请详情
     */
    public Result<ScrapRequestDTO> getScrapRequestByNo(String applicationNo) {
        LambdaQueryWrapper<ScrapRequest> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ScrapRequest::getApplicationNo, applicationNo);

        ScrapRequest scrapRequest = scrapRequestMapper.selectOne(wrapper);
        if (scrapRequest == null) {
            throw new BusinessException("APPLICATION_NOT_FOUND", "报废申请不存在");
        }

        ScrapRequestDTO result = ScrapRequestDTO.builder()
                .id(scrapRequest.getId())
                .applicationNo(scrapRequest.getApplicationNo())
                .assetId(scrapRequest.getAssetId())
                .reason(scrapRequest.getReason())
                .description(scrapRequest.getDescription())
                .status(scrapRequest.getStatus())
                .currentNode(scrapRequest.getCurrentNode())
                .totalNodes(scrapRequest.getTotalNodes())
                .applicantId(scrapRequest.getApplicantId())
                .createdAt(scrapRequest.getCreatedAt())
                .updatedAt(scrapRequest.getUpdatedAt())
                .build();

        return Result.success(result);
    }

    // ==================== 私有方法 ====================

    /**
     * 校验资产是否可以报废
     * 
     * @param asset 资产对象
     * @throws BusinessException 不可报废时抛出
     */
    private void validateAssetForScrap(Asset asset) {
        String status = asset.getStatus();

        // 不可报废的资产状态
        if ("SCRAPPED".equals(status)) {
            throw new BusinessException("ASSET_ALREADY_SCRAPPED", "资产已报废");
        }
        if ("IN_REPAIR".equals(status)) {
            throw new BusinessException("ASSET_UNDER_REPAIR", "资产正在维修中");
        }

        // 可报废的资产状态
        List<String> scrapableStatuses = List.of("IN_USE", "IDLE", "PENDING");
        if (!scrapableStatuses.contains(status)) {
            throw new BusinessException("INVALID_ASSET_STATUS", 
                    "当前资产状态不允许报废: " + status);
        }
    }

    /**
     * 检查是否存在重复的报废申请
     * 
     * @param assetId 资产ID
     * @throws BusinessException 存在重复申请时抛出
     */
    private void checkDuplicateScrapRequest(Long assetId) {
        LambdaQueryWrapper<ScrapRequest> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ScrapRequest::getAssetId, assetId)
               .eq(ScrapRequest::getStatus, ScrapStatus.PENDING.name());

        Long count = scrapRequestMapper.selectCount(wrapper);
        if (count > 0) {
            throw new BusinessException("DUPLICATE_SCRAP_REQUEST", 
                    "该资产存在待审批的报废申请，请勿重复提交");
        }
    }

    /**
     * 校验审批节点顺序
     * 
     * @param scrapRequest 报废申请
     * @param node 当前节点
     * @throws BusinessException 节点顺序错误时抛出
     */
    private void validateApprovalSequence(ScrapRequest scrapRequest, Integer node) {
        if (!node.equals(scrapRequest.getCurrentNode())) {
            throw new BusinessException("INVALID_APPROVAL_SEQUENCE", 
                    "审批节点顺序错误，请按顺序审批");
        }
    }

    /**
     * 校验审批人权限
     * 
     * @param userId 用户ID
     * @param scrapRequest 报废申请
     * @throws BusinessException 无权限时抛出
     */
    private void validateApproverPermission(Long userId, ScrapRequest scrapRequest) {
        // 调用权限服务验证审批人是否有权限审批该节点
        boolean hasPermission = approvalChainService.hasApprovalPermission(
                userId, scrapRequest.getAssetId(), scrapRequest.getCurrentNode());
        
        if (!hasPermission) {
            throw new BusinessException("UNAUTHORIZED_APPROVER", "无权限审批该报废申请");
        }
    }

    /**
     * 获取审批链节点数量
     * 
     * @return 节点数量
     */
    private int getApprovalNodeCount() {
        // 从审批链配置获取报废流程的节点数量
        return approvalChainService.getApprovalNodeCount("SCRAP");
    }

    /**
     * 生成申请单号
     * 
     * 格式: SCR-YYYYMMDD-XXXX
     * 
     * @return 申请单号
     */
    private String generateApplicationNo() {
        String datePart = java.time.LocalDate.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randomPart = String.format("%04d", 
                (int) (Math.random() * 10000));
        return "SCR-" + datePart + "-" + randomPart;
    }
}