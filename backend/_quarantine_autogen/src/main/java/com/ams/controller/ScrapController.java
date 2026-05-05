package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.ScrapRequestDTO;
import com.ams.dto.AssetScrapDTO;
import com.ams.service.ScrapService;
import com.ams.entity.RetirementHistory;
import com.ams.entity.ScrapRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * 资产报废退役流程控制器
 * 
 * <p>提供资产报废申请的发起、审批、撤回以及历史记录查询等完整生命周期管理功能。
 * 支持多级审批链配置，实现资产状态的正确流转控制。</p>
 * 
 * <p>主要功能包括：
 * <ul>
 *   <li>报废申请发起 - 资产管理员可发起报废申请</li>
 *   <li>审批流程管理 - 支持多级审批节点的状态推进</li>
 *   <li>申请撤回 - 仅在待审批状态可撤回</li>
 *   <li>历史记录追溯 - 完整的报废流程审计日志</li>
 * </ul>
 * </p>
 * 
 * <p><b>状态机转换规则：</b>
 * <ul>
 *   <li>PENDING → APPROVED (审批通过)</li>
 *   <li>PENDING → REJECTED (审批驳回)</li>
 *   <li>PENDING → WITHDRAWN (申请人撤回)</li>
 *   <li>APPROVED → SCRAPPED (最终审批完成)</li>
 * </ul>
 * </p>
 * 
 * @see ScrapService
 * @see com.ams.state.RetirementState
 * @author SWARM-002 Team
 * @version 1.0.0
 * @since Iteration-1
 */
@Slf4j
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "资产报废管理", description = "提供资产报废申请、审批、历史查询等功能")
public class ScrapController {

    private final ScrapService scrapService;

    /**
     * 发起资产报废申请
     * 
     * <p>允许用户对状态为 IN_USE、IDLE 或 PENDING 的资产发起报废申请。
     * 系统将自动分配申请单号并创建审批流程。</p>
     * 
     * <p><b>前置条件：</b>
     * <ul>
     *   <li>资产状态不为 SCRAPPED 或 IN_REPAIR</li>
     *   <li>资产无未解决的维保单</li>
     *   <li>申请人已通过认证</li>
     *   <li>审批链已配置</li>
     * </ul>
     * </p>
     * 
     * <p><b>业务规则：</b>
     * <ul>
     *   <li>同一资产同时只能有一个有效的报废申请</li>
     *   <li>必须上传至少一张资产照片或鉴定报告</li>
     *   <li>报废原因必须在枚举范围内</li>
     * </ul>
     * </p>
     * 
     * @param assetId 资产ID (UUID格式)
     * @param requestDTO 报废申请请求数据
     * @return 创建成功的报废申请信息，包含申请单号和初始状态
     * @see <a href="SPEC.md#ATB-001">ATB-001: 报废申请创建</a>
     */
    @PostMapping("/assets/{assetId}/scrapp")
    @Operation(
        summary = "发起资产报废申请",
        description = "为指定资产创建报废申请单，进入审批流程"
    )
    @PreAuthorize("hasAnyRole('ASSET_MANAGER', 'ADMIN')")
    public ResponseEntity<Result<ScrapRequestDTO>> createScrapApplication(
            @Parameter(description = "资产ID", required = true)
            @PathVariable UUID assetId,
            @Parameter(description = "报废申请信息", required = true)
            @RequestBody @Validated ScrapRequestDTO requestDTO) {
        
        log.info("[报废申请] 创建报废申请 - assetId: {}, reason: {}", 
                 assetId, requestDTO.getReason());
        
        try {
            ScrapRequestDTO result = scrapService.initiateScrap(assetId, requestDTO);
            log.info("[报废申请] 申请创建成功 - applicationNo: {}", result.getApplicationNo());
            return ResponseEntity
                    .status(HttpStatus.CREATED)
                    .body(Result.success(result));
        } catch (IllegalStateException e) {
            log.warn("[报废申请] 创建失败 - assetId: {}, error: {}", assetId, e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Result.error(e.getMessage()));
        } catch (IllegalArgumentException e) {
            log.warn("[报废申请] 参数错误 - assetId: {}, error: {}", assetId, e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(Result.error(e.getMessage()));
        }
    }

    /**
     * 查询报废申请列表
     * 
     * <p>支持分页查询和条件筛选，返回符合条件的报废申请单列表。
     * 可按申请单号、资产ID、状态等进行过滤。</p>
     * 
     * @param applicationNo 申请单号 (可选，精确匹配)
     * @param assetId 资产ID (可选)
     * @param status 申请状态 (可选)
     * @param pageable 分页参数
     * @return 分页后的报废申请列表
     */
    @GetMapping("/scrap-applications")
    @Operation(
        summary = "查询报废申请列表",
        description = "分页查询报废申请单列表，支持多条件筛选"
    )
    @PreAuthorize("hasAnyRole('ASSET_MANAGER', 'ADMIN', 'AUDITOR')")
    public ResponseEntity<Result<Page<ScrapRequestDTO>>> listScrapApplications(
            @Parameter(description = "申请单号")
            @RequestParam(required = false) String applicationNo,
            @Parameter(description = "资产ID")
            @RequestParam(required = false) UUID assetId,
            @Parameter(description = "申请状态")
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        
        log.debug("[报废申请] 查询列表 - applicationNo: {}, assetId: {}, status: {}", 
                  applicationNo, assetId, status);
        
        Page<ScrapRequestDTO> result = scrapService.listApplications(
                applicationNo, assetId, status, pageable);
        
        return ResponseEntity.ok(Result.success(result));
    }

    /**
     * 查询报废申请详情
     * 
     * <p>根据申请单ID查询完整的报废申请信息，包括审批历史和附件列表。</p>
     * 
     * @param id 报废申请ID (UUID格式)
     * @return 报废申请详细信息
     */
    @GetMapping("/scrap-applications/{id}")
    @Operation(
        summary = "查询报废申请详情",
        description = "根据ID查询报废申请单的完整信息"
    )
    @PreAuthorize("hasAnyRole('ASSET_MANAGER', 'ADMIN', 'AUDITOR')")
    public ResponseEntity<Result<ScrapRequestDTO>> getScrapApplication(
            @Parameter(description = "报废申请ID", required = true)
            @PathVariable UUID id) {
        
        log.debug("[报废申请] 查询详情 - id: {}", id);
        
        return scrapService.getApplicationById(id)
                .map(dto -> ResponseEntity.ok(Result.success(dto)))
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body(Result.error("报废申请不存在")));
    }

    /**
     * 审批报废申请（通过）
     * 
     * <p>审批人可对处于 PENDING 状态的报废申请进行审批操作。
     * 系统将验证审批顺序，阻止跨节点审批。</p>
     * 
     * <p><b>审批规则：</b>
     * <ul>
     *   <li>用户必须在当前审批节点的处理人列表中</li>
     *   <li>必须按节点顺序依次审批，禁止跳级</li>
     *   <li>最终节点审批完成后，资产状态将变更为 SCRAPPED</li>
     * </ul>
     * </p>
     * 
     * @param id 报废申请ID (UUID格式)
     * @param node 当前审批节点编号 (从1开始)
     * @param comment 审批意见 (可选)
     * @return 审批操作结果
     * @see <a href="SPEC.md#ATB-002">ATB-002: 审批链状态流转</a>
     */
    @PostMapping("/scrap-applications/{id}/approve")
    @Operation(
        summary = "审批通过报废申请",
        description = "审批人通过指定节点的报废申请，若为最终节点则完成报废"
    )
    @PreAuthorize("hasAnyRole('DEPT_MANAGER', 'ADMIN', 'FINANCE')")
    public ResponseEntity<Result<ScrapRequestDTO>> approveScrapApplication(
            @Parameter(description = "报废申请ID", required = true)
            @PathVariable UUID id,
            @Parameter(description = "审批节点编号", required = true)
            @RequestParam(defaultValue = "1") Integer node,
            @Parameter(description = "审批意见")
            @RequestParam(required = false) String comment) {
        
        log.info("[报废申请] 审批通过 - id: {}, node: {}, approverComment: {}", 
                 id, node, comment);
        
        try {
            ScrapRequestDTO result = scrapService.approveApplication(id, node, comment);
            log.info("[报废申请] 审批成功 - id: {}, newStatus: {}", id, result.getStatus());
            return ResponseEntity.ok(Result.success(result));
        } catch (SecurityException e) {
            log.warn("[报废申请] 权限不足 - id: {}, error: {}", id, e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.FORBIDDEN)
                    .body(Result.error(e.getMessage()));
        } catch (IllegalStateException e) {
            log.warn("[报废申请] 状态错误 - id: {}, error: {}", id, e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Result.error(e.getMessage()));
        }
    }

    /**
     * 驳回报废申请
     * 
     * <p>审批人可驳回处于 PENDING 状态的报废申请。
     * 驳回后申请进入 REJECTED 终态，不可再修改。</p>
     * 
     * <p><b>业务规则：</b>
     * <ul>
     *   <li>驳回后资产状态保持不变</li>
     *   <li>驳回为终态操作，不可撤回</li>
     *   <li>系统将发送通知给申请人</li>
     * </ul>
     * </p>
     * 
     * @param id 报废申请ID (UUID格式)
     * @param comment 驳回原因 (必填)
     * @return 驳回操作结果
     */
    @PostMapping("/scrap-applications/{id}/reject")
    @Operation(
        summary = "驳回报废申请",
        description = "审批人驳回报废申请，需提供驳回原因"
    )
    @PreAuthorize("hasAnyRole('DEPT_MANAGER', 'ADMIN', 'FINANCE')")
    public ResponseEntity<Result<ScrapRequestDTO>> rejectScrapApplication(
            @Parameter(description = "报废申请ID", required = true)
            @PathVariable UUID id,
            @Parameter(description = "驳回原因", required = true)
            @RequestParam String comment) {
        
        log.info("[报废申请] 驳回申请 - id: {}, rejectReason: {}", id, comment);
        
        try {
            ScrapRequestDTO result = scrapService.rejectApplication(id, comment);
            log.info("[报废申请] 驳回成功 - id: {}", id);
            return ResponseEntity.ok(Result.success(result));
        } catch (IllegalStateException e) {
            log.warn("[报废申请] 驳回失败 - id: {}, error: {}", id, e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Result.error(e.getMessage()));
        }
    }

    /**
     * 撤回报废申请
     * 
     * <p>申请人可在申请处于 PENDING 状态时撤回申请。
     * 撤回后申请进入 WITHDRAWN 终态。</p>
     * 
     * <p><b>限制条件：</b>
     * <ul>
     *   <li>仅申请人可以撤回自己的申请</li>
     *   <li>仅 PENDING 状态可撤回</li>
     *   <li>已进入审批流的申请不可撤回</li>
     * </ul>
     * </p>
     * 
     * @param id 报废申请ID (UUID格式)
     * @return 撤回操作结果
     * @see <a href="SPEC.md#ATB-003">ATB-003: 报废申请撤回</a>
     */
    @PostMapping("/scrap-applications/{id}/withdraw")
    @Operation(
        summary = "撤回报废申请",
        description = "申请人撤回自己提交的报废申请（仅待审批状态）"
    )
    @PreAuthorize("hasAnyRole('ASSET_MANAGER', 'ADMIN')")
    public ResponseEntity<Result<ScrapRequestDTO>> withdrawScrapApplication(
            @Parameter(description = "报废申请ID", required = true)
            @PathVariable UUID id) {
        
        log.info("[报废申请] 撤回申请 - id: {}", id);
        
        try {
            ScrapRequestDTO result = scrapService.withdrawApplication(id);
            log.info("[报废申请] 撤回成功 - id: {}", id);
            return ResponseEntity.ok(Result.success(result));
        } catch (SecurityException e) {
            log.warn("[报废申请] 撤回失败 - 权限不足 - id: {}, error: {}", id, e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.FORBIDDEN)
                    .body(Result.error(e.getMessage()));
        } catch (IllegalStateException e) {
            log.warn("[报废申请] 撤回失败 - 状态错误 - id: {}, error: {}", id, e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Result.error(e.getMessage()));
        }
    }

    /**
     * 查询资产报废历史记录
     * 
     * <p>返回指定资产的所有报废相关操作历史，包括申请创建、审批节点流转、状态变更等。
     * 用于审计追溯和流程分析。</p>
     * 
     * <p><b>记录内容：</b>
     * <ul>
     *   <li>CREATED - 申请创建</li>
     *   <li>APPROVED - 审批通过</li>
     *   <li>REJECTED - 审批驳回</li>
     *   <li>SCRAPPED - 报废完成</li>
     *   <li>WITHDRAWN - 申请人撤回</li>
     * </ul>
     * </p>
     * 
     * @param assetId 资产ID (UUID格式)
     * @return 报废历史记录列表（按时间倒序）
     * @see <a href="SPEC.md#ATB-004">ATB-004: 报废历史记录查询</a>
     */
    @GetMapping("/assets/{assetId}/scrap-history")
    @Operation(
        summary = "查询资产报废历史",
        description = "获取指定资产的所有报废流程历史记录"
    )
    @PreAuthorize("hasAnyRole('ASSET_MANAGER', 'ADMIN', 'AUDITOR')")
    public ResponseEntity<Result<List<RetirementHistory>>> getScrapHistory(
            @Parameter(description = "资产ID", required = true)
            @PathVariable UUID assetId) {
        
        log.debug("[报废申请] 查询历史 - assetId: {}", assetId);
        
        List<RetirementHistory> history = scrapService.getScrapHistory(assetId);
        
        return ResponseEntity.ok(Result.success(history));
    }

    /**
     * 获取可报废资产列表
     * 
     * <p>查询当前状态下允许发起报废申请的资产列表。
     * 筛选条件包括资产状态为 IN_USE、IDLE 或 PENDING。</p>
     * 
     * @param pageable 分页参数
     * @return 可报废资产分页列表
     */
    @GetMapping("/assets/scrappable")
    @Operation(
        summary = "查询可报废资产",
        description = "获取当前允许发起报废申请的资产列表"
    )
    @PreAuthorize("hasAnyRole('ASSET_MANAGER', 'ADMIN')")
    public ResponseEntity<Result<Page<AssetScrapDTO>>> listScrappableAssets(
            @PageableDefault(size = 20) Pageable pageable) {
        
        log.debug("[报废申请] 查询可报废资产列表");
        
        Page<AssetScrapDTO> result = scrapService.listScrappableAssets(pageable);
        
        return ResponseEntity.ok(Result.success(result));
    }
}