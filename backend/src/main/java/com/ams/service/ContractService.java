package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.Contract;
import com.ams.mapper.ContractMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ContractService {

    private final ContractMapper contractMapper;
    private final NotificationService notificationService;

    public Page<Contract> getPage(Integer page, Integer pageSize, String keyword,
                                   String contractType, String status, Long vendorId) {
        LambdaQueryWrapper<Contract> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            wrapper.like(Contract::getContractName, keyword)
                   .or().like(Contract::getContractNo, keyword);
        }
        if (contractType != null && !contractType.isBlank()) {
            wrapper.eq(Contract::getContractType, contractType);
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq(Contract::getStatus, status);
        }
        if (vendorId != null) {
            wrapper.eq(Contract::getVendorId, vendorId);
        }
        wrapper.orderByDesc(Contract::getCreatedAt);
        return contractMapper.selectPage(new Page<>(page, pageSize), wrapper);
    }

    public Contract getById(Long id) {
        Contract c = contractMapper.selectById(id);
        if (c == null) throw new BusinessException("合同不存在");
        return c;
    }

    public List<Contract> getExpiring(Integer days) {
        LocalDate today = LocalDate.now();
        LocalDate future = today.plusDays(days == null ? 30 : days);
        return contractMapper.findExpiring(today, future);
    }

    public Contract create(Contract c) {
        if (c.getContractNo() != null) {
            Long cnt = contractMapper.selectCount(new LambdaQueryWrapper<Contract>()
                    .eq(Contract::getContractNo, c.getContractNo()));
            if (cnt > 0) throw new BusinessException("合同编号已存在: " + c.getContractNo());
        }
        if (c.getStatus() == null) c.setStatus("DRAFT");
        contractMapper.insert(c);
        return c;
    }

    public Contract update(Long id, Contract c) {
        getById(id);
        c.setId(id);
        contractMapper.updateById(c);
        return c;
    }

    public void delete(Long id) {
        getById(id);
        contractMapper.deleteById(id);
    }

    /**
     * 通知即将到期的合同
     */
    public int notifyExpiringContracts(List<Contract> contracts) {
        if (contracts == null || contracts.isEmpty()) return 0;
        int notified = 0;
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        for (Contract c : contracts) {
            try {
                long daysLeft = ChronoUnit.DAYS.between(LocalDate.now(), c.getEndDate());
                Map<String, Object> variables = new HashMap<>();
                variables.put("contractName", c.getContractName());
                variables.put("contractNo", c.getContractNo());
                variables.put("endDate", c.getEndDate().format(formatter));
                variables.put("daysLeft", daysLeft);
                notificationService.sendByTemplateToRole(
                        "CONTRACT_EXPIRING", "ASSET_MANAGER",
                        variables, c.getId(), "contract");
                notified++;
            } catch (Exception ignored) {
                // 单条合同通知失败不阻塞
            }
        }
        return notified;
    }
}
