package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemAlertDTO;
import com.ams.dto.SystemAlertStatusRequest;
import com.ams.entity.SystemAlert;
import com.ams.mapper.SystemAlertMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class SystemAlertService {

    private static final String STATUS_CLOSED = "CLOSED";
    private static final String STATUS_READ = "READ";

    private final SystemAlertMapper systemAlertMapper;

    public SystemAlertDTO getById(Long id) {
        return SystemAlertDTO.from(requireAlert(id));
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemAlertDTO updateStatus(Long id, SystemAlertStatusRequest request, Long operatorId) {
        if (request == null || request.getStatus() == null || request.getStatus().isBlank()) {
            throw new BusinessException("告警状态不能为空");
        }
        SystemAlert alert = requireAlert(id);
        String status = request.getStatus();
        if (STATUS_CLOSED.equals(status) && STATUS_CLOSED.equals(alert.getStatus())) {
            return SystemAlertDTO.from(alert);
        }
        if (STATUS_READ.equals(status)) {
            markRead(alert, operatorId);
        } else if (STATUS_CLOSED.equals(status)) {
            alert.setStatus(STATUS_CLOSED);
            alert.setClosedAt(LocalDateTime.now());
            alert.setClosedBy(operatorId);
            if (!Boolean.TRUE.equals(alert.getRead())) {
                markRead(alert, operatorId);
            }
        } else {
            alert.setStatus(status);
        }
        systemAlertMapper.updateById(alert);
        return SystemAlertDTO.from(alert);
    }

    private SystemAlert requireAlert(Long id) {
        String tenantId = TenantContext.requireTenantId();
        SystemAlert alert = systemAlertMapper.selectOne(new QueryWrapper<SystemAlert>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (alert == null) {
            throw new BusinessException("系统告警不存在");
        }
        return alert;
    }

    private void markRead(SystemAlert alert, Long operatorId) {
        alert.setRead(true);
        alert.setReadAt(LocalDateTime.now());
        alert.setReadBy(operatorId);
    }
}
