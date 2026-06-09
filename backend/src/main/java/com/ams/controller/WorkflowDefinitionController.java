package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.dto.CreateCustomDefinitionRequest;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.security.LoginUser;
import com.ams.service.WorkflowDefinitionService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/workflows")
@RequiredArgsConstructor
public class WorkflowDefinitionController {

    private final WorkflowDefinitionService workflowDefinitionService;
    private final JwtUtil jwtUtil;

    @PreAuthorize("@ss.hasPermi('workflow:definition:query')")
    @GetMapping
    public Result<List<WorkflowDefinitionDTO>> list() {
        return Result.success(workflowDefinitionService.listDefinitions());
    }

    @PreAuthorize("@ss.hasPermi('workflow:definition:query')")
    @GetMapping("/{businessType}")
    public Result<WorkflowDefinitionDTO> get(@PathVariable String businessType) {
        return Result.success(workflowDefinitionService.getDefinition(businessType));
    }

    @PutMapping("/{businessType}/draft")
    @PreAuthorize("@ss.hasPermi('workflow:definition:edit')")
    public Result<WorkflowDefinitionDTO> saveDraft(
            @PathVariable String businessType,
            @Valid @RequestBody WorkflowDefinitionSaveDTO dto,
            HttpServletRequest request) {
        Long operatorId = getCurrentUserId(request);
        return Result.success(workflowDefinitionService.saveDraft(businessType, dto, operatorId));
    }

    @PostMapping("/{businessType}/publish")
    @PreAuthorize("@ss.hasPermi('workflow:definition:edit')")
    public Result<WorkflowDefinitionDTO> publish(
            @PathVariable String businessType,
            HttpServletRequest request) {
        Long operatorId = getCurrentUserId(request);
        return Result.success(workflowDefinitionService.publish(businessType, operatorId));
    }

    @PostMapping("/{businessType}/status")
    @PreAuthorize("@ss.hasPermi('workflow:definition:edit')")
    public Result<WorkflowDefinitionDTO> updateStatus(
            @PathVariable String businessType,
            @Valid @RequestBody WorkflowStatusUpdateDTO dto,
            HttpServletRequest request) {
        Long operatorId = getCurrentUserId(request);
        return Result.success(workflowDefinitionService.updateStatus(businessType, dto, operatorId));
    }

    @PostMapping("/custom")
    @PreAuthorize("@ss.hasPermi('workflow:definition:edit')")
    public Result<WorkflowDefinitionDTO> createCustomDefinition(
            @Valid @RequestBody CreateCustomDefinitionRequest req,
            HttpServletRequest request) {
        Long operatorId = getCurrentUserId(request);
        return Result.success(workflowDefinitionService.createCustomDefinition(
                req.getBusinessType(), req.getName(), req.getDescription(), operatorId));
    }

    @DeleteMapping("/{businessType}")
    @PreAuthorize("@ss.hasPermi('workflow:definition:edit')")
    public Result<Void> deleteDefinition(@PathVariable String businessType) {
        workflowDefinitionService.deleteDefinition(businessType);
        return Result.success(null);
    }

    private Long getCurrentUserId(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof LoginUser loginUser
                && loginUser.getUserId() != null) {
            return loginUser.getUserId();
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new BusinessException("未获取到当前用户");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new BusinessException("未获取到当前用户");
        }
        return userId;
    }
}
