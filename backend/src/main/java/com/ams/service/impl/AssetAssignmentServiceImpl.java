package com.ams.service.impl;

import com.ams.context.TenantContext;
import com.ams.dto.AssetAssignmentCreateDTO;
import com.ams.dto.AssetAssignmentQueryDTO;
import com.ams.dto.AssetAssignmentUpdateDTO;
import com.ams.entity.AssetAssignment;
import com.ams.mapper.AssetAssignmentMapper;
import com.ams.service.AssetAssignmentService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 资产领用归还服务实现。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AssetAssignmentServiceImpl implements AssetAssignmentService {

    private final AssetAssignmentMapper assetAssignmentMapper;

    @Override
    public Page<AssetAssignment> queryPage(AssetAssignmentQueryDTO queryDTO) {
        String tenantId = TenantContext.requireTenantId();
        Page<AssetAssignment> page = new Page<>(queryDTO.getPage(), queryDTO.getPageSize());
        LambdaQueryWrapper<AssetAssignment> wrapper = new LambdaQueryWrapper<AssetAssignment>()
                .eq(AssetAssignment::getTenantId, tenantId);
        if (queryDTO.getStatus() != null && !queryDTO.getStatus().isEmpty()) {
            wrapper.eq(AssetAssignment::getStatus, queryDTO.getStatus());
        }
        if (queryDTO.getAssetId() != null) {
            wrapper.eq(AssetAssignment::getAssetId, queryDTO.getAssetId());
        }
        if (queryDTO.getApplicantId() != null) {
            wrapper.eq(AssetAssignment::getApplicantId, queryDTO.getApplicantId());
        }
        if (queryDTO.getAllocationType() != null && !queryDTO.getAllocationType().isEmpty()) {
            wrapper.eq(AssetAssignment::getAllocationType, queryDTO.getAllocationType());
        }
        wrapper.orderByDesc(AssetAssignment::getCreateTime);
        return assetAssignmentMapper.selectPage(page, wrapper);
    }

    @Override
    public AssetAssignment getDetail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return assetAssignmentMapper.selectOne(new LambdaQueryWrapper<AssetAssignment>()
                .eq(AssetAssignment::getId, id)
                .eq(AssetAssignment::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AssetAssignment create(AssetAssignmentCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        AssetAssignment assignment = new AssetAssignment();
        assignment.setTenantId(tenantId);
        assignment.setAssetId(dto.getAssetId());
        assignment.setAssignedToUserId(dto.getAssignedToUserId());
        assignment.setAssignedToDeptId(dto.getAssignedToDeptId());
        assignment.setExpectedReturnDate(dto.getExpectedReturnDate());
        assignment.setRemark(dto.getRemark());
        assignment.setAllocationType(dto.getAllocationType());
        assignment.setStatus("DRAFT");
        assetAssignmentMapper.insert(assignment);
        return assignment;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AssetAssignment update(Long id, AssetAssignmentUpdateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        AssetAssignment assignment = assetAssignmentMapper.selectOne(new LambdaQueryWrapper<AssetAssignment>()
                .eq(AssetAssignment::getId, id)
                .eq(AssetAssignment::getTenantId, tenantId));
        if (assignment == null) {
            throw new IllegalArgumentException("领用单不存在");
        }
        if (dto.getAssignedToUserId() != null) assignment.setAssignedToUserId(dto.getAssignedToUserId());
        if (dto.getAssignedToDeptId() != null) assignment.setAssignedToDeptId(dto.getAssignedToDeptId());
        if (dto.getExpectedReturnDate() != null) assignment.setExpectedReturnDate(dto.getExpectedReturnDate());
        if (dto.getAllocationType() != null) assignment.setAllocationType(dto.getAllocationType());
        if (dto.getReturnCondition() != null) assignment.setReturnCondition(dto.getReturnCondition());
        if (dto.getRemark() != null) assignment.setRemark(dto.getRemark());
        assetAssignmentMapper.updateById(assignment);
        return assignment;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        assetAssignmentMapper.delete(new LambdaQueryWrapper<AssetAssignment>()
                .eq(AssetAssignment::getId, id)
                .eq(AssetAssignment::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AssetAssignment submit(Long id) {
        AssetAssignment assignment = getDetailOrThrow(id);
        assignment.setStatus("PENDING_APPROVAL");
        assetAssignmentMapper.updateById(assignment);
        return assignment;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AssetAssignment approve(Long id) {
        AssetAssignment assignment = getDetailOrThrow(id);
        assignment.setStatus("APPROVED");
        assignment.setApprovalTime(LocalDateTime.now());
        assetAssignmentMapper.updateById(assignment);
        return assignment;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AssetAssignment reject(Long id, String reason) {
        AssetAssignment assignment = getDetailOrThrow(id);
        assignment.setStatus("REJECTED");
        assignment.setApprovalRemark(reason);
        assignment.setApprovalTime(LocalDateTime.now());
        assetAssignmentMapper.updateById(assignment);
        return assignment;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AssetAssignment checkout(Long id) {
        AssetAssignment assignment = getDetailOrThrow(id);
        assignment.setStatus("CHECKED_OUT");
        assignment.setAssignmentDate(LocalDate.now());
        assetAssignmentMapper.updateById(assignment);
        return assignment;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AssetAssignment returnRequest(Long id) {
        AssetAssignment assignment = getDetailOrThrow(id);
        assignment.setStatus("RETURN_REQUESTED");
        assetAssignmentMapper.updateById(assignment);
        return assignment;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AssetAssignment approveReturn(Long id, String returnCondition) {
        AssetAssignment assignment = getDetailOrThrow(id);
        assignment.setStatus("RETURNED");
        assignment.setActualReturnDate(LocalDate.now());
        if (returnCondition != null) {
            assignment.setReturnCondition(returnCondition);
        }
        assetAssignmentMapper.updateById(assignment);
        return assignment;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AssetAssignment cancel(Long id) {
        AssetAssignment assignment = getDetailOrThrow(id);
        assignment.setStatus("CANCELLED");
        assetAssignmentMapper.updateById(assignment);
        return assignment;
    }

    private AssetAssignment getDetailOrThrow(Long id) {
        AssetAssignment assignment = getDetail(id);
        if (assignment == null) {
            throw new IllegalArgumentException("领用单不存在: id=" + id);
        }
        return assignment;
    }
}
