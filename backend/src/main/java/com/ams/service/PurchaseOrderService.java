package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.PurchaseOrderCreateDTO;
import com.ams.dto.PurchaseOrderUpdateDTO;
import com.ams.entity.PurchaseOrder;
import com.ams.entity.PurchaseOrderItem;
import com.ams.mapper.PurchaseOrderItemMapper;
import com.ams.mapper.PurchaseOrderMapper;
import com.ams.mapper.VendorMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PurchaseOrderService {

    private final PurchaseOrderMapper purchaseOrderMapper;
    private final PurchaseOrderItemMapper purchaseOrderItemMapper;
    private final VendorMapper vendorMapper;

    public Page<PurchaseOrder> getPage(Integer page, Integer pageSize, String keyword,
                                        String orderNo, String status, Long vendorId,
                                        String startDate, String endDate) {
        LambdaQueryWrapper<PurchaseOrder> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            wrapper.like(PurchaseOrder::getOrderNo, keyword)
                   .or().like(PurchaseOrder::getOrderName, keyword);
        }
        if (orderNo != null && !orderNo.isBlank()) {
            wrapper.like(PurchaseOrder::getOrderNo, orderNo);
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq(PurchaseOrder::getStatus, status);
        }
        if (vendorId != null) {
            wrapper.eq(PurchaseOrder::getVendorId, vendorId);
        }
        if (startDate != null && !startDate.isBlank()) {
            wrapper.ge(PurchaseOrder::getOrderDate, startDate);
        }
        if (endDate != null && !endDate.isBlank()) {
            wrapper.le(PurchaseOrder::getOrderDate, endDate);
        }
        wrapper.orderByDesc(PurchaseOrder::getCreatedAt);

        Page<PurchaseOrder> result = purchaseOrderMapper.selectPage(new Page<>(page, pageSize), wrapper);
        result.getRecords().forEach(this::attachVendorName);
        return result;
    }

    public PurchaseOrder getById(Long id) {
        PurchaseOrder order = purchaseOrderMapper.selectById(id);
        if (order == null) {
            throw new BusinessException("采购订单不存在");
        }
        attachVendorName(order);
        return order;
    }

    public List<PurchaseOrderItem> getItemsByOrderId(Long orderId) {
        return purchaseOrderItemMapper.selectList(
                new LambdaQueryWrapper<PurchaseOrderItem>()
                        .eq(PurchaseOrderItem::getOrderId, orderId));
    }

    public Map<String, Object> getDetail(Long id) {
        PurchaseOrder order = getById(id);
        List<PurchaseOrderItem> items = getItemsByOrderId(id);
        return Map.of("order", order, "items", items);
    }

    @Transactional(rollbackFor = Exception.class)
    public PurchaseOrder create(PurchaseOrderCreateDTO dto) {
        Long count = purchaseOrderMapper.selectCount(
                new LambdaQueryWrapper<PurchaseOrder>()
                        .eq(PurchaseOrder::getOrderNo, dto.getOrderNo()));
        if (count > 0) {
            throw new BusinessException("采购单号已存在: " + dto.getOrderNo());
        }

        PurchaseOrder order = new PurchaseOrder();
        order.setOrderNo(dto.getOrderNo());
        order.setOrderName(dto.getOrderName());
        order.setVendorId(dto.getVendorId());
        order.setOrderDate(dto.getOrderDate());
        order.setExpectedDate(dto.getExpectedDate());
        order.setRemark(dto.getRemark());
        order.setStatus("DRAFT");

        BigDecimal total = BigDecimal.ZERO;
        if (dto.getItems() != null) {
            for (PurchaseOrderItem item : dto.getItems()) {
                BigDecimal amount = item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
                item.setAmount(amount);
                total = total.add(amount);
            }
        }
        order.setTotalAmount(total);

        purchaseOrderMapper.insert(order);

        if (dto.getItems() != null) {
            for (PurchaseOrderItem item : dto.getItems()) {
                item.setId(null);
                item.setOrderId(order.getId());
                purchaseOrderItemMapper.insert(item);
            }
        }

        return order;
    }

    @Transactional(rollbackFor = Exception.class)
    public PurchaseOrder update(Long id, PurchaseOrderUpdateDTO dto) {
        PurchaseOrder existing = getById(id);
        if (!"DRAFT".equals(existing.getStatus())) {
            throw new BusinessException("只有草稿状态的采购单可以编辑");
        }

        if (dto.getOrderName() != null) existing.setOrderName(dto.getOrderName());
        if (dto.getTotalAmount() != null) existing.setTotalAmount(dto.getTotalAmount());
        if (dto.getOrderDate() != null) existing.setOrderDate(dto.getOrderDate());
        if (dto.getExpectedDate() != null) existing.setExpectedDate(dto.getExpectedDate());
        if (dto.getRemark() != null) existing.setRemark(dto.getRemark());

        purchaseOrderMapper.updateById(existing);
        return existing;
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        getById(id);
        purchaseOrderMapper.deleteById(id);
        purchaseOrderItemMapper.delete(
                new LambdaQueryWrapper<PurchaseOrderItem>()
                        .eq(PurchaseOrderItem::getOrderId, id));
    }

    @Transactional(rollbackFor = Exception.class)
    public PurchaseOrder submit(Long id) {
        PurchaseOrder order = getById(id);
        if (!"DRAFT".equals(order.getStatus())) {
            throw new BusinessException("只有草稿状态的采购单可以提交");
        }
        order.setStatus("PENDING");
        purchaseOrderMapper.updateById(order);
        return order;
    }

    @Transactional(rollbackFor = Exception.class)
    public PurchaseOrder approve(Long id) {
        PurchaseOrder order = getById(id);
        if (!"PENDING".equals(order.getStatus())) {
            throw new BusinessException("只有待审批状态的采购单可以审批通过");
        }
        order.setStatus("APPROVED");
        purchaseOrderMapper.updateById(order);
        return order;
    }

    @Transactional(rollbackFor = Exception.class)
    public PurchaseOrder receive(Long id) {
        PurchaseOrder order = getById(id);
        if (!"APPROVED".equals(order.getStatus())) {
            throw new BusinessException("只有已审批的采购单可以收货");
        }
        order.setStatus("RECEIVED");
        purchaseOrderMapper.updateById(order);
        return order;
    }

    @Transactional(rollbackFor = Exception.class)
    public PurchaseOrder cancel(Long id) {
        PurchaseOrder order = getById(id);
        if ("RECEIVED".equals(order.getStatus()) || "CANCELLED".equals(order.getStatus())) {
            throw new BusinessException("已收货或已取消的采购单无法取消");
        }
        order.setStatus("CANCELLED");
        purchaseOrderMapper.updateById(order);
        return order;
    }

    public Map<String, Object> getStats() {
        Long total = purchaseOrderMapper.selectCount(null);
        Long pendingCount = purchaseOrderMapper.selectCount(
                new LambdaQueryWrapper<PurchaseOrder>().eq(PurchaseOrder::getStatus, "PENDING"));
        Long approvedCount = purchaseOrderMapper.selectCount(
                new LambdaQueryWrapper<PurchaseOrder>().eq(PurchaseOrder::getStatus, "APPROVED"));
        return Map.of("totalOrders", total, "pendingApproval", pendingCount, "approved", approvedCount);
    }

    private void attachVendorName(PurchaseOrder order) {
        if (order.getVendorId() != null) {
            try {
                var vendor = vendorMapper.selectById(order.getVendorId());
                if (vendor != null) {
                    order.setVendorName(vendor.getName());
                }
            } catch (Exception ignored) {
            }
        }
    }
}
