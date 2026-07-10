package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SysTenantDTO;
import com.ams.entity.SysTenant;
import com.ams.mapper.SysTenantMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 租户主数据只读查询。
 *
 * 提供租户目录列表、详情与"当前租户"查询（后者供 UserProfilePage 展示租户名）。
 * 全部只读，不提供 create/update/suspend/activate（V3 只读 catalog 边界）。
 */
@Service
@RequiredArgsConstructor
public class SysTenantService {

    private final SysTenantMapper sysTenantMapper;

    public SysTenantDTO.PageResult list(String keyword, String status, int page, int pageSize) {
        int safePage = Math.max(page, 1);
        int safePageSize = pageSize <= 0 ? 20 : Math.min(pageSize, 200);
        int offset = (safePage - 1) * safePageSize;

        long total = sysTenantMapper.count(trim(keyword), trim(status));
        List<SysTenant> tenants = sysTenantMapper.selectPage(trim(keyword), trim(status), safePageSize, offset);

        SysTenantDTO.PageResult result = new SysTenantDTO.PageResult();
        result.setTotal(total);
        result.setRecords(tenants.stream().map(this::toDTO).toList());
        return result;
    }

    public SysTenantDTO detail(String id) {
        SysTenant tenant = sysTenantMapper.selectById(requireNonBlank(id));
        if (tenant == null) {
            throw new BusinessException("租户不存在");
        }
        return toDTO(tenant);
    }

    /** 当前租户，供 UserProfilePage 展示。基于 TenantContext（JWT 注入）。 */
    public SysTenantDTO current() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException("未获取到当前租户");
        }
        SysTenant tenant = sysTenantMapper.selectById(tenantId);
        if (tenant == null) {
            throw new BusinessException("当前租户主数据不存在");
        }
        return toDTO(tenant);
    }

    public SysTenantDTO.Meta meta() {
        SysTenantDTO.Meta meta = new SysTenantDTO.Meta();
        meta.setPlans(List.of("STANDARD", "PROFESSIONAL", "ENTERPRISE"));
        meta.setStatuses(List.of("ACTIVE", "SUSPENDED"));
        meta.setReadOnlyNotice("租户管理为只读 catalog；新建、编辑、停用、启用等写操作不在 V3 只读边界内。");
        return meta;
    }

    private SysTenantDTO toDTO(SysTenant tenant) {
        SysTenantDTO dto = new SysTenantDTO();
        dto.setId(tenant.getId());
        dto.setName(tenant.getName());
        dto.setPlan(tenant.getPlan());
        dto.setMaxUsers(tenant.getMaxUsers());
        dto.setMaxAssets(tenant.getMaxAssets());
        dto.setStatus(tenant.getStatus());
        dto.setContactName(tenant.getContactName());
        dto.setContactPhone(tenant.getContactPhone());
        dto.setContactEmail(tenant.getContactEmail());
        dto.setCreatedAt(tenant.getCreatedAt());
        dto.setUpdatedAt(tenant.getUpdatedAt());
        return dto;
    }

    private String trim(String value) {
        return value == null ? null : value.trim().isEmpty() ? null : value.trim();
    }

    private String requireNonBlank(String id) {
        if (id == null || id.isBlank()) {
            throw new BusinessException("租户标识不能为空");
        }
        return id.trim();
    }
}
