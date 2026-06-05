package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.annotation.DataScope;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ExecutionMaterialCreateDTO;
import com.ams.entity.MaintenanceExecutionMaterial;
import com.ams.mapper.MaintenanceExecutionMaterialMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * 物料/备件使用记录管理服务。
 *
 * <p>提供维保施工物料使用记录的 CRUD 和费用汇总。
 * 对客户端提交的 totalPrice 做后端校验，防止篡改。
 */
@Service
@RequiredArgsConstructor
public class MaintenanceExecutionMaterialService {

    /** totalPrice 与 quantity*unitPrice 偏差阈值 */
    private static final BigDecimal TOTAL_PRICE_THRESHOLD = new BigDecimal("0.01");

    private final MaintenanceExecutionMaterialMapper materialMapper;

    /**
     * 获取指定执行的物料列表。
     */
    @DataScope(userColumn = "create_by")
    public List<MaintenanceExecutionMaterial> getMaterials(Long executionId) {
        String tenantId = TenantContext.requireTenantId();
        return materialMapper.selectList(
                new LambdaQueryWrapper<MaintenanceExecutionMaterial>()
                        .eq(MaintenanceExecutionMaterial::getTenantId, tenantId)
                        .eq(MaintenanceExecutionMaterial::getExecutionId, executionId));
    }

    /**
     * 添加物料记录。
     *
     * <p>若客户端提交的 totalPrice 与 quantity*unitPrice 计算值偏差超过阈值，
     * 使用后端计算值覆盖客户端提交值，防止篡改。
     */
    @Transactional(rollbackFor = Exception.class)
    public MaintenanceExecutionMaterial addMaterial(ExecutionMaterialCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        MaintenanceExecutionMaterial material = new MaintenanceExecutionMaterial();
        BeanUtil.copyProperties(dto, material);
        material.setTenantId(tenantId);

        // 后端校验 totalPrice：如果偏差超过阈值，以后端计算值为准
        if (material.getQuantity() != null && material.getUnitPrice() != null) {
            BigDecimal calculatedTotal = material.getQuantity().multiply(material.getUnitPrice());
            if (material.getTotalPrice() == null
                    || calculatedTotal.subtract(material.getTotalPrice()).abs().compareTo(TOTAL_PRICE_THRESHOLD) > 0) {
                material.setTotalPrice(calculatedTotal);
            }
        } else if (material.getTotalPrice() == null) {
            material.setTotalPrice(BigDecimal.ZERO);
        }

        materialMapper.insert(material);
        return material;
    }

    /**
     * 删除物料记录（逻辑删除）。
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteMaterial(Long materialId) {
        getMaterialById(materialId);
        materialMapper.deleteById(materialId);
    }

    /**
     * 计算指定执行的物料总费用。
     */
    public BigDecimal getTotalCost(Long executionId) {
        String tenantId = TenantContext.requireTenantId();
        List<MaintenanceExecutionMaterial> materials = materialMapper.selectList(
                new LambdaQueryWrapper<MaintenanceExecutionMaterial>()
                        .eq(MaintenanceExecutionMaterial::getTenantId, tenantId)
                        .eq(MaintenanceExecutionMaterial::getExecutionId, executionId));
        return materials.stream()
                .map(m -> m.getTotalPrice() != null ? m.getTotalPrice() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private MaintenanceExecutionMaterial getMaterialById(Long materialId) {
        String tenantId = TenantContext.requireTenantId();
        MaintenanceExecutionMaterial material = materialMapper.selectOne(
                new LambdaQueryWrapper<MaintenanceExecutionMaterial>()
                        .eq(MaintenanceExecutionMaterial::getId, materialId)
                        .eq(MaintenanceExecutionMaterial::getTenantId, tenantId));
        if (material == null) {
            throw new BusinessException("物料记录不存在");
        }
        return material;
    }
}
