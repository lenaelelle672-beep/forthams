package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.FaultCode;
import com.ams.mapper.FaultCodeMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FaultCodeService {

    private final FaultCodeMapper faultCodeMapper;

    /**
     * 获取故障代码树（整棵树）
     */
    public List<FaultCode> getTree() {
        String tenantId = TenantContext.requireTenantId();
        List<FaultCode> all = faultCodeMapper.selectAll(tenantId);
        return buildTree(all, null);
    }

    /**
     * 构建树形结构
     */
    private List<FaultCode> buildTree(List<FaultCode> all, Long parentId) {
        List<FaultCode> nodes = new ArrayList<>();
        for (FaultCode fc : all) {
            if (parentId == null ? fc.getParentId() == null : parentId.equals(fc.getParentId())) {
                fc.setChildren(buildTree(all, fc.getId()));
                nodes.add(fc);
            }
        }
        return nodes;
    }

    /**
     * 获取指定节点的子节点（懒加载）
     */
    public List<FaultCode> getChildren(Long parentId) {
        String tenantId = TenantContext.requireTenantId();
        return faultCodeMapper.selectChildren(parentId, tenantId);
    }

    /**
     * 获取指定层级的节点
     */
    public List<FaultCode> getByLevel(Integer level) {
        String tenantId = TenantContext.requireTenantId();
        return faultCodeMapper.selectByLevel(level, tenantId);
    }

    /**
     * 根据ID获取故障代码
     */
    public FaultCode getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return faultCodeMapper.selectOne(new LambdaQueryWrapper<FaultCode>()
                .eq(FaultCode::getId, id)
                .eq(FaultCode::getTenantId, tenantId));
    }

    /**
     * 创建故障代码
     */
    @Transactional(rollbackFor = Exception.class)
    public FaultCode create(FaultCode faultCode) {
        String tenantId = TenantContext.requireTenantId();
        faultCode.setTenantId(tenantId);

        // 校验同级 code 唯一
        if (StringUtils.hasText(faultCode.getCode())) {
            LambdaQueryWrapper<FaultCode> wrapper = new LambdaQueryWrapper<FaultCode>()
                    .eq(FaultCode::getCode, faultCode.getCode())
                    .eq(FaultCode::getTenantId, tenantId)
                    .eq(FaultCode::getDeleted, 0);
            if (faultCodeMapper.selectCount(wrapper) > 0) {
                throw new BusinessException("故障编码已存在: " + faultCode.getCode());
            }
        }

        // 自动计算 level
        if (faultCode.getParentId() != null) {
            FaultCode parent = faultCodeMapper.selectById(faultCode.getParentId());
            if (parent == null) {
                throw new BusinessException("父节点不存在");
            }
            faultCode.setLevel(parent.getLevel() + 1);
            if (faultCode.getLevel() > 3) {
                throw new BusinessException("故障代码层级不能超过3级");
            }
        } else {
            faultCode.setLevel(1);
        }

        if (faultCode.getStatus() == null) {
            faultCode.setStatus("ENABLED");
        }

        faultCodeMapper.insert(faultCode);
        return faultCode;
    }

    /**
     * 更新故障代码
     */
    @Transactional(rollbackFor = Exception.class)
    public FaultCode update(Long id, FaultCode faultCode) {
        String tenantId = TenantContext.requireTenantId();
        FaultCode existing = faultCodeMapper.selectOne(new LambdaQueryWrapper<FaultCode>()
                .eq(FaultCode::getId, id)
                .eq(FaultCode::getTenantId, tenantId));
        if (existing == null) {
            throw new BusinessException("故障代码不存在");
        }

        // 校验 code 唯一（排除自身）
        if (StringUtils.hasText(faultCode.getCode()) && !faultCode.getCode().equals(existing.getCode())) {
            LambdaQueryWrapper<FaultCode> wrapper = new LambdaQueryWrapper<FaultCode>()
                    .eq(FaultCode::getCode, faultCode.getCode())
                    .eq(FaultCode::getTenantId, tenantId)
                    .eq(FaultCode::getDeleted, 0)
                    .ne(FaultCode::getId, id);
            if (faultCodeMapper.selectCount(wrapper) > 0) {
                throw new BusinessException("故障编码已存在: " + faultCode.getCode());
            }
        }

        faultCode.setId(id);
        faultCode.setTenantId(tenantId);
        faultCodeMapper.updateById(faultCode);
        return faultCode;
    }

    /**
     * 删除故障代码（禁止删除有子节点的）
     */
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        FaultCode existing = faultCodeMapper.selectOne(new LambdaQueryWrapper<FaultCode>()
                .eq(FaultCode::getId, id)
                .eq(FaultCode::getTenantId, tenantId));
        if (existing == null) {
            throw new BusinessException("故障代码不存在");
        }

        // 检查是否有子节点
        int childCount = faultCodeMapper.countChildren(id, tenantId);
        if (childCount > 0) {
            throw new BusinessException("该节点下有子节点，禁止删除");
        }

        faultCodeMapper.delete(new LambdaQueryWrapper<FaultCode>()
                .eq(FaultCode::getId, id)
                .eq(FaultCode::getTenantId, tenantId));
    }
}
